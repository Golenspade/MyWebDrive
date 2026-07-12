import { EventEmitter } from 'node:events'
import { createServer } from 'node:http'
import { Writable } from 'node:stream'

import pino from 'pino'
import { describe, expect, test } from 'vitest'

import {
  createAnalyticsWorkerMetrics,
  createAppTelemetry,
  createDependencyReadinessMetrics,
  createDownloadMetrics,
  createHttpLogger,
  createStorageWorkerMetrics,
  createUploadMetrics,
} from './index.js'

process.env.LOG_LEVEL = 'silent'

function recordRequest(input: {
  telemetry: ReturnType<typeof createAppTelemetry>
  method?: string
  status?: number
  baseUrl?: string
  routePath?: unknown
  path?: string
  originalUrl?: string
}) {
  const response = new EventEmitter() as EventEmitter & {
    statusCode: number
    setHeader: (name: string, value: string) => void
  }
  response.statusCode = input.status ?? 200
  response.setHeader = () => undefined
  const request = {
    headers: {},
    method: input.method ?? 'GET',
    baseUrl: input.baseUrl ?? '',
    route: input.routePath === undefined ? undefined : { path: input.routePath },
    path: input.path ?? '/',
    originalUrl: input.originalUrl ?? '/',
  }

  input.telemetry.httpMiddleware(
    request as never,
    response as never,
    () => response.emit('finish'),
  )
}

describe('createAppTelemetry', () => {
  test('logs a completed 2xx request at info level', async () => {
    const records: Array<{ level?: number; msg?: string }> = []
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        records.push(JSON.parse(chunk.toString()) as { level?: number; msg?: string })
        callback()
      },
    })
    const middleware = createHttpLogger(pino({ level: 'trace' }, destination))
    const server = createServer((req, res) => {
      middleware(req as never, res as never, () => {
        res.statusCode = 204
        res.end()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing server address')

    await fetch(`http://127.0.0.1:${address.port}/health`)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    )

    expect(records.find((record) => record.msg === 'request completed')?.level).toBe(30)
  })

  test('records the normalized mounted Express route template', async () => {
    const telemetry = createAppTelemetry({ service: 'core-api' })

    recordRequest({
      telemetry,
      method: 'POST',
      status: 201,
      baseUrl: '/api/v1',
      routePath: '/files/:fileId',
      path: '/files/private-object-key',
      originalUrl: '/api/v1/files/private-object-key?share=secret-share-token',
    })

    const metrics = await telemetry.register.metrics()
    const requestLine = metrics.split('\n').find((line) => line.startsWith('http_requests_total{'))
    const durationLine = metrics
      .split('\n')
      .find((line) => line.startsWith('http_request_duration_ms_count{'))
    expect(requestLine).toContain('service="core-api"')
    expect(requestLine).toContain('method="POST"')
    expect(requestLine).toContain('route="/files/:fileId"')
    expect(requestLine).toContain('status="201"')
    expect(requestLine).toMatch(/\} 1$/)
    expect(durationLine).toContain('service="core-api"')
    expect(durationLine).toContain('route="/files/:fileId"')
    expect(durationLine).toMatch(/\} 1$/)
    expect(metrics).not.toContain('private-object-key')
    expect(metrics).not.toContain('secret-share-token')
    expect(metrics).not.toContain('?share=')
  })

  test('uses a fixed label for unmatched requests', async () => {
    const telemetry = createAppTelemetry({ service: 'storage-api' })

    recordRequest({
      telemetry,
      status: 404,
      path: '/objects/attacker-controlled-key',
      originalUrl: '/objects/attacker-controlled-key?token=secret',
    })

    const metrics = await telemetry.register.metrics()
    const requestLine = metrics.split('\n').find((line) => line.startsWith('http_requests_total{'))
    expect(requestLine).toContain('service="storage-api"')
    expect(requestLine).toContain('route="unmatched"')
    expect(requestLine).toContain('status="404"')
    expect(requestLine).toMatch(/\} 1$/)
    expect(metrics).not.toContain('attacker-controlled-key')
    expect(metrics).not.toContain('secret')
  })

  test('domain constructors expose only bounded outcome methods', async () => {
    const telemetry = createAppTelemetry({ service: 'core-api' })
    const uploads = createUploadMetrics(telemetry.register)
    const downloads = createDownloadMetrics(telemetry.register)

    uploads.recordSuccess(12)
    uploads.recordFailure(7)
    downloads.recordCompleted(4096)
    downloads.recordAborted()
    downloads.recordAnalyticsEnqueueFailure()
    downloads.setUnknownAttempts(2)

    const metrics = await telemetry.register.metrics()
    expect(metrics).toContain('upload_finalizations_total{result="success"')
    expect(metrics).toContain('upload_finalizations_total{result="failure"')
    expect(metrics).toContain('upload_finalization_duration_ms_count')
    expect(metrics).toContain('download_streams_total{outcome="completed"')
    expect(metrics).toContain('download_streams_total{outcome="aborted"')
    expect(metrics).toContain('download_stream_bytes_total')
    expect(metrics).toContain('download_unknown_attempts')
    expect(uploads).not.toHaveProperty('labels')
    expect(downloads).not.toHaveProperty('labels')
  })

  test('worker and dependency constructors keep label values fixed', async () => {
    const telemetry = createAppTelemetry({ service: 'storage-worker' })
    const storage = createStorageWorkerMetrics(telemetry.register)
    const analytics = createAnalyticsWorkerMetrics(telemetry.register)
    const dependencies = createDependencyReadinessMetrics(telemetry.register)

    storage.setPending(3)
    storage.recordReclaimed()
    storage.recordCompleted()
    storage.recordDeadLetter()
    analytics.recordProcessed()
    analytics.recordRetried()
    analytics.recordFailed()
    analytics.setProjectionLagSeconds(4)
    analytics.setOldestOutboxAgeSeconds(5)
    dependencies.setPostgres(true)
    dependencies.setRedis(false)
    dependencies.setObjectStore(true)

    const metrics = await telemetry.register.metrics()
    expect(metrics).toContain('storage_worker_events_total{outcome="reclaimed"')
    expect(metrics).toContain('analytics_worker_events_total{outcome="processed"')
    expect(metrics).toContain('dependency_ready{dependency="postgres"')
    expect(metrics).toContain('dependency_ready{dependency="redis"')
    expect(metrics).toContain('dependency_ready{dependency="object-store"')
  })
})
