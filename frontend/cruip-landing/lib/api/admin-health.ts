// Admin health API
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type AdminServiceHealth = { name: string; url: string; status: 'healthy' | 'error' }
export type AdminHealth = { services: AdminServiceHealth[]; time: string }

export const adminHealthApi = {
  get: () => apiClient.get<AdminHealth>('/admin/health'),
}

