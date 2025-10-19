// Admin Audit API wrappers
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type AuditLog = {
  id: string
  action: string
  actorId?: string | null
  target?: string | null
  createdAt: string
  meta?: any
}

export const adminAuditApi = {
  list: () => apiClient.get<AuditLog[]>('/admin/audit'),
}

