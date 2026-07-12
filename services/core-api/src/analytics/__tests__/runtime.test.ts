import type { PrismaClient } from '@prisma/client'
import { createAppTelemetry } from '@mywebdrive/observability'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import {
  createAnalyticsWorkerHealthApp,
  runDownloadAttemptTimeoutLoop,
} from '../runtime.js'
import { AnalyticsWorkerState } from '../worker.js'

describe('analytics worker runtime health', () => {
  test('periodically moves stale started download attempts to unknown', async () => {
    const now = new Date('2026-07-12T12:00:00.000Z')
    const controller = new AbortController()
    const sweep = vi.fn(async () => 2)

    await runDownloadAttemptTimeoutLoop({
      signal: controller.signal,
      now: () => now,
      sleep: async () => controller.abort(),
      sweep,
      timeoutMilliseconds: 5 * 60 * 1000,
      intervalMilliseconds: 60 * 1000,
    })

    expect(sweep).toHaveBeenCalledWith({
      startedBefore: new Date('2026-07-12T11:55:00.000Z'),
      now,
    })
  })

  test('becomes ready after a successful worker poll and exposes private metrics', async () => {
    const state = new AnalyticsWorkerState()
    const prisma = {
      $queryRawUnsafe: vi.fn(async () => [{ '?column?': 1 }]),
    } as unknown as PrismaClient
    const telemetry = createAppTelemetry({ service: 'analytics-worker' })
    const app = createAnalyticsWorkerHealthApp({ prisma, state, telemetry })

    await request(app).get('/live').expect(200, {
      status: 'live',
      service: 'analytics-worker',
    })
    await request(app).get('/ready').expect(503, {
      status: 'not_ready',
      service: 'analytics-worker',
    })

    state.markRunning()
    state.markPollSuccess()
    await request(app).get('/ready').expect(200, {
      status: 'ready',
      service: 'analytics-worker',
    })
    const metrics = await request(app).get('/metrics').expect(200)
    expect(metrics.text).toContain('process_cpu')
    expect(metrics.text).toMatch(/dependency_ready\{[^}]*dependency="postgres"[^}]*\} 1/)
  })

  test('fails readiness when PostgreSQL is unavailable', async () => {
    const state = new AnalyticsWorkerState()
    state.markRunning()
    state.markPollSuccess()
    const prisma = {
      $queryRawUnsafe: vi.fn(async () => { throw new Error('database unavailable') }),
    } as unknown as PrismaClient

    await request(createAnalyticsWorkerHealthApp({ prisma, state })).get('/ready').expect(503)
  })
})
