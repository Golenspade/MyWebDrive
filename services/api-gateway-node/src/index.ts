import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { getEnv } from '@mywebdrive/common'
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability'
import jwt from 'jsonwebtoken'

// Read downstream services from env (align with existing Go services)
const AUTH = getEnv('AUTH_SERVICE_URL', 'http://localhost:8081')
const USER = getEnv('USER_SERVICE_URL', 'http://localhost:8082')
const METADATA = getEnv('METADATA_SERVICE_URL', 'http://localhost:8083')
const STORAGE = getEnv('STORAGE_SERVICE_URL', 'http://localhost:8084')
const SHARING = getEnv('SHARING_SERVICE_URL', 'http://localhost:8085')

// Default gateway port aligns with manage-services.sh (9080)
const PORT = parseInt(process.env.GATEWAY_PORT || '9080', 10)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

const app = express()
app.disable('x-powered-by')

// Logger & request logging
const logger = createLogger({ service: 'api-gateway-node' })
app.use(createHttpLogger(logger))

// Lightweight CORS for dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS,HEAD')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-ID')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Prometheus metrics (unified)
const { register, metricsMiddleware, metricsHandler } = createMetrics('api-gateway-node')
app.use(metricsMiddleware)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway-node' })
})
app.get('/metrics', metricsHandler)

// Aggregated admin health (aligns with Go gateway intent)
app.get('/api/v1/admin/health', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const services = [
      { name: 'auth-service', url: `${AUTH}/health` },
      { name: 'user-service', url: `${USER}/health` },
      { name: 'metadata-service', url: `${METADATA}/health` },
      { name: 'storage-service', url: `${STORAGE}/health` },
      { name: 'sharing-service', url: `${SHARING}/health` },
    ]

    const results = await Promise.all(
      services.map(async (s) => {
        try {
          const resp = await fetch(s.url, { signal: AbortSignal.timeout(4000) })
          return { name: s.name, url: s.url, status: resp.ok ? 'healthy' : 'error' }
        } catch {
          return { name: s.name, url: s.url, status: 'error' }
        }
      })
    )

    res.json({ services: results, time: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})

// Admin overview (degraded aggregate aligned to Go shape)
// Returns { totals: Record<string, number>, today: Record<string, number>, last7d: Record<string, Array<{date,value}>> }
app.get('/api/v1/admin/overview', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    // Minimal degraded data with zeros; can be enhanced to fetch downstream /metrics later
    const now = new Date()
    const day = (d: Date) => d.toISOString().slice(0, 10)
    const days: string[] = []
    for (let i = 7; i >= 1; i--) {
      const dt = new Date(now.getTime() - i * 24 * 3600 * 1000)
      days.push(day(dt))
    }
    const zeros = days.map((date) => ({ date, value: 0 }))
    res.json({
      totals: {
        total_users: 0,
        total_files: 0,
        total_storage_bytes: 0,
      },
      today: {
        uploads_bytes: 0,
        downloads_bytes: 0,
        uploads_count: 0,
        downloads_count: 0,
        active_users: 0,
        visits_uv: 0,
        requests_count: 0,
        errors_count: 0,
      },
      last7d: {
        uploads_bytes: zeros,
        downloads_bytes: zeros,
        visits_uv: zeros,
      },
    })
  } catch (err) {
    next(err)
  }
})

// --- Simple auth middlewares ---
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

// Helper to mount a proxy with base path stripping
function mountProxy(basePath: string, target: string) {
  app.use(
    basePath,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      // Reconstruct original path because Express strips the mount prefix
      pathRewrite: (_path, req) => (req as any).originalUrl,
      on: {
        proxyReq: (proxyReq: any, req: any) => {
          proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '')
          proxyReq.setHeader('X-Forwarded-Proto', 'http')
          proxyReq.setHeader('X-Gateway-Service', 'node')
        },
        error: (_err: any, _req: any, res: any) => {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Service temporarily unavailable' }))
        },
      },
    })
  )
}

// Route mapping aligned with current API contract
mountProxy('/api/v1/auth', AUTH)
mountProxy('/api/v1/users', USER)
// Important: route share-creation/list under files to sharing before metadata catch-all
app.use(
  '/api/v1/files/:fileId/shares',
  createProxyMiddleware({
    target: SHARING,
    changeOrigin: true,
    // Preserve full original path (e.g., /api/v1/files/<id>/shares)
    pathRewrite: (_path, req) => (req as any).originalUrl,
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        proxyReq.setHeader('X-Forwarded-Host', (req as any).headers.host || '')
        proxyReq.setHeader('X-Forwarded-Proto', 'http')
        proxyReq.setHeader('X-Gateway-Service', 'node')
      },
    },
  })
)
mountProxy('/api/v1/files', METADATA)
mountProxy('/api/v1/folders', METADATA)
mountProxy('/api/v1/storage', STORAGE)
mountProxy('/api/v1/shares', SHARING)

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  logger.info({ port: PORT }, 'gateway-node listening')
})

// Unified JSON error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500
  const message = err?.message || 'Internal Server Error'
  logger.error({ err, status }, 'unhandled error')
  res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } })
})
