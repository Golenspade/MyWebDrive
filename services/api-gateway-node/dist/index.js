import express from 'express';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getEnv } from '@mywebdrive/common';
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
// Read downstream services from env (align with existing Go services)
const AUTH = getEnv('AUTH_SERVICE_URL', 'http://localhost:8081');
const USER = getEnv('USER_SERVICE_URL', 'http://localhost:8082');
const METADATA = getEnv('METADATA_SERVICE_URL', 'http://localhost:7083');
const STORAGE = getEnv('STORAGE_SERVICE_URL', 'http://localhost:8084');
const SHARING = getEnv('SHARING_SERVICE_URL', 'http://localhost:8085');
// Default gateway port aligns with manage-services.sh (9080)
const PORT = parseInt(process.env.GATEWAY_PORT || '9080', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const app = express();
app.disable('x-powered-by');
// Logger & request logging
const logger = createLogger({ service: 'api-gateway-node' });
app.use(createHttpLogger(logger));
// Lightweight CORS for dev
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS,HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-ID');
    if (req.method === 'OPTIONS')
        return res.sendStatus(204);
    next();
});
// Prometheus metrics (unified)
const { register, metricsMiddleware, metricsHandler } = createMetrics('api-gateway-node');
// Simple UV aggregator (per-day unique ip+ua)
const uvByDate = new Map();
function visitorKey(req) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || (req.socket.remoteAddress || '');
    const ua = req.headers['user-agent'] || '';
    return `${ip}|${ua}`;
}
app.use((req, _res, next) => {
    try {
        if (req.path.startsWith('/api/')) {
            const day = new Date().toISOString().slice(0, 10);
            const k = visitorKey(req);
            let set = uvByDate.get(day);
            if (!set) {
                set = new Set();
                uvByDate.set(day, set);
            }
            set.add(k);
        }
    }
    catch { }
    next();
});
app.use(metricsMiddleware);
// Serve static assets from repo (dev only) so frontend can link /assets/* to assetsReal/*
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const ASSETS_DIR = path.resolve(REPO_ROOT, 'assetsReal');
app.use('/assets', express.static(ASSETS_DIR));
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'api-gateway-node' });
});
app.get('/metrics', metricsHandler);
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
        // feed notifications on status transition
        feedHealthNotifications(results);
        res.json({ services: results, time: new Date().toISOString() });
    }
    catch (err) {
        next(err);
    }
});
// Admin overview (aggregates across auth/metadata/storage)
// Returns { totals: Record<string, number>, today: Record<string, number>, last7d: Record<string, Array<{date,value}>> }
app.get('/api/v1/admin/overview', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const authHeader = String(req.headers['authorization'] || '');
        const range = String(req.query.range || '7d').toLowerCase();
        const days = range === 'today' ? 1 : range === '30d' ? 30 : 7;
        const [authStats, fileStats, storageTotals, storageDaily, downloadsTotals, downloadsDaily, gwMetrics, auMetrics, usMetrics, mdMetrics, stMetrics] = await Promise.all([
            fetch(`${AUTH}/api/v1/auth/admin/users/statistics?range=7d`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : { totalUsers: 0, newUsers: 0 }).catch(() => ({ totalUsers: 0, newUsers: 0 })),
            fetch(`${METADATA}/api/v1/files/statistics`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : { totalFiles: 0, totalSizeBytes: 0 }).catch(() => ({ totalFiles: 0, totalSizeBytes: 0 })),
            fetch(`${STORAGE}/api/v1/storage/statistics`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : { totalUploadsBytes: 0, totalUploadsCount: 0 }).catch(() => ({ totalUploadsBytes: 0, totalUploadsCount: 0 })),
            fetch(`${STORAGE}/api/v1/storage/statistics/daily?days=${days}`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : { days, series: [] }).catch(() => ({ days, series: [] })),
            fetch(`${STORAGE}/api/v1/storage/downloads/statistics`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : { totalDownloadsBytes: 0, totalDownloadsCount: 0 }).catch(() => ({ totalDownloadsBytes: 0, totalDownloadsCount: 0 })),
            fetch(`${STORAGE}/api/v1/storage/downloads/statistics/daily?days=${days}`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : { days, series: [] }).catch(() => ({ days, series: [] })),
            // metrics text for requests/errors
            fetch(`http://localhost:${PORT}/metrics`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(`${AUTH}/metrics`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(`${USER}/metrics`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(`${METADATA}/metrics`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(`${STORAGE}/metrics`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
        ]);
        const a = authStats;
        const f = fileStats;
        const st = storageTotals;
        const sd = storageDaily;
        const dlt = downloadsTotals;
        const dld = downloadsDaily;
        const uploadsSeries = Array.isArray(sd.series)
            ? sd.series.map((it) => ({ date: String(it.date), value: Number(it.bytes || 0) }))
            : [];
        const downloadsSeries = Array.isArray(dld.series)
            ? dld.series.map((it) => ({ date: String(it.date), value: Number(it.bytes || 0) }))
            : [];
        const todayISO = new Date().toISOString().slice(0, 10);
        const todayUploadsBytes = Array.isArray(sd.series)
            ? Number((sd.series.find((it) => String(it.date) === todayISO)?.bytes) || 0)
            : 0;
        const todayDownloadsBytes = Array.isArray(dld.series)
            ? Number((dld.series.find((it) => String(it.date) === todayISO)?.bytes) || 0)
            : 0;
        const todayDownloadsCount = Array.isArray(dld.series)
            ? Number((dld.series.find((it) => String(it.date) === todayISO)?.count) || 0)
            : 0;
        function sumRequests(text) {
            let total = 0;
            let errors = 0;
            if (!text)
                return { total, errors };
            const lines = text.split('\n');
            for (const line of lines) {
                if (!line.startsWith('http_requests_total'))
                    continue;
                const m = line.match(/^http_requests_total\{([^}]*)}\s+(\d+(?:\.\d+)?)/);
                if (!m)
                    continue;
                const labels = m[1];
                const val = Number(m[2] || '0');
                total += val;
                const sm = labels.match(/status="(\d{3})"/);
                const status = sm ? Number(sm[1]) : 0;
                if (status >= 500)
                    errors += val;
            }
            return { total, errors };
        }
        const r1 = sumRequests(gwMetrics);
        const r2 = sumRequests(auMetrics);
        const r3 = sumRequests(usMetrics);
        const r4 = sumRequests(mdMetrics);
        const r5 = sumRequests(stMetrics);
        const requests_count = r1.total + r2.total + r3.total + r4.total + r5.total;
        const errors_count = r1.errors + r2.errors + r3.errors + r4.errors + r5.errors;
        function parseLatency(text) {
            const buckets = new Map();
            if (!text)
                return buckets;
            for (const line of text.split('\n')) {
                if (!line.startsWith('http_request_duration_ms_bucket'))
                    continue;
                // http_request_duration_ms_bucket{le="10",method="GET",route="/x",status="200"} 123
                const m = line.match(/^http_request_duration_ms_bucket\{([^}]*)}\s+(\d+(?:\.\d+)?)/);
                if (!m)
                    continue;
                const labels = m[1];
                const val = Number(m[2] || '0');
                const lm = labels.match(/le="([^"]+)"/);
                if (!lm)
                    continue;
                const le = Number(lm[1]);
                if (!Number.isFinite(le))
                    continue;
                buckets.set(le, (buckets.get(le) || 0) + val);
            }
            return buckets;
        }
        function sumCounts(text) {
            let total = 0;
            if (!text)
                return total;
            for (const line of text.split('\n')) {
                if (!line.startsWith('http_request_duration_ms_count'))
                    continue;
                const m = line.match(/^http_request_duration_ms_count\{[^}]*}\s+(\d+(?:\.\d+)?)/);
                if (!m)
                    continue;
                total += Number(m[1] || '0');
            }
            return total;
        }
        // merge buckets across services
        const mergedBuckets = new Map();
        for (const t of [gwMetrics, auMetrics, usMetrics, mdMetrics, stMetrics]) {
            const b = parseLatency(t);
            for (const [le, cnt] of b)
                mergedBuckets.set(le, (mergedBuckets.get(le) || 0) + cnt);
        }
        const totalCount = [gwMetrics, auMetrics, usMetrics, mdMetrics, stMetrics].reduce((acc, t) => acc + sumCounts(t), 0);
        function percentile(p) {
            if (totalCount <= 0 || mergedBuckets.size === 0)
                return 0;
            const target = totalCount * p;
            const entries = Array.from(mergedBuckets.entries()).sort((a, b) => a[0] - b[0]);
            let cum = 0;
            for (const [le, cnt] of entries) {
                cum += cnt;
                if (cum >= target)
                    return le;
            }
            return entries[entries.length - 1][0];
        }
        const latency_ms_p95 = Math.round(percentile(0.95));
        const latency_ms_p99 = Math.round(percentile(0.99));
        // build visits uv series for selected days
        const uvSeries = [];
        for (let i = days; i >= 1; i--) {
            const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
            uvSeries.push({ date: d, value: (uvByDate.get(d)?.size || 0) });
        }
        res.json({
            totals: {
                total_users: Number(a.totalUsers || 0),
                total_files: Number(f.totalFiles || 0),
                total_storage_bytes: Number(f.totalSizeBytes || 0),
            },
            today: {
                uploads_bytes: todayUploadsBytes,
                downloads_bytes: todayDownloadsBytes,
                uploads_count: Number(st.totalUploadsCount || 0),
                downloads_count: todayDownloadsCount,
                active_users: Number(a.newUsers || 0),
                visits_uv: uvByDate.get(todayISO)?.size || 0,
                requests_count,
                errors_count,
                latency_ms_p95,
                latency_ms_p99,
            },
            last7d: {
                uploads_bytes: uploadsSeries,
                downloads_bytes: downloadsSeries,
                visits_uv: uvSeries,
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
        // Reconstruct original path because Express strips the mount prefix
        pathRewrite: (_path, req) => req.originalUrl,
        on: {
            proxyReq: (proxyReq, req) => {
                proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
                proxyReq.setHeader('X-Forwarded-Proto', 'http');
                proxyReq.setHeader('X-Gateway-Service', 'node');
            },
            error: (_err, _req, res) => {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Service temporarily unavailable' }));
            },
        },
    }));
}
// Intercept invitation creation to push notification
app.post('/api/v1/auth/invitations', requireAuth, requireAdmin, express.json(), async (req, res, next) => {
    try {
        const token = parseBearerToken(req);
        const upstream = await fetch(`${AUTH}${req.originalUrl}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(req.body || {}), signal: AbortSignal.timeout(10000),
        });
        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        if (upstream.ok) {
            try {
                const data = JSON.parse(text);
                await pushNotif({ title: '创建邀请码', description: `code=${data.code}`, severity: 'info', service: 'auth-service' });
            }
            catch { }
        }
        return res.end(text);
    }
    catch (err) {
        next(err);
    }
});
// Intercept user registration to push notification
app.post('/api/v1/auth/register', express.json(), async (req, res, next) => {
    try {
        const upstream = await fetch(`${AUTH}${req.originalUrl}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body || {}), signal: AbortSignal.timeout(10000),
        });
        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        if (upstream.ok) {
            try {
                const data = JSON.parse(text);
                await pushNotif({ title: '新用户注册', description: data.email || '', severity: 'success', service: 'auth-service' });
            }
            catch { }
        }
        return res.end(text);
    }
    catch (err) {
        next(err);
    }
});
// Intercept storage finalize to push upload notifications
app.post('/api/v1/storage/uploads/:uploadId/finalize', requireAuth, express.json(), async (req, res, next) => {
    try {
        const token = parseBearerToken(req);
        const upstream = await fetch(`${STORAGE}${req.originalUrl}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(req.body || {}), signal: AbortSignal.timeout(30000),
        });
        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        try {
            if (upstream.ok) {
                const data = JSON.parse(text);
                await pushNotif({ title: '文件上传完成', description: `${data.fileName} (${data.fileSize} bytes)`, severity: 'success', service: 'storage-service' });
            }
            else {
                await pushNotif({ title: '文件上传失败', description: `status=${upstream.status}`, severity: 'warning', service: 'storage-service' });
            }
        }
        catch { }
        return res.end(text);
    }
    catch (err) {
        next(err);
    }
});
// Pre-route notification for downloads (non-blocking)
app.use('/api/v1/storage/files/:fileId/download', async (req, _res, next) => {
    try {
        const fileId = req.params.fileId;
        await pushNotif({ title: '下载请求', description: `fileId=${fileId}`, severity: 'info', service: 'storage-service', });
    }
    catch { }
    return next();
});
// Aggregated admin users list: overlay profile name from User service (SoR)
app.get('/api/v1/admin/users', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const q = String(req.query.query || req.query.q || '');
        const page = String(req.query.page || '1');
        const pageSize = String(req.query.pageSize || '20');
        const authHeader = String(req.headers['authorization'] || '');
        const url = new URL(`${AUTH}/api/v1/auth/admin/users`);
        if (q)
            url.searchParams.set('query', q);
        url.searchParams.set('page', page);
        url.searchParams.set('pageSize', pageSize);
        const base = await fetch(url.toString(), { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(8000) });
        if (!base.ok) {
            res.status(base.status);
            res.setHeader('Content-Type', base.headers.get('content-type') || 'application/json');
            return res.end(await base.text());
        }
        const js = await base.json();
        // Overlay names from user service profile (batch in parallel, best-effort)
        const items = js.items;
        const enriched = await Promise.all(items.map(async (u) => {
            try {
                const r = await fetch(`${USER}/api/v1/users/${u.id}/storage`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(4000) });
                if (r.ok) {
                    const prof = await r.json();
                    return { ...u, name: (prof?.name ?? u.name) };
                }
            }
            catch { }
            return u;
        }));
        return res.json({ ...js, items: enriched });
    }
    catch (err) {
        next(err);
    }
});
// Preview stream: verify ownership via Metadata, set inline headers, and proxy Storage stream
app.get('/api/v1/files/:fileId/preview', requireAuth, async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        const authHeader = String(req.headers['authorization'] || '');
        // Verify ownership and get metadata (mimeType, name)
        const meta = await fetch(`${METADATA}/api/v1/files/${encodeURIComponent(fileId)}`, {
            headers: { Authorization: authHeader },
            signal: AbortSignal.timeout(6000)
        });
        if (!meta.ok) {
            res.status(meta.status);
            res.setHeader('Content-Type', meta.headers.get('content-type') || 'application/json');
            return res.end(await meta.text());
        }
        const info = await meta.json();
        // Fetch storage stream
        const stor = await fetch(`${STORAGE}/api/v1/storage/files/${encodeURIComponent(fileId)}/download`, { signal: AbortSignal.timeout(60_000) });
        if (!stor.ok || !stor.body) {
            res.status(stor.status || 502);
            return res.end(await stor.text().catch(() => ''));
        }
        // Inline headers for preview
        const mime = (info?.mimeType && typeof info.mimeType === 'string') ? info.mimeType : 'application/octet-stream';
        const filename = (info?.name && typeof info.name === 'string') ? info.name : fileId;
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        // @ts-ignore - Node.js ReadableStream has pipe method
        stor.body.pipe(res);
    }
    catch (err) {
        next(err);
    }
});
// Intercept quota change to add audit, then forward to user service
app.patch('/api/v1/users/:id/quota', requireAuth, requireAdmin, express.json(), async (req, res, next) => {
    try {
        const id = req.params.id;
        const token = parseBearerToken(req);
        // Forward request to user service
        const upstream = await fetch(`${USER}${req.originalUrl}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(req.body || {}),
            signal: AbortSignal.timeout(10000),
        });
        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        if (upstream.ok) {
            // Best-effort audit log
            try {
                const actorId = req.auth?.userId;
                const newQuota = (req.body || {}).storageQuota;
                if (prisma) {
                    await prisma.auditLog.create({ data: { action: 'users.quota.set', target: id, actorId, meta: { storageQuota: newQuota } } });
                }
                else {
                    const auditId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const item = { id: auditId, action: 'users.quota.set', target: id, actorId, createdAt: new Date().toISOString(), meta: { storageQuota: newQuota } };
                    AUDITS.unshift(item);
                    if (AUDITS.length > 500)
                        AUDITS.pop();
                }
            }
            catch { }
            // Notification for quota changed
            try {
                const newQuota = (req.body || {}).storageQuota;
                await pushNotif({ title: '\u914d\u989d\u4fee\u6539', description: `user=${id} -> ${newQuota} bytes`, severity: 'info', service: 'user-service' });
            }
            catch { }
        }
        return res.end(text);
    }
    catch (err) {
        next(err);
    }
});
// Route mapping aligned with current API contract
mountProxy('/api/v1/auth', AUTH);
mountProxy('/api/v1/users', USER);
// Important: route share-creation/list under files to sharing before metadata catch-all
app.use('/api/v1/files/:fileId/shares', createProxyMiddleware({
    target: SHARING,
    changeOrigin: true,
    // Preserve full original path (e.g., /api/v1/files/<id>/shares)
    pathRewrite: (_path, req) => req.originalUrl,
    on: {
        proxyReq: (proxyReq, req) => {
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
            proxyReq.setHeader('X-Forwarded-Proto', 'http');
            proxyReq.setHeader('X-Gateway-Service', 'node');
        },
    },
}));
mountProxy('/api/v1/catalog', METADATA);
// Special handling for catalog publish - audit & notify
app.put('/api/v1/files/:fileId/catalog', requireAuth, requireAdmin, express.json(), async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        const { slug, version, channel } = req.body || {};
        const actorId = req.auth?.userId;
        // Forward to metadata service
        const token = parseBearerToken(req);
        const metadataRes = await fetch(`${METADATA}/api/v1/files/${fileId}/catalog`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(req.body),
        });
        const data = await metadataRes.json();
        if (metadataRes.ok) {
            // Audit log (DB or memory fallback)
            await pushAudit({ action: 'publish', target: `${slug}@${version}`, actorId, meta: { fileId, slug, version, channel } });
            // Notification
            await pushNotif({
                title: '发布成功',
                description: `项目 ${slug} 版本 ${version} (${channel}) 已发布`,
                severity: 'success',
                service: 'catalog',
                meta: { fileId, slug, version, channel },
            });
            logger.info({ fileId, slug, version, channel, actorId }, 'Catalog published');
        }
        return res.status(metadataRes.status).json(data);
    }
    catch (err) {
        next(err);
    }
});
mountProxy('/api/v1/files', METADATA);
mountProxy('/api/v1/folders', METADATA);
mountProxy('/api/v1/search', METADATA);
mountProxy('/api/v1/catalog', METADATA);
mountProxy('/api/v1/storage', STORAGE);
mountProxy('/api/v1/shares', SHARING);
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    logger.info({ port: PORT }, 'gateway-node listening');
});
// Unified JSON error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = err?.message || 'Internal Server Error';
    logger.error({ err, status }, 'unhandled error');
    res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } });
});
const NOTIFS = [];
const AUDITS = [];
const MAX_NOTIFS = 500;
const lastStatus = new Map();
const sseClients = new Set();
// Optional Prisma (fallback to memory if not present)
let prisma = null;
(async () => {
    try {
        // Avoid TS module resolution at build time by using dynamic factory
        // eslint-disable-next-line no-new-func
        const dynImport = new Function('p', 'return import(p)');
        const mod = await dynImport('../prisma/client/index.js');
        prisma = new mod.PrismaClient();
    }
    catch { }
})();
async function pushNotif(n) {
    if (prisma) {
        try {
            const created = await prisma.adminNotification.create({ data: { title: n.title, description: n.description, severity: n.severity, service: n.service, unread: n.unread ?? true, meta: n.meta || undefined } });
            broadcastNotif(created);
            return created;
        }
        catch { }
    }
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const notif = { id, title: n.title, description: n.description, severity: n.severity, service: n.service, unread: n.unread ?? true, createdAt: new Date().toISOString(), meta: n.meta };
    NOTIFS.unshift(notif);
    if (NOTIFS.length > MAX_NOTIFS)
        NOTIFS.pop();
    broadcastNotif(notif);
    return notif;
}
async function pushAudit(a) {
    if (prisma) {
        try {
            const created = await prisma.auditLog.create({ data: { action: a.action, target: a.target, actorId: a.actorId, meta: a.meta || undefined } });
            return created;
        }
        catch { }
    }
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const item = { id, action: a.action, target: a.target, actorId: a.actorId, createdAt: new Date().toISOString(), meta: a.meta };
    AUDITS.unshift(item);
    if (AUDITS.length > 500)
        AUDITS.pop();
    return item;
}
function broadcastNotif(notif) {
    for (const res of sseClients) {
        try {
            res.write(`event: notification\n`);
            res.write(`data: ${JSON.stringify(notif)}\n\n`);
        }
        catch {
            try {
                res.end();
            }
            catch { }
            sseClients.delete(res);
        }
    }
}
async function feedHealthNotifications(results) {
    for (const r of results) {
        const prev = lastStatus.get(r.name);
        const st = r.status === 'healthy' ? 'healthy' : 'error';
        if (prev && prev !== st) {
            if (st === 'error') {
                await pushNotif({ title: '服务异常', description: `${r.name} (${r.url}) 状态：error`, severity: 'critical', service: r.name, meta: { url: r.url, status: r.status } });
            }
            else if (st === 'healthy') {
                await pushNotif({ title: '服务恢复', description: `${r.name} (${r.url}) 状态：healthy`, severity: 'success', service: r.name, meta: { url: r.url, status: r.status }, unread: false });
            }
        }
        lastStatus.set(r.name, st);
    }
}
app.get('/api/v1/admin/notifications', requireAuth, requireAdmin, async (req, res) => {
    const unreadOnly = String(req.query.unreadOnly || 'false').toLowerCase() === 'true';
    const service = req.query.service || '';
    const severity = req.query.severity || '';
    const q = req.query.q || '';
    const pageParam = Number.parseInt(String(req.query.page || '1'), 10);
    const pageSizeParam = Number.parseInt(String(req.query.pageSize || '20'), 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = Number.isFinite(pageSizeParam) ? Math.max(1, Math.min(200, pageSizeParam)) : 20;
    const from = req.query.from || '';
    const to = req.query.to || '';
    if (prisma) {
        const where = {};
        if (unreadOnly)
            where.unread = true;
        if (service)
            where.service = service;
        if (severity)
            where.severity = severity;
        if (q)
            where.OR = [
                { title: { contains: q } },
                { description: { contains: q } },
                { service: { contains: q } },
            ];
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = new Date(from);
            if (to)
                where.createdAt.lte = new Date(to);
        }
        const [total, items] = await Promise.all([
            prisma.adminNotification.count({ where }),
            prisma.adminNotification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        ]);
        return res.json({ items, page, pageSize, total });
    }
    let items = NOTIFS;
    if (unreadOnly)
        items = items.filter((n) => n.unread);
    if (service)
        items = items.filter((n) => n.service === service);
    if (severity)
        items = items.filter((n) => n.severity === severity);
    if (q)
        items = items.filter((n) => (n.title + ' ' + (n.description || '') + ' ' + (n.service || '')).toLowerCase().includes(q.toLowerCase()));
    if (from)
        items = items.filter(n => new Date(n.createdAt) >= new Date(from));
    if (to)
        items = items.filter(n => new Date(n.createdAt) <= new Date(to));
    const total = items.length;
    const slice = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    return res.json({ items: slice, page, pageSize, total });
});
app.post('/api/v1/admin/notifications', requireAuth, requireAdmin, express.json(), async (req, res) => {
    const { title, description, severity, service, meta } = req.body || {};
    if (!title || !severity)
        return res.status(400).json({ error: 'Invalid request' });
    const created = await pushNotif({ title, description, severity, service, meta });
    return res.status(201).json(created);
});
app.post('/api/v1/admin/notifications/mark-read', requireAuth, requireAdmin, express.json(), async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (prisma) {
        await prisma.adminNotification.updateMany({ where: { id: { in: ids } }, data: { unread: false } });
        return res.json({ ok: true, updated: ids.length });
    }
    for (const id of ids) {
        const n = NOTIFS.find((x) => x.id === id);
        if (n)
            n.unread = false;
    }
    return res.json({ ok: true, updated: ids.length });
});
// SSE stream for notifications (supports Authorization header or access_token query)
app.get('/api/v1/admin/notifications/stream', (req, res) => {
    function send401() { res.status(401).end('Unauthorized'); }
    try {
        let token = null;
        const h = String(req.headers.authorization || '');
        const parts = h.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer')
            token = parts[1];
        if (!token)
            token = req.query.access_token || null;
        if (!token)
            return send401();
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded?.user_id || (decoded?.role || 'user') !== 'admin')
            return res.status(403).end('Admin required');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        (async () => {
            try {
                let init = [];
                if (prisma) {
                    init = await prisma.adminNotification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
                }
                else {
                    init = NOTIFS.slice(0, 50);
                }
                res.write(`event: snapshot\n`);
                res.write(`data: ${JSON.stringify(init)}\n\n`);
            }
            catch { }
        })();
        sseClients.add(res);
        req.on('close', () => {
            sseClients.delete(res);
        });
    }
    catch {
        return send401();
    }
});
app.get('/api/v1/admin/audit', requireAuth, requireAdmin, async (_req, res) => {
    if (prisma) {
        const items = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
        return res.json(items);
    }
    return res.json(AUDITS.slice(0, 200));
});
app.post('/api/v1/admin/audit', requireAuth, requireAdmin, express.json(), async (req, res) => {
    const { action, target, meta } = req.body || {};
    if (!action)
        return res.status(400).json({ error: 'Invalid request' });
    const actorId = req.auth?.userId;
    if (prisma) {
        const item = await prisma.auditLog.create({ data: { action, target, actorId, meta: meta || undefined } });
        return res.status(201).json(item);
    }
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const item = { id, action, target, createdAt: new Date().toISOString(), actorId, meta };
    AUDITS.unshift(item);
    if (AUDITS.length > 500)
        AUDITS.pop();
    return res.status(201).json(item);
});
//# sourceMappingURL=index.js.map