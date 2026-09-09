"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCompactBytes } from '@/lib/utils/format-bytes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/stores/auth-store'
import { adminApi, type QuotaPoolPlan, type UsersResp } from '@/lib/api/admin'
import type { Role } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { parseBytes, toUnit } from '@/lib/utils/parse-bytes'
import { SegmentedBar } from '../components/segmented-bar'

type QuotaUnit = 'KB' | 'MB' | 'GB' | 'TB'

function staffAllowed(role: Role | null) {
  return role === 'admin' || role === 'superuser'
}

function formatPoolBytes(raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (n < 0) return `-${formatCompactBytes(-n)}`
  return formatCompactBytes(n)
}

export default function AdminUsersPage() {
  const { isAuthenticated, role } = useAuthStore()
  const canManage = role === 'admin'
  const [query, setQuery] = useState('')
  const queryRef = useRef('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [poolLoading, setPoolLoading] = useState(false)
  const [rebalancing, setRebalancing] = useState(false)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [pool, setPool] = useState<QuotaPoolPlan | null>(null)
  const [data, setData] = useState<UsersResp>({ items: [], page: 1, pageSize: 10, total: 0 })

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / pageSize)), [data.total, pageSize])
  const emailById = useMemo(() => new Map(data.items.map((user) => [user.id, user.email])), [data.items])

  const fetchUsers = useCallback(async () => {
    if (!isAuthenticated || !staffAllowed(role)) return
    setLoading(true)
    try {
      const list = await adminApi.listUsers({ q: queryRef.current, page, pageSize })
      setData(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, role, page, pageSize])

  const fetchPool = useCallback(async () => {
    if (!isAuthenticated || !staffAllowed(role)) return
    setPoolLoading(true)
    setPoolError(null)
    try {
      setPool(await adminApi.previewQuotaPool())
    } catch (err) {
      console.error(err)
      setPoolError(err instanceof Error ? err.message : '无法读取存储池')
    } finally {
      setPoolLoading(false)
    }
  }, [isAuthenticated, role])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    void fetchPool()
  }, [fetchPool])

  async function changeRole(id: string, nextRole: Role) {
    if (!canManage) return
    await adminApi.setRole(id, nextRole)
    setData(prev => ({ ...prev, items: prev.items.map(u => u.id === id ? { ...u, role: nextRole } : u) }))
    void fetchPool()
  }

  async function applyPoolRebalance() {
    if (!canManage) return
    setRebalancing(true)
    setPoolError(null)
    try {
      const plan = await adminApi.rebalanceQuotaPool()
      setPool(plan)
      await fetchUsers()
    } catch (err) {
      console.error(err)
      setPoolError(err instanceof Error ? err.message : '自动分配失败')
    } finally {
      setRebalancing(false)
    }
  }

  // Storage quota dialog state
  const [quotaDlgOpen, setQuotaDlgOpen] = useState(false)
  const [quotaUserId, setQuotaUserId] = useState<string | null>(null)
  const [quotaInput, setQuotaInput] = useState('')
  const [quotaInfo, setQuotaInfo] = useState<{ storageQuota: number; storageUsed: number } | null>(null)
  const [quotaUnit, setQuotaUnit] = useState<QuotaUnit>('GB')
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const DEFAULT_TOTAL_BYTES = 40 * 1024 * 1024 * 1024 // 40 GiB
  const [sliderMax, setSliderMax] = useState<number>(toUnit(DEFAULT_TOTAL_BYTES, 'GB'))
  const [sliderVal, setSliderVal] = useState<number>(0)

  async function openQuota(id: string) {
    setQuotaUserId(id)
    setQuotaDlgOpen(true)
    setQuotaError(null)
    try {
      const user = await adminApi.getUser(id)
      const js = {
        storageQuota: Number(user.quota?.limitBytes ?? '0'),
        storageUsed: Number(user.quota?.committedBytes ?? '0'),
      }
      setQuotaInfo(js)
      setSliderVal(toUnit(js.storageQuota || 0, quotaUnit))
      setQuotaInput('')
    } catch (err) {
      const maybe = err as { status?: number } | null | undefined
      const status = typeof maybe?.status === 'number' ? maybe.status : undefined
      if (status === 404) {
        const fallback = { storageQuota: 0, storageUsed: 0 }
        setQuotaInfo(fallback)
        setSliderVal(0)
        setQuotaInput('')
      } else {
        console.error(err)
      }
    }
  }

  async function saveQuota() {
    if (!quotaUserId || !canManage) return
    setQuotaError(null)
    const bytes = quotaInput.trim() ? parseBytes(quotaInput) : (() => {
      const map: Record<string, number> = { KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 }
      return Math.max(0, Math.floor((map[quotaUnit] || 1) * sliderVal))
    })()
    try {
      const fresh = await adminApi.setQuota(quotaUserId, String(bytes))
      setQuotaInfo({
        storageQuota: Number(fresh.limitBytes),
        storageUsed: Number(fresh.committedBytes),
      })
      setData(prev => ({
        ...prev,
        items: prev.items.map(u => u.id === quotaUserId ? { ...u, quota: fresh } : u),
      }))
      void fetchPool()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setQuotaError('超出存储池容量，请先按池自动分配或降低其他用户限额')
        return
      }
      setQuotaError(err instanceof Error ? err.message : '保存失败')
    }
  }

  return (
    <div className='p-6 space-y-6 max-w-[92.5rem] mx-auto'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <h1 className='font-nothing-head text-2xl font-semibold text-nothing-display'>用户管理</h1>
        <div className='flex items-center gap-2'>
          <Button onClick={() => { void fetchUsers(); void fetchPool() }} disabled={loading || poolLoading}>刷新</Button>
        </div>
      </div>

      <Card>
        <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CardTitle className='text-base'>存储池</CardTitle>
          <div className='flex flex-col items-stretch gap-2 sm:flex-row sm:items-center'>
            <Button onClick={applyPoolRebalance} disabled={!canManage || rebalancing || poolLoading}>
              按池自动分配
            </Button>
            {!canManage && (
              <span className='text-xs text-nothing-secondary'>Superuser 可预览，仅 Admin 可执行</span>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {poolError && <div className='text-sm text-red-500'>{poolError}</div>}
          {pool ? (
            <>
              <div className='grid gap-3 sm:grid-cols-4'>
                <div>
                  <div className='text-xs text-nothing-secondary'>池剩余</div>
                  <div className='font-nothing-mono text-sm text-nothing-primary'>{formatPoolBytes(pool.allocableBytes)}</div>
                </div>
                <div>
                  <div className='text-xs text-nothing-secondary'>已占用（含预留）</div>
                  <div className='font-nothing-mono text-sm text-nothing-primary'>{formatPoolBytes(pool.occupiedBytes)}</div>
                </div>
                <div>
                  <div className='text-xs text-nothing-secondary'>平台预留</div>
                  <div className='font-nothing-mono text-sm text-nothing-primary'>{formatPoolBytes(pool.platformReserveBytes)}</div>
                </div>
                <div>
                  <div className='text-xs text-nothing-secondary'>池容量</div>
                  <div className='font-nothing-mono text-sm text-nothing-primary'>{formatPoolBytes(pool.poolBytes)}</div>
                </div>
              </div>
              {pool.overcommitted && (
                <div className='text-sm text-amber-500'>池已过订：活跃用户限额将压到当前占用，无法再分配余量。</div>
              )}
              <div className='rounded-[var(--nothing-r-md)] border border-nothing-line-2 overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>占用</TableHead>
                      <TableHead>原限额</TableHead>
                      <TableHead>新限额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pool.allocations.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className='font-medium'>{emailById.get(row.userId) || row.userId}</TableCell>
                        <TableCell className='font-nothing-mono text-xs'>{formatPoolBytes(row.occupiedBytes)}</TableCell>
                        <TableCell className='font-nothing-mono text-xs'>{formatPoolBytes(row.previousLimitBytes)}</TableCell>
                        <TableCell className='font-nothing-mono text-xs'>{formatPoolBytes(row.limitBytes)}</TableCell>
                      </TableRow>
                    ))}
                    {pool.allocations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className='text-sm text-nothing-secondary'>暂无活跃配额账户</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className='text-sm text-nothing-secondary'>{poolLoading ? '正在读取存储池...' : '暂无存储池数据'}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-2 pb-4'>
            <Input
              placeholder='搜索邮箱/姓名'
              value={query}
              onChange={(e) => { setQuery(e.target.value); queryRef.current = e.target.value }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (page !== 1) {
                    setPage(1)
                  } else {
                    void fetchUsers()
                  }
                }
              }}
            />
            <Button
              onClick={() => {
                if (page !== 1) {
                  setPage(1)
                } else {
                  void fetchUsers()
                }
              }}
              disabled={loading}
            >
              搜索
            </Button>
          </div>

          <div className='rounded-[var(--nothing-r-md)] border border-nothing-line-2 overflow-hidden'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-80'>ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>限额</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className='text-right'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span className='font-nothing-mono text-xs break-all text-nothing-primary'>{u.id}</span>
                        <Button size='sm' variant='outline' onClick={()=>navigator.clipboard?.writeText(u.id)}>复制</Button>
                      </div>
                    </TableCell>
                    <TableCell className='font-medium'>{u.email}</TableCell>
                    <TableCell>{u.name || '-'}</TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>{u.role.toUpperCase()}</Badge>
                        {canManage ? (
                          <Select value={u.role} onValueChange={(v)=>changeRole(u.id, v as Role)}>
                            <SelectTrigger className='w-32'><SelectValue placeholder='角色' /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value='user'>user</SelectItem>
                              <SelectItem value='superuser'>superuser</SelectItem>
                              <SelectItem value='admin'>admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className='font-nothing-mono text-xs text-nothing-secondary'>
                      {formatPoolBytes(u.quota?.limitBytes ?? '0')}
                    </TableCell>
                    <TableCell className='font-nothing-mono text-xs text-nothing-secondary'>{format(new Date(u.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button variant='outline' asChild><Link href={`/admin/users/${u.id}`}>详情</Link></Button>
                        <Button variant='outline' onClick={()=>openQuota(u.id)}>手动调整限额</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4'>
            <div className='text-sm text-nothing-secondary'>共 {data.total} 个用户</div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</Button>
              <div className='text-sm text-nothing-secondary'>第 {page} / {totalPages} 页</div>
              <Button variant='outline' disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>下一页</Button>
              <Select value={String(pageSize)} onValueChange={(v)=>{ setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger className='w-28'><SelectValue placeholder='每页' /></SelectTrigger>
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
            <DialogTitle>手动调整限额</DialogTitle>
          </DialogHeader>
          {quotaInfo ? (
            <div className='space-y-5'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-nothing-secondary'>已用 / 配额</span>
                <span className='font-nothing-mono text-xs text-nothing-primary'>
                  {formatCompactBytes(quotaInfo.storageUsed)} / {formatCompactBytes(quotaInfo.storageQuota)}
                </span>
              </div>

              <SegmentedBar used={quotaInfo.storageUsed} limit={quotaInfo.storageQuota} />

              {/* Slider mode */}
              <div className='space-y-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <label className='text-sm text-nothing-secondary'>单位</label>
                  <Select
                    value={quotaUnit}
                    onValueChange={(v)=>{
                      const nextUnit = v as QuotaUnit
                      setQuotaUnit(nextUnit)
                      setSliderVal(0)
                      setSliderMax(toUnit(DEFAULT_TOTAL_BYTES, nextUnit))
                    }}
                  >
                    <SelectTrigger className='w-28'><SelectValue placeholder='单位' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='KB'>KB</SelectItem>
                      <SelectItem value='MB'>MB</SelectItem>
                      <SelectItem value='GB'>GB</SelectItem>
                      <SelectItem value='TB'>TB</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className='text-sm text-nothing-secondary'>总容量参考 ({quotaUnit})</label>
                  <Input className='w-24' value={String(sliderMax)} onChange={(e)=>{
                    const v = Number.parseInt(e.target.value||'0',10); setSliderMax(Number.isFinite(v)&&v>0? v: sliderMax)
                  }} />
                </div>
                <input
                  type='range'
                  min={0}
                  max={sliderMax}
                  value={sliderVal}
                  onChange={(e)=>setSliderVal(Number(e.target.value))}
                  className='w-full accent-nothing-display'
                />
                <div className='font-nothing-mono text-xs text-nothing-secondary'>当前选择：{sliderVal} {quotaUnit}</div>
              </div>

              {/* Manual input */}
              <div className='flex items-center gap-2'>
                <Input placeholder='例如: 500 MB / 20GB / 1048576 (bytes)' value={quotaInput} onChange={(e)=>setQuotaInput(e.target.value)} />
                <Button onClick={saveQuota} disabled={!canManage}>保存</Button>
              </div>
              {quotaError && <div className='text-sm text-red-500'>{quotaError}</div>}
            </div>
          ) : (
            <div className='text-sm text-nothing-secondary'>正在加载...</div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={()=>setQuotaDlgOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
