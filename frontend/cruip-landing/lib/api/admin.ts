// Admin API wrappers (user management)
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

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
  role: 'user' | 'admin'
  status: string
  createdAt: string
  quota: QuotaBalance | null
}
export type UsersResp = { items: AdminUser[]; page: number; pageSize: number; total: number }

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
  setRole: (id: string, role: 'user' | 'admin') => apiClient.patch<{ id: string; role: 'user' | 'admin' }>(`/admin/users/${encodeURIComponent(id)}/role`, { role }),
  setQuota: (id: string, limitBytes: string) => apiClient.patch<QuotaBalance>(`/admin/users/${encodeURIComponent(id)}/quota`, { limitBytes }),
}
