// User API wrappers
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type User = {
  id: string
  name: string | null
  email?: string
  storageQuota: number
  storageUsed: number
  createdAt?: string
  updatedAt?: string
  role?: 'user' | 'admin'
}

export const usersApi = {
  me: () => apiClient.get<User>('/users/me'),
  getStorageById: (id: string) => apiClient.get<{ id?: string; storageQuota: number; storageUsed: number }>(`/users/${id}/storage`),
  setQuotaById: (id: string, storageQuota: number) => apiClient.patch<{ id: string; storageQuota: number }>(`/users/${id}/quota`, { storageQuota }),
}

