// Files (Metadata) admin APIs
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type AdminFileItem = {
  id: string
  name: string
  size: number | null
  mimeType?: string | null
  updatedAt: string
  path: string
}

export type AdminFilesResp = { items: AdminFileItem[]; nextCursor: string | null }

export const filesApi = {
  listByUserAdmin: (userId: string, opts: { limit?: number; cursor?: string } = {}) => {
    const usp = new URLSearchParams()
    if (opts.limit) usp.set('limit', String(opts.limit))
    if (opts.cursor) usp.set('cursor', opts.cursor)
    const qs = usp.toString()
    return apiClient.get<AdminFilesResp>(`/files/admin/by-user/${userId}${qs ? `?${qs}` : ''}`)
  }
}

