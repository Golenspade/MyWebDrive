import pino from 'pino';
import pinoHttp from 'pino-http';
import os from 'os';
import client, { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { randomUUID } from 'crypto';
export function createLogger(opts) {
    const level = (process.env.LOG_LEVEL || opts.level || 'info').toLowerCase();
    const base = {
        service: opts.service,
        env: process.env.NODE_ENV || 'development',
        instance: process.env.INSTANCE_ID || os.hostname(),
    };
    const redactPaths = [
        'req.headers.authorization',
        'headers.authorization',
        'authorization',
        'password',
        '*.password',
        'accessToken',
        'refreshToken',
    ];
    const redact = { paths: redactPaths, remove: true };
    const options = { level, base, redact };
    return pino(options);
}
export function createHttpLogger(logger) {
    const options = {
        logger: logger,
        // Reuse or create x-request-id and reflect back in response
        genReqId(req, res) {
            const existing = req.headers['x-request-id'] || '';
            const id = existing || randomUUID();
            // propagate to downstream and response
            req.headers['x-request-id'] = id;
            res.setHeader('x-request-id', id);
            return id;
        },
        autoLogging: true,
        customLogLevel(_req, res, err) {
            const sc = Number(res.statusCode || 0);
            if (err || sc >= 500)
                return 'error';
            if (sc >= 400)
                return 'warn';
            return 'info';
        },
        serializers: {
            // keep logs compact but useful
            req(req) {
                return { id: req.id, method: req.method };
            },
            res(res) {
                return { statusCode: res.statusCode };
            },
        },
    };
    return pinoHttp(options);
}
function matchedRouteTemplate(req) {
    return typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
}
export function createMetrics(service) {
    const register = new Registry();
    register.setDefaultLabels({ service, instance: process.env.INSTANCE_ID || os.hostname() });
    collectDefaultMetrics({ register });
    const httpRequestsTotal = new client.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status'],
        registers: [register],
    });
    const httpRequestDurationMs = new client.Histogram({
        name: 'http_request_duration_ms',
        help: 'Duration of HTTP requests in ms',
        buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
        labelNames: ['method', 'route', 'status'],
        registers: [register],
    });
    const metricsMiddleware = (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const route = matchedRouteTemplate(req);
            const labels = { method: req.method, route, status: String(res.statusCode) };
            httpRequestsTotal.inc(labels);
            httpRequestDurationMs.observe(labels, Date.now() - start);
        });
        next();
    };
    const metricsHandler = async (_req, res) => {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
    };
    return { register, httpRequestsTotal, httpRequestDurationMs, metricsMiddleware, metricsHandler };
}
export function createAppTelemetry(input) {
    const logger = createLogger({ service: input.service });
    const httpLogger = createHttpLogger(logger);
    const metrics = createMetrics(input.service);
    const httpMiddleware = (req, res, next) => {
        httpLogger(req, res, (error) => {
            if (error)
                return next(error);
            return metrics.metricsMiddleware(req, res, next);
        });
    };
    return {
        logger,
        httpMiddleware,
        metricsHandler: metrics.metricsHandler,
        register: metrics.register,
    };
}
function nonNegative(value) {
    if (!Number.isFinite(value) || value < 0)
        throw new RangeError('metric value must be nonnegative');
    return value;
}
export function createUploadMetrics(register) {
    const finalizations = new Counter({
        name: 'upload_finalizations_total',
        help: 'Finalized upload attempts by bounded result',
        labelNames: ['result'],
        registers: [register],
    });
    const duration = new Histogram({
        name: 'upload_finalization_duration_ms',
        help: 'Upload finalization duration in milliseconds',
        buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        labelNames: ['result'],
        registers: [register],
    });
    const record = (result, durationMs) => {
        finalizations.inc({ result });
        duration.observe({ result }, nonNegative(durationMs));
    };
    return {
        recordSuccess: (durationMs) => record('success', durationMs),
        recordFailure: (durationMs) => record('failure', durationMs),
    };
}
export function createDownloadMetrics(register) {
    const streams = new Counter({
        name: 'download_streams_total',
        help: 'Download streams by bounded outcome',
        labelNames: ['outcome'],
        registers: [register],
    });
    const bytes = new Counter({
        name: 'download_stream_bytes_total',
        help: 'Bytes sent by completed download streams',
        registers: [register],
    });
    const enqueueFailures = new Counter({
        name: 'download_analytics_enqueue_failures_total',
        help: 'Failed durable download analytics enqueue attempts',
        registers: [register],
    });
    const unknownAttempts = new Gauge({
        name: 'download_unknown_attempts',
        help: 'Download attempts left in the unknown state',
        registers: [register],
    });
    return {
        recordCompleted: (streamBytes) => {
            streams.inc({ outcome: 'completed' });
            bytes.inc(nonNegative(streamBytes));
        },
        recordAborted: () => streams.inc({ outcome: 'aborted' }),
        recordAnalyticsEnqueueFailure: () => enqueueFailures.inc(),
        setUnknownAttempts: (count) => unknownAttempts.set(nonNegative(count)),
    };
}
export function createStorageWorkerMetrics(register) {
    const pending = new Gauge({
        name: 'storage_worker_pending',
        help: 'Pending Storage worker events',
        registers: [register],
    });
    const events = new Counter({
        name: 'storage_worker_events_total',
        help: 'Storage worker events by bounded outcome',
        labelNames: ['outcome'],
        registers: [register],
    });
    return {
        setPending: (count) => pending.set(nonNegative(count)),
        recordReclaimed: () => events.inc({ outcome: 'reclaimed' }),
        recordCompleted: () => events.inc({ outcome: 'completed' }),
        recordDeadLetter: () => events.inc({ outcome: 'dead-letter' }),
    };
}
export function createAnalyticsWorkerMetrics(register) {
    const events = new Counter({
        name: 'analytics_worker_events_total',
        help: 'Analytics worker events by bounded outcome',
        labelNames: ['outcome'],
        registers: [register],
    });
    const projectionLag = new Gauge({
        name: 'analytics_projection_lag_seconds',
        help: 'Analytics projection lag in seconds',
        registers: [register],
    });
    const oldestOutboxAge = new Gauge({
        name: 'analytics_oldest_outbox_age_seconds',
        help: 'Age of the oldest eligible analytics Outbox event in seconds',
        registers: [register],
    });
    return {
        recordProcessed: () => events.inc({ outcome: 'processed' }),
        recordRetried: () => events.inc({ outcome: 'retried' }),
        recordFailed: () => events.inc({ outcome: 'failed' }),
        setProjectionLagSeconds: (seconds) => projectionLag.set(nonNegative(seconds)),
        setOldestOutboxAgeSeconds: (seconds) => oldestOutboxAge.set(nonNegative(seconds)),
    };
}
export function createDependencyReadinessMetrics(register) {
    const readiness = new Gauge({
        name: 'dependency_ready',
        help: 'Readiness of a bounded application dependency',
        labelNames: ['dependency'],
        registers: [register],
    });
    const set = (dependency, ready) => readiness.set({ dependency }, ready ? 1 : 0);
    return {
        setPostgres: (ready) => set('postgres', ready),
        setRedis: (ready) => set('redis', ready),
        setObjectStore: (ready) => set('object-store', ready),
    };
}
//# sourceMappingURL=index.js.map