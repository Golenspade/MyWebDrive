export type SystemHealthRange = 'today' | '7d' | '30d'

export type ServiceHealth = {
  name: 'core-api' | 'storage-api' | 'storage-worker'
  up: boolean | null
}

export type PrometheusHealthResult = {
  availability: 'available' | 'partial' | 'unavailable'
  traffic: {
    requestsCount: string | null
    errorsCount: string | null
    errorRate: number | null
    p95Ms: number | null
    p99Ms: number | null
  }
  services: ServiceHealth[]
}

export type PrometheusHealthClient = {
  querySystemHealth(input: {
    range: SystemHealthRange
    now: Date
  }): Promise<PrometheusHealthResult>
}

type VectorSample = {
  metric: Record<string, string>
  value: [number, string]
}

const SERVICE_NAMES = ['core-api', 'storage-api', 'storage-worker'] as const
const SERVICE_SELECTOR = 'core-api|storage-api|storage-worker'
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

export type ResolvedSystemHealthRange = {
  kind: SystemHealthRange
  timezone: 'Asia/Shanghai'
  start: Date
  end: Date
  windowSeconds: number
}

export function resolveSystemHealthRange(
  value: unknown,
  now: Date,
): ResolvedSystemHealthRange {
  if (value !== 'today' && value !== '7d' && value !== '30d') {
    throw new Error('invalid dashboard range')
  }
  const shanghai = new Date(now.getTime() + SHANGHAI_OFFSET_MS)
  const daysBefore = value === 'today' ? 0 : value === '7d' ? 6 : 29
  const localMidnightUtc = Date.UTC(
    shanghai.getUTCFullYear(),
    shanghai.getUTCMonth(),
    shanghai.getUTCDate() - daysBefore,
  )
  const start = new Date(localMidnightUtc - SHANGHAI_OFFSET_MS)
  return {
    kind: value,
    timezone: 'Asia/Shanghai',
    start,
    end: new Date(now),
    windowSeconds: Math.max(1, Math.floor((now.getTime() - start.getTime()) / 1000)),
  }
}

function fixedQueries(range: SystemHealthRange, now: Date) {
  const window = resolveSystemHealthRange(range, now).windowSeconds
  return {
    requests: `sum(increase(http_requests_total{service=~"${SERVICE_SELECTOR}"}[${window}s])) or vector(0)`,
    errors: `sum(increase(http_requests_total{service=~"${SERVICE_SELECTOR}",status=~"5.."}[${window}s])) or vector(0)`,
    p95: `histogram_quantile(0.95, sum by (le) (increase(http_request_duration_ms_bucket{service=~"${SERVICE_SELECTOR}"}[${window}s])))`,
    p99: `histogram_quantile(0.99, sum by (le) (increase(http_request_duration_ms_bucket{service=~"${SERVICE_SELECTOR}"}[${window}s])))`,
    services: `up{job=~"${SERVICE_SELECTOR}"}`,
  }
}

function parseVector(payload: unknown): VectorSample[] {
  if (!payload || typeof payload !== 'object') throw new Error('malformed Prometheus response')
  const root = payload as {
    status?: unknown
    data?: { resultType?: unknown; result?: unknown }
  }
  if (
    root.status !== 'success' ||
    root.data?.resultType !== 'vector' ||
    !Array.isArray(root.data.result)
  ) {
    throw new Error('malformed Prometheus response')
  }
  return root.data.result.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('malformed Prometheus sample')
    const sample = item as { metric?: unknown; value?: unknown }
    if (
      !sample.metric ||
      typeof sample.metric !== 'object' ||
      !Array.isArray(sample.value) ||
      sample.value.length !== 2 ||
      typeof sample.value[0] !== 'number' ||
      typeof sample.value[1] !== 'string'
    ) {
      throw new Error('malformed Prometheus sample')
    }
    return {
      metric: sample.metric as Record<string, string>,
      value: [sample.value[0], sample.value[1]],
    }
  })
}

function scalar(samples: VectorSample[]): number {
  if (samples.length !== 1) throw new Error('missing Prometheus scalar')
  const value = Number(samples[0]?.value[1])
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid Prometheus scalar')
  return value
}

function count(samples: VectorSample[]): string {
  if (samples.length === 0) return '0'
  if (samples.length !== 1) throw new Error('invalid Prometheus counter')
  const raw = samples[0]?.value[1]
  if (raw && /^\d+$/.test(raw)) return BigInt(raw).toString(10)
  return String(Math.round(scalar(samples)))
}

function latency(samples: VectorSample[]): number | null {
  if (samples.length === 0) return null
  if (samples.length !== 1) throw new Error('invalid Prometheus latency')
  if (samples[0]?.value[1] === 'NaN') return null
  return scalar(samples)
}

function services(samples: VectorSample[]): ServiceHealth[] {
  const values = new Map<string, boolean>()
  for (const sample of samples) {
    const job = sample.metric.job
    const value = Number(sample.value[1])
    if (SERVICE_NAMES.includes(job as (typeof SERVICE_NAMES)[number]) && (value === 0 || value === 1)) {
      values.set(job, value === 1)
    }
  }
  return SERVICE_NAMES.map((name) => ({ name, up: values.get(name) ?? null }))
}

export function createPrometheusClient(input: {
  baseUrl: string
  fetch?: typeof fetch
  timeoutMs?: number
}): PrometheusHealthClient {
  const fetchImpl = input.fetch ?? fetch
  const timeoutMs = input.timeoutMs ?? 2_000

  async function query(promql: string, now: Date): Promise<VectorSample[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const url = new URL(`${input.baseUrl.replace(/\/+$/, '')}/api/v1/query`)
      url.searchParams.set('query', promql)
      url.searchParams.set('time', now.toISOString())
      const response = await fetchImpl(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Prometheus returned ${response.status}`)
      return parseVector(await response.json())
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    async querySystemHealth({ range, now }) {
      const templates = fixedQueries(range, now)
      const results = await Promise.allSettled([
        query(templates.requests, now).then(count),
        query(templates.errors, now).then(count),
        query(templates.p95, now).then(latency),
        query(templates.p99, now).then(latency),
        query(templates.services, now).then(services),
      ])
      const [requestsResult, errorsResult, p95Result, p99Result, servicesResult] = results
      const requestsCount = requestsResult.status === 'fulfilled' ? requestsResult.value : null
      const errorsCount = errorsResult.status === 'fulfilled' ? errorsResult.value : null
      const requestNumber = requestsCount === null ? null : Number(requestsCount)
      const errorNumber = errorsCount === null ? null : Number(errorsCount)
      const successful = results.filter((result) => result.status === 'fulfilled').length
      const serviceValues =
        servicesResult.status === 'fulfilled'
          ? servicesResult.value
          : SERVICE_NAMES.map((name) => ({ name, up: null }))
      const completeServiceCoverage = serviceValues.every((service) => service.up !== null)

      return {
        availability:
          successful === results.length && completeServiceCoverage
            ? 'available'
            : successful === 0
              ? 'unavailable'
              : 'partial',
        traffic: {
          requestsCount,
          errorsCount,
          errorRate:
            requestNumber === null || errorNumber === null
              ? null
              : requestNumber === 0
                ? 0
                : errorNumber / requestNumber,
          p95Ms: p95Result.status === 'fulfilled' ? p95Result.value : null,
          p99Ms: p99Result.status === 'fulfilled' ? p99Result.value : null,
        },
        services: serviceValues,
      }
    },
  }
}
