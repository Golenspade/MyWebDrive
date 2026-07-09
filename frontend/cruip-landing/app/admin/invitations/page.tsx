"use client"

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { invitationsApi, type Invitation } from '@/lib/api/admin'
import { auditApi } from '@/lib/api/audit'

function SegmentedBar({ used, limit }: { used: number; limit: number }) {
  const cells = useMemo(() => {
    const cap = Math.min(limit, 20)
    if (cap <= 0) return []
    const unit = limit > 20 ? limit / 20 : 1
    const filled = Math.min(Math.max(0, Math.ceil(used / unit)), cap)
    const over = Math.min(Math.max(0, Math.ceil((used - limit) / unit)), cap - filled)
    return Array.from({ length: cap }, (_, i) => {
      if (i < filled) return 'filled'
      if (i < filled + over) return 'over'
      return 'empty'
    })
  }, [used, limit])

  return (
    <div className='flex items-center gap-3'>
      <div className='flex gap-0.5'>
        {cells.map((state, i) => (
          <div
            key={i}
            className={cn(
              'h-3 w-3',
              state === 'filled' && 'bg-nothing-display',
              state === 'over' && 'bg-nothing-accent',
              state === 'empty' && 'bg-nothing-line'
            )}
          />
        ))}
      </div>
      <div className='text-sm font-nothing-mono text-nothing-secondary'>
        <span className='font-nothing-display text-nothing-primary'>{used}</span>
        <span className='mx-1'>/</span>
        <span className='font-nothing-display text-nothing-primary'>{limit}</span>
      </div>
    </div>
  )
}

export default function InvitationsPage() {
  const [items, setItems] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [usageLimit, setUsageLimit] = useState('1')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')
  const [createdFlag, setCreatedFlag] = useState(false)

  // 初始加载邀请码列表。失败时只在顶部显示错误提示，不阻断整个页面。
  async function load() {
    setLoading(true)
    setError(null)
    try {
      const list = await invitationsApi.list()
      setItems(list)
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || '加载失败')
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
    setCreatedFlag(true)
    setTimeout(() => setCreatedFlag(false), 2000)
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
        <h1 className='text-2xl font-nothing-head font-semibold text-nothing-display'>邀请码管理</h1>
        <div className='flex items-center gap-2'>
          <Button onClick={() => setCreateOpen(true)}>创建邀请码</Button>
          <Button variant='outline' onClick={load} disabled={loading}>刷新</Button>
          {createdFlag && <span className='text-xs font-nothing-mono uppercase tracking-[0.08em] text-nothing-success'>[CREATED]</span>}
        </div>
      </div>

      {error && <div className='rounded-[var(--nothing-r-md)] border border-nothing-error/30 bg-nothing-error/10 p-3 text-sm text-nothing-error'>{error}</div>}

      <div className='rounded-[var(--nothing-r-md)] border border-nothing-line-2 overflow-hidden'>
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
                <TableCell className='font-nothing-mono text-sm text-nothing-primary'>{i.code}</TableCell>
                <TableCell>
                  {i.isActive ? (
                    <Badge variant='default'>有效</Badge>
                  ) : (
                    <Badge variant='outline'>已停用</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <SegmentedBar used={i.usedCount} limit={i.usageLimit} />
                </TableCell>
                <TableCell className='font-nothing-mono text-[11px] text-nothing-secondary'>{i.expiresAt ? new Date(i.expiresAt).toLocaleString() : '-'}</TableCell>
                <TableCell className='text-nothing-primary text-sm'>{i.notes || '-'}</TableCell>
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
          <div className='space-y-4'>
            <div>
              <label className='label-nothing'>使用次数上限 (1-100)</label>
              <Input value={usageLimit} onChange={(e)=>setUsageLimit(e.target.value)} />
            </div>
            <div>
              <label className='label-nothing'>过期时间 (ISO，可选)</label>
              <Input placeholder='2025-12-31T23:59:59Z' value={expiresAt} onChange={(e)=>setExpiresAt(e.target.value)} />
            </div>
            <div>
              <label className='label-nothing'>备注（可选）</label>
              <Input value={notes} onChange={(e)=>setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='ghost' onClick={()=>setCreateOpen(false)}>取消</Button>
            <Button onClick={createOne}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
