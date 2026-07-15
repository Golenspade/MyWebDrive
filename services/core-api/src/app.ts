import type { PrismaClient } from '@prisma/client'
import {
  createAppTelemetry,
  createDependencyReadinessMetrics,
  createUploadMetrics,
  type AppTelemetry,
} from '@mywebdrive/observability'
import express from 'express'
import type Redis from 'ioredis'

import { createAdminRouter } from './admin/router.js'
import { createAnalyticsRouter } from './analytics/router.js'
import { createDownloadAttemptCallbackRouter } from './analytics/download-attempt.js'
import type { EmailSender } from './identity/email-sender.js'
import { createIdentityRouter } from './identity/router.js'
import { createFilesRouter } from './files/router.js'
import { createSharingRouter } from './sharing/router.js'
import { createUploadRouter } from './uploads/router.js'
import {
  createPrometheusClient,
  type PrometheusHealthClient,
} from './system-health/prometheus.js'
import { createSystemHealthRouter } from './system-health/router.js'

export type { EmailSender, SendOtpInput } from './identity/email-sender.js'

export type CoreDependencies = {
  prisma: PrismaClient
  redis: Redis
  emailSender: EmailSender
  now: () => Date
  randomBytes: (size: number) => Buffer
  identity?: {
    sessionSecret: string
    otpPepper: string
    adminEmails: string
    production: boolean
    defaultUserQuotaBytes: bigint
  }
  storage?: { grantSecret: string; callbackSecret?: string }
  telemetry?: AppTelemetry
  prometheus?: PrometheusHealthClient
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer
    }
  }
}

const INTERNAL_COMPLETION_PATH =
  /^\/api\/v1\/internal\/(?:upload-intents\/[^/]+\/complete|download-attempts\/[^/]+\/(?:started|completed))$/

export function createCoreApp(deps: CoreDependencies): express.Express {
  const app = express()
  const startedAt = deps.now().toISOString()
  const telemetry = deps.telemetry ?? createAppTelemetry({ service: 'core-api' })
  const uploadMetrics = createUploadMetrics(telemetry.register)
  const dependencyMetrics = createDependencyReadinessMetrics(telemetry.register)
  const prometheus = deps.prometheus ?? createPrometheusClient({
    baseUrl: process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:9090',
  })
  const identity = deps.identity ?? {
    sessionSecret:
      process.env.CORE_SESSION_SECRET ?? 'development-only-core-session-secret',
    otpPepper: process.env.OTP_PEPPER ?? 'development-only-otp-pepper',
    adminEmails: process.env.CORE_ADMIN_EMAILS ?? '',
    production: process.env.NODE_ENV === 'production',
    defaultUserQuotaBytes: 0n,
  }

  app.disable('x-powered-by')
  app.get('/metrics', telemetry.metricsHandler)
  app.get('/live', (_req, res) => res.json({ status: 'live', service: 'core-api' }))
  app.get('/ready', async (_req, res) => {
    const [postgres, redis] = await Promise.allSettled([
      deps.prisma.$queryRawUnsafe('SELECT 1'),
      deps.redis.ping(),
    ])
    dependencyMetrics.setPostgres(postgres.status === 'fulfilled')
    dependencyMetrics.setRedis(redis.status === 'fulfilled')
    if (postgres.status === 'rejected' || redis.status === 'rejected') {
      return res.status(503).json({ status: 'not_ready', service: 'core-api' })
    }
    return res.json({ status: 'ready', service: 'core-api' })
  })
  app.get('/version', (_req, res) =>
    res.json({
      gitSha: process.env.GIT_SHA ?? 'unknown',
      buildId: process.env.BUILD_ID ?? 'local',
      startedAt,
    }),
  )

  app.use(telemetry.httpMiddleware)
  const jsonParser = express.json()
  const callbackParser = express.raw({ type: 'application/json' })
  app.use((req, res, next) => {
    if (!INTERNAL_COMPLETION_PATH.test((req.url ?? '').split('?')[0] ?? '')) {
      return jsonParser(req, res, next)
    }
    return callbackParser(req, res, (error) => {
      if (!error && Buffer.isBuffer(req.body)) req.rawBody = Buffer.from(req.body)
      return next(error)
    })
  })

  app.use(
    '/api/v1/auth',
    createIdentityRouter({
      prisma: deps.prisma,
      redis: deps.redis,
      emailSender: deps.emailSender,
      now: deps.now,
      randomBytes: deps.randomBytes,
      ...identity,
    }),
  )

  app.use(
    '/api/v1',
    createAdminRouter({
      prisma: deps.prisma,
      sessionSecret: identity.sessionSecret,
      now: deps.now,
    }),
  )

  app.use(
    '/api/v1',
    createUploadRouter({
      prisma: deps.prisma,
      now: deps.now,
      sessionSecret: identity.sessionSecret,
      grantSecret:
        deps.storage?.grantSecret ??
        process.env.STORAGE_GRANT_SECRET ??
        'development-only-storage-grant-secret',
      callbackSecret:
        deps.storage?.callbackSecret ??
        process.env.CORE_CALLBACK_SECRET ??
        'development-only-core-callback-secret',
      uploadMetrics,
    }),
  )

  app.use(
    '/api/v1',
    createDownloadAttemptCallbackRouter({
      prisma: deps.prisma,
      callbackSecret:
        deps.storage?.callbackSecret ??
        process.env.CORE_CALLBACK_SECRET ??
        'development-only-core-callback-secret',
      now: deps.now,
    }),
  )

  app.use(
    '/api/v1',
    createFilesRouter({ prisma: deps.prisma, sessionSecret: identity.sessionSecret }),
  )

  app.use(
    '/api/v1',
    createSharingRouter({
      prisma: deps.prisma,
      sessionSecret: identity.sessionSecret,
      grantSecret:
        deps.storage?.grantSecret ??
        process.env.STORAGE_GRANT_SECRET ??
        'development-only-storage-grant-secret',
      now: deps.now,
      randomBytes: deps.randomBytes,
    }),
  )

  app.use(
    '/api/v1',
    createAnalyticsRouter({
      prisma: deps.prisma,
      sessionSecret: identity.sessionSecret,
      now: deps.now,
    }),
  )

  app.use(
    '/api/v1',
    createSystemHealthRouter({
      prisma: deps.prisma,
      sessionSecret: identity.sessionSecret,
      prometheus,
      now: deps.now,
    }),
  )

  return app
}
