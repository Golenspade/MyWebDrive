import type { PrismaClient } from '@prisma/client'
import express from 'express'

import { createAccessMiddleware, requireAdmin } from '../auth/middleware.js'
import {
  resolveSystemHealthRange,
  type PrometheusHealthClient,
} from './prometheus.js'
import { getSystemHealth } from './service.js'

export function createSystemHealthRouter(input: {
  prisma: PrismaClient
  sessionSecret: string
  prometheus: PrometheusHealthClient
  now: () => Date
}): express.Router {
  const router = express.Router()
  const requireAccess = createAccessMiddleware(input)

  router.get('/admin/dashboard/system', requireAccess, requireAdmin, async (req, res) => {
    const now = input.now()
    let range
    try {
      range = resolveSystemHealthRange(req.query.range, now).kind
    } catch {
      return res.status(400).json({ error: 'invalid dashboard range' })
    }

    const result = await getSystemHealth({
      prisma: input.prisma,
      prometheus: input.prometheus,
      range,
      now,
    })
    return res.status(result.availability === 'unavailable' ? 503 : 200).json(result)
  })

  return router
}
