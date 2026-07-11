import type { PrismaClient } from '@prisma/client'
import type express from 'express'

import { verifyAccessToken } from './access-token.js'

export type AuthUser = {
  id: string
  email: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser
    }
  }
}

export function createAccessMiddleware(input: {
  prisma: PrismaClient
  sessionSecret: string
}): express.RequestHandler {
  return async (req, res, next) => {
    const authorization = req.headers.authorization
    const match =
      typeof authorization === 'string'
        ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
            authorization,
          )
        : null
    if (!match?.[1]) {
      return res.status(401).json({ error: 'invalid access token' })
    }

    let userId: string
    try {
      userId = verifyAccessToken(match[1], input.sessionSecret).userId
    } catch {
      return res.status(401).json({ error: 'invalid access token' })
    }

    try {
      const user = await input.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, status: true },
      })
      if (!user || user.status !== 'active') {
        return res.status(401).json({ error: 'invalid access token' })
      }
      req.authUser = { id: user.id, email: user.email, role: user.role }
      return next()
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }
  }
}

export const requireAdmin: express.RequestHandler = (req, res, next) => {
  if (req.authUser?.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' })
  }
  return next()
}
