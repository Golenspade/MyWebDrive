'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api/client'
import { userFilesApi } from '@/lib/api/files'

const PART_BYTES = 5 * 1024 * 1024

type UploadIntent = {
  id: string
  objectKey: string
  uploadGrant: string
  expiresAt: string
}

type UploadPanelProps = {
  onCompleted?: (result: { fileId: string; fileName: string }) => void
  showPreMetadata?: boolean
  showPostDraft?: boolean
  title?: boolean | string
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '上传失败'
}

export default function UploadPanel({ onCompleted, title = '上传文件' }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const fileSummary = useMemo(() => {
    if (!file) return null
    return `${file.name} · ${file.size.toLocaleString()} B`
  }, [file])

  async function waitUntilVisible(fileName: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const files = await userFilesApi.listMine({ limit: 100 })
      const visible = files.items.find(
        (item) => item.name === fileName && item.currentVersion !== null,
      )
      if (visible) return visible
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return null
  }

  async function startUpload() {
    if (!file || file.size < 1) {
      setStatus('请选择一个非空文件')
      return
    }
    setUploading(true)
    setProgress(0)
    setStatus('预留上传配额…')
    let intent: UploadIntent | null = null
    let completionQueued = false
    try {
      intent = await apiClient.post<UploadIntent>(
        '/upload-intents',
        {
          fileName: file.name,
          sizeBytes: String(file.size),
          mimeType: file.type || 'application/octet-stream',
        },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      )

      const parts = Math.ceil(file.size / PART_BYTES)
      for (let index = 0; index < parts; index += 1) {
        const partNumber = index + 1
        const body = file.slice(index * PART_BYTES, Math.min(file.size, partNumber * PART_BYTES))
        await apiClient.raw(`/storage/uploads/${intent.objectKey}/parts/${partNumber}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${intent.uploadGrant}`,
            'Content-Type': 'application/octet-stream',
          },
          body,
        })
        setProgress(Math.round((partNumber / parts) * 100))
        setStatus(`已上传 ${partNumber}/${parts} 个分片`)
      }

      await apiClient.raw(`/storage/uploads/${intent.objectKey}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${intent.uploadGrant}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parts }),
      })
      completionQueued = true
      setStatus('文件正在完成处理…')
      const visible = await waitUntilVisible(file.name)
      if (visible) {
        setStatus('上传完成')
        onCompleted?.({ fileId: visible.id, fileName: visible.name })
      } else {
        setStatus('文件已提交，后台仍在处理，请稍后刷新文件列表')
      }
    } catch (error) {
      if (intent && !completionQueued) {
        try {
          await apiClient.post(`/upload-intents/${intent.id}/cancel`, {})
        } catch {
          setStatus(`${message(error)}；上传预留的自动取消也失败，请稍后重试`)
          return
        }
      }
      setStatus(message(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      {title ? <div className="text-sm font-medium">{typeof title === 'string' ? title : '上传文件'}</div> : null}
      <Input type="file" disabled={uploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      {fileSummary ? <div className="text-xs text-muted-foreground">{fileSummary}</div> : null}
      {uploading ? (
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div className="h-2 bg-primary" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}
      <Button onClick={startUpload} disabled={!file || uploading}>开始上传</Button>
    </div>
  )
}
