"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { overviewApi, type AdminOverview } from '@/lib/api/overview'
import { Button } from '@/components/ui/button'
import { formatCompactBytes } from '@/lib/utils/format-bytes'
import { MetricCard } from '../components/metric-card'
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'

function splitValueUnit(value: string): { value: string; unit: string } {
  const trimmed = value.trim()
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/)
  if (!match) return { value: trimmed, unit: '' }
  return { value: match[1], unit: match[2] }
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const js = await overviewApi.get(range)
      setData(js)
    } catch (err) {
      const message = err instanceof Error ? err.message : null
      setError(message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const uploadsSeries = useMemo(() => (data?.last7d.uploads_bytes || []).map(p => ({ name: p.date.slice(5), value: p.value })), [data])
  const downloadsSeries = useMemo(() => (data?.last7d.downloads_bytes || []).map(p => ({ name: p.date.slice(5), value: p.value })), [data])

  const totalStorage = splitValueUnit(formatCompactBytes(data?.totals.total_storage_bytes ?? 0))
  const todayUpload = splitValueUnit(formatCompactBytes(data?.today.uploads_bytes ?? 0))
  const errorCount = data?.today.errors_count ?? 0

  return (
    <div className='p-6 space-y-6 max-w-[92.5rem] mx-auto'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <h1 className='font-nothing-head text-2xl font-semibold text-nothing-display'>系统概览</h1>
        <div className='flex items-center gap-2'>
          <div className='inline-flex rounded-full border border-nothing-line-2 p-1'>
            <Button variant={range==='today'?'default':'outline'} size='sm' onClick={()=>setRange('today')}>今天</Button>
            <Button variant={range==='7d'?'default':'outline'} size='sm' onClick={()=>setRange('7d')}>7天</Button>
            <Button variant={range==='30d'?'default':'outline'} size='sm' onClick={()=>setRange('30d')}>30天</Button>
          </div>
          <Button onClick={load} disabled={loading}>刷新</Button>
        </div>
      </div>

      {error && (
        <div className='rounded-[var(--nothing-r-sm)] border-l-2 border-nothing-error bg-nothing-error/10 p-3 text-sm text-nothing-error'>
          {error}
        </div>
      )}

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricCard label='用户总数' value={data?.totals.total_users ?? '-'} loading={loading && data == null} />
        <MetricCard label='文件总数' value={data?.totals.total_files ?? '-'} loading={loading && data == null} />
        <MetricCard label='存储总量' value={totalStorage.value} unit={totalStorage.unit} loading={loading && data == null} />
        <MetricCard label='今日上传' value={todayUpload.value} unit={todayUpload.unit} loading={loading && data == null} />
        <MetricCard label='今日下载次数' value={data?.today.downloads_count ?? '-'} loading={loading && data == null} />
        <MetricCard label='请求总数' value={data?.today.requests_count ?? '-'} loading={loading && data == null} />
        <MetricCard label='错误总数' value={errorCount} error={errorCount > 0} loading={loading && data == null} />
        <MetricCard label='P95 延迟' value={data?.today.latency_ms_p95 ?? '-'} unit='MS' loading={loading && data == null} />
        <MetricCard label='P99 延迟' value={data?.today.latency_ms_p99 ?? '-'} unit='MS' loading={loading && data == null} />
      </div>

      <div className='grid gap-3 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>最近 7 天上传趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {uploadsSeries.length ? (
              <div className='h-80'>
                <ResponsiveContainer width='100%' height='100%'>
                  <LineChart data={uploadsSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke='var(--nothing-line)' />
                    <XAxis dataKey='name' tick={{ fill: 'var(--nothing-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: 'var(--nothing-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--nothing-surface)',
                        border: '1px solid var(--nothing-line)',
                        borderRadius: 'var(--nothing-r-md)',
                      }}
                      itemStyle={{ color: 'var(--nothing-primary)', fontFamily: 'var(--nothing-font-mono)' }}
                      labelStyle={{ color: 'var(--nothing-secondary)', fontFamily: 'var(--nothing-font-mono)' }}
                    />
                    <Line type='monotone' dataKey='value' stroke='var(--nothing-display)' strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className='text-sm text-nothing-secondary'>无数据</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>最近 7 天下载趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {downloadsSeries.length ? (
              <div className='h-80'>
                <ResponsiveContainer width='100%' height='100%'>
                  <LineChart data={downloadsSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke='var(--nothing-line)' />
                    <XAxis dataKey='name' tick={{ fill: 'var(--nothing-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: 'var(--nothing-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--nothing-surface)',
                        border: '1px solid var(--nothing-line)',
                        borderRadius: 'var(--nothing-r-md)',
                      }}
                      itemStyle={{ color: 'var(--nothing-primary)', fontFamily: 'var(--nothing-font-mono)' }}
                      labelStyle={{ color: 'var(--nothing-secondary)', fontFamily: 'var(--nothing-font-mono)' }}
                    />
                    <Line type='monotone' dataKey='value' stroke='var(--nothing-secondary)' strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className='text-sm text-nothing-secondary'>无数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
