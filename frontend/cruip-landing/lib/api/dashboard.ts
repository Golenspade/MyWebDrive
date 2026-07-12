import { apiClient } from './client'

export type DashboardRangeKind = 'today' | '7d' | '30d'

export type DashboardSeriesPoint = {
  date: string
  count?: string | null
  bytes?: string | null
}

export type BusinessDashboard = {
  range: {
    kind: DashboardRangeKind
    timezone: 'Asia/Shanghai'
    start: string
    end: string
  }
  generatedAt: string
  coverage: {
    uploadsFrom: string | null
    downloadsFrom: string | null
    complete: boolean
  }
  totals: {
    totalUsers: string | null
    liveFiles: string | null
    committedStorageBytes: string | null
  }
  activity: {
    uploads: { count: string | null; bytes: string | null; series: DashboardSeriesPoint[] }
    downloads: { count: string | null; bytes: string | null; series: DashboardSeriesPoint[] }
    activeUsers: { count: string | null; series: DashboardSeriesPoint[] }
  }
  freshness: {
    readModelUpdatedAt: string | null
    lagSeconds: number | null
  }
}

export type SystemDashboard = {
  range: { kind: DashboardRangeKind; timezone: 'Asia/Shanghai' }
  generatedAt: string
  availability: 'available' | 'partial'
  traffic: {
    requestsCount: string | null
    errorsCount: string | null
    errorRate: number | null
    p95Ms: number | null
    p99Ms: number | null
  }
  pipeline: {
    outboxPending: string | null
    oldestOutboxAgeSeconds: number | null
    analyticsLagSeconds: number | null
    downloadTelemetry: 'healthy' | 'degraded' | 'unknown'
  }
  services: Array<{ name: string; up: boolean | null }>
}

export const dashboardApi = {
  business: (range: DashboardRangeKind, signal?: AbortSignal) =>
    apiClient.get<BusinessDashboard>(`/admin/dashboard/business?range=${range}`, { signal }),
  system: (range: DashboardRangeKind, signal?: AbortSignal) =>
    apiClient.get<SystemDashboard>(`/admin/dashboard/system?range=${range}`, { signal }),
}
