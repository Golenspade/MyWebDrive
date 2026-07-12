import { createAppTelemetry, type AppTelemetry } from '@mywebdrive/observability'
import express from 'express'
import helmet from 'helmet'

import type { WorkerLoopState } from './worker.js'

type DependencyMetrics = {
  setRedis(ready: boolean): void
  setObjectStore(ready: boolean): void
}

export async function checkStorageWorkerDependencies(input: {
  redis: () => Promise<unknown>
  objectStore: () => Promise<unknown>
  metrics: DependencyMetrics
}): Promise<void> {
  const [redis, objectStore] = await Promise.allSettled([
    input.redis(),
    input.objectStore(),
  ])
  input.metrics.setRedis(redis.status === 'fulfilled')
  input.metrics.setObjectStore(objectStore.status === 'fulfilled')
  if (redis.status === 'rejected' || objectStore.status === 'rejected') {
    throw new Error('storage dependency unavailable')
  }
}

function baseApp(service: 'storage-api' | 'storage-worker', telemetry?: AppTelemetry) {
  const app = express()
  const resolvedTelemetry = telemetry ?? createAppTelemetry({ service })
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false }))
  app.get('/metrics', resolvedTelemetry.metricsHandler)
  return { app, telemetry: resolvedTelemetry }
}

export function createStorageApiApp(input: {
  router: express.Router
  telemetry?: AppTelemetry
}): express.Express {
  const { app, telemetry } = baseApp('storage-api', input.telemetry)
  app.use(telemetry.httpMiddleware)
  app.use(input.router)
  return app
}

export function createStorageWorkerHealthApp(input: {
  state: WorkerLoopState
  ready: () => Promise<void>
  telemetry?: AppTelemetry
}): express.Express {
  const { app } = baseApp('storage-worker', input.telemetry)
  app.get('/live', (_req, res) => res.json({ status: 'live', service: 'storage-worker' }))
  app.get('/ready', async (_req, res) => {
    try {
      if (!input.state.isReady()) throw new Error('worker loop unavailable')
      await input.ready()
      return res.json({ status: 'ready', service: 'storage-worker' })
    } catch {
      return res.status(503).json({ status: 'not_ready', service: 'storage-worker' })
    }
  })
  return app
}
