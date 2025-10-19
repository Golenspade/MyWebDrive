// Files (Metadata) APIs (user + admin)
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type FileItem = {
  id: string
  name: string
  size: number | null
  mimeType?: string | null
  updatedAt: string
  path: string
  version?: number
}

export type FilesResp = { items: FileItem[]; nextCursor: string | null }

export const userFilesApi = {
  listMine: (opts: { limit?: number; cursor?: string } = {}) => {
    const usp = new URLSearchParams()
    if (opts.limit) usp.set('limit', String(opts.limit))
    if (opts.cursor) usp.set('cursor', String(opts.cursor))
    const qs = usp.toString()
    return apiClient.get<FilesResp>(`/files/me${qs ? `?${qs}` : ''}`)
  }
}
export type FileVersion = {
  id: string
  version: number
  size: number
  md5Hash?: string | null
  createdAt: string
}

export const userFileVersionsApi = {
  list: (fileId: string, limit = 20) => apiClient.get<{ versions: FileVersion[] }>(`/files/${encodeURIComponent(fileId)}/versions?limit=${limit}`),
  restore: (fileId: string, versionId: string) => apiClient.post(`/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}/restore`),
}



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

