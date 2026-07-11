'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import UploadPanel from '@/components/upload/upload-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiClient } from '@/lib/api/client'
import {
  userFilesApi,
  type DownloadTicket,
  type FileItem,
  type FileVersion,
} from '@/lib/api/files'
import { useProtected } from '@/lib/hooks/use-protected'
import { useAuthStore } from '@/lib/stores/auth-store'
import { formatCompactBytes } from '@/lib/utils/format-bytes'

function saveResponse(response: Response, fileName: string) {
  return response.blob().then((blob) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  })
}

export default function AccountPage() {
  const { ready } = useProtected('user')
  const router = useRouter()
  const { user, role, logout } = useAuthStore()
  const [files, setFiles] = useState<FileItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [versionFile, setVersionFile] = useState<FileItem | null>(null)
  const [versions, setVersions] = useState<FileVersion[]>([])

  const loadFiles = useCallback(async (cursor?: string) => {
    setLoading(true)
    setError('')
    try {
      const response = await userFilesApi.listMine({ limit: 20, cursor })
      setFiles((current) => (cursor ? [...current, ...response.items] : response.items))
      setNextCursor(response.nextCursor)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '文件列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ready) void loadFiles()
  }, [ready, loadFiles])

  async function openVersions(file: FileItem) {
    setVersionFile(file)
    const response = await userFilesApi.listVersions(file.id, { limit: 100 })
    setVersions(response.items)
  }

  async function downloadFile(file: FileItem) {
    const ticket = await apiClient.post<DownloadTicket>(
      `/files/${encodeURIComponent(file.id)}/download-ticket`,
      {},
    )
    const response = await apiClient.raw(
      `/storage/objects/${encodeURIComponent(ticket.objectKey)}`,
      { headers: { Authorization: `Bearer ${ticket.downloadGrant}` } },
    )
    await saveResponse(response, ticket.fileName)
  }

  async function onLogout() {
    await logout()
    router.replace('/signin')
  }

  if (!ready) return null

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">个人中心</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">账户</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>{user?.email ?? '-'}</div>
          <div>{role ?? 'user'}</div>
          <Button variant="destructive" onClick={onLogout}>退出登录</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">上传文件</CardTitle></CardHeader>
        <CardContent>
          <UploadPanel onCompleted={() => void loadFiles()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">我的文件</CardTitle>
            <Button variant="outline" disabled={loading} onClick={() => void loadFiles()}>刷新</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          {!loading && !error && files.length === 0 ? <div className="text-sm text-muted-foreground">暂无文件</div> : null}
          {files.map((file) => (
            <div key={file.id} className="grid gap-2 border-b py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
              <div>
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {file.currentVersion
                    ? `${formatCompactBytes(Number(file.currentVersion.sizeBytes))} · v${file.currentVersion.version} · ${file.currentVersion.mimeType}`
                    : '文件尚未生成可用版本'}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(file.updatedAt).toLocaleString()}</div>
              <Button variant="outline" disabled={!file.currentVersion} onClick={() => void openVersions(file)}>版本</Button>
              <Button disabled={!file.currentVersion} onClick={() => void downloadFile(file)}>下载</Button>
            </div>
          ))}
          {nextCursor ? <Button variant="outline" disabled={loading} onClick={() => void loadFiles(nextCursor)}>加载更多</Button> : null}
        </CardContent>
      </Card>

      <Dialog open={versionFile !== null} onOpenChange={(open) => { if (!open) { setVersionFile(null); setVersions([]) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{versionFile?.name} 的版本</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {versions.length === 0 ? <div className="text-muted-foreground">暂无版本</div> : null}
            {versions.map((version) => (
              <div key={version.id} className="grid grid-cols-3 gap-2 border-b py-2">
                <div>v{version.version}</div>
                <div>{formatCompactBytes(Number(version.sizeBytes))}</div>
                <div>{new Date(version.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
