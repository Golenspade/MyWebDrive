import express from 'express'
import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'

import { issueAccessToken, verifyAccessToken } from '../auth/access-token.js'
import type { EmailSender } from './email-sender.js'
import { normalizeEmail } from './email.js'
import {
  InvalidOtpError,
  OtpAttemptsExhaustedError,
  OtpDeliveryError,
  OtpInfrastructureError,
  OtpRateLimitError,
  requestEmailOtp,
  verifyEmailOtp,
} from './otp.js'
import {
  InvalidRefreshSessionError,
  revokeRefreshSession,
  rotateRefreshSession,
} from './session.js'

const COOKIE_NAME = 'mwd_refresh'
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

type IdentityRouterDependencies = {
  prisma: PrismaClient
  redis: Redis
  emailSender: EmailSender
  now: () => Date
  randomBytes: (size: number) => Buffer
  sessionSecret: string
  otpPepper: string
  adminEmails: string
  production: boolean
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const field of header.split(';')) {
    const separator = field.indexOf('=')
    if (separator < 0) continue
    if (field.slice(0, separator).trim() !== name) continue
    const value = field.slice(separator + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

function cookieOptions(production: boolean): express.CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: production,
    path: '/api/v1/auth',
    maxAge: COOKIE_MAX_AGE_MS,
  }
}

function adminAllowlist(value: string): ReadonlySet<string> {
  const emails = new Set<string>()
  for (const candidate of value.split(',')) {
    if (!candidate.trim()) continue
    try {
      emails.add(normalizeEmail(candidate))
    } catch {
      continue
    }
  }
  return emails
}

export function createIdentityRouter(deps: IdentityRouterDependencies): express.Router {
  const router = express.Router()
  const admins = adminAllowlist(deps.adminEmails)

  router.post('/email/request', async (req, res) => {
    let email: string
    try {
      email = normalizeEmail(req.body?.email)
    } catch {
      return res.status(400).json({ error: 'invalid email' })
    }

    try {
      const result = await requestEmailOtp({
        prisma: deps.prisma,
        redis: deps.redis,
        emailSender: deps.emailSender,
        email,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        now: deps.now(),
        randomBytes: deps.randomBytes,
        pepper: deps.otpPepper,
      })
      return res.status(202).json({
        challengeId: result.challengeId,
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      })
    } catch (error) {
      if (error instanceof OtpRateLimitError) {
        return res.status(429).json({ error: 'rate limit exceeded' })
      }
      if (error instanceof OtpInfrastructureError || error instanceof OtpDeliveryError) {
        return res.status(503).json({ error: 'authentication service unavailable' })
      }
      return res.status(503).json({ error: 'authentication service unavailable' })
    }
  })

  router.post('/email/verify', async (req, res) => {
    const challengeId = req.body?.challengeId
    const code = req.body?.code
    let email: string
    if (typeof challengeId !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'invalid verification request' })
    }
    try {
      email = normalizeEmail(req.body?.email)
    } catch {
      return res.status(400).json({ error: 'invalid verification request' })
    }

    try {
      const verified = await verifyEmailOtp({
        prisma: deps.prisma,
        challengeId,
        email,
        code,
        now: deps.now(),
        pepper: deps.otpPepper,
        adminEmails: admins,
        randomBytes: deps.randomBytes,
      })
      const accessToken = issueAccessToken(verified.user, deps.sessionSecret)
      res.cookie(COOKIE_NAME, verified.refreshToken, cookieOptions(deps.production))
      return res.json({
        accessToken,
        expiresInSeconds: 900,
        user: verified.user,
      })
    } catch (error) {
      if (error instanceof OtpAttemptsExhaustedError) {
        return res.status(429).json({ error: 'verification attempts exhausted' })
      }
      if (error instanceof InvalidOtpError) {
        return res.status(401).json({ error: 'invalid or expired challenge' })
      }
      return res.status(503).json({ error: 'authentication service unavailable' })
    }
  })

  router.post('/refresh', async (req, res) => {
    const token = parseCookie(req.headers.cookie, COOKIE_NAME)
    if (!token) return res.status(401).json({ error: 'invalid session' })

    try {
      const rotated = await rotateRefreshSession(
        deps.prisma,
        token,
        deps.now(),
        deps.randomBytes,
      )
      res.cookie(COOKIE_NAME, rotated.token, cookieOptions(deps.production))
      return res.json({
        accessToken: issueAccessToken(rotated.user, deps.sessionSecret),
        expiresInSeconds: 900,
      })
    } catch (error) {
      if (error instanceof InvalidRefreshSessionError) {
        return res.status(401).json({ error: 'invalid session' })
      }
      return res.status(503).json({ error: 'authentication service unavailable' })
    }
  })

  router.post('/logout', async (req, res) => {
    const token = parseCookie(req.headers.cookie, COOKIE_NAME)
    if (token) await revokeRefreshSession(deps.prisma, token, deps.now())
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions(deps.production)
    res.clearCookie(COOKIE_NAME, clearOptions)
    return res.status(204).end()
  })

  router.get('/me', async (req, res) => {
    const authorization = req.headers.authorization
    const match = typeof authorization === 'string' ? /^Bearer (\S+)$/.exec(authorization) : null
    if (!match?.[1]) return res.status(401).json({ error: 'invalid access token' })

    try {
      const claims = verifyAccessToken(match[1], deps.sessionSecret)
      const user = await deps.prisma.user.findUnique({
        where: { id: claims.userId },
        select: { id: true, email: true, role: true },
      })
      if (!user) return res.status(401).json({ error: 'invalid access token' })
      return res.json(user)
    } catch {
      return res.status(401).json({ error: 'invalid access token' })
    }
  })

  return router
}
