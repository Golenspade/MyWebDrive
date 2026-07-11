import type { PrismaClient } from '@prisma/client'
import express from 'express'
import type Redis from 'ioredis'

export type SendOtpInput = {
  to: string
  code: string
  ttlSeconds: 600
  purpose: 'login'
}

export interface EmailSender {
  sendOtp(input: SendOtpInput): Promise<void>
}

export type CoreDependencies = {
  prisma: PrismaClient
  redis: Redis
  emailSender: EmailSender
  now: () => Date
  randomBytes: (size: number) => Buffer
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

  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        if (INTERNAL_COMPLETION_PATH.test((req.url ?? '').split('?')[0] ?? '')) {
          const request = req as express.Request
          request.rawBody = Buffer.from(buffer)
        }
      },
    }),
  )

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

  return app
}
