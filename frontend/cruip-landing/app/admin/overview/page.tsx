"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { overviewApi, type AdminOverview } from '@/lib/api/overview'
import { Button } from '@/components/ui/button'
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts'

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const js = await overviewApi.get(range)
      setData(js)
    } catch (err: any) {
      setError(err?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [range])

  const uploadsSeries = useMemo(() => (data?.last7d.uploads_bytes || []).map(p => ({ name: p.date.slice(5), value: p.value })), [data])
  const downloadsSeries = useMemo(() => (data?.last7d.downloads_bytes || []).map(p => ({ name: p.date.slice(5), value: p.value })), [data])

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>系统概览</h1>
        <div className='flex items-center gap-2'>
          <div className='inline-flex rounded-md border p-1'>
            <Button variant={range==='today'?'secondary':'ghost'} onClick={()=>setRange('today')}>今天</Button>
            <Button variant={range==='7d'?'secondary':'ghost'} onClick={()=>setRange('7d')}>7天</Button>
            <Button variant={range==='30d'?'secondary':'ghost'} onClick={()=>setRange('30d')}>30天</Button>
          </div>
          <Button onClick={load} disabled={loading}>刷新</Button>
        </div>
      </div>

      {error && <div className='rounded bg-red-50 p-3 text-sm text-red-600'>{error}</div>}

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>用户总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.totals.total_users ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>文件总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.totals.total_files ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>存储总字节</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.totals.total_storage_bytes ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>今日上传字节</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.today.uploads_bytes ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>今日下载次数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.today.downloads_count ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>请求总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.today.requests_count ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>错误总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.today.errors_count ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>P95 延迟 (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.today.latency_ms_p95 ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>P99 延迟 (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.today.latency_ms_p99 ?? '-'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>最近 7 天上传趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {uploadsSeries.length ? (
            <div className='h-[300px]'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={uploadsSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id='g1' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='var(--color-primary)' stopOpacity={0.6} />
                      <stop offset='95%' stopColor='var(--color-primary)' stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' strokeOpacity={0.2} />
                  <XAxis dataKey='name' fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type='monotone' dataKey='value' stroke='var(--color-primary)' fill='url(#g1)' />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className='text-sm text-muted-foreground'>无数据</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>最近 7 天下载趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {downloadsSeries.length ? (
            <div className='h-[300px]'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={downloadsSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id='g2' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='var(--color-secondary, #22c55e)' stopOpacity={0.6} />
                      <stop offset='95%' stopColor='var(--color-secondary, #22c55e)' stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' strokeOpacity={0.2} />
                  <XAxis dataKey='name' fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type='monotone' dataKey='value' stroke='var(--color-secondary, #22c55e)' fill='url(#g2)' />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className='text-sm text-muted-foreground'>无数据</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
