import { describe, expect, test, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import {
  createAppTelemetry,
  createDependencyReadinessMetrics,
} from '@mywebdrive/observability'

import { connectRuntimeRedis } from '../runtime.js'
import {
  checkStorageWorkerDependencies,
  createStorageApiApp,
  createStorageWorkerHealthApp,
} from '../server.js'
import { WorkerLoopState } from '../worker.js'

describe('storage runtime startup', () => {
  test('mounts private metrics on the Storage API runtime', async () => {
    const router = express.Router()
    router.get('/api/v1/probe', (_req, res) => res.json({ ok: true }))
    const app = createStorageApiApp({ router })

    await request(app).get('/api/v1/probe').expect(200, { ok: true })
    const metrics = await request(app).get('/metrics').expect(200)
    expect(metrics.text).toContain('service="storage-api"')
    expect(metrics.text).toContain('route="/api/v1/probe"')
  })

  test('mounts worker health and private metrics independently', async () => {
    const state = new WorkerLoopState()
    const ready = vi.fn(async () => undefined)
    const app = createStorageWorkerHealthApp({ state, ready })

    await request(app).get('/ready').expect(503)
    state.markRunning()
    state.markPollSuccess()
    await request(app).get('/ready').expect(200)
    await request(app).get('/metrics').expect(200)
    expect(ready).toHaveBeenCalled()
  })

  test('explicitly connects Redis before startup continues', async () => {
    const connect = vi.fn(async () => undefined)

    await expect(connectRuntimeRedis({ connect })).resolves.toBeUndefined()

    expect(connect).toHaveBeenCalledOnce()
  })

  test('fails closed when the initial Redis connection fails', async () => {
    const unavailable = new Error('redis unavailable')

    await expect(
      connectRuntimeRedis({ connect: vi.fn(async () => Promise.reject(unavailable)) }),
    ).rejects.toBe(unavailable)
  })

  test('records Redis and object-store readiness independently', async () => {
    const telemetry = createAppTelemetry({ service: 'storage-worker' })
    const metrics = createDependencyReadinessMetrics(telemetry.register)

    await expect(checkStorageWorkerDependencies({
      redis: vi.fn(async () => { throw new Error('redis unavailable') }),
      objectStore: vi.fn(async () => undefined),
      metrics,
    })).rejects.toThrow('storage dependency unavailable')

    const output = await telemetry.register.metrics()
    expect(output).toMatch(/dependency_ready\{[^}]*dependency="redis"[^}]*\} 0/)
    expect(output).toMatch(/dependency_ready\{[^}]*dependency="object-store"[^}]*\} 1/)
  })
})
