// Admin overview aggregated API
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type TimeSeriesPoint = { date: string; value: number }
export type AdminOverview = {
  totals: { total_users: number; total_files: number; total_storage_bytes: number }
  today: { uploads_bytes: number; downloads_bytes: number; uploads_count: number; downloads_count: number; active_users: number; visits_uv: number; requests_count: number; errors_count: number; latency_ms_p95: number; latency_ms_p99: number }
  last7d: { uploads_bytes: TimeSeriesPoint[]; downloads_bytes: TimeSeriesPoint[]; visits_uv: TimeSeriesPoint[] }
}

export const overviewApi = {
  get: (range: 'today' | '7d' | '30d' = '7d') => apiClient.get<AdminOverview>(`/admin/overview?range=${range}`),
}
