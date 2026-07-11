import type { PrismaClient } from '@prisma/client'
import express from 'express'
import type Redis from 'ioredis'

import type { EmailSender } from './identity/email-sender.js'
import { createIdentityRouter } from './identity/router.js'
import { createFilesRouter } from './files/router.js'
import { createUploadRouter } from './uploads/router.js'

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
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer
    }
  }
}

const INTERNAL_COMPLETION_PATH = /^\/api\/v1\/internal\/upload-intents\/[^/]+\/complete$/

export function createCoreApp(deps: CoreDependencies): express.Express {
  const app = express()
  const startedAt = deps.now().toISOString()
  const identity = deps.identity ?? {
    sessionSecret:
      process.env.CORE_SESSION_SECRET ?? 'development-only-core-session-secret',
    otpPepper: process.env.OTP_PEPPER ?? 'development-only-otp-pepper',
    adminEmails: process.env.CORE_ADMIN_EMAILS ?? '',
    production: process.env.NODE_ENV === 'production',
    defaultUserQuotaBytes: 0n,
  }

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

  app.get('/live', (_req, res) => res.json({ status: 'live', service: 'core-api' }))
  app.get('/ready', async (_req, res) => {
    try {
      await deps.prisma.$queryRawUnsafe('SELECT 1')
      await deps.redis.ping()
      return res.json({ status: 'ready', service: 'core-api' })
    } catch {
      return res.status(503).json({ status: 'not_ready', service: 'core-api' })
    }
  })
  app.get('/version', (_req, res) =>
    res.json({
      gitSha: process.env.GIT_SHA ?? 'unknown',
      buildId: process.env.BUILD_ID ?? 'local',
      startedAt,
    }),
  )

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
    }),
  )

  app.use(
    '/api/v1',
    createFilesRouter({ prisma: deps.prisma, sessionSecret: identity.sessionSecret }),
  )

  return app
}
