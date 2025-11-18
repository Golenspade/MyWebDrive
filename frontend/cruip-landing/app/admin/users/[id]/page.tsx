"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { adminApi } from '@/lib/api/admin'
import { adminAuditApi } from '@/lib/api/admin-audit'
import { usersApi } from '@/lib/api/users'
import { filesApi } from '@/lib/api/files'
import { storageAdminApi } from '@/lib/api/storage-admin'
import { formatCompactBytes } from '@/lib/utils/format-bytes'

export default function AdminUserDetailPage(){
  const params = useParams() as { id?: string }
  const id = params?.id || ''
  const [basic, setBasic] = useState<any>(null)
  const [uploads, setUploads] = useState<Array<{ id:string; name:string; size:number|null; updatedAt:string }>>([])
  const [, setUploadsCursor] = useState<string | null>(null)

  const [storage, setStorage] = useState<{ storageQuota:number; storageUsed:number }|null>(null)
  const [audits, setAudits] = useState<Array<{ action:string; target?:string|null; createdAt:string; meta?: any }>>([])
  const [downloadsByFile, setDownloadsByFile] = useState<Record<string, Array<{ createdAt:string; bytes:number }>>>({})

  async function load(){
    if (!id) return
    try {
      setBasic(await adminApi.getUser(id))
    } catch {
      // 基本信息加载失败时保持为空，用占位文案展示
    }
    try {
      setStorage(await usersApi.getStorageById(id))
    } catch {
      // 用户在 User 服务中还没有存储记录时允许忽略
    }
    try {
      const r = await filesApi.listByUserAdmin(id, { limit: 20 })
      setUploads(r.items.map(x=>({ id:x.id, name:x.name, size:x.size ?? 0, updatedAt:x.updatedAt })))
      setUploadsCursor(r.nextCursor)
    } catch {
      // 上传列表失败时保留已有 uploads，避免打断其它区域
    }
    try {
      setAudits(await adminAuditApi.list())
    } catch {
      // 审计记录失败时仅影响“最近活动”模块
    }
  }

  useEffect(()=>{ load() },[id])
  useEffect(()=>{
    const onVis = ()=> { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return ()=> document.removeEventListener('visibilitychange', onVis)
  },[id])
  // Fetch recent downloads for up to first 5 files
  useEffect(()=>{
    (async()=>{
      try{
        const first = uploads.slice(0, 5)
        if (first.length === 0) { setDownloadsByFile({}); return }
        const results = await Promise.all(first.map(f=> storageAdminApi.getDownloadsByFile(f.id, 10).catch(()=>({ items: [] }))))
        const map: Record<string, Array<{ createdAt:string; bytes:number }>> = {}
        results.forEach((r, idx)=> { map[first[idx].id] = (r.items||[]).map(x=>({ createdAt: x.createdAt, bytes: x.bytes })) })
        setDownloadsByFile(map)
      }catch{
        // 下载记录获取失败时忽略，活动时间线会少一些数据
      }
    })()
  },[uploads])


  const activities = useMemo(()=>{
    const arr: Array<{ text: string; at: string }> = []
    if (basic?.createdAt) arr.push({ text: '创建账户', at: basic.createdAt })
    for (const u of uploads) arr.push({ text: `上传了 ${u.name}`, at: u.updatedAt })
    // quota changes from gateway audit
    for (const a of audits) {
      if (a.action === 'users.quota.set' && a.target === id) {
        const q = a.meta?.storageQuota
        arr.push({ text: `配额修改为 ${typeof q==='number' ? formatCompactBytes(q) : q}`, at: a.createdAt })
      }
    }
    // downloads from storage events
    for (const u of uploads) {
      const evs = downloadsByFile[u.id] || []
      for (const e of evs) {
        arr.push({ text: `下载了 ${u.name}（${formatCompactBytes(e.bytes)}）`, at: e.createdAt })
      }
    }
    return arr.sort((a,b)=> new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10)
  }, [basic, uploads, audits, downloadsByFile, id])

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>用户详情</h1>
        <Link href='/admin/users' className='text-sm text-muted-foreground hover:underline'>返回列表</Link>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle className='text-base'>基本信息</CardTitle></CardHeader>
          <CardContent>
            {basic ? (
              <div className='space-y-1 text-sm'>
                <div>ID: {basic.id}</div>
                <div>Email: {basic.email}</div>
                <div>姓名: {basic.name || '-'} / 角色: {basic.role}</div>
                <div>创建时间: {new Date(basic.createdAt).toLocaleString()}</div>
              </div>
            ) : <div className='text-sm text-muted-foreground'>...</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-base'>存储</CardTitle>
              <Button size='sm' variant='outline' onClick={load}>刷新</Button>
            </div>
          </CardHeader>
          <CardContent>
            {storage ? (
              <div className='space-y-1 text-sm'>
                <div>已用: {formatCompactBytes(storage.storageUsed)}</div>
                <div>配额: {formatCompactBytes(storage.storageQuota)}</div>
              </div>
            ) : <div className='text-sm text-muted-foreground'>加载中...</div>}
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle className='text-base'>上传内容</CardTitle></CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <div className='text-sm text-muted-foreground'>暂无数据</div>
            ) : (
              <div className='text-sm'>
                <div className='grid grid-cols-3 gap-2 text-muted-foreground mb-2'>
                  <div>文件名</div>
                  <div>大小</div>
                  <div>更新时间</div>
                </div>
                {uploads.map(f => (
                  <div key={f.id} className='grid grid-cols-3 gap-2 py-1 border-b last:border-b-0'>
                    <div className='truncate'>{f.name}</div>
                    <div>{formatCompactBytes(f.size||0)}</div>
                    <div>{new Date(f.updatedAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className='text-base'>最近活动</CardTitle></CardHeader>
          <CardContent>
            {activities.length ? (
              <div className='space-y-2 text-sm'>
                {activities.map((ev, idx) => (
                  <div key={idx} className='flex items-center justify-between gap-3'>
                    <div className='truncate'>{ev.text}</div>
                    <div className='text-muted-foreground whitespace-nowrap'>{new Date(ev.at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-sm text-muted-foreground'>暂无活动</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

