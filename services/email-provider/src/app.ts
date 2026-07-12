import { timingSafeEqual } from 'node:crypto'

import express from 'express'

import type { OtpMailer, SendOtpInput } from './directmail.js'

type EmailProviderDependencies = {
  mailer: OtpMailer
  serviceToken: string
  checkReady?: () => Promise<void>
  reportError?: (diagnostic: ProviderFailureDiagnostic) => void
}

type ProviderFailureDiagnostic = {
  event: 'directmail_send_failed'
  code?: string
  statusCode?: number
}

function providerFailureDiagnostic(error: unknown): ProviderFailureDiagnostic {
  const diagnostic: ProviderFailureDiagnostic = { event: 'directmail_send_failed' }
  if (!error || typeof error !== 'object') return diagnostic

  const candidate = error as { code?: unknown; statusCode?: unknown }
  if (typeof candidate.code === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(candidate.code)) {
    diagnostic.code = candidate.code
  }
  if (
    typeof candidate.statusCode === 'number'
    && Number.isInteger(candidate.statusCode)
    && candidate.statusCode >= 100
    && candidate.statusCode <= 599
  ) {
    diagnostic.statusCode = candidate.statusCode
  }
  return diagnostic
}

function tokenMatches(header: string | undefined, expected: string): boolean {
  const match = typeof header === 'string' ? /^Bearer (\S+)$/.exec(header) : null
  if (!match?.[1]) return false

  const received = Buffer.from(match[1], 'utf8')
  const configured = Buffer.from(expected, 'utf8')
  return received.length === configured.length && timingSafeEqual(received, configured)
}

function isRecipient(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 2
    && value.length <= 254
    && value === value.trim()
    && /^[^\s@]+@[A-Za-z0-9._-]+$/.test(value)
}

function parseOtpRequest(value: unknown): SendOtpInput | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (!isRecipient(body.to)) return null
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) return null
  if (body.ttlSeconds !== 600 || body.purpose !== 'login') return null

  return {
    to: body.to,
    code: body.code,
    ttlSeconds: 600,
    purpose: 'login',
  }
}

export function createEmailProviderApp(
  deps: EmailProviderDependencies,
): express.Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '4kb' }))

  app.get('/live', (_req, res) => {
    res.json({ status: 'live', service: 'email-provider' })
  })
  app.get('/ready', async (_req, res) => {
    try {
      await deps.checkReady?.()
      return res.json({ status: 'ready', service: 'email-provider' })
    } catch {
      return res.status(503).json({ status: 'not_ready', service: 'email-provider' })
    }
  })

  app.post('/v1/messages/otp', async (req, res) => {
    if (!tokenMatches(req.headers.authorization, deps.serviceToken)) {
      return res.status(401).json({ error: 'invalid service identity' })
    }

    const input = parseOtpRequest(req.body)
    if (!input) return res.status(400).json({ error: 'invalid OTP request' })

    try {
      await deps.mailer.sendOtp(input)
      return res.status(204).end()
    } catch (error) {
      deps.reportError?.(providerFailureDiagnostic(error))
      return res.status(503).json({ error: 'email delivery unavailable' })
    }
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error) return res.status(400).json({ error: 'invalid request' })
    return res.status(500).json({ error: 'internal error' })
  })

  return app
}
