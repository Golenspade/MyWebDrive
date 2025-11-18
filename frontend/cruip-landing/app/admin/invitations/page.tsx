"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { invitationsApi, type Invitation } from '@/lib/api/admin'
import { auditApi } from '@/lib/api/audit'

// 管理端邀请码管理页。
// 依赖 Auth 后端的邀请制开关，当 REGISTRATION_REQUIRE_INVITE=true 时，用户只能通过邀请码注册。
export default function InvitationsPage() {
  const [items, setItems] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [usageLimit, setUsageLimit] = useState('1')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')

  // 初始加载邀请码列表。失败时只在顶部显示错误提示，不阻断整个页面。
  async function load() {
    setLoading(true)
    setError(null)
    try {
      const list = await invitationsApi.list()
      setItems(list)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败'
      setError(msg || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // 创建一条新的邀请码，并将关键操作记录到审计日志中
  async function createOne() {
    // usageLimit 从输入框读入，强制收敛在 [1, 100] 区间，避免滥用
    const ul = Math.max(1, Math.min(100, parseInt(usageLimit || '1', 10)))
    const payload: { usageLimit?: number; expiresAt?: string; notes?: string } = { usageLimit: ul }
    if (expiresAt) payload.expiresAt = expiresAt
    if (notes) payload.notes = notes

    const inv = await invitationsApi.create(payload)
    try {
      // 邀请码创建成功后，将 usageLimit 写入审计日志，方便后续追踪调整原因
      await auditApi.create({ action: 'invitation.create', target: inv.code, meta: { usageLimit: inv.usageLimit } })
    } catch {
      // 审计写入失败不影响邀请码主流程，忽略错误，保证用户仍能正常注册
    }

    // 将新邀请码插入到列表顶部，方便管理员立即复制 / 撤销
    setItems((prev) => [inv, ...prev])
    setCreateOpen(false)
    setUsageLimit('1')
    setExpiresAt('')
    setNotes('')
  }

  async function revoke(code: string) {
    await invitationsApi.revoke(code)
    try {
      await auditApi.create({ action: 'invitation.revoke', target: code })
    } catch {
      // 审计写入失败不影响撤销操作
    }
    setItems((prev) => prev.map((i) => (i.code === code ? { ...i, isActive: false } : i)))
  }

  function copyLink(code: string) {
    try {
      const url = new URL('/signup', window.location.origin)
      url.searchParams.set('code', code)
      navigator.clipboard?.writeText(url.toString())
    } catch {
      // 复制失败直接忽略，可能是浏览器限制
    }
  }

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>邀请码管理</h1>
        <div className='flex items-center gap-2'>
          <Button onClick={() => setCreateOpen(true)}>创建邀请码</Button>
          <Button onClick={load} disabled={loading}>刷新</Button>
        </div>
      </div>

      {error && <div className='rounded bg-red-50 p-3 text-sm text-red-600'>{error}</div>}

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>已用/限制</TableHead>
              <TableHead>过期时间</TableHead>
              <TableHead>备注</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell className='font-mono text-sm'>{i.code}</TableCell>
                <TableCell>{i.isActive ? '有效' : '已停用'}</TableCell>
                <TableCell>{i.usedCount} / {i.usageLimit}</TableCell>
                <TableCell>{i.expiresAt ? new Date(i.expiresAt).toLocaleString() : '-'}</TableCell>
                <TableCell>{i.notes || '-'}</TableCell>
                <TableCell className='text-right'>
                  <div className='inline-flex gap-2'>
                    <Button size='sm' variant='outline' onClick={() => copyLink(i.code)}>复制链接</Button>
                    <Button size='sm' variant='outline' onClick={() => navigator.clipboard?.writeText(i.code)}>复制</Button>
                    <Button size='sm' variant='destructive' disabled={!i.isActive} onClick={() => revoke(i.code)}>撤销</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建邀请码</DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <div>
              <label className='mb-1 block text-sm text-muted-foreground'>使用次数上限 (1-100)</label>
              <Input value={usageLimit} onChange={(e)=>setUsageLimit(e.target.value)} />
            </div>
            <div>
              <label className='mb-1 block text-sm text-muted-foreground'>过期时间 (ISO，可选)</label>
              <Input placeholder='2025-12-31T23:59:59Z' value={expiresAt} onChange={(e)=>setExpiresAt(e.target.value)} />
            </div>
            <div>
              <label className='mb-1 block text-sm text-muted-foreground'>备注（可选）</label>
              <Input value={notes} onChange={(e)=>setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='secondary' onClick={()=>setCreateOpen(false)}>取消</Button>
            <Button onClick={createOne}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
