import { describe, expect, test, vi } from 'vitest'

import { createPrometheusClient } from '../prometheus.js'

const now = new Date('2026-07-12T12:00:00.000Z')

function success(result: unknown) {
  return new Response(
    JSON.stringify({ status: 'success', data: { resultType: 'vector', result } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function sample(value: string, metric: Record<string, string> = {}) {
  return { metric, value: [now.getTime() / 1000, value] }
}

describe('Prometheus system-health client', () => {
  test('uses only the fixed 7d templates and parses traffic and service health', async () => {
    const queries: string[] = []
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const query = url.searchParams.get('query') ?? ''
      queries.push(query)
      if (query.startsWith('sum(increase(http_requests_total{service=~')) {
        return success([sample(query.includes('status=~"5.."') ? '3' : '1200')])
      }
      if (query.startsWith('histogram_quantile(0.95')) return success([sample('85')])
      if (query.startsWith('histogram_quantile(0.99')) return success([sample('190')])
      if (query.startsWith('up{')) {
        return success([
          sample('1', { job: 'core-api' }),
          sample('0', { job: 'storage-api' }),
          sample('1', { job: 'storage-worker' }),
        ])
      }
      return new Response('unexpected query', { status: 500 })
    })
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: fetchImpl as typeof fetch,
    })

    const result = await client.querySystemHealth({
      range: '7d',
      now,
      query: 'vector(999)',
    } as Parameters<typeof client.querySystemHealth>[0])

    expect(queries).toEqual([
      'sum(increase(http_requests_total{service=~"core-api|storage-api|storage-worker"}[590400s])) or vector(0)',
      'sum(increase(http_requests_total{service=~"core-api|storage-api|storage-worker",status=~"5.."}[590400s])) or vector(0)',
      'histogram_quantile(0.95, sum by (le) (increase(http_request_duration_ms_bucket{service=~"core-api|storage-api|storage-worker"}[590400s])))',
      'histogram_quantile(0.99, sum by (le) (increase(http_request_duration_ms_bucket{service=~"core-api|storage-api|storage-worker"}[590400s])))',
      'up{job=~"core-api|storage-api|storage-worker"}',
    ])
    expect(queries).not.toContain('vector(999)')
    expect(result).toEqual({
      availability: 'available',
      traffic: {
        requestsCount: '1200',
        errorsCount: '3',
        errorRate: 0.0025,
        p95Ms: 85,
        p99Ms: 190,
      },
      services: [
        { name: 'core-api', up: true },
        { name: 'storage-api', up: false },
        { name: 'storage-worker', up: true },
      ],
    })
  })

  test.each([
    ['no recognized targets', []],
    [
      'one required target missing',
      [sample('1', { job: 'core-api' }), sample('0', { job: 'storage-api' })],
    ],
  ])('reports partial service coverage when %s', async (_name, serviceSamples) => {
    let call = 0
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: vi.fn(async () => {
        call += 1
        return success(call === 5 ? serviceSamples : [sample('0')])
      }) as typeof fetch,
    })

    const result = await client.querySystemHealth({ range: 'today', now })

    expect(result.availability).toBe('partial')
    expect(result.services).toEqual([
      { name: 'core-api', up: serviceSamples.length === 0 ? null : true },
      { name: 'storage-api', up: serviceSamples.length === 0 ? null : false },
      { name: 'storage-worker', up: null },
    ])
  })

  test('calculates today from midnight in Asia/Shanghai', async () => {
    const queries: string[] = []
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: vi.fn(async (input: string | URL | Request) => {
        queries.push(new URL(String(input)).searchParams.get('query') ?? '')
        return success([sample('0')])
      }) as typeof fetch,
    })

    await client.querySystemHealth({ range: 'today', now })

    expect(queries[0]).toContain('[72000s]')
  })

  test('preserves integer counter strings above JavaScript safe integer range', async () => {
    let call = 0
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: vi.fn(async () => {
        call += 1
        return success([
          sample(call === 1 ? '9007199254740993' : call === 5 ? '1' : '0', call === 5 ? { job: 'core-api' } : {}),
        ])
      }) as typeof fetch,
    })

    const result = await client.querySystemHealth({ range: 'today', now })

    expect(result.traffic.requestsCount).toBe('9007199254740993')
  })

  test('treats empty counter and latency vectors as a healthy zero-traffic window', async () => {
    let call = 0
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: vi.fn(async () => {
        call += 1
        return success(
          call === 5
            ? [
                sample('1', { job: 'core-api' }),
                sample('1', { job: 'storage-api' }),
                sample('1', { job: 'storage-worker' }),
              ]
            : [],
        )
      }) as typeof fetch,
    })

    const result = await client.querySystemHealth({ range: 'today', now })

    expect(result.availability).toBe('available')
    expect(result.traffic).toEqual({
      requestsCount: '0',
      errorsCount: '0',
      errorRate: 0,
      p95Ms: null,
      p99Ms: null,
    })
  })

  test('treats NaN histogram quantiles as missing latency without degrading availability', async () => {
    let call = 0
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: vi.fn(async () => {
        call += 1
        if (call === 3 || call === 4) return success([sample('NaN')])
        return success(
          call === 5
            ? [
                sample('1', { job: 'core-api' }),
                sample('1', { job: 'storage-api' }),
                sample('1', { job: 'storage-worker' }),
              ]
            : [sample('0')],
        )
      }) as typeof fetch,
    })

    const result = await client.querySystemHealth({ range: 'today', now })

    expect(result.availability).toBe('available')
    expect(result.traffic.p95Ms).toBeNull()
    expect(result.traffic.p99Ms).toBeNull()
  })

  test('returns partial data when one predefined query fails', async () => {
    let call = 0
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: vi.fn(async () => {
        call += 1
        if (call === 2) throw new Error('connection reset')
        return success([sample(call === 5 ? '1' : '10', call === 5 ? { job: 'core-api' } : {})])
      }) as typeof fetch,
    })

    const result = await client.querySystemHealth({ range: '30d', now })

    expect(result.availability).toBe('partial')
    expect(result.traffic.requestsCount).toBe('10')
    expect(result.traffic.errorsCount).toBeNull()
    expect(result.traffic.errorRate).toBeNull()
    expect(result.traffic.p95Ms).toBe(10)
  })

  test('keeps valid results partial when one query returns a malformed payload', async () => {
    let call = 0
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: vi.fn(async () => {
        call += 1
        if (call === 4) return new Response(JSON.stringify({ status: 'success', data: {} }))
        return success([sample(call === 5 ? '1' : '10', call === 5 ? { job: 'core-api' } : {})])
      }) as typeof fetch,
    })

    const result = await client.querySystemHealth({ range: '7d', now })

    expect(result.availability).toBe('partial')
    expect(result.traffic.requestsCount).toBe('10')
    expect(result.traffic.p99Ms).toBeNull()
  })

  test.each([
    ['malformed payload', vi.fn(async () => new Response('{broken', { status: 200 }))],
    [
      'timeout',
      vi.fn(
        (_input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          }),
      ),
    ],
  ])('returns unavailable for %s from every query', async (_name, fetchImpl) => {
    const client = createPrometheusClient({
      baseUrl: 'http://prometheus:9090',
      fetch: fetchImpl as typeof fetch,
      timeoutMs: 5,
    })

    const result = await client.querySystemHealth({ range: 'today', now })

    expect(result.availability).toBe('unavailable')
    expect(result.traffic).toEqual({
      requestsCount: null,
      errorsCount: null,
      errorRate: null,
      p95Ms: null,
      p99Ms: null,
    })
    expect(result.services.every((service) => service.up === null)).toBe(true)
  })
})
