// Admin notifications API client (gateway in-memory MVP)
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type Severity = 'critical' | 'warning' | 'info' | 'success'

export type AdminNotification = {
  id: string
  title: string
  description?: string
  severity: Severity
  service?: string
  unread: boolean
  createdAt: string
  meta?: Record<string, unknown>
}

export type NotificationsQuery = { unreadOnly?: boolean; service?: string; severity?: Severity; q?: string; page?: number; pageSize?: number; from?: string; to?: string }
export type NotificationsResp = { items: AdminNotification[]; page: number; pageSize: number; total: number }

export const notificationsApi = {
  list: (query: NotificationsQuery = {}) => {
    const usp = new URLSearchParams()
    if (query.unreadOnly) usp.set('unreadOnly', 'true')
    if (query.service) usp.set('service', query.service)
    if (query.severity) usp.set('severity', query.severity)
    if (query.q) usp.set('q', query.q)
    if (query.page) usp.set('page', String(query.page))
    if (query.pageSize) usp.set('pageSize', String(query.pageSize))
    if (query.from) usp.set('from', query.from)
    if (query.to) usp.set('to', query.to)
    const qs = usp.toString()
    return apiClient.get<NotificationsResp>(`/admin/notifications${qs ? `?${qs}` : ''}`)
  },
  create: (data: { title: string; severity: Severity; description?: string; service?: string; meta?: Record<string, unknown> }) =>
    apiClient.post<AdminNotification>('/admin/notifications', data),
  markRead: (ids: string[]) => apiClient.post<{ ok: true; updated: number }>('/admin/notifications/mark-read', { ids }),
}
