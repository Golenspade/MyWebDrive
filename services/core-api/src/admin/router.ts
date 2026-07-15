import type { Prisma, PrismaClient } from '@prisma/client'
import express from 'express'

import { createAccessMiddleware, requireAdmin } from '../auth/middleware.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SEVERITIES = new Set(['critical', 'warning', 'info', 'success'])

type AdminRouterDependencies = {
  prisma: PrismaClient
  sessionSecret: string
  now: () => Date
}

type QuotaRecord = {
  limitBytes: bigint
  reservedBytes: bigint
  committedBytes: bigint
}

type AdminUserRecord = {
  id: string
  displayName: string | null
  email: string
  role: string
  status: string
  createdAt: Date
  quotaAccount: QuotaRecord | null
}

function parsePositiveInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

function serializeQuota(quota: QuotaRecord | null) {
  if (!quota) return null
  const occupied = quota.reservedBytes + quota.committedBytes
  return {
    limitBytes: quota.limitBytes.toString(),
    reservedBytes: quota.reservedBytes.toString(),
    committedBytes: quota.committedBytes.toString(),
    availableBytes: (quota.limitBytes > occupied ? quota.limitBytes - occupied : 0n).toString(),
  }
}

function serializeUser(user: AdminUserRecord) {
  return {
    id: user.id,
    name: user.displayName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    quota: serializeQuota(user.quotaAccount),
  }
}

function optionalString(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maximum) return undefined
  return trimmed
}

function notificationMeta(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) return undefined
  try {
    const encoded = JSON.stringify(value)
    if (encoded.length > 16_384) return undefined
    return JSON.parse(encoded) as Prisma.InputJsonValue
  } catch {
    return undefined
  }
}

function parseDate(value: unknown): Date | undefined | null {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function createAdminRouter(deps: AdminRouterDependencies): express.Router {
  const router = express.Router()
  const requireAccess = createAccessMiddleware({
    prisma: deps.prisma,
    sessionSecret: deps.sessionSecret,
  })
  const streamClients = new Set<express.Response>()

  router.get('/admin/users', requireAccess, requireAdmin, async (req, res) => {
    const query = optionalString(req.query.query ?? req.query.q, 200) ?? ''
    const page = parsePositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = parsePositiveInteger(req.query.pageSize, 20, 100)
    const where: Prisma.UserWhereInput = query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}

    try {
      const [total, items] = await Promise.all([
        deps.prisma.user.count({ where }),
        deps.prisma.user.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            displayName: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            quotaAccount: {
              select: {
                limitBytes: true,
                reservedBytes: true,
                committedBytes: true,
              },
            },
          },
        }),
      ])
      return res.json({
        items: items.map((item) => serializeUser(item)),
        page,
        pageSize,
        total,
      })
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/admin/users/:userId', requireAccess, requireAdmin, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.userId ?? '')) {
      return res.status(404).json({ error: 'user not found' })
    }
    try {
      const user = await deps.prisma.user.findUnique({
        where: { id: req.params.userId },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          quotaAccount: {
            select: {
              limitBytes: true,
              reservedBytes: true,
              committedBytes: true,
            },
          },
        },
      })
      if (!user) return res.status(404).json({ error: 'user not found' })
      return res.json(serializeUser(user))
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.patch('/admin/users/:userId/role', requireAccess, requireAdmin, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.userId ?? '')) {
      return res.status(404).json({ error: 'user not found' })
    }
    const role = req.body?.role
    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({ error: 'invalid role' })
    }
    try {
      const updated = await deps.prisma.user.update({
        where: { id: req.params.userId },
        data: { role },
        select: { id: true, role: true },
      })
      return res.json(updated)
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'user not found' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/admin/notifications', requireAccess, requireAdmin, async (req, res) => {
    const page = parsePositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER)
    const pageSize = parsePositiveInteger(req.query.pageSize, 20, 200)
    const service = optionalString(req.query.service, 100)
    const severity = optionalString(req.query.severity, 20)
    const query = optionalString(req.query.q, 200)
    const unreadOnly = String(req.query.unreadOnly ?? '').toLowerCase() === 'true'
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    if ((severity && !SEVERITIES.has(severity)) || from === null || to === null) {
      return res.status(400).json({ error: 'invalid notification query' })
    }
    if (from && to && from > to) {
      return res.status(400).json({ error: 'invalid notification query' })
    }

    const where: Prisma.AdminNotificationWhereInput = {}
    if (unreadOnly) where.unread = true
    if (service) where.service = service
    if (severity) where.severity = severity
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { service: { contains: query, mode: 'insensitive' } },
      ]
    }
    if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }

    try {
      const [total, items] = await Promise.all([
        deps.prisma.adminNotification.count({ where }),
        deps.prisma.adminNotification.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ])
      return res.json({ items, page, pageSize, total })
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.post('/admin/notifications', requireAccess, requireAdmin, async (req, res) => {
    const title = optionalString(req.body?.title, 200)
    const description = optionalString(req.body?.description, 2_000)
    const severity = optionalString(req.body?.severity, 20)
    const service = optionalString(req.body?.service, 100)
    const meta = notificationMeta(req.body?.meta)
    if (!title || !severity || !SEVERITIES.has(severity) || (req.body?.meta != null && !meta)) {
      return res.status(400).json({ error: 'invalid notification' })
    }
    try {
      const notification = await deps.prisma.adminNotification.create({
        data: {
          title,
          severity,
          ...(description ? { description } : {}),
          ...(service ? { service } : {}),
          ...(meta ? { meta } : {}),
          createdAt: deps.now(),
        },
      })
      const frame = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`
      for (const client of streamClients) {
        try {
          client.write(frame)
        } catch {
          streamClients.delete(client)
        }
      }
      return res.status(201).json(notification)
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.post('/admin/notifications/mark-read', requireAccess, requireAdmin, async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? Array.from(new Set<string>(req.body.ids.filter(
          (id: unknown): id is string => typeof id === 'string' && UUID_PATTERN.test(id),
        ))).slice(0, 200)
      : []
    if (ids.length === 0) return res.status(400).json({ error: 'invalid notification ids' })
    try {
      const result = await deps.prisma.adminNotification.updateMany({
        where: { id: { in: ids }, unread: true },
        data: { unread: false },
      })
      return res.json({ ok: true, updated: result.count })
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/admin/notifications/stream', requireAccess, requireAdmin, async (req, res) => {
    let snapshot
    try {
      snapshot = await deps.prisma.adminNotification.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      })
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }

    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
    streamClients.add(res)
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25_000)
    const close = () => {
      clearInterval(heartbeat)
      streamClients.delete(res)
    }
    req.once('close', close)
    res.once('close', close)
  })

  return router
}
