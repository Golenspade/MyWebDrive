'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api/client'
import type { DownloadTicket } from '@/lib/api/files'
import { formatCompactBytes } from '@/lib/utils/format-bytes'

type Publication = {
  id: string
  fileId: string
  slug: string
  status: 'published'
  fileName: string
  mimeType: string
  sizeBytes: string
  createdAt: string
  updatedAt: string
}

type PublicationsResponse = {
  items: Publication[]
  nextCursor: string | null
}

type CatalogStatus = 'loading' | 'ready' | 'error'

async function downloadPublication(publication: Publication) {
  const ticket = await apiClient.postNoRetry<DownloadTicket>(
    `/publications/${encodeURIComponent(publication.slug)}/download-ticket`,
    {},
  )
  const response = await apiClient.raw(
    `/storage/objects/${encodeURIComponent(ticket.objectKey)}`,
    { headers: { Authorization: `Bearer ${ticket.downloadGrant}` } },
  )
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ticket.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function CatalogPage() {
  const [publications, setPublications] = useState<Publication[]>([])
  const [status, setStatus] = useState<CatalogStatus>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get<PublicationsResponse>('/publications')
      .then((response) => {
        if (!active) return
        setPublications(response.items)
        setStatus('ready')
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : '目录加载失败')
        setStatus('error')
      })
    return () => { active = false }
  }, [])

  if (status === 'loading') {
    return <div className="mx-auto max-w-6xl p-8 text-sm text-nothing-secondary">正在加载发布目录…</div>
  }
  if (status === 'error') {
    return <div className="mx-auto max-w-6xl p-8 text-sm text-destructive">发布目录不可用：{error}</div>
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">软件分发</h1>
        <p className="mt-2 text-sm text-nothing-secondary">下载凭证仅在点击时签发，且只能使用一次。</p>
      </div>
      {publications.length === 0 ? (
        <div className="rounded border p-8 text-center text-sm text-nothing-secondary">暂无已发布文件</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publications.map((publication) => (
            <Card key={publication.id}>
              <CardHeader><CardTitle className="truncate text-base">{publication.fileName}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="text-nothing-secondary">{publication.mimeType}</div>
                <div className="text-nothing-secondary">{formatCompactBytes(Number(publication.sizeBytes))}</div>
                <Button onClick={() => void downloadPublication(publication)}>下载</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
