import type { PrismaClient } from '@prisma/client'

import {
  resolveSystemHealthRange,
  type PrometheusHealthClient,
  type PrometheusHealthResult,
  type ServiceHealth,
  type SystemHealthRange,
} from './prometheus.js'

const ANALYTICS_TOPICS = [
  'user.created',
  'user.activity.recorded',
  'file.version.created',
  'download.completed',
] as const

type PipelineResult = {
  outboxPending: string | null
  oldestOutboxAgeSeconds: number | null
  analyticsLagSeconds: number | null
  downloadTelemetry: 'healthy' | 'degraded' | 'unknown'
}

export type SystemHealthRepository = {
  countPendingOutbox(): Promise<bigint>
  findOldestUnprocessedOutbox(): Promise<Date | null>
  findOldestUnprocessedAnalyticsEvent(): Promise<Date | null>
  countUnknownDownloads(start: Date, end: Date): Promise<bigint>
}

export type SystemHealthResult = {
  range: { kind: SystemHealthRange; timezone: 'Asia/Shanghai' }
  generatedAt: string
  availability: 'available' | 'partial' | 'unavailable'
  traffic: PrometheusHealthResult['traffic']
  pipeline: PipelineResult
  services: ServiceHealth[]
}

function ageSeconds(now: Date, createdAt: Date | null): number {
  if (!createdAt) return 0
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 1000))
}

function unavailablePrometheus(): PrometheusHealthResult {
  return {
    availability: 'unavailable',
    traffic: {
      requestsCount: null,
      errorsCount: null,
      errorRate: null,
      p95Ms: null,
      p99Ms: null,
    },
    services: [
      { name: 'core-api', up: null },
      { name: 'storage-api', up: null },
      { name: 'storage-worker', up: null },
    ],
  }
}

export function createPrismaSystemHealthRepository(
  prisma: PrismaClient,
): SystemHealthRepository {
  return {
    async countPendingOutbox() {
      return BigInt(await prisma.outboxEvent.count({ where: { processedAt: null } }))
    },
    async findOldestUnprocessedOutbox() {
      const event = await prisma.outboxEvent.findFirst({
        where: { processedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
      return event?.createdAt ?? null
    },
    async findOldestUnprocessedAnalyticsEvent() {
      const event = await prisma.outboxEvent.findFirst({
        where: {
          processedAt: null,
          topic: { in: [...ANALYTICS_TOPICS] },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
      return event?.createdAt ?? null
    },
    async countUnknownDownloads(start, end) {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS "count"
        FROM "DownloadAttempt"
        WHERE "status" = 'unknown'
          AND "unknownAt" >= ${start}
          AND "unknownAt" <= ${end}
      `
      const count = rows[0]?.count
      if (count === undefined) throw new Error('missing unknown download count')
      return BigInt(count)
    },
  }
}

export async function getSystemHealth(input: {
  prisma: PrismaClient
  prometheus: PrometheusHealthClient
  range: SystemHealthRange
  now: Date
  repository?: SystemHealthRepository
}): Promise<SystemHealthResult> {
  const range = resolveSystemHealthRange(input.range, input.now)
  const repository = input.repository ?? createPrismaSystemHealthRepository(input.prisma)
  const results = await Promise.allSettled([
    input.prometheus.querySystemHealth({ range: range.kind, now: input.now }),
    repository.countPendingOutbox(),
    repository.findOldestUnprocessedOutbox(),
    repository.findOldestUnprocessedAnalyticsEvent(),
    repository.countUnknownDownloads(range.start, range.end),
  ])
  const [prometheusResult, pendingResult, oldestResult, analyticsResult, downloadResult] = results
  const prometheus =
    prometheusResult.status === 'fulfilled' ? prometheusResult.value : unavailablePrometheus()
  const pipelineSuccesses = results.slice(1).filter((result) => result.status === 'fulfilled').length
  const everySourceAvailable =
    prometheus.availability === 'available' && pipelineSuccesses === results.length - 1
  const anySourceAvailable = prometheus.availability !== 'unavailable' || pipelineSuccesses > 0
  const downloadCount =
    downloadResult.status === 'fulfilled' ? downloadResult.value : undefined

  return {
    range: { kind: range.kind, timezone: range.timezone },
    generatedAt: input.now.toISOString(),
    availability: everySourceAvailable
      ? 'available'
      : anySourceAvailable
        ? 'partial'
        : 'unavailable',
    traffic: prometheus.traffic,
    pipeline: {
      outboxPending:
        pendingResult.status === 'fulfilled' ? pendingResult.value.toString(10) : null,
      oldestOutboxAgeSeconds:
        oldestResult.status === 'fulfilled'
          ? ageSeconds(input.now, oldestResult.value)
          : null,
      analyticsLagSeconds:
        analyticsResult.status === 'fulfilled'
          ? ageSeconds(input.now, analyticsResult.value)
          : null,
      downloadTelemetry:
        downloadCount === undefined
          ? 'unknown'
          : BigInt(downloadCount) > 0n
            ? 'degraded'
            : 'healthy',
    },
    services: prometheus.services,
  }
}
