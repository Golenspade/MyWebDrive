import express from 'express'
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '../prisma/client/index.js'
import { getEnv } from '@mywebdrive/common'

const app = express()
app.disable('x-powered-by')

// Config
const JWT_SECRET = getEnv('JWT_SECRET', 'dev-secret')
const PORT = parseInt(process.env.USER_PORT || '7082', 10)

// DB
const prisma = new PrismaClient()

// Middleware
app.use(express.json())
const logger = createLogger({ service: 'user-service-node' })
app.use(createHttpLogger(logger))

// Metrics
const { register, metricsMiddleware, metricsHandler } = createMetrics('user-service-node')
app.use(metricsMiddleware)

// Helpers
function parseBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization || ''
  const parts = header.split(' ')
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1]
  return null
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const token = parseBearerToken(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (!decoded?.user_id) return res.status(401).json({ error: 'Unauthorized' })
    ;(req as any).auth = { userId: decoded.user_id, role: decoded.role || 'user' }
    next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

// Routes
app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'user-service-node' }))
app.get('/metrics', metricsHandler)

// Get current user profile
app.get('/api/v1/users/me', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).auth.userId as string
    let user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      user = await prisma.user.create({
        data: { id: userId, name: 'User', storageQuota: BigInt(0), storageUsed: BigInt(0) },
      })
    }
    return res.json({
      id: user.id,
      name: user.name,
      storageQuota: Number(user.storageQuota),
      storageUsed: Number(user.storageUsed),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: (req as any).auth?.role || 'user',
    })
  } catch (err) {
    next(err)
  }
})

// Update current user profile
app.patch('/api/v1/users/me', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).auth.userId as string
    const { name } = (req.body || {}) as { name?: string }

    const data: any = {}
    if (name && typeof name === 'string' && name.trim().length >= 2) data.name = name.trim()

    const updated = await prisma.user.upsert({
      where: { id: userId },
      update: data,
      create: { id: userId, name: data.name || 'User', storageQuota: BigInt(0), storageUsed: BigInt(0) },
    })

    return res.json({
      id: updated.id,
      name: updated.name,
      storageQuota: Number(updated.storageQuota),
      storageUsed: Number(updated.storageUsed),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      role: (req as any).auth?.role || 'user',
    })
  } catch (err) {
    next(err)
  }
})

// Get storage usage
app.get('/api/v1/users/me/storage', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).auth.userId as string
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    return res.json({ storageQuota: Number(user.storageQuota), storageUsed: Number(user.storageUsed) })
  } catch (err) {
    next(err)
  }
})

// Unified error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500
  const message = err?.message || 'Internal Server Error'
  logger.error({ err, status }, 'unhandled error')
  res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } })
})

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'user-service-node listening')
})
