"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/api/admin'
import { usersApi } from '@/lib/api/users'
import { filesApi } from '@/lib/api/files'
import { formatCompactBytes } from '@/lib/utils/format-bytes'

export default function AdminUserDetailPage(){
  const params = useParams() as { id?: string }
  const id = params?.id || ''
  const [basic, setBasic] = useState<any>(null)
  const [uploads, setUploads] = useState<Array<{ id:string; name:string; size:number|null; updatedAt:string }>>([])
  const [uploadsCursor, setUploadsCursor] = useState<string | null>(null)

  const [storage, setStorage] = useState<{ storageQuota:number; storageUsed:number }|null>(null)

  useEffect(()=>{
    if (!id) return
    ;(async()=>{
      try { setBasic(await adminApi.getUser(id)) } catch {}
      try { setStorage(await usersApi.getStorageById(id)) } catch {}
      try {
        const r = await filesApi.listByUserAdmin(id, { limit: 20 })
        setUploads(r.items.map(x=>({ id:x.id, name:x.name, size:x.size ?? 0, updatedAt:x.updatedAt })))
        setUploadsCursor(r.nextCursor)
      } catch {}
    })()
  },[id])

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'></h1>
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
                <div>: {basic.name || '-'} / : {basic.role}
                </div>
                <div>: {new Date(basic.createdAt).toLocaleString()}</div>
              </div>
            ) : <div className='text-sm text-muted-foreground'>...</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className='text-base'></CardTitle></CardHeader>
          <CardContent>
            {storage ? (
              <div className='space-y-1 text-sm'>
                <div>: {formatCompactBytes(storage.storageUsed)}</div>
                <div>: {formatCompactBytes(storage.storageQuota)}</div>
              </div>
            ) : <div className='text-sm text-muted-foreground'>...</div>}
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle className='text-base'></CardTitle></CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <div className='text-sm text-muted-foreground'>...</div>
            ) : (
              <div className='text-sm'>
                <div className='grid grid-cols-3 gap-2 text-muted-foreground mb-2'>
                  <div></div>
                  <div></div>
                  <div></div>
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
          <CardHeader><CardTitle className='text-base'></CardTitle></CardHeader>
          <CardContent>
            <div className='text-sm text-muted-foreground'> (admin  )</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

