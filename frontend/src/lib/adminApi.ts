import api from '@/lib/api'

export type Overview = {
  totals: Record<string, number>
  today: Record<string, number>
  last7d: Record<string, { date: string; value: number }[]>
}

export type OverviewQuery = {
  start?: string
  end?: string
}

export async function fetchAdminOverview(params?: OverviewQuery): Promise<Overview> {
  const { data } = await api.get('/admin/overview', { params })
  return data as Overview
}

