import type { PrismaClient } from '@prisma/client'
import express from 'express'

import { createAccessMiddleware, requireAdmin } from '../auth/middleware.js'
import { InvalidDashboardRangeError, parseDashboardRange } from './range.js'
import { getBusinessDashboard } from './service.js'

export function createAnalyticsRouter(input: {
  prisma: PrismaClient
  sessionSecret: string
  now: () => Date
}): express.Router {
  const router = express.Router()
  const authenticate = createAccessMiddleware(input)

  router.get(
    '/admin/dashboard/business',
    authenticate,
    requireAdmin,
    async (req, res) => {
      const now = input.now()
      try {
        const range = parseDashboardRange(req.query.range, now)
        return res.json(await getBusinessDashboard({ prisma: input.prisma, range, now }))
      } catch (error) {
        if (error instanceof InvalidDashboardRangeError) {
          return res.status(400).json({ error: 'invalid dashboard range' })
        }
        return res.status(503).json({ error: 'service unavailable' })
      }
    },
  )

  return router
}
