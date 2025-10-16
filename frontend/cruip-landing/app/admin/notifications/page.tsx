"use client"

import React from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { BellRing, ShieldAlert, Server, Info, CheckCircle2, Filter, MoreHorizontal, Download, RefreshCw, Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CalendarDateRangePicker } from '@/app/admin/components/date-range-picker'
import type { DateRange } from 'react-day-picker'
import TeamSwitcher from '@/app/admin/components/team-switcher'
import { MainNav } from '@/app/admin/components/main-nav'
import { Search } from '@/app/admin/components/search'
import { UserNav } from '@/app/admin/components/user-nav'
import Accordion from '@/components/accordion'
import { notificationsApi, type AdminNotification } from '@/lib/api/notifications'
import { useAuthStore } from '@/lib/stores/auth-store'

type Severity = 'critical' | 'warning' | 'info' | 'success'
type NotificationItem = AdminNotification

function sevIcon(sev: Severity) {
  switch (sev) {
    case 'critical':
      return <ShieldAlert className='text-red-600' />
    case 'warning':
      return <BellRing className='text-amber-500' />
    case 'info':
      return <Info className='text-blue-600' />
    case 'success':
      return <CheckCircle2 className='text-green-600' />
  }
}

function sevBadge(sev: Severity) {
  if (sev === 'critical') return <Badge className='bg-red-600 text-white'>紧急</Badge>
  if (sev === 'warning') return <Badge className='bg-amber-500 text-white'>警告</Badge>
  if (sev === 'success') return <Badge className='bg-green-600 text-white'>运维</Badge>
  return <Badge className='bg-blue-600 text-white'>信息</Badge>
}

function useNotifications() {
  const [data, setData] = React.useState<NotificationItem[]>([])
  const [services, setServices] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(12)
  const [total, setTotal] = React.useState(0)
  const [category, setCategory] = React.useState<'all' | Severity>('all')
  const [search, setSearch] = React.useState('')
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const [serviceFilter, setServiceFilter] = React.useState<string | 'all'>('all')
  const [range, setRange] = React.useState<DateRange | undefined>(undefined)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const from = range?.from ? new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0).toISOString() : undefined
      const to = range?.to ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59).toISOString() : undefined
      const res = await notificationsApi.list({
        page,
        pageSize,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        unreadOnly,
        severity: category === 'all' ? undefined : category,
        q: search || undefined,
        from,
        to,
      })
      setData(res.items)
      setTotal(res.total)
      setServices(Array.from(new Set(res.items.map(s => s.service).filter(Boolean) as string[])))
    } catch (err: any) {
      setError(err?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { setPage(1) }, [category, search, unreadOnly, serviceFilter, range?.from, range?.to])
  React.useEffect(() => { load() }, [page, pageSize, category, search, unreadOnly, serviceFilter, range?.from, range?.to])

  const markRead = async (ids: string[]) => {
    if (!ids.length) return
    try { await notificationsApi.markRead(ids) } catch {}
    setData(d => d.map(n => ids.includes(n.id) ? { ...n, unread: false } : n))
  }
  const remove = (ids: string[]) => setData(d => d.filter(n => !ids.includes(n.id)))
  return { data, services, load, loading, error, markRead, remove, page, setPage, pageSize, setPageSize, total, category, setCategory, search, setSearch, unreadOnly, setUnreadOnly, serviceFilter, setServiceFilter, range, setRange }
}


function PageSizeSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      className='h-9 rounded-md border px-2 text-sm'
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {[10, 12, 20, 50].map((n) => (
        <option key={n} value={n}>{n} / 页</option>
      ))}
    </select>
  )
}

export default function NotificationsPage() {
  const { data, services, load, loading, error, markRead, remove, page, setPage, pageSize, setPageSize, total, category, setCategory, search, setSearch, unreadOnly, setUnreadOnly, serviceFilter, setServiceFilter, range, setRange } = useNotifications()
  const { accessToken } = useAuthStore()
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [openId, setOpenId] = React.useState<string | null>(null)
  const PAGE_SIZE = 12

  const openItem = data.find((d) => d.id === openId) || null

  const filtered = data.filter((n) => {
    if (category !== 'all' && n.severity !== category) return false
    if (unreadOnly && !n.unread) return false
    if (serviceFilter !== 'all' && n.service !== serviceFilter) return false
    if (search && !`${n.title} ${n.description ?? ''} ${n.service}`.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  const paged = data

  const unreadCount = data.filter((n) => n.unread).length

  const allSelectedOnPage = paged.length > 0 && paged.every((n) => selected[n.id])
  const toggleSelectAll = () => {
    const next = { ...selected }
    if (allSelectedOnPage) {
      paged.forEach((n) => delete next[n.id])
    } else {
      paged.forEach((n) => (next[n.id] = true))
    }
    setSelected(next)
  }

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)

  const onBulkRead = () => { if (selectedIds.length) { markRead(selectedIds); setSelected({}) } }
  const onBulkDelete = () => {
    if (!selectedIds.length) return
    if (typeof window !== 'undefined' && !window.confirm(`确认删除选中的 ${selectedIds.length} 条通知？`)) return
    remove(selectedIds)
    setSelected({})
  }

  const exportJSON = (rows: NotificationItem[]) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notifications_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const refresh = () => load()

  // Live updates via SSE
  const [live, setLive] = React.useState(false)
  const esRef = React.useRef<EventSource | null>(null)
  React.useEffect(() => {
    if (!live) {
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      return
    }
    if (!accessToken) return
    const url = `/api/v1/admin/notifications/stream?access_token=${encodeURIComponent(accessToken)}`
    const es = new EventSource(url)
    esRef.current = es
    es.addEventListener('snapshot', (evt: MessageEvent) => {
      try {
        const arr = JSON.parse(String(evt.data)) as NotificationItem[]
        if (Array.isArray(arr)) {
          // only set if local list is empty to avoid flicker
          if (data.length === 0) {
            // not calling setData here because it's internal to hook; trigger reload
            load()
          }
        }
      } catch {}
    })
    es.addEventListener('notification', (evt: MessageEvent) => {
      try {
        const n = JSON.parse(String(evt.data)) as NotificationItem
        // optimistic prepend (client-only)
        // we don't have direct setData, so trigger reload for correctness
        load()
      } catch {}
    })
    es.onerror = () => {
      es.close()
      esRef.current = null
    }
    return () => { es.close(); esRef.current = null }
  }, [live, accessToken])

  return (
    <>
      <div className='md:hidden p-6'>
        <h2 className='text-2xl font-bold'>通知中心</h2>
        <p className='text-sm text-muted-foreground mt-2'>请在桌面端查看完整体验。</p>
        <div className='mt-4'>
          <Button asChild variant='secondary'>
            <Link href='/admin'>返回管理面板</Link>
          </Button>
        </div>
      </div>
      <div className='hidden flex-col md:flex'>
        {/* Top chrome */}
        <div className='border-b'>
          <div className='flex h-16 items-center px-4'>
            <TeamSwitcher />
            <MainNav className='mx-6' />
            <div className='ml-auto flex items-center space-x-4'>
              <Search />
              <UserNav />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className='flex-1 space-y-4 p-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <h2 className='text-2xl font-bold'>通知中心</h2>
              <Badge variant='secondary'>未读 {unreadCount}</Badge>
            </div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' onClick={refresh} disabled={loading}>
                <RefreshCw className='mr-2 h-4 w-4' /> 刷新
              </Button>
              <Button variant={live ? 'secondary' : 'outline'} onClick={() => setLive(v => !v)}>
                <BellRing className='mr-2 h-4 w-4' /> {live ? '实时中' : '开启实时'}
              </Button>
              <Button asChild variant='secondary'>
                <Link href='/admin'>返回管理面板</Link>
              </Button>
            </div>
          </div>

          <Tabs value={category} onValueChange={(v) => setCategory(v as any)}>
            <TabsList>
              <TabsTrigger value='all'>全部</TabsTrigger>
              <TabsTrigger value='critical'>系统</TabsTrigger>
              <TabsTrigger value='info'>业务</TabsTrigger>
              <TabsTrigger value='success'>运维</TabsTrigger>
            </TabsList>
            <TabsContent value={category}>
              {/* Toolbar */}
              <div className='mt-4 flex flex-wrap items-center gap-3'>
                <div className='flex items-center gap-2'>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='搜索关键字' className='w-[240px]' />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant='outline'>
                        <CalendarIcon className='mr-2 h-4 w-4' /> 时间范围
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align='start' className='p-2'>
                      <CalendarDateRangePicker value={range} onChange={setRange} />
                    </PopoverContent>
                  </Popover>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='outline'>
                        <Filter className='mr-2 h-4 w-4' /> 高级筛选
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start' className='min-w-[220px]'>
                      <DropdownMenuItem onClick={() => setServiceFilter('all')}>
                        所有服务
                      </DropdownMenuItem>
                      {(services.length ? services : ['gateway','auth-service','user-service','metadata-service','storage-service','sharing-service']).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => setServiceFilter(s)}>
                          <Server className='mr-2 h-4 w-4' /> {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Separator className='mx-2 h-6' />
                {error && <div className='text-sm text-red-600'>{error}</div>}
                <div className='flex items-center gap-4 ml-auto'>
                  <label className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Checkbox checked={unreadOnly} onCheckedChange={(v) => setUnreadOnly(Boolean(v))} />
                    只看未读
                  </label>
                  <Badge variant='outline'>来源: {serviceFilter}</Badge>
                </div>
                <div className='ml-auto flex items-center gap-2'>
                  <Button variant='outline' onClick={() => exportJSON(paged)}>
                    <Download className='mr-2 h-4 w-4' /> 导出 JSON
                  </Button>
                  <Button variant='outline' onClick={onBulkRead} disabled={selectedIds.length === 0}>
                    标记已读
                  </Button>
                  <Button variant='destructive' onClick={onBulkDelete} disabled={selectedIds.length === 0}>
                    删除
                  </Button>
                </div>
              </div>

              {/* List */}
              <div className='mt-4 rounded-md border'>
                <Table>
                  <TableHeader className='sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
                    <TableRow>
                      <TableHead className='w-10'>
                        <Checkbox
                          checked={allSelectedOnPage}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className='w-20'>类别</TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead className='hidden md:table-cell'>服务</TableHead>
                      <TableHead className='hidden md:table-cell'>状态</TableHead>
                      <TableHead>时间</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((n) => (
                      <TableRow key={n.id} className={cn(n.unread && 'bg-primary/5')}>
                        <TableCell className='align-middle'>
                          <Checkbox
                            checked={!!selected[n.id]}
                            onCheckedChange={(v) => setSelected((s) => ({ ...s, [n.id]: Boolean(v) }))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            {sevIcon(n.severity)}
                            {sevBadge(n.severity)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <button className='text-left font-medium hover:underline' onClick={() => setOpenId(n.id)}>
                            {n.title}
                          </button>
                          <div className='line-clamp-1 text-xs text-muted-foreground'>
                            {n.description}
                          </div>
                        </TableCell>
                        <TableCell className='hidden md:table-cell'>
                          <div className='inline-flex items-center gap-2'>
                            <Server className='h-4 w-4 text-muted-foreground' />
                            <span>{n.service}</span>
                          </div>
                        </TableCell>
                        <TableCell className='hidden md:table-cell'>
                          {n.unread ? <Badge variant='outline'>未读</Badge> : <span className='text-muted-foreground'>已读</span>}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size='icon' variant='ghost'>
                                <MoreHorizontal className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem onClick={() => setOpenId(n.id)}>查看详情</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markRead([n.id])}>标记已读</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportJSON([n])}>导出 JSON</DropdownMenuItem>
                              <DropdownMenuItem className='text-red-600 focus:text-red-600' onClick={() => remove([n.id])}>删除</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Detail drawer */}
              <Sheet open={!!openItem} onOpenChange={(v) => { if (!v) setOpenId(null) }}>
                <SheetContent side='right' className='w-[420px] sm:w-[540px]'>
                  <SheetHeader>
                    <SheetTitle>通知详情</SheetTitle>
                  </SheetHeader>
                  {openItem && (
                    <div className='py-6'>
                      <div className='mb-3 text-sm text-muted-foreground'>
                        生成于：{new Date(openItem.createdAt).toLocaleString()}
                      </div>
                      <Accordion title={openItem.title} content={openItem.description || ''} />
                      <div className='mt-4 text-sm'>
                        <div>服务：{openItem.service}</div>
                        <div>状态：{String(openItem.meta?.status || '')}</div>
                        <div>URL：{String(openItem.meta?.url || '')}</div>
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
              {/* Pagination */}
              <div className='mt-4 flex items-center justify-between'>
                <div className='text-sm text-muted-foreground'>共 {total} 条</div>
                <div className='flex items-center gap-2'>
                  <Button variant='outline' disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</Button>
                  <div className='text-sm'>第 {page} / {totalPages} 页</div>
                  <Button variant='outline' disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>下一页</Button>
                  <PageSizeSelect value={pageSize} onChange={setPageSize} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
