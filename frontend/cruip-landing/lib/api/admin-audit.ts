// Admin Audit API wrappers
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type AuditMeta = {
  storageQuota?: number | string
} | null

export type AuditLog = {
  id: string
  action: string
  actorId?: string | null
  target?: string | null
  createdAt: string
  meta?: AuditMeta
}

export const adminAuditApi = {
  list: () => apiClient.get<AuditLog[]>('/admin/audit'),
}

