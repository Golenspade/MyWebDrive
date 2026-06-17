import express from 'express';
import helmet from 'helmet';
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../prisma/client/index.js';
import { getEnv } from '@mywebdrive/common';
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');
// Config
const JWT_SECRET = getEnv('JWT_SECRET', 'dev-secret');
const PORT = parseInt(process.env.USER_PORT || '7082', 10);
const DEFAULT_USER_QUOTA_BYTES = (() => {
    const v = process.env.USER_DEFAULT_QUOTA_BYTES || '';
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0)
        return Math.floor(n);
    // Dev-friendly default: 10 GiB
    return 10 * 1024 * 1024 * 1024;
})();
// DB
const prisma = new PrismaClient();
// Middleware
app.use(express.json());
const logger = createLogger({ service: 'user-service-node' });
app.use(createHttpLogger(logger));
// Metrics
const { register, metricsMiddleware, metricsHandler } = createMetrics('user-service-node');
app.use(metricsMiddleware);
// Helpers
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
// Routes
app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'user-service-node' }));
app.get('/metrics', metricsHandler);
// Get current user profile
app.get('/api/v1/users/me', requireAuth, async (req, res, next) => {
    try {
        const userId = req.auth.userId;
        let user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            user = await prisma.user.create({
                data: { id: userId, name: 'User', storageQuota: BigInt(DEFAULT_USER_QUOTA_BYTES), storageUsed: BigInt(0) },
            });
        }
        return res.json({
            id: user.id,
            name: user.name,
            storageQuota: Number(user.storageQuota),
            storageUsed: Number(user.storageUsed),
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            role: req.auth?.role || 'user',
        });
    }
    catch (err) {
        next(err);
    }
});
// Update current user profile
app.patch('/api/v1/users/me', requireAuth, async (req, res, next) => {
    try {
        const userId = req.auth.userId;
        const { name } = (req.body || {});
        const data = {};
        if (name && typeof name === 'string' && name.trim().length >= 2)
            data.name = name.trim();
        const updated = await prisma.user.upsert({
            where: { id: userId },
            update: data,
            create: { id: userId, name: data.name || 'User', storageQuota: BigInt(DEFAULT_USER_QUOTA_BYTES), storageUsed: BigInt(0) },
        });
        return res.json({
            id: updated.id,
            name: updated.name,
            storageQuota: Number(updated.storageQuota),
            storageUsed: Number(updated.storageUsed),
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            role: req.auth?.role || 'user',
        });
    }
    catch (err) {
        next(err);
    }
});
// Get storage usage
app.get('/api/v1/users/me/storage', requireAuth, async (req, res, next) => {
    try {
        const userId = req.auth.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.json({ storageQuota: Number(user.storageQuota), storageUsed: Number(user.storageUsed) });
    }
    catch (err) {
        next(err);
    }
});
// --- Admin: quota & storage ---
app.patch('/api/v1/users/:id/quota', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = req.params.id;
        const { storageQuota } = (req.body || {});
        if (typeof storageQuota !== 'number' || !Number.isFinite(storageQuota) || storageQuota < 0) {
            return res.status(400).json({ error: 'Invalid storageQuota' });
        }
        const updated = await prisma.user.upsert({
            where: { id },
            update: { storageQuota: BigInt(Math.floor(storageQuota)) },
            create: { id, name: 'User', storageQuota: BigInt(Math.floor(storageQuota)), storageUsed: BigInt(0) },
        });
        return res.json({ id: updated.id, storageQuota: Number(updated.storageQuota) });
    }
    catch (err) {
        next(err);
    }
});
// Adjust storage used (owner)
app.post('/api/v1/users/me/storage/adjust', requireAuth, async (req, res, next) => {
    try {
        const userId = req.auth.userId;
        const { delta } = (req.body || {});
        const d = Number(delta);
        if (!Number.isFinite(d))
            return res.status(400).json({ error: 'Invalid delta' });
        const user = await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, name: 'User', storageQuota: BigInt(DEFAULT_USER_QUOTA_BYTES), storageUsed: BigInt(0) },
        });
        const cur = Number(user.storageUsed || 0);
        const next = Math.max(0, Math.floor(cur + d));
        const updated = await prisma.user.update({ where: { id: userId }, data: { storageUsed: BigInt(next) } });
        return res.json({ storageQuota: Number(updated.storageQuota), storageUsed: Number(updated.storageUsed) });
    }
    catch (err) {
        next(err);
    }
});
app.get('/api/v1/users/:id/storage', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = req.params.id;
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        return res.json({ id: user.id, name: user.name, storageQuota: Number(user.storageQuota), storageUsed: Number(user.storageUsed) });
    }
    catch (err) {
        next(err);
    }
});
// Unified error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = err?.message || 'Internal Server Error';
    logger.error({ err, status }, 'unhandled error');
    res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } });
});
app.listen(PORT, () => {
    logger.info({ port: PORT }, 'user-service-node listening');
});
//# sourceMappingURL=index.js.map