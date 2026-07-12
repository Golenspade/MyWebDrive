'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api/client'
import type { FileItem } from '@/lib/api/files'
import { useProtectedAdmin } from '@/lib/hooks/use-protected'

type FilesResponse = {
  items: FileItem[]
  nextCursor: string | null
}

type PublicationStatus = 'draft' | 'published'

type Publication = {
  id: string
  fileId: string
  slug: string
  status: PublicationStatus | 'disabled'
  createdAt: string
  updatedAt: string
}

type PageStatus = 'loading' | 'ready' | 'error'

function suggestedSlug(name: string) {
  return name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

function formatBytes(value: string) {
  let bytes: bigint
  try {
    bytes = BigInt(value)
  } catch {
    return `${value} B`
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const
  let unit = 0
  let divisor = BigInt(1)
  const radix = BigInt(1024)
  while (unit < units.length - 1 && bytes >= divisor * radix) {
    divisor *= radix
    unit += 1
  }
  if (unit === 0) return `${bytes} B`
  const whole = bytes / divisor
  const decimal = ((bytes % divisor) * BigInt(100)) / divisor
  return `${whole}.${decimal.toString().padStart(2, '0')} ${units[unit]}`
}

export default function AdminPublishPage() {
  const { ready } = useProtectedAdmin()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [error, setError] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [slug, setSlug] = useState('')
  const [publicationStatus, setPublicationStatus] = useState<PublicationStatus>('published')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState<Publication | null>(null)

  const loadFiles = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true)
    else setStatus('loading')
    setError('')
    try {
      const response = cursor
        ? await apiClient.get<FilesResponse>(
          `/files?limit=100&cursor=${encodeURIComponent(cursor)}`,
        )
        : await apiClient.get<FilesResponse>('/files?limit=100')
      setFiles((current) => cursor ? [...current, ...response.items] : response.items)
      setNextCursor(response.nextCursor)
      setStatus('ready')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '文件列表加载失败')
      if (!cursor) setStatus('error')
    } finally {
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (ready) void loadFiles()
  }, [ready, loadFiles])

  const visibleFiles = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    return files.filter((file) =>
      file.type === 'file' &&
      file.currentVersion !== null &&
      (!query || file.name.toLocaleLowerCase().includes(query)),
    )
  }, [files, searchQuery])

  function selectFile(file: FileItem) {
    setSelectedFile(file)
    setSlug(suggestedSlug(file.name))
    setPublished(null)
    setError('')
  }

  async function publish() {
    if (!selectedFile?.currentVersion || !slug.trim()) return
    setPublishing(true)
    setPublished(null)
    setError('')
    try {
      const publication = await apiClient.put<Publication>(
        `/files/${encodeURIComponent(selectedFile.id)}/publication`,
        { slug: slug.trim(), status: publicationStatus },
      )
      setPublished(publication)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  if (!ready) return null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">发布管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            仅可发布当前账户拥有且已经生成版本的文件。
          </p>
        </div>
        <Button variant="outline" disabled={status === 'loading' || loadingMore} onClick={() => void loadFiles()}>
          刷新
        </Button>
      </div>

      {status === 'error' ? (
        <div className="rounded border border-destructive/40 p-4 text-sm text-destructive">
          文件列表不可用：{error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">选择文件</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="按文件名筛选"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {status === 'loading' ? (
              <div className="text-sm text-muted-foreground">正在加载文件…</div>
            ) : null}
            {status === 'ready' && !nextCursor && visibleFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无可发布的已完成文件</div>
            ) : null}
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {visibleFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={`w-full rounded border p-3 text-left transition-colors ${
                    selectedFile?.id === file.id ? 'border-primary bg-muted' : 'hover:bg-muted/60'
                  }`}
                  onClick={() => selectFile(file)}
                >
                  <div className="font-medium">{file.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatBytes(file.currentVersion!.sizeBytes)} · v{file.currentVersion!.version}
                  </div>
                </button>
              ))}
              {nextCursor ? (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => void loadFiles(nextCursor)}
                >
                  {loadingMore ? '加载中…' : '加载更多'}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">发布设置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="publication-file">文件</Label>
              <Input id="publication-file" value={selectedFile?.name ?? ''} readOnly placeholder="请先选择文件" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publication-slug">公开标识</Label>
              <Input
                id="publication-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="stable-release"
              />
              <div className="text-xs text-muted-foreground">仅允许小写字母、数字和中划线。</div>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={publicationStatus}
                onValueChange={(value) => setPublicationStatus(value as PublicationStatus)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">立即公开</SelectItem>
                  <SelectItem value="draft">保存为草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && status !== 'error' ? <div className="text-sm text-destructive">{error}</div> : null}
            <Button
              className="w-full"
              disabled={!selectedFile?.currentVersion || !slug.trim() || publishing}
              onClick={() => void publish()}
            >
              {publishing ? '提交中…' : '保存发布状态'}
            </Button>
            {published ? (
              <div className="rounded border p-4 text-sm">
                <div className="font-medium">已保存：{published.slug}</div>
                <div className="mt-1 text-muted-foreground">
                  {published.status === 'published' ? '已进入公开发布目录' : '当前为草稿，不会出现在公开目录'}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
