// User API wrappers
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export const usersApi = {
  getStorageById: (id: string) => apiClient.get<{ id?: string; storageQuota: number; storageUsed: number }>(`/users/${id}/storage`),
  setQuotaById: (id: string, storageQuota: number) => apiClient.patch<{ id: string; storageQuota: number }>(`/users/${id}/quota`, { storageQuota }),
}
