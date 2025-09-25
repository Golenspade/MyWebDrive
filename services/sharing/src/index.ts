import express from 'express'
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../prisma/client/index.js'
import { randomUUID, randomBytes } from 'crypto'
import { getEnv } from '@mywebdrive/common'
import { Readable } from 'stream'

const app = express()
app.disable('x-powered-by')

// Config
const JWT_SECRET = getEnv('JWT_SECRET', 'dev-secret')
const PORT = parseInt(process.env.SHARING_PORT || '7085', 10)
const STORAGE_SERVICE_URL = process.env.STORAGE_SERVICE_URL || 'http://localhost:7084'
const METADATA_SERVICE_URL = process.env.METADATA_SERVICE_URL || 'http://localhost:7083'
const DATABASE_URL = process.env.SHARING_DATABASE_URL || 'file:./sharing.db'
const MAX_PWD_ATTEMPTS = parseInt(process.env.SHARE_MAX_PASSWORD_ATTEMPTS || '5', 10)
const LOCK_SECONDS = parseInt(process.env.SHARE_LOCK_SECONDS || '900', 10)

// DB
process.env.SHARING_DATABASE_URL = DATABASE_URL
const prisma = new PrismaClient()

// Middleware
app.use(express.json())
const logger = createLogger({ service: 'sharing-service-node' })
app.use(createHttpLogger(logger))

const { register, metricsMiddleware, metricsHandler } = createMetrics('sharing-service-node')
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
function signServiceToken() {
  return jwt.sign({ role: 'service', type: 'service' }, JWT_SECRET, { expiresIn: 300 })
}
function signShareAccessToken(shareId: string) {
  return jwt.sign({ type: 'share_access', share_id: shareId }, JWT_SECRET, { expiresIn: 900 }) // 15m
}
function verifyShareAccessToken(token?: string | null) {
  if (!token) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (decoded?.type === 'share_access' && decoded?.share_id) return decoded.share_id as string
    return null
  } catch {
    return null
  }
}

// Health & metrics
app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'sharing-service-node' }))
app.get('/metrics', metricsHandler)

// Public: get share info by token
app.get('/api/v1/shares/:shareToken', async (req, res, next) => {
  try {
    const token = req.params.shareToken
    const share = await prisma.share.findUnique({ where: { token } })
    if (!share || !share.isActive) return res.status(404).json({ error: 'Share not found' })
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: 'Share expired' })
    return res.json({
      id: share.id,
      token: share.token,
      fileId: share.fileId,
      requiresPassword: !!share.passwordHash,
      expiresAt: share.expiresAt,
    })
  } catch (err) {
    next(err)
  }
})

// Public: password access to receive a share access token
app.post('/api/v1/shares/:shareToken/access', async (req, res, next) => {
  try {
    const token = req.params.shareToken
    const { password } = (req.body || {}) as { password?: string }
    const share = await prisma.share.findUnique({ where: { token } })
    if (!share || !share.isActive) return res.status(404).json({ error: 'Share not found' })
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: 'Share expired' })
    if (share.lockUntil && share.lockUntil.getTime() > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try later.' })
    if (share.passwordHash) {
      if (!password) return res.status(401).json({ error: 'Password required' })
      const ok = await bcrypt.compare(password, share.passwordHash)
      if (!ok) {
        const attempts = (share.failedAttempts || 0) + 1
        const lockUntil = attempts >= MAX_PWD_ATTEMPTS ? new Date(Date.now() + LOCK_SECONDS * 1000) : null
        await prisma.share.update({ where: { id: share.id }, data: { failedAttempts: lockUntil ? 0 : attempts, lockUntil } })
        return res.status(401).json({ error: 'Invalid password' })
      }
      // Reset attempts on success
      if ((share.failedAttempts || 0) > 0 || share.lockUntil) {
        await prisma.share.update({ where: { id: share.id }, data: { failedAttempts: 0, lockUntil: null } })
      }
    }
    const accessToken = signShareAccessToken(share.id)
    return res.json({ accessToken, shareId: share.id })
  } catch (err) {
    next(err)
  }
})

// Public: download via token (requires access token if password protected)
app.get('/api/v1/shares/:shareToken/download', async (req, res, next) => {
  try {
    const token = req.params.shareToken
    const access = (req.headers['x-share-access-token'] as string) || (req.query['access_token'] as string) || ''
    const share = await prisma.share.findUnique({ where: { token } })
    if (!share || !share.isActive) return res.status(404).json({ error: 'Share not found' })
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: 'Share expired' })
    if (share.maxDownloads !== null && share.maxDownloads !== undefined && share.downloadCount >= share.maxDownloads) {
      return res.status(410).json({ error: 'Share download limit reached' })
    }
    if (share.passwordHash) {
      const shareId = verifyShareAccessToken(access)
      if (shareId !== share.id) return res.status(401).json({ error: 'Share access required' })
    }

    // Simple IP-based rate limiting per share
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
    if (!checkRateLimit(ip, share.id)) {
      return res.status(429).json({ error: 'Too many requests' })
    }

    // Proxy download from storage using service token
    const svcToken = signServiceToken()
    const resp = await fetch(`${STORAGE_SERVICE_URL}/api/v1/storage/files/${encodeURIComponent(share.fileId)}`, {
      headers: { Authorization: `Bearer ${svcToken}` },
    })
    if (!resp.ok || !resp.body) {
      return res.status(resp.status || 502).json({ error: 'Failed to fetch file' })
    }
    // Forward headers and stream
    const contentType = resp.headers.get('content-type') || 'application/octet-stream'
    const contentLength = resp.headers.get('content-length')
    res.setHeader('Content-Type', contentType)
    if (contentLength) res.setHeader('Content-Length', contentLength)
    const stream = Readable.fromWeb(resp.body as any)
    stream.pipe(res)
    stream.on('end', async () => {
      try {
        await prisma.share.update({ where: { id: share.id }, data: { downloadCount: (share.downloadCount || 0) + 1 } })
      } catch {}
    })
  } catch (err) {
    next(err)
  }
})

// Authenticated: create a share for a file
app.post('/api/v1/files/:fileId/shares', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const { password, expiresAt, maxDownloads } = (req.body || {}) as { password?: string; expiresAt?: string; maxDownloads?: number }
    const ownerId = (req as any).auth.userId as string
    const id = randomUUID()
    // Short readable token
    const t = randomBytes(12).toString('base64url')
    const passwordHash = password ? await bcrypt.hash(password, 10) : null
    const exp = expiresAt ? new Date(expiresAt) : null

    // Verify file belongs to user via metadata-service (auth required)
    try {
      const bearer = req.headers.authorization || ''
      const metaResp = await fetch(`${METADATA_SERVICE_URL}/api/v1/files/${encodeURIComponent(fileId)}`, {
        headers: { Authorization: bearer },
        signal: AbortSignal.timeout(8000),
      })
      if (!metaResp.ok) {
        if (metaResp.status === 404) return res.status(404).json({ error: 'File not found' })
        if (metaResp.status === 403) return res.status(403).json({ error: 'Access denied' })
        return res.status(502).json({ error: 'Metadata service unavailable' })
      }
    } catch (e) {
      return res.status(502).json({ error: 'Failed to verify file with metadata' })
    }

    const share = await prisma.share.create({
      data: {
        id,
        token: t,
        ownerId,
        fileId,
        passwordHash,
        expiresAt: exp,
        isActive: true,
        maxDownloads: typeof maxDownloads === 'number' ? maxDownloads : null,
      },
    })
    res.status(201).json({ id: share.id, token: share.token, shareToken: share.token, fileId: share.fileId, expiresAt: share.expiresAt, requiresPassword: !!share.passwordHash })
  } catch (err) {
    next(err)
  }
})

// Authenticated: list shares for a file
app.get('/api/v1/files/:fileId/shares', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const ownerId = (req as any).auth.userId as string
    const items = await prisma.share.findMany({ where: { ownerId, fileId }, orderBy: { createdAt: 'desc' } })
    res.json(items.map(s => ({ id: s.id, token: s.token, shareToken: s.token, fileId: s.fileId, expiresAt: s.expiresAt, isActive: s.isActive, requiresPassword: !!s.passwordHash, downloadCount: s.downloadCount, maxDownloads: s.maxDownloads })))
  } catch (err) {
    next(err)
  }
})

// Authenticated: list my shares
app.get('/api/v1/shares', requireAuth, async (req, res, next) => {
  try {
    const ownerId = (req as any).auth.userId as string
    const items = await prisma.share.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } })
    res.json(items.map(s => ({ id: s.id, token: s.token, shareToken: s.token, fileId: s.fileId, expiresAt: s.expiresAt, isActive: s.isActive, requiresPassword: !!s.passwordHash, downloadCount: s.downloadCount, maxDownloads: s.maxDownloads })))
  } catch (err) {
    next(err)
  }
})

// Authenticated: update a share
app.patch('/api/v1/shares/:shareId', requireAuth, async (req, res, next) => {
  try {
    const shareId = req.params.shareId
    const ownerId = (req as any).auth.userId as string
    const { password, expiresAt, isActive } = (req.body || {}) as { password?: string; expiresAt?: string; isActive?: boolean }
    const share = await prisma.share.findUnique({ where: { id: shareId } })
    if (!share || share.ownerId !== ownerId) return res.status(404).json({ error: 'Share not found' })
    const data: any = {}
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (typeof expiresAt === 'string') data.expiresAt = new Date(expiresAt)
    if (typeof password === 'string') data.passwordHash = password ? await bcrypt.hash(password, 10) : null
    const updated = await prisma.share.update({ where: { id: shareId }, data })
    res.json({ id: updated.id, token: updated.token, fileId: updated.fileId, expiresAt: updated.expiresAt, isActive: updated.isActive, requiresPassword: !!updated.passwordHash })
  } catch (err) {
    next(err)
  }
})

// Authenticated: revoke a share
app.delete('/api/v1/shares/:shareId', requireAuth, async (req, res, next) => {
  try {
    const shareId = req.params.shareId
    const ownerId = (req as any).auth.userId as string
    const share = await prisma.share.findUnique({ where: { id: shareId } })
    if (!share || share.ownerId !== ownerId) return res.status(404).json({ error: 'Share not found' })
    await prisma.share.update({ where: { id: shareId }, data: { isActive: false } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Batch revoke ---
app.post('/api/v1/shares/batch/revoke', requireAuth, async (req, res, next) => {
  try {
    const ownerId = (req as any).auth.userId as string
    const ids = ((req.body || {}).ids as string[]) || []
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No ids provided' })
    const resu = await prisma.share.updateMany({ where: { id: { in: ids }, ownerId }, data: { isActive: false } })
    res.json({ revoked: resu.count })
  } catch (err) {
    next(err)
  }
})

// --- Stats ---
app.get('/api/v1/shares/stats', requireAuth, async (req, res, next) => {
  try {
    const ownerId = (req as any).auth.userId as string
    const [total, active, sumDownloads] = await Promise.all([
      prisma.share.count({ where: { ownerId } }),
      prisma.share.count({ where: { ownerId, isActive: true } }),
      prisma.share.aggregate({ _sum: { downloadCount: true }, where: { ownerId } }),
    ])
    res.json({ total, active, downloads: sumDownloads._sum.downloadCount || 0 })
  } catch (err) {
    next(err)
  }
})

// --- Advanced permissions ---
app.post('/api/v1/shares/:shareId/permissions', requireAuth, async (req, res, next) => {
  try {
    const shareId = req.params.shareId
    const ownerId = (req as any).auth.userId as string
    const { maxDownloads, expiresAt, password } = (req.body || {}) as { maxDownloads?: number | null; expiresAt?: string | null; password?: string | null }
    const share = await prisma.share.findUnique({ where: { id: shareId } })
    if (!share || share.ownerId !== ownerId) return res.status(404).json({ error: 'Share not found' })
    const data: any = {}
    if (typeof maxDownloads === 'number' || maxDownloads === null) data.maxDownloads = maxDownloads
    if (typeof expiresAt === 'string' || expiresAt === null) data.expiresAt = expiresAt ? new Date(expiresAt) : null
    if (typeof password === 'string' || password === null) data.passwordHash = password ? await bcrypt.hash(password, 10) : null
    const updated = await prisma.share.update({ where: { id: shareId }, data })
    res.json({ id: updated.id, isActive: updated.isActive, maxDownloads: updated.maxDownloads, expiresAt: updated.expiresAt, requiresPassword: !!updated.passwordHash })
  } catch (err) {
    next(err)
  }
})

// In-memory rate limiter per ip+share within a time window
const rateLimiter = new Map<string, { count: number; resetTime: number }>()
function checkRateLimit(ip: string, shareId: string) {
  const key = `${ip}:${shareId}`
  const now = Date.now()
  const windowMs = 60_000
  const limit = 10
  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  const record = rateLimiter.get(key)!
  if (now > record.resetTime) {
    record.count = 1
    record.resetTime = now + windowMs
    return true
  }
  if (record.count >= limit) return false
  record.count++
  return true
}

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500
  const message = err?.message || 'Internal Server Error'
  logger.error({ err, status }, 'unhandled error')
  res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } })
})

app.listen(PORT, async () => {
  logger.info({ port: PORT }, 'sharing-service-node listening')
})
