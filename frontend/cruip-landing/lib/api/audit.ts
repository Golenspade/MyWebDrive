// Admin audit API client
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type AuditItem = {
  id: string
  action: string
  actorId?: string
  target?: string
  createdAt: string
  meta?: Record<string, unknown>
}

export const auditApi = {
  list: () => apiClient.get<AuditItem[]>('/admin/audit'),
  create: (data: { action: string; target?: string; meta?: Record<string, unknown> }) => apiClient.post<AuditItem>('/admin/audit', data),
}

