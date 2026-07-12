import type { PrismaClient } from '@prisma/client'
import express from 'express'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { issueAccessToken } from '../../auth/access-token.js'
import type { PrometheusHealthClient } from '../prometheus.js'
import { createSystemHealthRouter } from '../router.js'
import { createPrismaSystemHealthRepository } from '../service.js'

const now = new Date('2026-07-12T12:00:00.000Z')
const sessionSecret = 'system-health-session-secret-at-least-32-bytes'

function prometheus(
  result: Awaited<ReturnType<PrometheusHealthClient['querySystemHealth']>>,
): PrometheusHealthClient {
  return { querySystemHealth: vi.fn(async () => result) }
}

function prisma(input?: {
  role?: string
  pending?: bigint
  oldestCreatedAt?: Date | null
  analyticsCreatedAt?: Date | null
  unknownDownloads?: bigint
  failPipeline?: boolean
}) {
  let findCall = 0
  return {
    user: {
      findUnique: vi.fn(async () => ({
        id: 'admin-id',
        email: 'admin@example.test',
        role: input?.role ?? 'admin',
        status: 'active',
      })),
    },
    outboxEvent: {
      count: vi.fn(async () => {
        if (input?.failPipeline) throw new Error('db unavailable')
        return input?.pending ?? 0
      }),
      findFirst: vi.fn(async () => {
        if (input?.failPipeline) throw new Error('db unavailable')
        findCall += 1
        return findCall === 1
          ? input?.oldestCreatedAt
            ? { createdAt: input.oldestCreatedAt }
            : null
          : input?.analyticsCreatedAt
            ? { createdAt: input.analyticsCreatedAt }
            : null
      }),
    },
    $queryRaw: vi.fn(async () => {
      if (input?.failPipeline) throw new Error('db unavailable')
      return [{ count: input?.unknownDownloads ?? 0n }]
    }),
  } as unknown as PrismaClient
}

function app(input: { prisma: PrismaClient; prometheus: PrometheusHealthClient }) {
  const app = express()
  app.use(
    '/api/v1',
    createSystemHealthRouter({
      ...input,
      sessionSecret,
      now: () => now,
    }),
  )
  return app
}

function token(role = 'admin') {
  return issueAccessToken({ id: 'admin-id', role }, sessionSecret)
}

const availablePrometheus = prometheus({
  availability: 'available',
  traffic: {
    requestsCount: '1200',
    errorsCount: '3',
    errorRate: 0.0025,
    p95Ms: 85,
    p99Ms: 190,
  },
  services: [
    { name: 'core-api', up: true },
    { name: 'storage-api', up: true },
    { name: 'storage-worker', up: true },
  ],
})

describe('system health router', () => {
  test('counts unknown downloads by unknownAt transition time rather than ticket issue time', async () => {
    const queryRaw = vi.fn(async (
      _strings: TemplateStringsArray,
      ..._values: unknown[]
    ) => [{ count: 0n }])
    const repository = createPrismaSystemHealthRepository({
      $queryRaw: queryRaw,
    } as unknown as PrismaClient)
    const start = new Date('2026-07-12T00:00:00.000Z')
    const end = new Date('2026-07-13T00:00:00.000Z')

    await repository.countUnknownDownloads(start, end)

    const call = queryRaw.mock.calls[0]
    if (!call) throw new Error('missing unknown download query')
    const [strings, ...values] = call
    expect(Array.from(strings).join('?')).toContain('"unknownAt" >= ?')
    expect(Array.from(strings).join('?')).not.toContain('"issuedAt"')
    expect(values).toEqual([start, end])
  })

  test('analytics lag includes unprocessed analytics events delayed by retry backoff', async () => {
    const createdAt = new Date(now.getTime() - 30_000)
    const findFirst = vi.fn(async () => ({ createdAt }))
    const repository = createPrismaSystemHealthRepository({
      outboxEvent: { findFirst },
    } as unknown as PrismaClient)

    const result = await repository.findOldestUnprocessedAnalyticsEvent()

    expect(result).toEqual(createdAt)
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        processedAt: null,
        topic: {
          in: [
            'user.created',
            'user.activity.recorded',
            'file.version.created',
            'download.completed',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    })
  })

  test('returns the exact admin system-health contract', async () => {
    const response = await request(
      app({
        prisma: prisma({
          pending: 2n,
          oldestCreatedAt: new Date(now.getTime() - 4_900),
          analyticsCreatedAt: new Date(now.getTime() - 2_900),
          unknownDownloads: 0n,
        }),
        prometheus: availablePrometheus,
      }),
    )
      .get('/api/v1/admin/dashboard/system?range=7d')
      .set('Authorization', `Bearer ${token()}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      range: { kind: '7d', timezone: 'Asia/Shanghai' },
      generatedAt: now.toISOString(),
      availability: 'available',
      traffic: {
        requestsCount: '1200',
        errorsCount: '3',
        errorRate: 0.0025,
        p95Ms: 85,
        p99Ms: 190,
      },
      pipeline: {
        outboxPending: '2',
        oldestOutboxAgeSeconds: 4,
        analyticsLagSeconds: 2,
        downloadTelemetry: 'healthy',
      },
      services: [
        { name: 'core-api', up: true },
        { name: 'storage-api', up: true },
        { name: 'storage-worker', up: true },
      ],
    })
  })

  test('uses live Core admin authorization', async () => {
    await request(app({ prisma: prisma({ role: 'user' }), prometheus: availablePrometheus }))
      .get('/api/v1/admin/dashboard/system?range=today')
      .set('Authorization', `Bearer ${token('user')}`)
      .expect(403, { error: 'admin access required' })
  })

  test('returns partial with nullable fields when Prometheus and one pipeline query fail', async () => {
    const partialPrometheus = prometheus({
      availability: 'partial',
      traffic: {
        requestsCount: '10',
        errorsCount: null,
        errorRate: null,
        p95Ms: 5,
        p99Ms: null,
      },
      services: [
        { name: 'core-api', up: true },
        { name: 'storage-api', up: null },
        { name: 'storage-worker', up: null },
      ],
    })
    const database = prisma({ pending: 1n, unknownDownloads: 1n }) as PrismaClient & {
      outboxEvent: { findFirst: ReturnType<typeof vi.fn> }
    }
    database.outboxEvent.findFirst.mockRejectedValueOnce(new Error('oldest query failed'))

    const response = await request(app({ prisma: database, prometheus: partialPrometheus }))
      .get('/api/v1/admin/dashboard/system?range=30d')
      .set('Authorization', `Bearer ${token()}`)

    expect(response.status).toBe(200)
    expect(response.body.availability).toBe('partial')
    expect(response.body.pipeline).toEqual({
      outboxPending: '1',
      oldestOutboxAgeSeconds: null,
      analyticsLagSeconds: 0,
      downloadTelemetry: 'degraded',
    })
  })

  test('returns 503 only when neither Prometheus nor a pipeline query establishes a result', async () => {
    const unavailablePrometheus = prometheus({
      availability: 'unavailable',
      traffic: {
        requestsCount: null,
        errorsCount: null,
        errorRate: null,
        p95Ms: null,
        p99Ms: null,
      },
      services: [
        { name: 'core-api', up: null },
        { name: 'storage-api', up: null },
        { name: 'storage-worker', up: null },
      ],
    })
    const response = await request(
      app({ prisma: prisma({ failPipeline: true }), prometheus: unavailablePrometheus }),
    )
      .get('/api/v1/admin/dashboard/system?range=today')
      .set('Authorization', `Bearer ${token()}`)

    expect(response.status).toBe(503)
    expect(response.body.availability).toBe('unavailable')
    expect(response.body.pipeline).toEqual({
      outboxPending: null,
      oldestOutboxAgeSeconds: null,
      analyticsLagSeconds: null,
      downloadTelemetry: 'unknown',
    })
  })

  test('rejects an unsupported range before querying health sources', async () => {
    await request(app({ prisma: prisma(), prometheus: availablePrometheus }))
      .get('/api/v1/admin/dashboard/system?range=90d')
      .set('Authorization', `Bearer ${token()}`)
      .expect(400, { error: 'invalid dashboard range' })
  })
})
