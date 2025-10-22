"use client"

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/lib/stores/auth-store'
import { apiClient } from '@/lib/api/client'

type UploadPanelProps = {
  onCompleted?: (result: { fileId: string; fileName: string }) => void
  showPreMetadata?: boolean
  showPostDraft?: boolean
  title?: boolean | string
}

export default function UploadPanel({ onCompleted, showPreMetadata = true, showPostDraft = true, title = '上传文件' }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0) // 0~100
  const [status, setStatus] = useState<string>('')
  const [uploadId, setUploadId] = useState<string | null>(null)

  // Draft metadata UI state (pre-upload fill)
  const [draft, setDraft] = useState<{ name?: string; description?: string; category?: string; license?: string; os?: 'windows'|'darwin'|'linux'|'any'; arch?: 'amd64'|'arm64'|'any'; channel?: 'stable'|'beta'|'dev' }>({ channel: 'stable', os: 'any', arch: 'any' })
  const [savingDraft, setSavingDraft] = useState(false)

  const token = useAuthStore((s) => s.accessToken)

  // Optional: get quota to disable when no capacity
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null)
  useEffect(() => {
    ;(async () => {
      try {
        const me = await apiClient.get<any>('/users/me')
        setQuota({ used: Number(me.storageUsed||0), total: Number(me.storageQuota||0) })
      } catch {}
    })()
  }, [])

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
      // Save draft metadata for this file id
      try { await apiClient.put(`/files/${id}/draft`, draft) } catch {}
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
      {title ? (
        <div className="text-sm font-medium">{typeof title === 'string' ? title : '上传文件'}</div>
      ) : null}
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
      {showPostDraft && uploadId && !uploading && status === '上传完成' && (
        <div className="space-y-3 text-xs">
          <div>
            已完成。你可以在“我的文件”或发布管理中使用该文件，或直接下载：
            <a className="ml-1 underline" href={`/api/v1/storage/files/${uploadId}/download-direct?ttl=600`}>直链下载</a>
          </div>
          <div className="p-3 border rounded-md space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="name">资源名称</Label>
                  <Input id="name" value={draft.name || ''} onChange={(e)=>setDraft({ ...draft, name: e.target.value })} placeholder="例如：Awesome Tool" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category">分类</Label>
                  <Select value={draft.category as any} onValueChange={(v:any)=>setDraft({ ...draft, category: v })}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">基础工具</SelectItem>
                      <SelectItem value="writing">写作工具</SelectItem>
                      <SelectItem value="model">模型工具</SelectItem>
                      <SelectItem value="script">脚本工具</SelectItem>
                      <SelectItem value="bundle">整合包</SelectItem>
                      <SelectItem value="modelAsset">模型</SelectItem>
                      <SelectItem value="article">文章</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="license">许可证</Label>
                  <Input id="license" value={draft.license || ''} onChange={(e)=>setDraft({ ...draft, license: e.target.value })} placeholder="MIT/Apache-2.0/..." />
                </div>
                <div className="space-y-1">
                  <Label>兼容性</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={draft.os} onValueChange={(v:any)=>setDraft({ ...draft, os: v })}>
                      <SelectTrigger><SelectValue placeholder="OS" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">通用</SelectItem>
                        <SelectItem value="windows">Windows</SelectItem>
                        <SelectItem value="darwin">macOS</SelectItem>
                        <SelectItem value="linux">Linux</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={draft.arch} onValueChange={(v:any)=>setDraft({ ...draft, arch: v })}>
                      <SelectTrigger><SelectValue placeholder="Arch" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">通用</SelectItem>
                        <SelectItem value="amd64">AMD64</SelectItem>
                        <SelectItem value="arm64">ARM64</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={draft.channel} onValueChange={(v:any)=>setDraft({ ...draft, channel: v })}>
                      <SelectTrigger><SelectValue placeholder="渠道" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stable">Stable</SelectItem>
                        <SelectItem value="beta">Beta</SelectItem>
                        <SelectItem value="dev">Dev</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="desc">描述</Label>
                  <textarea id="desc" className="w-full min-h-[80px] p-2 rounded border bg-background text-foreground" value={draft.description || ''} onChange={(e)=>setDraft({ ...draft, description: e.target.value })} placeholder="简要介绍您的资源..." />
                </div>
              </div>
              <div>
                <Button size="sm" disabled={savingDraft} onClick={async()=>{
                  if (!uploadId) return
                  setSavingDraft(true)
                  try {
                    await apiClient.put(`/files/${uploadId}/draft`, draft)
                    setStatus('草稿信息已保存')
                  } catch (e:any) {
                    setStatus(e?.message || '保存失败')
                  } finally {
                    setSavingDraft(false)
                  }
                }}>保存草稿</Button>
              </div>
            </div>
        </div>
      )}

      {showPreMetadata && (
      <div className="p-3 border rounded-md space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="name-pre">资源名称</Label>
            <Input id="name-pre" value={draft.name || ''} onChange={(e)=>setDraft({ ...draft, name: e.target.value })} placeholder="例如：Awesome Tool" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category-pre">分类</Label>
            <Select value={draft.category as any} onValueChange={(v:any)=>setDraft({ ...draft, category: v })}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">基础工具</SelectItem>
                <SelectItem value="writing">写作工具</SelectItem>
                <SelectItem value="model">模型工具</SelectItem>
                <SelectItem value="script">脚本工具</SelectItem>
                <SelectItem value="bundle">整合包</SelectItem>
                <SelectItem value="modelAsset">模型</SelectItem>
                <SelectItem value="article">文章</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="license-pre">许可证</Label>
            <Input id="license-pre" value={draft.license || ''} onChange={(e)=>setDraft({ ...draft, license: e.target.value })} placeholder="MIT/Apache-2.0/..." />
          </div>
          <div className="space-y-1">
            <Label>兼容性</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={draft.os} onValueChange={(v:any)=>setDraft({ ...draft, os: v })}>
                <SelectTrigger><SelectValue placeholder="OS" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">通用</SelectItem>
                  <SelectItem value="windows">Windows</SelectItem>
                  <SelectItem value="darwin">macOS</SelectItem>
                  <SelectItem value="linux">Linux</SelectItem>
                </SelectContent>
              </Select>
              <Select value={draft.arch} onValueChange={(v:any)=>setDraft({ ...draft, arch: v })}>
                <SelectTrigger><SelectValue placeholder="Arch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">通用</SelectItem>
                  <SelectItem value="amd64">AMD64</SelectItem>
                  <SelectItem value="arm64">ARM64</SelectItem>
                </SelectContent>
              </Select>
              <Select value={draft.channel} onValueChange={(v:any)=>setDraft({ ...draft, channel: v })}>
                <SelectTrigger><SelectValue placeholder="渠道" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">Stable</SelectItem>
                  <SelectItem value="beta">Beta</SelectItem>
                  <SelectItem value="dev">Dev</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="desc-pre">描述</Label>
            <textarea id="desc-pre" className="w-full min-h-[80px] p-2 rounded border bg-background text-foreground" value={draft.description || ''} onChange={(e)=>setDraft({ ...draft, description: e.target.value })} placeholder="简要介绍您的资源..." />
          </div>
        </div>
      </div>
      )}

      {/* Disable upload when no quota or missing name */}
      {quota && quota.total > 0 && quota.used >= quota.total && (
        <div className="text-xs text-red-600">您的存储配额已用尽，请联系管理员或释放空间</div>
      )}

      <div className="flex items-center gap-2">
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button onClick={startUpload} disabled={!file || uploading || !draft.name || !!(quota && quota.total > 0 && quota.used >= quota.total)}>开始上传</Button>
      </div>

    </div>
  )
}

