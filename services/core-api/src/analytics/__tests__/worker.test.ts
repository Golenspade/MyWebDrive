import { PrismaClient } from '@prisma/client'
import { createAnalyticsWorkerMetrics, createAppTelemetry } from '@mywebdrive/observability'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { AnalyticsWorkerState, runAnalyticsWorker } from '../worker.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const fixedNow = new Date('2026-07-12T12:00:00.000Z')

integration('analytics worker', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } })
    await prisma.$connect()
  })

  beforeEach(async () => {
    await prisma.analyticsEventReceipt.deleteMany()
    await prisma.analyticsDailyActiveUser.deleteMany()
    await prisma.analyticsDaily.deleteMany()
    await prisma.outboxEvent.deleteMany()
  })

  afterAll(async () => {
    await prisma.analyticsEventReceipt.deleteMany()
    await prisma.analyticsDaily.deleteMany()
    await prisma.outboxEvent.deleteMany()
    await prisma.$disconnect()
  })

  test('processes only a bounded batch and marks successful rows after projection', async () => {
    await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        prisma.outboxEvent.create({
          data: {
            dedupeKey: `file.version.created:batch-${index}`,
            topic: 'file.version.created',
            aggregateId: `file-${index}`,
            occurredAt: fixedNow,
            availableAt: fixedNow,
            payload: { sizeBytes: '1' },
          },
        }),
      ),
    )
    const controller = new AbortController()
    const sleep = vi.fn(async () => controller.abort())

    await runAnalyticsWorker({
      prisma,
      signal: controller.signal,
      now: () => fixedNow,
      sleep,
      batchSize: 2,
    })

    expect(sleep).toHaveBeenCalledTimes(1)
    expect(await prisma.outboxEvent.count({ where: { processedAt: fixedNow } })).toBe(2)
    expect(await prisma.analyticsEventReceipt.count()).toBe(2)
  })

  test('backs off a poison event, sanitizes its error and continues with later events', async () => {
    await prisma.outboxEvent.create({
      data: {
        dedupeKey: 'file.version.created:poison',
        topic: 'file.version.created',
        aggregateId: 'file-poison',
        occurredAt: fixedNow,
        availableAt: fixedNow,
        payload: { sizeBytes: 'secret malformed value' },
      },
    })
    await prisma.outboxEvent.create({
      data: {
        dedupeKey: 'user.created:later',
        topic: 'user.created',
        aggregateId: 'later',
        occurredAt: new Date(fixedNow.getTime() + 1),
        availableAt: fixedNow,
        payload: { userId: 'later' },
      },
    })
    const controller = new AbortController()

    await runAnalyticsWorker({
      prisma,
      signal: controller.signal,
      now: () => fixedNow,
      sleep: async () => controller.abort(),
      batchSize: 2,
    })

    const poison = await prisma.outboxEvent.findUniqueOrThrow({
      where: { dedupeKey: 'file.version.created:poison' },
    })
    expect(poison).toMatchObject({
      attempts: 1,
      processedAt: null,
      lastErrorCode: 'INVALID_EVENT_PAYLOAD',
      availableAt: new Date('2026-07-12T12:00:01.000Z'),
    })
    expect(
      await prisma.outboxEvent.findUniqueOrThrow({
        where: { dedupeKey: 'user.created:later' },
      }),
    ).toMatchObject({ processedAt: fixedNow })
  })

  test('caps retry delay at sixty seconds', async () => {
    await prisma.outboxEvent.create({
      data: {
        dedupeKey: 'file.version.created:capped',
        topic: 'file.version.created',
        aggregateId: 'file-capped',
        attempts: 99,
        occurredAt: fixedNow,
        availableAt: fixedNow,
        payload: { sizeBytes: '-1' },
      },
    })
    const controller = new AbortController()

    await runAnalyticsWorker({
      prisma,
      signal: controller.signal,
      now: () => fixedNow,
      sleep: async () => controller.abort(),
      batchSize: 1,
    })

    expect(
      await prisma.outboxEvent.findUniqueOrThrow({
        where: { dedupeKey: 'file.version.created:capped' },
      }),
    ).toMatchObject({
      attempts: 100,
      availableAt: new Date('2026-07-12T12:01:00.000Z'),
    })
  })
})

describe('analytics worker claiming', () => {
  test('updates bounded processed, retried, failed, and lag metrics', async () => {
    const controller = new AbortController()
    const telemetry = createAppTelemetry({ service: 'analytics-worker' })
    const metrics = createAnalyticsWorkerMetrics(telemetry.register)
    const baseEvent = {
      id: 'event-1',
      dedupeKey: 'user.created:user-1',
      topic: 'user.created',
      aggregateId: 'user-1',
      payload: { userId: 'user-1' },
      attempts: 0,
      availableAt: fixedNow,
      processedAt: null,
      lastErrorCode: null,
      createdAt: new Date(fixedNow.getTime() - 5_000),
      occurredAt: new Date(fixedNow.getTime() - 4_000),
    }
    const events = [
      baseEvent,
      {
        ...baseEvent,
        id: 'event-2',
        dedupeKey: 'file.version.created:file-2',
        topic: 'file.version.created',
        payload: { sizeBytes: 'invalid' },
      },
    ]
    const tx = {
      $queryRaw: vi.fn(async () => events.length > 0 ? [events.shift()] : []),
      analyticsEventReceipt: { createMany: vi.fn(async () => ({ count: 1 })) },
      analyticsDaily: { upsert: vi.fn(async () => undefined) },
      outboxEvent: { update: vi.fn(async () => undefined) },
    }
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      outboxEvent: { updateMany: vi.fn(async () => ({ count: 1 })) },
    } as unknown as PrismaClient

    await runAnalyticsWorker({
      prisma,
      signal: controller.signal,
      now: () => fixedNow,
      sleep: async () => controller.abort(),
      batchSize: 3,
      metrics,
    })

    const output = await telemetry.register.metrics()
    expect(output).toMatch(/analytics_worker_events_total\{[^}]*outcome="processed"[^}]*\} 1/)
    expect(output).toMatch(/analytics_worker_events_total\{[^}]*outcome="retried"[^}]*\} 1/)
    expect(output).toMatch(/analytics_projection_lag_seconds\{[^}]*\} 4/)
    expect(output).toMatch(/analytics_oldest_outbox_age_seconds\{[^}]*\} 5/)

    const failedTelemetry = createAppTelemetry({ service: 'analytics-worker-failed' })
    const failedMetrics = createAnalyticsWorkerMetrics(failedTelemetry.register)
    await expect(runAnalyticsWorker({
      prisma: {
        $transaction: vi.fn(async () => { throw new Error('database unavailable') }),
      } as unknown as PrismaClient,
      signal: new AbortController().signal,
      now: () => fixedNow,
      sleep: async () => undefined,
      batchSize: 1,
      metrics: failedMetrics,
    })).rejects.toThrow('database unavailable')
    expect(await failedTelemetry.register.metrics()).toMatch(
      /analytics_worker_events_total\{[^}]*outcome="failed"[^}]*\} 1/,
    )
  })

  test('becomes ready only after a successful poll and stops cleanly', async () => {
    const controller = new AbortController()
    const state = new AnalyticsWorkerState()
    const tx = { $queryRaw: vi.fn(async () => []) }
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient

    expect(state.isReady()).toBe(false)
    await runAnalyticsWorker({
      prisma,
      signal: controller.signal,
      now: () => fixedNow,
      sleep: async () => {
        expect(state.isReady()).toBe(true)
        controller.abort()
      },
      batchSize: 1,
      state,
    })
    expect(state.isReady()).toBe(false)
  })

  test('uses FOR UPDATE SKIP LOCKED and claims only supported topics', async () => {
    const controller = new AbortController()
    let queryText = ''
    const tx = {
      $queryRaw: vi.fn(async (query: { sql: string }) => {
        queryText = query.sql
        return []
      }),
    }
    const mockPrisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient

    await runAnalyticsWorker({
      prisma: mockPrisma,
      signal: controller.signal,
      now: () => fixedNow,
      sleep: async () => controller.abort(),
      batchSize: 5,
    })

    expect(queryText).toContain('FOR UPDATE SKIP LOCKED')
    for (const topic of [
      'user.created',
      'user.activity.recorded',
      'file.version.created',
      'download.completed',
    ]) {
      expect(queryText).toContain(topic)
    }
  })
})
