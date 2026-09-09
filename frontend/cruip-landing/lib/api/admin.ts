// Admin API wrappers (user management)
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'
import type { Role } from './auth'

export type QuotaBalance = {
  limitBytes: string
  reservedBytes: string
  committedBytes: string
  availableBytes: string
}
export type AdminUser = {
  id: string
  name: string | null
  email: string
  role: Role
  status: string
  createdAt: string
  quota: QuotaBalance | null
}
export type UsersResp = { items: AdminUser[]; page: number; pageSize: number; total: number }

export type QuotaPoolAllocation = {
  userId: string
  previousLimitBytes: string
  occupiedBytes: string
  limitBytes: string
}

export type QuotaPoolPlan = {
  overcommitted: boolean
  poolBytes: string
  platformReserveBytes: string
  occupiedBytes: string
  allocableBytes: string
  allocations: QuotaPoolAllocation[]
}

export const adminApi = {
  listUsers: (query: { q?: string; page?: number; pageSize?: number } = {}) => {
    const usp = new URLSearchParams()
    if (query.q) usp.set('query', query.q)
    if (query.page) usp.set('page', String(query.page))
    if (query.pageSize) usp.set('pageSize', String(query.pageSize))
    const qs = usp.toString()
    return apiClient.get<UsersResp>(`/admin/users${qs ? `?${qs}` : ''}`)
  },
  getUser: (id: string) => apiClient.get<AdminUser>(`/admin/users/${encodeURIComponent(id)}`),
  setRole: (id: string, role: Role) => apiClient.patch<{ id: string; role: Role }>(`/admin/users/${encodeURIComponent(id)}/role`, { role }),
  setQuota: (id: string, limitBytes: string) => apiClient.patch<QuotaBalance>(`/admin/users/${encodeURIComponent(id)}/quota`, { limitBytes }),
  previewQuotaPool: () => apiClient.get<QuotaPoolPlan>('/admin/quota/pool'),
  rebalanceQuotaPool: () => apiClient.post<QuotaPoolPlan>('/admin/quota/rebalance'),
}
