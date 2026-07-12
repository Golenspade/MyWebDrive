import type { Request, Response, NextFunction } from 'express'
import pino, { type LoggerOptions, type Logger } from 'pino'
import pinoHttp, { type Options as PinoHttpOptions, type HttpLogger } from 'pino-http'
import os from 'os'
import client, { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client'
import { randomUUID } from 'crypto'

// ---- Logger ----
export type CreateLoggerOptions = {
  service: string
  level?: string
}

export function createLogger(opts: CreateLoggerOptions): Logger {
  const level = (process.env.LOG_LEVEL || opts.level || 'info').toLowerCase()
  const base: Record<string, unknown> = {
    service: opts.service,
    env: process.env.NODE_ENV || 'development',
    instance: process.env.INSTANCE_ID || os.hostname(),
  }
  const redactPaths: string[] = [
    'req.headers.authorization',
    'headers.authorization',
    'authorization',
    'password',
    '*.password',
    'accessToken',
    'refreshToken',
  ]
  const redact: any = { paths: redactPaths, remove: true }
  const options: LoggerOptions = { level, base, redact }
  return pino(options)
}

export function createHttpLogger(logger: Logger): HttpLogger {
  const options: PinoHttpOptions = {
    logger: logger as any,
    // Reuse or create x-request-id and reflect back in response
    genReqId(req, res) {
      const existing = (req.headers['x-request-id'] as string) || ''
      const id = existing || randomUUID()
      // propagate to downstream and response
      req.headers['x-request-id'] = id
      res.setHeader('x-request-id', id)
      return id
    },
    autoLogging: true,
    customLogLevel(_req, res, err) {
      const sc = Number((res as any).statusCode || 0)
      if (err || sc >= 500) return 'error'
      if (sc >= 400) return 'warn'
      return 'info'
    },
    serializers: {
      // keep logs compact but useful
      req(req) {
        return { id: (req as any).id, method: req.method }
      },
      res(res) {
        return { statusCode: (res as any).statusCode }
      },
    },
  }
  return (pinoHttp as any)(options) as unknown as HttpLogger
}

// ---- Metrics ----
export type Metrics = {
  register: Registry
  httpRequestsTotal: Counter<'method' | 'route' | 'status'>
  httpRequestDurationMs: Histogram<'method' | 'route' | 'status'>
  metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void
  metricsHandler: (req: Request, res: Response) => Promise<void>
}

function matchedRouteTemplate(req: Request): string {
  return typeof req.route?.path === 'string' ? req.route.path : 'unmatched'
}

export function createMetrics(service: string): Metrics {
  const register = new Registry()
  register.setDefaultLabels({ service, instance: process.env.INSTANCE_ID || os.hostname() })
  collectDefaultMetrics({ register })

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [register],
  })
  const httpRequestDurationMs = new client.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    labelNames: ['method', 'route', 'status'] as const,
    registers: [register],
  })

  const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    res.on('finish', () => {
      const route = matchedRouteTemplate(req)
      const labels = { method: req.method, route, status: String(res.statusCode) }
      httpRequestsTotal.inc(labels)
      httpRequestDurationMs.observe(labels, Date.now() - start)
    })
    next()
  }

  const metricsHandler = async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', register.contentType)
    res.end(await register.metrics())
  }

  return { register, httpRequestsTotal, httpRequestDurationMs, metricsMiddleware, metricsHandler }
}

export type AppTelemetry = {
  logger: Logger
  httpMiddleware: (req: Request, res: Response, next: NextFunction) => void
  metricsHandler: (req: Request, res: Response) => Promise<void>
  register: Registry
}

export function createAppTelemetry(input: { service: string }): AppTelemetry {
  const logger = createLogger({ service: input.service })
  const httpLogger = createHttpLogger(logger)
  const metrics = createMetrics(input.service)
  const httpMiddleware = (req: Request, res: Response, next: NextFunction) => {
    httpLogger(req, res, (error?: unknown) => {
      if (error) return next(error)
      return metrics.metricsMiddleware(req, res, next)
    })
  }

  return {
    logger,
    httpMiddleware,
    metricsHandler: metrics.metricsHandler,
    register: metrics.register,
  }
}

function nonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('metric value must be nonnegative')
  return value
}

export function createUploadMetrics(register: Registry) {
  const finalizations = new Counter({
    name: 'upload_finalizations_total',
    help: 'Finalized upload attempts by bounded result',
    labelNames: ['result'] as const,
    registers: [register],
  })
  const duration = new Histogram({
    name: 'upload_finalization_duration_ms',
    help: 'Upload finalization duration in milliseconds',
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    labelNames: ['result'] as const,
    registers: [register],
  })
  const record = (result: 'success' | 'failure', durationMs: number) => {
    finalizations.inc({ result })
    duration.observe({ result }, nonNegative(durationMs))
  }
  return {
    recordSuccess: (durationMs: number) => record('success', durationMs),
    recordFailure: (durationMs: number) => record('failure', durationMs),
  }
}

export function createDownloadMetrics(register: Registry) {
  const streams = new Counter({
    name: 'download_streams_total',
    help: 'Download streams by bounded outcome',
    labelNames: ['outcome'] as const,
    registers: [register],
  })
  const bytes = new Counter({
    name: 'download_stream_bytes_total',
    help: 'Bytes sent by completed download streams',
    registers: [register],
  })
  const enqueueFailures = new Counter({
    name: 'download_analytics_enqueue_failures_total',
    help: 'Failed durable download analytics enqueue attempts',
    registers: [register],
  })
  const unknownAttempts = new Gauge({
    name: 'download_unknown_attempts',
    help: 'Download attempts left in the unknown state',
    registers: [register],
  })
  return {
    recordCompleted: (streamBytes: number) => {
      streams.inc({ outcome: 'completed' })
      bytes.inc(nonNegative(streamBytes))
    },
    recordAborted: () => streams.inc({ outcome: 'aborted' }),
    recordAnalyticsEnqueueFailure: () => enqueueFailures.inc(),
    setUnknownAttempts: (count: number) => unknownAttempts.set(nonNegative(count)),
  }
}

export function createStorageWorkerMetrics(register: Registry) {
  const pending = new Gauge({
    name: 'storage_worker_pending',
    help: 'Pending Storage worker events',
    registers: [register],
  })
  const events = new Counter({
    name: 'storage_worker_events_total',
    help: 'Storage worker events by bounded outcome',
    labelNames: ['outcome'] as const,
    registers: [register],
  })
  return {
    setPending: (count: number) => pending.set(nonNegative(count)),
    recordReclaimed: () => events.inc({ outcome: 'reclaimed' }),
    recordCompleted: () => events.inc({ outcome: 'completed' }),
    recordDeadLetter: () => events.inc({ outcome: 'dead-letter' }),
  }
}

export function createAnalyticsWorkerMetrics(register: Registry) {
  const events = new Counter({
    name: 'analytics_worker_events_total',
    help: 'Analytics worker events by bounded outcome',
    labelNames: ['outcome'] as const,
    registers: [register],
  })
  const projectionLag = new Gauge({
    name: 'analytics_projection_lag_seconds',
    help: 'Analytics projection lag in seconds',
    registers: [register],
  })
  const oldestOutboxAge = new Gauge({
    name: 'analytics_oldest_outbox_age_seconds',
    help: 'Age of the oldest eligible analytics Outbox event in seconds',
    registers: [register],
  })
  return {
    recordProcessed: () => events.inc({ outcome: 'processed' }),
    recordRetried: () => events.inc({ outcome: 'retried' }),
    recordFailed: () => events.inc({ outcome: 'failed' }),
    setProjectionLagSeconds: (seconds: number) => projectionLag.set(nonNegative(seconds)),
    setOldestOutboxAgeSeconds: (seconds: number) => oldestOutboxAge.set(nonNegative(seconds)),
  }
}

export function createDependencyReadinessMetrics(register: Registry) {
  const readiness = new Gauge({
    name: 'dependency_ready',
    help: 'Readiness of a bounded application dependency',
    labelNames: ['dependency'] as const,
    registers: [register],
  })
  const set = (dependency: 'postgres' | 'redis' | 'object-store', ready: boolean) =>
    readiness.set({ dependency }, ready ? 1 : 0)
  return {
    setPostgres: (ready: boolean) => set('postgres', ready),
    setRedis: (ready: boolean) => set('redis', ready),
    setObjectStore: (ready: boolean) => set('object-store', ready),
  }
}
