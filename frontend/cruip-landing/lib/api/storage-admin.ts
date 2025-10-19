// Storage Admin API wrappers
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type DownloadEvent = {
  id: string
  fileId: string
  bytes: number
  ip?: string | null
  createdAt: string
}

export const storageAdminApi = {
  getDownloadsByFile: (fileId: string, limit = 20) => apiClient.get<{ items: DownloadEvent[] }>(`/storage/downloads/by-file/${fileId}?limit=${encodeURIComponent(String(limit))}`),
}

