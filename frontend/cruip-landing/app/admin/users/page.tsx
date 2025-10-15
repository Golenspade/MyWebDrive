"use client"

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/stores/auth-store'
import { adminApi } from '@/lib/api/admin'
import { usersApi } from '@/lib/api/users'
import { auditApi } from '@/lib/api/audit'

type AdminUser = { id: string; name: string | null; email: string; role: 'user' | 'admin'; createdAt: string }
type UsersResp = { items: AdminUser[]; page: number; pageSize: number; total: number }

export default function AdminUsersPage() {
  const { isAuthenticated, role } = useAuthStore()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<UsersResp>({ items: [], page: 1, pageSize: 10, total: 0 })

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / pageSize)), [data.total, pageSize])

  async function fetchUsers() {
    if (!isAuthenticated || role !== 'admin') return
    setLoading(true)
    try {
      const list = await adminApi.listUsers({ q: query, page, pageSize })
      setData(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [isAuthenticated, role, page, pageSize])

  async function changeRole(id: string, nextRole: 'user' | 'admin') {
    await adminApi.setRole(id, nextRole)
    try { await auditApi.create({ action: 'user.role.update', target: id, meta: { role: nextRole } }) } catch {}
    setData(prev => ({ ...prev, items: prev.items.map(u => u.id === id ? { ...u, role: nextRole } : u) }))
  }

  // Storage quota dialog state
  const [quotaDlgOpen, setQuotaDlgOpen] = useState(false)
  const [quotaUserId, setQuotaUserId] = useState<string | null>(null)
  const [quotaInput, setQuotaInput] = useState('')
  const [quotaInfo, setQuotaInfo] = useState<{ storageQuota: number; storageUsed: number } | null>(null)

  async function openQuota(id: string) {
    setQuotaUserId(id)
    setQuotaDlgOpen(true)
    const js = await usersApi.getStorageById(id)
    setQuotaInfo(js)
    setQuotaInput(String(js.storageQuota))
  }

  async function saveQuota() {
    if (!quotaUserId) return
    const val = Number.parseInt(quotaInput, 10)
    if (!Number.isFinite(val) || val < 0) return
    await usersApi.setQuotaById(quotaUserId, val)
    try { await auditApi.create({ action: 'user.quota.update', target: quotaUserId, meta: { storageQuota: val } }) } catch {}
    const fresh = await usersApi.getStorageById(quotaUserId)
    setQuotaInfo(fresh)
  }

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>用户管理</h1>
        <div className='flex items-center gap-2'>
          <Button onClick={fetchUsers} disabled={loading}>刷新</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-2 pb-4'>
            <Input placeholder='搜索邮箱/姓名' value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') { setPage(1); fetchUsers() } }} />
            <Button onClick={() => { setPage(1); fetchUsers() }} disabled={loading}>搜索</Button>
          </div>

          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className='text-right'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className='font-medium'>{u.email}</TableCell>
                    <TableCell>{u.name || '-'}</TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                        <Select value={u.role} onValueChange={(v)=>changeRole(u.id, v as any)}>
                          <SelectTrigger className='w-[120px]'><SelectValue placeholder='角色' /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value='user'>user</SelectItem>
                            <SelectItem value='admin'>admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(u.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button variant='outline' onClick={()=>openQuota(u.id)}>存储</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='flex items-center justify-between mt-4'>
            <div className='text-sm text-muted-foreground'>共 {data.total} 个用户</div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</Button>
              <div className='text-sm'>第 {page} / {totalPages} 页</div>
              <Button variant='outline' disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>下一页</Button>
              <Select value={String(pageSize)} onValueChange={(v)=>{ setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger className='w-[110px]'><SelectValue placeholder='每页' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>每页 10</SelectItem>
                  <SelectItem value='20'>每页 20</SelectItem>
                  <SelectItem value='50'>每页 50</SelectItem>
                  <SelectItem value='100'>每页 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quota Dialog */}
      <Dialog open={quotaDlgOpen} onOpenChange={setQuotaDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>存储配额</DialogTitle>
          </DialogHeader>
          {quotaInfo ? (
            <div className='space-y-3'>
              <div className='text-sm text-muted-foreground'>已用 {quotaInfo.storageUsed} / 配额 {quotaInfo.storageQuota} 字节</div>
              <div className='flex items-center gap-2'>
                <Input value={quotaInput} onChange={(e)=>setQuotaInput(e.target.value)} />
                <Button onClick={saveQuota}>保存</Button>
              </div>
            </div>
          ) : (
            <div className='text-sm text-muted-foreground'>正在加载...</div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={()=>setQuotaDlgOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
