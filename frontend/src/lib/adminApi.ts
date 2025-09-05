import api from '@/lib/api'

export type Overview = {
  totals: Record<string, number>
  today: Record<string, number>
  last7d: Record<string, { date: string; value: number }[]>
}

export async function fetchAdminOverview(): Promise<Overview> {
  const { data } = await api.get('/admin/overview')
  return data as Overview
}

