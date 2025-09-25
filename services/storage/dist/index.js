import express from 'express';
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability';
import jwt from 'jsonwebtoken';
import { createWriteStream, existsSync, createReadStream } from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getEnv } from '@mywebdrive/common';
import { Worker } from 'worker_threads';
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
// Redis for download concurrency gating
import Redis from 'ioredis';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
const redis = new Redis(REDIS_URL);
// Limits
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
// DB (Prisma)
import { PrismaClient } from '../prisma/client';
process.env.STORAGE_DATABASE_URL = STORAGE_DB_URL;
const prisma = new PrismaClient();
// Middleware
app.use(express.json());
const logger = createLogger({ service: 'storage-service-node' });
app.use(createHttpLogger(logger));
const { register, metricsMiddleware, metricsHandler } = createMetrics('storage-service-node');
app.use(metricsMiddleware);
// Optional MD5 worker usage (off by default)
const MD5_IN_WORKER = (process.env.MD5_IN_WORKER || 'false').toLowerCase() === 'true';
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
app.get('/metrics', metricsHandler);
// Prepare dirs
async function ensureDir(p) {
    if (!existsSync(p))
        await fsp.mkdir(p, { recursive: true });
}
// Persist helpers
// Owner cookie and download gating (lightweight, in-memory; production should use Redis)
const OWNER_COOKIE_SECRET = process.env.OWNER_COOKIE_SECRET || 'owner-dev-secret';
const DOWNLOAD_CONCURRENCY_LIMIT = parseInt(process.env.DOWNLOAD_CONCURRENCY_LIMIT || '3', 10);
function parseCookies(header) {
    const out = {};
    if (!header)
        return out;
    for (const part of header.split(';')) {
        const [k, v] = part.split('=');
        if (!k)
            continue;
        out[k.trim()] = decodeURIComponent((v || '').trim());
    }
    return out;
}
function isOwner(req) {
    try {
        const ck = parseCookies(req.headers['cookie']);
        const token = ck['owner'];
        if (!token)
            return false;
        const payload = jwt.verify(token, OWNER_COOKIE_SECRET);
        return payload?.role === 'owner';
    }
    catch {
        return false;
    }
}
function clientIp(req) {
    const xf = req.headers['x-forwarded-for'] || '';
    const ip = xf.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    return ip;
}
async function tryAcquire(ip) {
    const key = `dl:${ip}`;
    const limit = DOWNLOAD_CONCURRENCY_LIMIT;
    const ttlSec = 600;
    const script = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])
    local cur = tonumber(redis.call('GET', key) or '0')
    if cur < limit then
      cur = redis.call('INCR', key)
      if cur == 1 then redis.call('EXPIRE', key, ttl) end
      return 1
    else
      return 0
    end
  `;
    try {
        const ok = await redis.eval(script, 1, key, String(limit), String(ttlSec));
        return Number(ok) === 1;
    }
    catch {
        // fail-open or fail-closed? safer to fail-closed here
        return false;
    }
}
async function release(ip) {
    const key = `dl:${ip}`;
    try {
        const v = await redis.decr(key);
        if (v <= 0)
            await redis.del(key);
    }
    catch {
        // ignore
    }
}
// Simple token-bucket bandwidth throttle (bytes per second)
import { Transform } from 'stream';
const DOWNLOAD_BYTES_PER_SEC = Math.floor((Number(process.env.DOWNLOAD_Mbps || '300') * 1024 * 1024) / 8);
class BandwidthThrottle extends Transform {
    constructor(bps) {
        super();
        this.capacity = Math.max(1024 * 64, bps);
        this.tokens = this.capacity;
        this.refillTimer = setInterval(() => {
            this.tokens = Math.min(this.tokens + bps, this.capacity);
            this.resume();
        }, 100);
        this.on('close', () => clearInterval(this.refillTimer));
    }
    _transform(chunk, _enc, cb) {
        const trySend = () => {
            if (this.tokens >= chunk.length) {
                this.tokens -= chunk.length;
                this.push(chunk);
                cb();
            }
            else {
                const need = chunk.length - this.tokens;
                const waitMs = Math.ceil((need / this.capacity) * 100);
                setTimeout(trySend, Math.max(10, waitMs));
            }
        };
        trySend();
    }
}
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
// Helper: parse TUS Upload-Metadata header (key base64, comma separated)
function parseTusMetadataHeader(h) {
    const meta = {};
    if (!h)
        return meta;
    const parts = String(h).split(',');
    for (const p of parts) {
        const [k, v] = p.trim().split(' ');
        if (!k || !v)
            continue;
        try {
            meta[k] = Buffer.from(v, 'base64').toString('utf8');
        }
        catch { /* ignore */ }
    }
    return meta;
}
app.post('/api/v1/storage/uploads', requireAuth, async (req, res) => {
    // Support both JSON body (Node flow) and TUS-style headers
    const uploadLenHdr = req.headers['upload-length'];
    const uploadMetaHdr = req.headers['upload-metadata'];
    if (uploadLenHdr) {
        // TUS create session
        const fileSize = Number.parseInt(String(uploadLenHdr), 10);
        if (!Number.isFinite(fileSize) || fileSize <= 0)
            return res.status(400).json({ error: 'Invalid Upload-Length' });
        if (fileSize > MAX_FILE_SIZE)
            return res.status(400).json({ error: 'File too large (max 2GB)' });
        const meta = parseTusMetadataHeader(uploadMetaHdr);
        const fileName = meta.filename || meta.name || 'unnamed';
        const mimeType = meta.mimetype || meta.type || 'application/octet-stream';
        const cs = 5 * 1024 * 1024; // default chunk size for internal chunking
        const totalChunks = Math.ceil(fileSize / cs);
        const id = randomUUID();
        const now = new Date();
        const session = {
            id,
            fileName,
            fileSize,
            mimeType,
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
        res.status(201).setHeader('Location', `/api/v1/storage/uploads/${id}`).end();
        return;
    }
    // JSON body create session
    const { fileName, fileSize, mimeType, chunkSize } = req.body || {};
    if (!fileName || !fileSize || typeof fileSize !== 'number')
        return res.status(400).json({ error: 'Invalid request' });
    if (fileSize > MAX_FILE_SIZE)
        return res.status(400).json({ error: 'File too large (max 2GB)' });
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
    const session = SESSIONS.get(uploadId);
    if (!session)
        return res.status(404).json({ error: 'Upload session not found' });
    if (session.ownerId !== req.auth.userId)
        return res.status(403).json({ error: 'Access denied' });
    const tusOffsetHdr = req.headers['upload-offset'];
    const tusMode = typeof tusOffsetHdr !== 'undefined';
    let chunkIndex = -1;
    if (tusMode) {
        // TUS: enforce sequential append at current offset
        const currentContiguous = (() => {
            let i = 0;
            while (session.uploadedChunks[i])
                i++;
            const offset = Math.min(session.fileSize, i * session.chunkSize);
            return offset;
        })();
        const offset = Number.parseInt(String(tusOffsetHdr), 10);
        if (!Number.isFinite(offset) || offset < 0)
            return res.status(400).json({ error: 'Invalid Upload-Offset' });
        if (offset !== currentContiguous)
            return res.status(409).end();
        // Map offset -> chunk index
        if (offset % session.chunkSize !== 0)
            return res.status(400).json({ error: 'Offset not aligned to chunk size' });
        chunkIndex = Math.floor(offset / session.chunkSize);
        if (chunkIndex < 0 || chunkIndex >= session.totalChunks)
            return res.status(400).json({ error: 'Invalid chunk index' });
        // Optional: validate Content-Length matches expected size
        const expectedLen = chunkIndex === session.totalChunks - 1 ? session.fileSize - chunkIndex * session.chunkSize : session.chunkSize;
        const contentLen = Number.parseInt(String(req.headers['content-length'] || '0'), 10);
        if (Number.isFinite(contentLen) && contentLen > 0 && contentLen !== expectedLen) {
            return res.status(400).json({ error: 'Content-Length mismatch' });
        }
    }
    else {
        // Node flow: Prefer header X-Chunk-Index; fallback to body field 'chunkIndex'
        const hdr = req.headers['x-chunk-index'] || '';
        const chunkIndexStr = hdr || req.body?.chunkIndex || '';
        chunkIndex = Number.parseInt(chunkIndexStr, 10);
        if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks)
            return res.status(400).json({ error: 'Invalid chunk index' });
    }
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
    if (tusMode) {
        // Return next offset (contiguous)
        let i = 0;
        while (session.uploadedChunks[i])
            i++;
        const nextOffset = Math.min(session.fileSize, i * session.chunkSize);
        res.setHeader('Upload-Offset', String(nextOffset));
        return res.sendStatus(204);
    }
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
    // Include a derived uploadOffset for convenience
    let i = 0;
    while (session.uploadedChunks[i])
        i++;
    const uploadOffset = Math.min(session.fileSize, i * session.chunkSize);
    res.json({ ...getStatus(session), uploadOffset });
});
app.head('/api/v1/storage/uploads/:uploadId', requireAuth, (req, res) => {
    const uploadId = req.params.uploadId;
    const session = SESSIONS.get(uploadId);
    if (!session || session.ownerId !== req.auth.userId)
        return res.sendStatus(404);
    // TUS-compatible headers
    let i = 0;
    while (session.uploadedChunks[i])
        i++;
    const uploadOffset = Math.min(session.fileSize, i * session.chunkSize);
    res.setHeader('Upload-Length', String(session.fileSize));
    res.setHeader('Upload-Offset', String(uploadOffset));
    res.sendStatus(200);
});
// Finalize upload -> merge chunks with MD5 and commit
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
async function computeMd5InWorker(filePath) {
    return new Promise((resolve, reject) => {
        // Use a dedicated worker module to avoid booting the server in the worker thread
        const workerUrl = new URL('./md5-worker.js', import.meta.url);
        const worker = new Worker(workerUrl, { workerData: { filePath } });
        const cleanup = () => { try {
            worker.terminate();
        }
        catch { } };
        worker.on('message', (msg) => {
            if (msg?.hash) {
                cleanup();
                resolve(String(msg.hash));
            }
            else if (msg?.error) {
                cleanup();
                reject(new Error(String(msg.error)));
            }
        });
        worker.on('error', (err) => { cleanup(); reject(err); });
        worker.on('exit', (code) => { if (code !== 0)
            reject(new Error(`worker exited with code ${code}`)); });
    });
}
async function mergeChunks(session, expectedMd5) {
    // Merge into a temp file first using streaming with backpressure
    const tempDir = path.join(STORAGE_PATH, 'temp', session.id);
    await ensureDir(tempDir);
    const tempMergedPath = path.join(tempDir, 'merged');
    const hasher = MD5_IN_WORKER ? null : createHash('md5');
    const ws = createWriteStream(tempMergedPath);
    // Transform that updates md5 and passes through
    const hashT = hasher
        ? new Transform({
            transform(chunk, _enc, cb) {
                hasher.update(chunk);
                cb(null, chunk);
            },
        })
        : null;
    // Pipe each chunk sequentially to the same writer to honor order
    for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        if (hashT) {
            await pipeline(createReadStream(chunkPath), hashT, ws, { end: false });
        }
        else {
            await pipeline(createReadStream(chunkPath), ws, { end: false });
        }
    }
    // finalize writer
    await new Promise((resolve) => ws.end(resolve));
    const md5Hex = hasher ? hasher.digest('hex') : await computeMd5InWorker(tempMergedPath);
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
    if (session.fileSize > MAX_FILE_SIZE)
        return res.status(400).json({ error: 'File too large (max 2GB)' });
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
// Public download with concurrency gating (owner bypass). Bandwidth limit to be added with throttle stream.
app.get('/api/v1/storage/files/:fileId/download', async (req, res) => {
    const ip = clientIp(req);
    let acquired = false;
    if (!isOwner(req)) {
        if (!(await tryAcquire(ip)))
            return res.status(429).json({ error: 'Too many concurrent downloads' });
        acquired = true;
        res.on('close', () => { void release(ip); });
        res.on('finish', () => { void release(ip); });
    }
    const fileId = req.params.fileId;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileId}"`);
    if (USE_MINIO) {
        try {
            const { Client } = await import('minio');
            const client = new Client({ endPoint: MINIO_ENDPOINT.split(':')[0], port: Number(MINIO_ENDPOINT.split(':')[1] || (MINIO_USE_SSL ? '443' : '9000')), useSSL: MINIO_USE_SSL, accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY });
            const obj = await client.getObject(MINIO_BUCKET, `files/${fileId}`);
            obj.on('error', () => {
                if (acquired)
                    void release(ip);
                res.end();
            });
            const throttled = isOwner(req) ? obj : obj.pipe(new BandwidthThrottle(DOWNLOAD_BYTES_PER_SEC));
            throttled.pipe(res);
        }
        catch (e) {
            if (acquired)
                void release(ip);
            return res.status(404).json({ error: 'File not found' });
        }
    }
    else {
        const p = path.join(STORAGE_PATH, 'files', fileId);
        try {
            await fsp.stat(p);
        }
        catch {
            if (acquired)
                void release(ip);
            return res.status(404).json({ error: 'File not found' });
        }
        const fsStream = createReadStream(p).on('error', () => {
            if (acquired)
                void release(ip);
            res.end();
        });
        const throttled = isOwner(req) ? fsStream : fsStream.pipe(new BandwidthThrottle(DOWNLOAD_BYTES_PER_SEC));
        throttled.pipe(res);
    }
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
// STS issuance stub (to be implemented with @alicloud/sts20150401)
app.post('/api/v1/storage/oss/sts', requireAuth, async (_req, res) => {
    const roleArn = process.env.ALIYUN_ROLE_ARN || '';
    if (!roleArn)
        return res.status(503).json({ error: 'STS not configured' });
    return res.status(501).json({ error: 'STS not implemented yet' });
});
app.use((err, _req, res, _next) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const message = err?.message || 'Internal Server Error';
    logger.error({ err, status }, 'unhandled error');
    res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } });
});
app.listen(PORT, async () => {
    await ensureDir(path.join(STORAGE_PATH, 'files'));
    await ensureDir(path.join(STORAGE_PATH, 'temp'));
    try {
        await loadActiveSessions();
    }
    catch { }
    logger.info({ port: PORT }, 'storage-service-node listening');
});
//# sourceMappingURL=index.js.map