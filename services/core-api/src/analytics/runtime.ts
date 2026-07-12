import type { PrismaClient } from '@prisma/client'
import {
  createAppTelemetry,
  createDependencyReadinessMetrics,
  type AppTelemetry,
} from '@mywebdrive/observability'
import express from 'express'

import type { AnalyticsWorkerState } from './worker.js'

export function createAnalyticsWorkerHealthApp(input: {
  prisma: PrismaClient
  state: AnalyticsWorkerState
  telemetry?: AppTelemetry
}): express.Express {
  const app = express()
  const telemetry = input.telemetry ?? createAppTelemetry({ service: 'analytics-worker' })
  const dependencyMetrics = createDependencyReadinessMetrics(telemetry.register)
  app.disable('x-powered-by')
  app.get('/metrics', telemetry.metricsHandler)
  app.get('/live', (_req, res) => {
    res.json({ status: 'live', service: 'analytics-worker' })
  })
  app.get('/ready', async (_req, res) => {
    const [postgres] = await Promise.allSettled([
      input.prisma.$queryRawUnsafe('SELECT 1'),
    ])
    dependencyMetrics.setPostgres(postgres.status === 'fulfilled')
    if (!input.state.isReady() || postgres.status === 'rejected') {
      return res.status(503).json({ status: 'not_ready', service: 'analytics-worker' })
    }
    return res.json({ status: 'ready', service: 'analytics-worker' })
  })
  return app
}

export function abortableSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error('aborted'))
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout)
      reject(new Error('aborted'))
    }
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function runDownloadAttemptTimeoutLoop(input: {
  signal: AbortSignal
  now: () => Date
  sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>
  sweep: (input: { startedBefore: Date; now: Date }) => Promise<number>
  timeoutMilliseconds: number
  intervalMilliseconds: number
}): Promise<void> {
  while (!input.signal.aborted) {
    const now = input.now()
    await input.sweep({
      startedBefore: new Date(now.getTime() - input.timeoutMilliseconds),
      now,
    })
    try {
      await input.sleep(input.intervalMilliseconds, input.signal)
    } catch (error) {
      if (!input.signal.aborted) throw error
    }
  }
}
