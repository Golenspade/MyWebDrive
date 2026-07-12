import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'

import { PrismaClient } from '@prisma/client'
import {
  createAnalyticsWorkerMetrics,
  createAppTelemetry,
} from '@mywebdrive/observability'
import Redis from 'ioredis'

import { bootstrapAnalyticsReadModel } from './analytics/bootstrap.js'
import { markStaleDownloadAttemptsUnknown } from './analytics/download-attempt.js'
import {
  abortableSleep,
  createAnalyticsWorkerHealthApp,
  runDownloadAttemptTimeoutLoop,
} from './analytics/runtime.js'
import { AnalyticsWorkerState, runAnalyticsWorker } from './analytics/worker.js'
import { createCoreApp } from './app.js'
import { loadAnalyticsWorkerConfig, loadCoreConfig } from './config.js'
import { createEmailSender } from './identity/email-sender.js'

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

async function runApi(): Promise<void> {
  const config = loadCoreConfig()
  const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } })
  const redis = new Redis(config.redisUrl)
  const emailSender = createEmailSender({
    providerUrl: config.emailProviderUrl,
    token: config.emailProviderToken,
  })
  const app = createCoreApp({
    prisma,
    redis,
    emailSender,
    now: () => new Date(),
    randomBytes,
    identity: {
      sessionSecret: config.sessionSecret,
      otpPepper: config.otpPepper,
      adminEmails: process.env.CORE_ADMIN_EMAILS ?? '',
      production: config.nodeEnv === 'production',
      defaultUserQuotaBytes: config.defaultUserQuotaBytes,
    },
    storage: {
      grantSecret: config.storageGrantSecret,
      callbackSecret: config.callbackSecret,
    },
  })
  const server = app.listen(config.port)
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    await closeServer(server)
    await Promise.all([prisma.$disconnect(), redis.quit()])
  }
  process.once('SIGTERM', () => { void stop() })
  process.once('SIGINT', () => { void stop() })
}

async function runWorker(): Promise<void> {
  const config = loadAnalyticsWorkerConfig()
  const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } })
  const state = new AnalyticsWorkerState()
  const telemetry = createAppTelemetry({ service: 'analytics-worker' })
  const metrics = createAnalyticsWorkerMetrics(telemetry.register)
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)

  await prisma.$connect()
  await bootstrapAnalyticsReadModel({ prisma, now: () => new Date() })
  const app = createAnalyticsWorkerHealthApp({ prisma, state, telemetry })
  const server = app.listen(config.port)
  try {
    const analytics = runAnalyticsWorker({
      prisma,
      signal: controller.signal,
      now: () => new Date(),
      sleep: abortableSleep,
      batchSize: 100,
      state,
      metrics,
    })
    const downloadTimeouts = runDownloadAttemptTimeoutLoop({
      signal: controller.signal,
      now: () => new Date(),
      sleep: abortableSleep,
      timeoutMilliseconds: 5 * 60 * 1000,
      intervalMilliseconds: 60 * 1000,
      sweep: ({ startedBefore, now }) => markStaleDownloadAttemptsUnknown({
        prisma,
        startedBefore,
        now,
      }),
    })
    try {
      await Promise.all([analytics, downloadTimeouts])
    } catch (error) {
      controller.abort()
      await Promise.allSettled([analytics, downloadTimeouts])
      throw error
    }
  } finally {
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
    await closeServer(server)
    await prisma.$disconnect()
  }
}

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command === 'api') return runApi()
  if (command === 'analytics-worker') return runWorker()
  throw new Error('usage: node dist/index.js api|analytics-worker')
}

main().catch((error: unknown) => {
  process.stderr.write(
    `core startup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  )
  process.exitCode = 1
})
