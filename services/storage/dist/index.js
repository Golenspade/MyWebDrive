import express from 'express';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import { createWriteStream, existsSync, createReadStream } from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getEnv } from '@mywebdrive/common';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { isMainThread, parentPort } from 'worker_threads';
const app = express();
app.disable('x-powered-by');
// Config
const JWT_SECRET = getEnv('JWT_SECRET', 'dev-secret');
const PORT = parseInt(process.env.STORAGE_PORT || '7084', 10);
const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve('storage');
const USE_MINIO = (process.env.USE_MINIO || 'false').toLowerCase() === 'true';
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
const MINIO_USE_SSL = (process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'mywebdrive';
const METADATA_SERVICE_URL = process.env.METADATA_SERVICE_URL || 'http://localhost:7083';
const STORAGE_DB_URL = process.env.STORAGE_DATABASE_URL || 'file:./storage.db';
// DB (Prisma)
import { PrismaClient } from '../prisma/client';
process.env.STORAGE_DATABASE_URL = STORAGE_DB_URL;
const prisma = new PrismaClient();
// Middleware
app.use(express.json());
app.use((req, res, next) => {
    const rid = req.headers['x-request-id'] || randomUUID();
    req.headers['x-request-id'] = rid;
    res.setHeader('x-request-id', rid);
    next();
});
app.use(morgan(':method :url :status :res[content-length] - :response-time ms rid=:req[x-request-id]'));
// Metrics
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
// Optional: MD5 worker support
if (!isMainThread) {
    parentPort?.on('message', async ({ filePath }) => {
        try {
            const hash = createHash('md5');
            const rs = createReadStream(filePath);
            await pipeline(rs, new Transform({ transform(chunk, _enc, cb) { hash.update(chunk); cb(null, chunk); } }));
            parentPort?.postMessage({ hash: hash.digest('hex') });
        }
        catch (e) {
            parentPort?.postMessage({ error: e?.message || 'md5_failed' });
        }
    });
}
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
const SESSIONS = new Map();
const SESSION_TTL_MS = 24 * 3600 * 1000;
const CLEANUP_PERIOD_MS = 30 * 60 * 1000;
setInterval(async () => {
    const now = Date.now();
    for (const [id, s] of SESSIONS) {
        if (new Date(s.expiresAt).getTime() < now) {
            SESSIONS.delete(id);
            await fsp.rm(path.join(STORAGE_PATH, 'temp', id), { force: true, recursive: true });
            try {
                await prisma.uploadSession.delete({ where: { id } });
            }
            catch { }
        }
    }
}, CLEANUP_PERIOD_MS).unref();
// Health & metrics
app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'storage-service-node' }));
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
// Prepare dirs
async function ensureDir(p) {
    if (!existsSync(p))
        await fsp.mkdir(p, { recursive: true });
}
// Persist helpers
async function persistSession(session) {
    const data = {
        id: session.id,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        uploadedChunks: JSON.stringify(session.uploadedChunks || {}),
        chunkMd5s: session.chunkMd5s ? JSON.stringify(session.chunkMd5s) : null,
        ownerId: session.ownerId,
        status: session.status,
        storagePath: session.storagePath || null,
        md5Hash: session.md5Hash || null,
        expiresAt: new Date(session.expiresAt),
    };
    await prisma.uploadSession.upsert({ where: { id: session.id }, update: data, create: data });
}
async function loadActiveSessions() {
    const now = new Date();
    const rows = await prisma.uploadSession.findMany({ where: { status: 'uploading', expiresAt: { gt: now } } });
    for (const r of rows) {
        let uploadedChunks = {};
        let chunkMd5s = {};
        try {
            uploadedChunks = JSON.parse(r.uploadedChunks || '{}');
        }
        catch { }
        try {
            chunkMd5s = JSON.parse(r.chunkMd5s || '{}');
        }
        catch { }
        SESSIONS.set(r.id, {
            id: r.id,
            fileName: r.fileName,
            fileSize: r.fileSize,
            mimeType: r.mimeType,
            chunkSize: r.chunkSize,
            totalChunks: r.totalChunks,
            uploadedChunks,
            chunkMd5s,
            ownerId: r.ownerId,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            expiresAt: r.expiresAt.toISOString(),
            status: r.status,
            storagePath: r.storagePath || undefined,
            md5Hash: r.md5Hash || undefined,
        });
    }
}
// Create upload session
app.post('/api/v1/storage/uploads', requireAuth, async (req, res) => {
    const { fileName, fileSize, mimeType, chunkSize } = req.body || {};
    if (!fileName || !fileSize || typeof fileSize !== 'number')
        return res.status(400).json({ error: 'Invalid request' });
    const cs = chunkSize && chunkSize > 0 ? chunkSize : 5 * 1024 * 1024;
    const totalChunks = Math.ceil(fileSize / cs);
    const id = randomUUID();
    const now = new Date();
    const session = {
        id,
        fileName,
        fileSize,
        mimeType: mimeType || 'application/octet-stream',
        chunkSize: cs,
        totalChunks,
        uploadedChunks: {},
        ownerId: req.auth.userId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
        status: 'uploading',
    };
    SESSIONS.set(id, session);
    await ensureDir(path.join(STORAGE_PATH, 'temp', id));
    await persistSession(session);
    res.status(201).json(session);
});
// Upload chunk (streaming, supports raw binary with X-Chunk-Index or fallback multipart)
app.patch('/api/v1/storage/uploads/:uploadId', requireAuth, async (req, res) => {
    const uploadId = req.params.uploadId;
    // Prefer header X-Chunk-Index; fallback to body field 'chunkIndex'
    const hdr = req.headers['x-chunk-index'] || '';
    const chunkIndexStr = hdr || req.body?.chunkIndex || '';
    const chunkIndex = Number.parseInt(chunkIndexStr, 10);
    const session = SESSIONS.get(uploadId);
    if (!session)
        return res.status(404).json({ error: 'Upload session not found' });
    if (session.ownerId !== req.auth.userId)
        return res.status(403).json({ error: 'Access denied' });
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks)
        return res.status(400).json({ error: 'Invalid chunk index' });
    const tempDir = path.join(STORAGE_PATH, 'temp', uploadId);
    await ensureDir(tempDir);
    const finalChunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
    const tmpChunkPath = finalChunkPath + '.part';
    // Stream request body to file and compute MD5 on the fly
    const { createHash } = await import('crypto');
    const hasher = createHash('md5');
    await new Promise((resolve, reject) => {
        const ws = createWriteStream(tmpChunkPath);
        let aborted = false;
        req.on('aborted', () => {
            aborted = true;
            ws.destroy(new Error('client aborted'));
        });
        req.on('data', (buf) => {
            hasher.update(buf);
        });
        req.on('error', (e) => ws.destroy(e));
        ws.on('error', (e) => reject(e));
        ws.on('finish', () => {
            if (aborted)
                return reject(new Error('Upload aborted'));
            resolve();
        });
        req.pipe(ws);
    });
    const chunkMd5 = hasher.digest('hex');
    // Atomic rename .part -> final
    await fsp.rename(tmpChunkPath, finalChunkPath).catch(async () => {
        // Fallback copy+remove if rename across devices fails
        await fsp.copyFile(tmpChunkPath, finalChunkPath);
        await fsp.rm(tmpChunkPath, { force: true });
    });
    session.uploadedChunks[chunkIndex] = true;
    session.chunkMd5s = session.chunkMd5s || {};
    session.chunkMd5s[chunkIndex] = chunkMd5;
    session.updatedAt = new Date().toISOString();
    await persistSession(session);
    const uploaded = Object.keys(session.uploadedChunks).length;
    const isComplete = uploaded === session.totalChunks;
    res.json({ chunkIndex, md5: chunkMd5, uploadedChunks: Object.keys(session.uploadedChunks).map((n) => Number(n)), isComplete });
});
// Get upload status (GET and HEAD)
function getStatus(session) {
    return session;
}
app.get('/api/v1/storage/uploads/:uploadId', requireAuth, (req, res) => {
    const uploadId = req.params.uploadId;
    const session = SESSIONS.get(uploadId);
    if (!session)
        return res.status(404).json({ error: 'Upload session not found' });
    if (session.ownerId !== req.auth.userId)
        return res.status(403).json({ error: 'Access denied' });
    res.json(getStatus(session));
});
app.head('/api/v1/storage/uploads/:uploadId', requireAuth, (req, res) => {
    const uploadId = req.params.uploadId;
    const session = SESSIONS.get(uploadId);
    if (!session || session.ownerId !== req.auth.userId)
        return res.sendStatus(404);
    res.sendStatus(200);
});
// Finalize upload -> merge chunks with MD5 and commit
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
async function mergeChunks(session, expectedMd5) {
    // Merge into a temp file first using streaming with backpressure
    const tempDir = path.join(STORAGE_PATH, 'temp', session.id);
    await ensureDir(tempDir);
    const tempMergedPath = path.join(tempDir, 'merged');
    const hasher = createHash('md5');
    const ws = createWriteStream(tempMergedPath);
    // Transform that updates md5 and passes through
    const hashT = new Transform({
        transform(chunk, _enc, cb) {
            hasher.update(chunk);
            cb(null, chunk);
        },
    });
    // Pipe each chunk sequentially to the same writer to honor order
    for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        await pipeline(createReadStream(chunkPath), hashT, ws, { end: false });
    }
    // finalize writer
    await new Promise((resolve) => ws.end(resolve));
    const md5Hex = hasher.digest('hex');
    if (expectedMd5 && expectedMd5.toLowerCase() !== md5Hex.toLowerCase()) {
        // Do not remove chunks so client may retry finalize with correct expected MD5
        await fsp.rm(tempMergedPath, { force: true });
        const err = new Error('MD5 checksum mismatch');
        err.code = 'MD5_MISMATCH';
        throw err;
    }
    // Commit to final storage (local or MinIO)
    const finalDir = path.join(STORAGE_PATH, 'files');
    await ensureDir(finalDir);
    const finalPath = path.join(finalDir, session.id);
    if (USE_MINIO) {
        try {
            const { Client } = await import('minio');
            const [host, portStr] = MINIO_ENDPOINT.split(':');
            const client = new Client({ endPoint: host, port: Number(portStr || (MINIO_USE_SSL ? '443' : '9000')), useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
            const exists = await client.bucketExists(MINIO_BUCKET).catch(() => false);
            if (!exists) {
                await client.makeBucket(MINIO_BUCKET, '');
            }
            const objectName = `files/${session.id}`;
            await client.putObject(MINIO_BUCKET, objectName, createReadStream(tempMergedPath), session.fileSize);
            await fsp.rm(tempMergedPath, { force: true });
            // Cleanup chunks directory after successful commit
            await fsp.rm(tempDir, { force: true, recursive: true });
            return { finalPath: `minio://${MINIO_BUCKET}/${objectName}`, md5: md5Hex };
        }
        catch (e) {
            // Fall back to local path if minio upload failed: move to files dir
            await fsp.rename(tempMergedPath, finalPath).catch(async () => {
                // If rename fails (e.g., cross-device), copy+remove
                await fsp.copyFile(tempMergedPath, finalPath);
                await fsp.rm(tempMergedPath, { force: true });
            });
            await fsp.rm(tempDir, { force: true, recursive: true });
            return { finalPath, md5: md5Hex };
        }
    }
    else {
        // Local: move merged temp file to final path
        await fsp.rename(tempMergedPath, finalPath).catch(async () => {
            await fsp.copyFile(tempMergedPath, finalPath);
            await fsp.rm(tempMergedPath, { force: true });
        });
        await fsp.rm(tempDir, { force: true, recursive: true });
        return { finalPath, md5: md5Hex };
    }
}
app.post('/api/v1/storage/uploads/:uploadId/finalize', requireAuth, async (req, res) => {
    const uploadId = req.params.uploadId;
    const session = SESSIONS.get(uploadId);
    if (!session)
        return res.status(404).json({ error: 'Upload session not found' });
    if (session.ownerId !== req.auth.userId)
        return res.status(403).json({ error: 'Access denied' });
    if (Object.keys(session.uploadedChunks).length !== session.totalChunks)
        return res.status(400).json({ error: 'Not all chunks uploaded' });
    try {
        const { expectedMd5 } = (req.body || {});
        const { finalPath, md5 } = await mergeChunks(session, expectedMd5);
        session.status = 'completed';
        session.storagePath = finalPath;
        session.md5Hash = md5;
        session.updatedAt = new Date().toISOString();
        await persistSession(session);
        // Notify metadata service: create or update file + version
        try {
            const bearer = String(req.headers['authorization'] || '');
            const r = await callMetadataServiceWithRetry(`${METADATA_SERVICE_URL}/api/v1/files/${encodeURIComponent(uploadId)}/versions`, { fileName: session.fileName, size: session.fileSize, mimeType: session.mimeType, storagePath: finalPath, md5Hash: md5, parentId: null }, bearer);
            if (!r.ok) {
                // Rollback stored file if metadata creation failed
                if (USE_MINIO) {
                    try {
                        const { Client } = await import('minio');
                        const [host, portStr] = MINIO_ENDPOINT.split(':');
                        const client = new Client({ endPoint: host, port: Number(portStr || (MINIO_USE_SSL ? '443' : '9000')), useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
                        await client.removeObject(MINIO_BUCKET, `files/${session.id}`);
                    }
                    catch { }
                }
                else {
                    try {
                        await fsp.rm(finalPath, { force: true });
                    }
                    catch { }
                }
                session.status = 'failed';
                await persistSession(session);
                return res.status(502).json({ error: 'Failed to create metadata' });
            }
        }
        catch { }
        return res.json({
            uploadId,
            fileName: session.fileName,
            fileSize: session.fileSize,
            storagePath: finalPath,
            md5Hash: md5,
            status: 'completed',
            fileId: uploadId,
        });
    }
    catch (err) {
        if (err?.code === 'MD5_MISMATCH') {
            session.status = 'failed';
            await persistSession(session);
            return res.status(422).json({ error: 'MD5 checksum mismatch' });
        }
        session.status = 'failed';
        await persistSession(session);
        return res.status(500).json({ error: 'Failed to merge file' });
    }
});
// Cancel upload
app.delete('/api/v1/storage/uploads/:uploadId', requireAuth, async (req, res) => {
    const uploadId = req.params.uploadId;
    const session = SESSIONS.get(uploadId);
    if (!session)
        return res.status(404).json({ error: 'Upload session not found' });
    if (session.ownerId !== req.auth.userId)
        return res.status(403).json({ error: 'Access denied' });
    SESSIONS.delete(uploadId);
    await fsp.rm(path.join(STORAGE_PATH, 'temp', uploadId), { force: true, recursive: true });
    res.sendStatus(204);
});
// Download file
function requireServiceToken(req, res, next) {
    try {
        const token = parseBearerToken(req);
        if (!token)
            return res.status(401).json({ error: 'Unauthorized' });
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.role !== 'service')
            return res.status(403).json({ error: 'Service access required' });
        next();
    }
    catch {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}
// Simple exponential backoff retry for metadata calls
async function callMetadataServiceWithRetry(url, data, bearer, maxRetries = 3) {
    let lastErr;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: bearer },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(10000),
            });
            if (resp.ok)
                return resp;
            lastErr = new Error(`HTTP ${resp.status}`);
        }
        catch (error) {
            lastErr = error;
        }
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
    throw lastErr;
}
app.get('/api/v1/storage/files/:fileId', requireServiceToken, async (req, res) => {
    const fileId = req.params.fileId;
    if (USE_MINIO) {
        try {
            const { Client } = await import('minio');
            const client = new Client({ endPoint: MINIO_ENDPOINT.split(':')[0], port: Number(MINIO_ENDPOINT.split(':')[1] || (MINIO_USE_SSL ? '443' : '9000')), useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
            const obj = await client.getObject(MINIO_BUCKET, `files/${fileId}`);
            res.setHeader('Content-Type', 'application/octet-stream');
            obj.on('error', () => res.end());
            obj.pipe(res);
        }
        catch (e) {
            return res.status(404).json({ error: 'File not found' });
        }
    }
    else {
        const p = path.join(STORAGE_PATH, 'files', fileId);
        try {
            await fsp.stat(p);
        }
        catch {
            return res.status(404).json({ error: 'File not found' });
        }
        res.sendFile(p);
    }
});
// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = err?.message || 'Internal Server Error';
    res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } });
});
app.listen(PORT, async () => {
    await ensureDir(path.join(STORAGE_PATH, 'files'));
    await ensureDir(path.join(STORAGE_PATH, 'temp'));
    try {
        await loadActiveSessions();
    }
    catch { }
    // eslint-disable-next-line no-console
    console.log(`[storage-service-node] listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map