import express from 'express'
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '../prisma/client/index.js'
import { randomUUID, randomBytes } from 'crypto'
import { getEnv } from '@mywebdrive/common'

const app = express()
app.disable('x-powered-by')

// Config
const JWT_SECRET = getEnv('JWT_SECRET', 'dev-secret')
const ACCESS_TOKEN_TTL = parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10) // 15m
const REFRESH_TOKEN_TTL = parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10) // 7d
const REQUIRE_INVITE = (process.env.REGISTRATION_REQUIRE_INVITE || 'false').toLowerCase() === 'true'
const PORT = parseInt(process.env.AUTH_PORT || '7081', 10)


// Owner auth (static code -> owner cookie)
const OWNER_CODE_HASH = process.env.OWNER_CODE_HASH || ''
const OWNER_COOKIE_SECRET = process.env.OWNER_COOKIE_SECRET || 'owner-dev-secret'
const OWNER_COOKIE_TTL_SEC = parseInt(process.env.OWNER_COOKIE_TTL_SEC || '86400', 10) // 24h
const OWNER_COOKIE_SECURE = (process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true'

// DB
const prisma = new PrismaClient()

// Middleware
app.use(express.json())
const logger = createLogger({ service: 'auth-service-node' })
app.use(createHttpLogger(logger))

const { register, metricsMiddleware, metricsHandler } = createMetrics('auth-service-node')
app.use(metricsMiddleware)

// Helpers
function signAccess(userId: string, role: string) {
  return jwt.sign({ user_id: userId, role, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL })
}
function signRefresh(userId: string) {
  return jwt.sign({ user_id: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL })
}

// Routes
app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'auth-service-node' }))
app.get('/metrics', metricsHandler)

// Simple auth middlewares
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

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const role = (req as any).auth?.role
  if (role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

// Register
app.post('/api/v1/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, invitationCode } = req.body || {}
    if (!name || !email || !password) return res.status(400).json({ error: 'Invalid request' })

    if (REQUIRE_INVITE) {
      const inv = await prisma.invitationCode.findUnique({ where: { code: invitationCode || '' } })
      if (!inv || !inv.isActive) return res.status(403).json({ error: 'Invalid or expired invitation code' })
      if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) return res.status(403).json({ error: 'Invalid or expired invitation code' })
      if (inv.usedCount >= inv.usageLimit) return res.status(403).json({ error: 'Invalid or expired invitation code' })
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email already exists' })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        password: hash,
        role: 'user',
      },
    })

    if (REQUIRE_INVITE && invitationCode) {
      const inv = await prisma.invitationCode.findUnique({ where: { code: invitationCode } })
      if (inv) {
        const newCount = inv.usedCount + 1
        await prisma.invitationCode.update({
          where: { code: invitationCode },
          data: {
            usedCount: newCount,
            usedBy: user.id,
            usedAt: new Date(),
            isActive: inv.usageLimit === 1 ? false : inv.isActive,
          },
        })
      }
    }

    const accessToken = signAccess(user.id, user.role)
    const refreshToken = signRefresh(user.id)
    return res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, accessToken, refreshToken })
  } catch (err) {
    next(err)
  }
})

// Login
app.post('/api/v1/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Invalid request' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const accessToken = signAccess(user.id, user.role)
    const refreshToken = signRefresh(user.id)
    return res.json({ accessToken, refreshToken })
  } catch (err) {
    next(err)
  }
})


// Owner login (sets HttpOnly owner cookie) and logout
app.post('/api/v1/auth/owner-login', async (req, res) => {
  try {
    const { code } = req.body || {}
    if (!code) return res.status(400).json({ error: 'Invalid request' })
    if (!OWNER_CODE_HASH) return res.status(503).json({ error: 'Owner code not configured' })
    const ok = await bcrypt.compare(String(code), OWNER_CODE_HASH)
    if (!ok) return res.status(401).json({ error: 'Invalid owner code' })
    const token = jwt.sign({ role: 'owner', issuedAt: Date.now() }, OWNER_COOKIE_SECRET, { expiresIn: OWNER_COOKIE_TTL_SEC })
    const cookie = [
      `owner=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${OWNER_COOKIE_TTL_SEC}`,
      OWNER_COOKIE_SECURE ? 'Secure' : '',
    ].filter(Boolean).join('; ')
    res.setHeader('Set-Cookie', cookie)
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Failed to set owner cookie' })
  }
})

app.post('/api/v1/auth/owner-logout', async (_req, res) => {
  const cookie = [
    'owner=deleted',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    OWNER_COOKIE_SECURE ? 'Secure' : '',
  ].filter(Boolean).join('; ')
  res.setHeader('Set-Cookie', cookie)
  return res.json({ ok: true })
})



// Refresh
app.post('/api/v1/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {}
    if (!refreshToken) return res.status(400).json({ error: 'Invalid request' })
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any
    if (decoded?.type !== 'refresh' || !decoded?.user_id) return res.status(401).json({ error: 'Invalid refresh token' })
    const userId = decoded.user_id as string
    // Optionally ensure user still exists
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' })
    const accessToken = signAccess(user.id, user.role)
    return res.json({ accessToken })
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// Logout (stateless)
app.post('/api/v1/auth/logout', async (_req, res) => {
  return res.status(204).send()
})

// Invitation code admin routes (CRUD-ish)
// Create invitation
app.post('/api/v1/auth/invitations', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { usageLimit, expiresAt, notes } = (req.body || {}) as {
      usageLimit?: number
      expiresAt?: string
      notes?: string
    }
    const limit = Math.max(1, Math.min(usageLimit ?? Number(process.env.INVITE_DEFAULT_USAGE_LIMIT || '1'), 100))
    const codeLength = parseInt(process.env.INVITE_CODE_LENGTH || '16', 10)
    const raw = randomBytes(Math.ceil((codeLength * 3) / 4))
    let code = raw.toString('base64url').replace(/_/g, '-').replace(/\./g, '').slice(0, codeLength)

    const issuedBy = (req as any).auth.userId as string
    const exp = expiresAt ? new Date(expiresAt) : new Date(Date.now() + (parseInt(process.env.INVITE_DEFAULT_TTL_SEC || '2592000', 10) * 1000)) // 30d

    const inv = await prisma.invitationCode.create({
      data: {
        id: randomUUID(),
        code,
        issuedBy,
        issuedAt: new Date(),
        expiresAt: exp,
        usageLimit: limit,
        usedCount: 0,
        isActive: true,
        notes: notes || null,
      },
    })
    return res.status(201).json(inv)
  } catch (err) {
    next(err)
  }
})

// List invitations
app.get('/api/v1/auth/invitations', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const list = await prisma.invitationCode.findMany({ orderBy: { issuedAt: 'desc' } })
    return res.json(list)
  } catch (err) {
    next(err)
  }
})

// Get invitation by code
app.get('/api/v1/auth/invitations/:code', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code
    const inv = await prisma.invitationCode.findUnique({ where: { code } })
    if (!inv) return res.status(404).json({ error: 'Invitation not found' })
    return res.json(inv)
  } catch (err) {
    next(err)
  }
})

// Revoke invitation
app.post('/api/v1/auth/invitations/:code/revoke', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code
    const inv = await prisma.invitationCode.findUnique({ where: { code } })
    if (!inv || !inv.isActive) return res.status(404).json({ error: 'Invitation not found or already revoked' })
    await prisma.invitationCode.update({ where: { code }, data: { isActive: false } })
    return res.json({ message: 'Invitation revoked successfully' })
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
  logger.info({ port: PORT }, 'auth-service-node listening')
})
