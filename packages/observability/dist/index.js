import pino from 'pino';
import pinoHttp from 'pino-http';
import os from 'os';
import client, { Registry, collectDefaultMetrics } from 'prom-client';
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
        customLogLevel(res, err) {
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
                return { id: req.id, method: req.method, url: req.url };
            },
            res(res) {
                return { statusCode: res.statusCode };
            },
        },
    };
    return pinoHttp(options);
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
            const route = req.route?.path || req.path;
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
//# sourceMappingURL=index.js.map