'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { MetricCard } from '../components/metric-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  dashboardApi,
  type BusinessDashboard,
  type DashboardRangeKind,
  type SystemDashboard,
} from '@/lib/api/dashboard'
import {
  decimalStringToChartNumber,
  formatDashboardBytes,
  formatDashboardInteger,
} from '@/lib/dashboard/format'
import {
  emptyResource,
  loadingResource,
  readyResource,
  rejectedResource,
  type ResourceState,
} from '@/lib/dashboard/resource-state'

type ResourceTarget = 'all' | 'business' | 'system'

const rangeLabel: Record<DashboardRangeKind, string> = {
  today: '今天',
  '7d': '最近 7 天',
  '30d': '最近 30 天',
}

function ResourceNotice({
  label,
  state,
  retry,
}: {
  label: string
  state: ResourceState<unknown>
  retry: () => void
}) {
  if (state.status !== 'stale' && state.status !== 'unavailable') return null
  return (
    <div className='flex items-center justify-between gap-3 rounded-[var(--nothing-r-sm)] border-l-2 border-nothing-error bg-nothing-error/10 p-3 text-sm text-nothing-error'>
      <span>
        {label}{state.status === 'stale' ? '刷新失败，当前显示上次数据' : '暂时不可用'}
        {state.error ? `：${state.error}` : ''}
      </span>
      <Button variant='outline' size='sm' onClick={retry}>仅重试此部分</Button>
    </div>
  )
}

function TrendCard({
  title,
  data,
  stroke,
}: {
  title: string
  data: Array<{ name: string; value: number | null }>
  stroke: string
}) {
  return (
    <Card>
      <CardHeader><CardTitle className='text-base'>{title}</CardTitle></CardHeader>
      <CardContent>
        {data.some(point => point.value != null) ? (
          <div data-visual-dynamic className='h-80'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke='var(--nothing-line)' />
                <XAxis dataKey='name' tick={{ fill: 'var(--nothing-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--nothing-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--nothing-surface)',
                    border: '1px solid var(--nothing-line)',
                    borderRadius: 'var(--nothing-r-md)',
                  }}
                  itemStyle={{ color: stroke, fontFamily: 'var(--nothing-font-mono)' }}
                  labelStyle={{ color: 'var(--nothing-secondary)', fontFamily: 'var(--nothing-font-mono)' }}
                />
                <Line type='monotone' dataKey='value' stroke={stroke} strokeWidth={1.5} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div data-visual-dynamic className='text-sm text-nothing-secondary'>无可用数据</div>}
      </CardContent>
    </Card>
  )
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState<DashboardRangeKind>('7d')
  const [businessState, setBusinessState] = useState<ResourceState<BusinessDashboard>>(
    emptyResource,
  )
  const [systemState, setSystemState] = useState<ResourceState<SystemDashboard>>(emptyResource)
  const controllers = useRef<{
    business?: AbortController
    system?: AbortController
  }>({})

  const load = useCallback(async (target: ResourceTarget = 'all') => {
    const loadBusiness = target === 'all' || target === 'business'
    const loadSystem = target === 'all' || target === 'system'
    let businessController: AbortController | undefined
    let systemController: AbortController | undefined
    if (loadBusiness) {
      controllers.current.business?.abort()
      businessController = new AbortController()
      controllers.current.business = businessController
      setBusinessState(previous => loadingResource(previous))
    }
    if (loadSystem) {
      controllers.current.system?.abort()
      systemController = new AbortController()
      controllers.current.system = systemController
      setSystemState(previous => loadingResource(previous))
    }

    const [businessResult, systemResult] = await Promise.allSettled([
      loadBusiness ? dashboardApi.business(range, businessController?.signal) : Promise.resolve(null),
      loadSystem ? dashboardApi.system(range, systemController?.signal) : Promise.resolve(null),
    ])

    if (loadBusiness && businessController && controllers.current.business === businessController && !businessController.signal.aborted) {
      if (businessResult.status === 'fulfilled' && businessResult.value) {
        setBusinessState(readyResource(businessResult.value, businessResult.value.generatedAt))
      } else if (businessResult.status === 'rejected') {
        setBusinessState(previous => rejectedResource(previous, businessResult.reason))
      }
      delete controllers.current.business
    }
    if (loadSystem && systemController && controllers.current.system === systemController && !systemController.signal.aborted) {
      if (systemResult.status === 'fulfilled' && systemResult.value) {
        setSystemState(readyResource(systemResult.value, systemResult.value.generatedAt))
      } else if (systemResult.status === 'rejected') {
        setSystemState(previous => rejectedResource(previous, systemResult.reason))
      }
      delete controllers.current.system
    }
  }, [range])

  useEffect(() => {
    const activeControllers = controllers.current
    void load('all')
    return () => {
      activeControllers.business?.abort()
      activeControllers.system?.abort()
    }
  }, [load])

  const business = businessState.data
  const system = systemState.data
  const storage = formatDashboardBytes(business?.totals.committedStorageBytes ?? null)
  const uploaded = formatDashboardBytes(business?.activity.uploads.bytes ?? null)
  const downloaded = formatDashboardBytes(business?.activity.downloads.bytes ?? null)
  const uploadsSeries = useMemo(() => business?.activity.uploads.series.map(point => ({
    name: point.date.slice(5),
    value: decimalStringToChartNumber(point.bytes),
  })) ?? [], [business])
  const downloadsSeries = useMemo(() => business?.activity.downloads.series.map(point => ({
    name: point.date.slice(5),
    value: decimalStringToChartNumber(point.bytes),
  })) ?? [], [business])

  const businessLoading = businessState.status === 'loading' && business == null
  const systemLoading = systemState.status === 'loading' && system == null

  return (
    <div className='p-6 space-y-6 max-w-[92.5rem] mx-auto'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='font-nothing-head text-2xl font-semibold text-nothing-display'>系统概览</h1>
          <p className='mt-1 text-sm text-nothing-secondary'>业务分析与系统健康独立加载 · {rangeLabel[range]}</p>
        </div>
        <div className='flex items-center gap-2'>
          <div className='inline-flex rounded-full border border-nothing-line-2 p-1'>
            {(['today', '7d', '30d'] as const).map(value => (
              <Button key={value} variant={range === value ? 'default' : 'outline'} size='sm' onClick={() => setRange(value)}>
                {value === 'today' ? '今天' : value === '7d' ? '7天' : '30天'}
              </Button>
            ))}
          </div>
          <Button onClick={() => void load('all')} disabled={businessState.status === 'loading' || systemState.status === 'loading'}>
            全部刷新
          </Button>
        </div>
      </div>

      <ResourceNotice label='业务分析' state={businessState} retry={() => void load('business')} />
      <ResourceNotice label='系统健康' state={systemState} retry={() => void load('system')} />

      <section className='space-y-3'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='font-nothing-head text-lg text-nothing-display'>业务分析</h2>
            <p data-visual-dynamic className='text-xs text-nothing-secondary'>数据覆盖：上传自 {business?.coverage.uploadsFrom ?? '不可用'}；下载自 {business?.coverage.downloadsFrom ?? '不可用'}；{business?.coverage.complete ? '完整' : '部分覆盖'}</p>
          </div>
          <p data-visual-dynamic className='text-xs text-nothing-secondary'>读模型更新：{business?.freshness.readModelUpdatedAt ?? '不可用'} · 延迟 {business?.freshness.lagSeconds ?? '-'} 秒</p>
        </div>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard label='用户总数' value={formatDashboardInteger(business?.totals.totalUsers ?? null)} loading={businessLoading} />
          <MetricCard label='在线文件' value={formatDashboardInteger(business?.totals.liveFiles ?? null)} loading={businessLoading} />
          <MetricCard label='承诺存储量' value={storage.value} unit={storage.unit} loading={businessLoading} />
          <MetricCard label={`${rangeLabel[range]}活跃用户`} value={formatDashboardInteger(business?.activity.activeUsers.count ?? null)} loading={businessLoading} />
          <MetricCard label={`${rangeLabel[range]}上传次数`} value={formatDashboardInteger(business?.activity.uploads.count ?? null)} loading={businessLoading} />
          <MetricCard label={`${rangeLabel[range]}上传量`} value={uploaded.value} unit={uploaded.unit} loading={businessLoading} />
          <MetricCard label={`${rangeLabel[range]}成功下载`} value={formatDashboardInteger(business?.activity.downloads.count ?? null)} loading={businessLoading} />
          <MetricCard label={`${rangeLabel[range]}下载量`} value={downloaded.value} unit={downloaded.unit} loading={businessLoading} />
        </div>
      </section>

      <section className='space-y-3'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='font-nothing-head text-lg text-nothing-display'>系统健康</h2>
            <p className='text-xs text-nothing-secondary'>Prometheus 状态：{system?.availability ?? '不可用'} · 下载遥测：{system?.pipeline.downloadTelemetry ?? 'unknown'}</p>
          </div>
          <p data-visual-dynamic className='text-xs text-nothing-secondary'>生成时间：{system?.generatedAt ?? '不可用'}</p>
        </div>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard label='请求总数' value={formatDashboardInteger(system?.traffic.requestsCount ?? null)} loading={systemLoading} />
          <MetricCard label='5XX 错误总数' value={formatDashboardInteger(system?.traffic.errorsCount ?? null)} loading={systemLoading} />
          <MetricCard label='P95 延迟' value={system?.traffic.p95Ms ?? '-'} unit={system?.traffic.p95Ms == null ? '' : 'MS'} loading={systemLoading} />
          <MetricCard label='P99 延迟' value={system?.traffic.p99Ms ?? '-'} unit={system?.traffic.p99Ms == null ? '' : 'MS'} loading={systemLoading} />
          <MetricCard label='待处理 Outbox' value={formatDashboardInteger(system?.pipeline.outboxPending ?? null)} loading={systemLoading} />
          <MetricCard label='最老 Outbox' value={system?.pipeline.oldestOutboxAgeSeconds ?? '-'} unit={system?.pipeline.oldestOutboxAgeSeconds == null ? '' : '秒'} loading={systemLoading} />
          <MetricCard label='分析管线延迟' value={system?.pipeline.analyticsLagSeconds ?? '-'} unit={system?.pipeline.analyticsLagSeconds == null ? '' : '秒'} loading={systemLoading} />
          <MetricCard label='错误率' value={system?.traffic.errorRate == null ? '-' : `${(system.traffic.errorRate * 100).toFixed(2)}%`} loading={systemLoading} />
        </div>
      </section>

      <div className='grid gap-3 lg:grid-cols-2'>
        <TrendCard title={`${rangeLabel[range]}上传趋势`} data={uploadsSeries} stroke='var(--nothing-display)' />
        <TrendCard title={`${rangeLabel[range]}下载趋势`} data={downloadsSeries} stroke='var(--nothing-secondary)' />
      </div>
    </div>
  )
}
