import express from 'express';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getEnv } from '@mywebdrive/common';
import { randomUUID } from 'crypto';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import jwt from 'jsonwebtoken';
// Read downstream services from env (align with existing Go services)
const AUTH = getEnv('AUTH_SERVICE_URL', 'http://localhost:8081');
const USER = getEnv('USER_SERVICE_URL', 'http://localhost:8082');
const METADATA = getEnv('METADATA_SERVICE_URL', 'http://localhost:8083');
const STORAGE = getEnv('STORAGE_SERVICE_URL', 'http://localhost:8084');
const SHARING = getEnv('SHARING_SERVICE_URL', 'http://localhost:8085');
const PORT = parseInt(process.env.GATEWAY_PORT || '9080', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const app = express();
app.disable('x-powered-by');
// Request ID middleware (simple)
app.use((req, res, next) => {
    const rid = req.headers['x-request-id'] || randomUUID();
    req.headers['x-request-id'] = rid;
    res.setHeader('x-request-id', rid);
    next();
});
// Lightweight CORS for dev
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS,HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-ID');
    if (req.method === 'OPTIONS')
        return res.sendStatus(204);
    next();
});
// Basic logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms rid=:req[x-request-id]'));
// Prometheus metrics
const register = new Registry();
collectDefaultMetrics({ register });
const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
});
const httpRequestDurationMs = new Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    labelNames: ['method', 'route', 'status'],
    registers: [register],
});
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const route = req.route?.path || req.path;
        const labels = { method: req.method, route, status: String(res.statusCode) };
        httpRequestsTotal.inc(labels);
        httpRequestDurationMs.observe(labels, Date.now() - start);
    });
    next();
});
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'api-gateway-node' });
});
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
// Aggregated admin health (aligns with Go gateway intent)
app.get('/api/v1/admin/health', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
        const services = [
            { name: 'auth-service', url: `${AUTH}/health` },
            { name: 'user-service', url: `${USER}/health` },
            { name: 'metadata-service', url: `${METADATA}/health` },
            { name: 'storage-service', url: `${STORAGE}/health` },
            { name: 'sharing-service', url: `${SHARING}/health` },
        ];
        const results = await Promise.all(services.map(async (s) => {
            try {
                const resp = await fetch(s.url, { signal: AbortSignal.timeout(4000) });
                return { name: s.name, url: s.url, status: resp.ok ? 'healthy' : 'error' };
            }
            catch {
                return { name: s.name, url: s.url, status: 'error' };
            }
        }));
        res.json({ services: results, time: new Date().toISOString() });
    }
    catch (err) {
        next(err);
    }
});
// Admin overview (degraded aggregate aligned to Go shape)
// Returns { totals: Record<string, number>, today: Record<string, number>, last7d: Record<string, Array<{date,value}>> }
app.get('/api/v1/admin/overview', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
        // Minimal degraded data with zeros; can be enhanced to fetch downstream /metrics later
        const now = new Date();
        const day = (d) => d.toISOString().slice(0, 10);
        const days = [];
        for (let i = 7; i >= 1; i--) {
            const dt = new Date(now.getTime() - i * 24 * 3600 * 1000);
            days.push(day(dt));
        }
        const zeros = days.map((date) => ({ date, value: 0 }));
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
        });
    }
    catch (err) {
        next(err);
    }
});
// --- Simple auth middlewares ---
function parseBearerToken(req) {
    const header = req.headers.authorization || '';
    const parts = header.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer')
        return parts[1];
    return null;
}
function requireAuth(req, res, next) {
    try {
        const token = parseBearerToken(req);
        if (!token)
            return res.status(401).json({ error: 'Unauthorized' });
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded?.user_id)
            return res.status(401).json({ error: 'Unauthorized' });
        req.auth = { userId: decoded.user_id, role: decoded.role || 'user' };
        next();
    }
    catch {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}
function requireAdmin(req, res, next) {
    const role = req.auth?.role;
    if (role !== 'admin')
        return res.status(403).json({ error: 'Admin access required' });
    next();
}
// Helper to mount a proxy with base path stripping
function mountProxy(basePath, target) {
    app.use(basePath, createProxyMiddleware({
        target,
        changeOrigin: true,
        // Strip the basePath so downstream services receive canonical paths
        pathRewrite: { [`^${basePath}`]: '' },
        // Forward original host/proto info
        on: {
            proxyReq: (proxyReq, req) => {
                proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
                proxyReq.setHeader('X-Forwarded-Proto', 'http');
                proxyReq.setHeader('X-Gateway-Service', 'node');
            },
            error: (_err, _req, res) => {
                // Fallback error shape
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Service temporarily unavailable' }));
            },
        },
    }));
}
// Route mapping aligned with current API contract
mountProxy('/api/v1/auth', AUTH);
mountProxy('/api/v1/users', USER);
mountProxy('/api/v1/files', METADATA);
mountProxy('/api/v1/folders', METADATA);
mountProxy('/api/v1/storage', STORAGE);
mountProxy('/api/v1/shares', SHARING);
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[gateway-node] listening on http://localhost:${PORT}`);
});
// Unified JSON error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = err?.message || 'Internal Server Error';
    res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } });
});
//# sourceMappingURL=index.js.map
