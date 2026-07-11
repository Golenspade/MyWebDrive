import { apiClient } from './client'

export type FileVersion = {
  id: string
  fileId: string
  version: number
  sizeBytes: string
  mimeType: string
  sha256: string
  createdAt: string
}

export type FileItem = {
  id: string
  ownerId: string
  parentId: string | null
  name: string
  type: 'file' | 'folder'
  createdAt: string
  updatedAt: string
  currentVersion: FileVersion | null
}

export type FilesResp = { items: FileItem[]; nextCursor: string | null }
export type VersionsResp = { items: FileVersion[]; nextCursor: string | null }

export type DownloadTicket = {
  objectKey: string
  downloadGrant: string
  expiresInSeconds: number
  fileName: string
  mimeType: string
}

function query(opts: { limit?: number; cursor?: string; parentId?: string | null } = {}) {
  const params = new URLSearchParams()
  if (opts.limit) params.set('limit', String(opts.limit))
  if (opts.cursor) params.set('cursor', opts.cursor)
  if (opts.parentId !== undefined) params.set('parentId', opts.parentId ?? 'null')
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const userFilesApi = {
  listMine: (opts: { limit?: number; cursor?: string; parentId?: string | null } = {}) =>
    apiClient.get<FilesResp>(`/files${query(opts)}`),
  listVersions: (fileId: string, opts: { limit?: number; cursor?: string } = {}) =>
    apiClient.get<VersionsResp>(
      `/files/${encodeURIComponent(fileId)}/versions${query(opts)}`,
    ),
  privateTicket: (fileId: string) =>
    apiClient.post<DownloadTicket>(`/files/${encodeURIComponent(fileId)}/download-ticket`, {}),
}

export const filesApi = {
  listByUserAdmin: (userId: string, opts: { limit?: number; cursor?: string } = {}) =>
    apiClient.get<FilesResp>(
      `/admin/users/${encodeURIComponent(userId)}/files${query(opts)}`,
    ),
}

export const shareDownloadApi = {
  ticket: (token: string, password?: string) =>
    apiClient.postNoRetry<DownloadTicket>(
      `/shares/${encodeURIComponent(token)}/download-ticket`,
      password ? { password } : {},
    ),
}
