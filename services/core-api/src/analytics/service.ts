import type { AnalyticsCoverage, PrismaClient } from '@prisma/client'

import type {
  BusinessDashboardResponse,
  CountBytesSeriesPoint,
  CountSeriesPoint,
  DashboardRange,
} from './types.js'

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function bucketStart(date: string): Date {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - SHANGHAI_OFFSET_MS)
}

function observesBucket(coverage: AnalyticsCoverage | undefined, date: string): boolean {
  if (!coverage) return false
  const start = bucketStart(date)
  const end = new Date(start.getTime() + DAY_MS)
  if (coverage.startedAt >= end) return false
  return !coverage.gapStartedAt || coverage.gapStartedAt > start
}

function observesRange(
  coverage: AnalyticsCoverage | undefined,
  range: DashboardRange,
): boolean {
  if (!coverage || coverage.startedAt >= range.end) return false
  return !coverage.gapStartedAt || coverage.gapStartedAt > range.start
}

function coversRange(
  coverage: AnalyticsCoverage | undefined,
  range: DashboardRange,
): boolean {
  if (!coverage || coverage.startedAt > range.start) return false
  if (coverage.gapStartedAt) return coverage.gapStartedAt >= range.end
  return coverage.complete
}

function sum(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n)
}

export async function getBusinessDashboard(input: {
  prisma: PrismaClient
  range: DashboardRange
  now: Date
}): Promise<BusinessDashboardResponse> {
  const firstDate = new Date(`${input.range.dates[0]}T00:00:00.000Z`)
  const lastDate = new Date(`${input.range.dates.at(-1)}T00:00:00.000Z`)
  const [
    totalUsers,
    liveFiles,
    quota,
    dailyRows,
    activeRows,
    distinctActiveUsers,
    coverageRows,
    receiptFreshness,
  ] = await Promise.all([
    input.prisma.user.count(),
    input.prisma.file.count({ where: { type: 'file', deletedAt: null } }),
    input.prisma.quotaAccount.aggregate({ _sum: { committedBytes: true } }),
    input.prisma.analyticsDaily.findMany({
      where: { date: { gte: firstDate, lte: lastDate } },
      orderBy: { date: 'asc' },
    }),
    input.prisma.analyticsDailyActiveUser.groupBy({
      by: ['date'],
      where: { date: { gte: firstDate, lte: lastDate } },
      _count: { userId: true },
      orderBy: { date: 'asc' },
    }),
    input.prisma.analyticsDailyActiveUser.findMany({
      where: { date: { gte: firstDate, lte: lastDate } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    input.prisma.analyticsCoverage.findMany({
      where: { metric: { in: ['uploads', 'downloads', 'activeUsers'] } },
    }),
    input.prisma.analyticsEventReceipt.aggregate({ _max: { processedAt: true } }),
  ])

  const coverage = new Map(coverageRows.map((row) => [row.metric, row]))
  const uploadsCoverage = coverage.get('uploads')
  const downloadsCoverage = coverage.get('downloads')
  const activeUsersCoverage = coverage.get('activeUsers')
  const daily = new Map(dailyRows.map((row) => [row.date.toISOString().slice(0, 10), row]))
  const active = new Map(
    activeRows.map((row) => [row.date.toISOString().slice(0, 10), BigInt(row._count.userId)]),
  )

  const countBytesSeries = (
    metricCoverage: AnalyticsCoverage | undefined,
    countField: 'uploadsCount' | 'downloadsCount',
    bytesField: 'uploadsBytes' | 'downloadsBytes',
  ): CountBytesSeriesPoint[] =>
    input.range.dates.map((date) => {
      if (!observesBucket(metricCoverage, date)) return { date, count: null, bytes: null }
      const row = daily.get(date)
      return {
        date,
        count: (row?.[countField] ?? 0n).toString(),
        bytes: (row?.[bytesField] ?? 0n).toString(),
      }
    })

  const activeSeries: CountSeriesPoint[] = input.range.dates.map((date) => ({
    date,
    count: observesBucket(activeUsersCoverage, date)
      ? (active.get(date) ?? 0n).toString()
      : null,
  }))
  const uploadsComplete = coversRange(uploadsCoverage, input.range)
  const downloadsComplete = coversRange(downloadsCoverage, input.range)
  const activeUsersComplete = coversRange(activeUsersCoverage, input.range)
  const uploadsObserved = observesRange(uploadsCoverage, input.range)
  const downloadsObserved = observesRange(downloadsCoverage, input.range)
  const activeUsersObserved = observesRange(activeUsersCoverage, input.range)
  const dailyFreshness = dailyRows.reduce<Date | null>(
    (latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest),
    null,
  )
  const readModelUpdatedAt = [dailyFreshness, receiptFreshness._max.processedAt]
    .filter((value): value is Date => Boolean(value))
    .reduce<Date | null>((latest, value) => (!latest || value > latest ? value : latest), null)

  return {
    range: {
      kind: input.range.kind,
      timezone: input.range.timezone,
      start: input.range.start.toISOString(),
      end: input.range.end.toISOString(),
    },
    generatedAt: input.now.toISOString(),
    coverage: {
      uploadsFrom: uploadsCoverage?.startedAt.toISOString() ?? null,
      downloadsFrom: downloadsCoverage?.startedAt.toISOString() ?? null,
      complete: uploadsComplete && downloadsComplete && activeUsersComplete,
    },
    totals: {
      totalUsers: totalUsers.toString(),
      liveFiles: liveFiles.toString(),
      committedStorageBytes: (quota._sum.committedBytes ?? 0n).toString(),
    },
    activity: {
      uploads: {
        count: uploadsObserved ? sum(dailyRows.map((row) => row.uploadsCount)).toString() : null,
        bytes: uploadsObserved ? sum(dailyRows.map((row) => row.uploadsBytes)).toString() : null,
        series: countBytesSeries(uploadsCoverage, 'uploadsCount', 'uploadsBytes'),
      },
      downloads: {
        count: downloadsObserved ? sum(dailyRows.map((row) => row.downloadsCount)).toString() : null,
        bytes: downloadsObserved ? sum(dailyRows.map((row) => row.downloadsBytes)).toString() : null,
        series: countBytesSeries(downloadsCoverage, 'downloadsCount', 'downloadsBytes'),
      },
      activeUsers: {
        count: activeUsersObserved ? distinctActiveUsers.length.toString() : null,
        series: activeSeries,
      },
    },
    freshness: {
      readModelUpdatedAt: readModelUpdatedAt?.toISOString() ?? null,
      lagSeconds: readModelUpdatedAt
        ? Math.max(0, Math.floor((input.now.getTime() - readModelUpdatedAt.getTime()) / 1_000))
        : null,
    },
  }
}
