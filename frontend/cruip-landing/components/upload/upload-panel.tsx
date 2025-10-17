"use client"

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/stores/auth-store'
import { apiClient } from '@/lib/api/client'

export default function UploadPanel({ onCompleted }: { onCompleted?: (result: { fileId: string; fileName: string }) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0) // 0~100
  const [status, setStatus] = useState<string>('')
  const [uploadId, setUploadId] = useState<string | null>(null)

  const token = useAuthStore((s) => s.accessToken)

  const fileInfo = useMemo(() => {
    if (!file) return null
    const fmt = (n: number) => {
      if (!n) return '0 B'
      const u = ['B','KB','MB','GB','TB']
      const i = Math.floor(Math.log(n)/Math.log(1024))
      return `${(n/Math.pow(1024,i)).toFixed(2)} ${u[i]}`
    }
    return `${file.name}（${fmt(file.size)}）`
  }, [file])

  async function startUpload() {
    if (!file) return
    setUploading(true)
    setProgress(0)
    setStatus('创建上传会话…')
    try {
      // 1) 创建会话（JSON 流程）
      const session = await apiClient.post<any>('/storage/uploads', {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      })
      const id: string = session.id
      const chunkSize: number = session.chunkSize || 5 * 1024 * 1024
      const totalChunks: number = session.totalChunks || Math.ceil(file.size / chunkSize)
      setUploadId(id)

      // 2) 逐块上传
      setStatus('开始上传分片…')
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(file.size, start + chunkSize)
        const slice = file.slice(start, end)
        const res = await fetch(`/api/v1/storage/uploads/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Chunk-Index': String(i),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: slice,
        })
        if (!res.ok) {
          const msg = await res.text().catch(() => '')
          throw new Error(`分片上传失败 #${i}: ${res.status} ${msg}`)
        }
        const pct = Math.round(((i + 1) / totalChunks) * 100)
        setProgress(pct)
        setStatus(`已上传 ${i + 1}/${totalChunks} 个分片`)
      }

      // 3) 完成合并
      setStatus('合并文件…')
      const fin = await apiClient.post<{ fileId: string }>(`/storage/uploads/${id}/finalize`, {})
      setStatus('上传完成')
      onCompleted?.({ fileId: fin.fileId || id, fileName: file.name })
    } catch (err: any) {
      console.error(err)
      setStatus(err?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">上传文件</div>
      <div className="flex items-center gap-2">
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button onClick={startUpload} disabled={!file || uploading}>开始上传</Button>
      </div>
      {fileInfo && <div className="text-xs text-muted-foreground">{fileInfo}</div>}
      {uploading && (
        <div className="space-y-2">
          <div className="h-2 w-full rounded bg-muted overflow-hidden">
            <div className="h-2 bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">{status}</div>
        </div>
      )}
      {!uploading && status && <div className="text-xs text-muted-foreground">{status}</div>}
      {uploadId && !uploading && status === '上传完成' && (
        <div className="text-xs">
          已完成。你可以在“我的文件”或发布管理中使用该文件，或直接下载：
          <a className="ml-1 underline" href={`/api/v1/storage/files/${uploadId}/download-direct?ttl=600`}>直链下载</a>
        </div>
      )}
    </div>
  )
}

