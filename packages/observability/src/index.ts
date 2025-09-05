import type { Request, Response, NextFunction } from 'express'
import pino, { type LoggerOptions, type Logger } from 'pino'
import pinoHttp, { type Options as PinoHttpOptions, type HttpLogger } from 'pino-http'
import os from 'os'
import client, { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client'
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
    customLogLevel(res, err) {
      const sc = Number((res as any).statusCode || 0)
      if (err || sc >= 500) return 'error'
      if (sc >= 400) return 'warn'
      return 'info'
    },
    serializers: {
      // keep logs compact but useful
      req(req) {
        return { id: (req as any).id, method: req.method, url: req.url }
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
      const route = (req.route?.path as string) || req.path
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
