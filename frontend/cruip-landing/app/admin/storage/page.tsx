"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adminApi } from '@/lib/api/admin'
import { usersApi } from '@/lib/api/users'
import { formatCompactBytes } from '@/lib/utils/format-bytes'
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

// Admin Storage Panel: show per-user used vs quota with chart.
// 后端并没有直接提供“按用户聚合后的存储统计”，所以这里：
// 1. 先用 adminApi.listUsers 拿到前 100 个用户；
// 2. 再逐个调用 usersApi.getStorageById(u.id) 拼出 used/quota；
// 3. 在前端做排序 + Top N 截断，仅用于管理员观察整体水位，
//    如果未来用户规模增大，这块要改成后端聚合接口。
export default function AdminStoragePage(){
  // 目前 loading 只用于防抖/未来扩展，所以不暴露给 UI
  const [, setLoading] = useState(false)
  const [items, setItems] = useState<Array<{ id:string; name:string|null; email:string; role:'user'|'admin'; used:number; quota:number }>>([])
  // topN 用字符串是为了直接和 Select 组件的 value 对齐
  const [topN, setTopN] = useState<string>('10')  // '5' | '10' | '20' | '100' | 'ALL'

  // 拉取前 100 个用户，并补充存储信息（失败时按 0 处理）
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await adminApi.listUsers({ page:1, pageSize:100 })
      const enriched = await Promise.all(list.items.map(async (u)=>{
        try{
          const s = await usersApi.getStorageById(u.id)
          return { id:u.id, name:u.name, email:u.email, role: u.role, used: s.storageUsed||0, quota: s.storageQuota||0 }
        }catch{
          // 用户在 User 服务里还没有存储记录时，视为 0 / 0，避免打断整体面板
          return { id:u.id, name:u.name, email:u.email, role: u.role, used: 0, quota: 0 }
        }
      }))
      setItems(enriched)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(()=>{ void load() },[load])

  // 根据已用空间对用户排序，并按 Top N 截断，仅用于前端展示
  const displayItems = useMemo(()=>{
    const sorted = [...items].sort((a,b)=> (b.used||0) - (a.used||0)) // 已用降序
    const n = topN === 'ALL' ? sorted.length : parseInt(topN, 10)
    return sorted.slice(0, Math.max(0, Math.min(sorted.length, n||0)))
  }, [items, topN])

  // 将字节转换为 MB，并带上管理员标记供图表高亮使用
  const chartData = useMemo(()=>displayItems.map(u=>{
    const usedMB = Math.max(0, Math.round((Number(u.used) || 0) / 1024 / 1024))
    const quotaMB = Math.max(0, Math.round((Number(u.quota) || 0) / 1024 / 1024))
    const remainMB = Math.max(0, quotaMB - usedMB)
    return { name: u.email || u.id, used: usedMB, remain: remainMB, isAdmin: u.role === 'admin' }
  }), [displayItems])

  // 若所有数据都是 0，则显示“暂无数据”占位，避免空图
  const hasData = useMemo(()=> chartData.some(d => (d.used ?? 0) > 0 || (d.remain ?? 0) > 0), [chartData])

  return (
    <div className='p-6 space-y-6'>
      <h1 className='text-2xl font-bold'>存储面板</h1>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-4'>
            <CardTitle className='text-base'>按用户使用情况（MB）</CardTitle>
            <div className='flex items-center gap-2'>
              <Label htmlFor='topn' className='text-sm text-muted-foreground'>显示 Top N</Label>
              <Select value={topN} onValueChange={setTopN}>
                <SelectTrigger className='h-8 w-[120px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='5'>Top 5</SelectItem>
                  <SelectItem value='10'>Top 10</SelectItem>
                  <SelectItem value='20'>Top 20</SelectItem>
                  <SelectItem value='100'>Top 100</SelectItem>
                  <SelectItem value='ALL'>全部</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant='secondary' className='ml-2'>已用降序</Badge>
              <Badge variant='outline' className='ml-1'>管理员高亮</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent style={{height:300}}>
          <ResponsiveContainer width="100%" height={260}>
            {hasData ? (
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="used" stackId="a" fill="#3b82f6" name="已用(MB)">
                  {chartData.map((d, i)=> (
                    <Cell key={`used-${i}`} stroke={d.isAdmin ? '#f59e0b' : undefined} strokeWidth={d.isAdmin ? 2 : 0} />
                  ))}
                </Bar>
                <Bar dataKey="remain" stackId="a" fill="#e5e7eb" name="剩余(MB)">
                  {chartData.map((d, i)=> (
                    <Cell key={`remain-${i}`} stroke={d.isAdmin ? '#f59e0b' : undefined} strokeWidth={d.isAdmin ? 2 : 0} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <div className='w-full h-full flex items-center justify-center text-sm text-muted-foreground'>暂无数据</div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-base'>用户列表</CardTitle></CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>已用</TableHead>
                  <TableHead>配额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(u=> (
                  <TableRow key={u.id}>
                    <TableCell className='font-medium flex items-center gap-2'>
                      {u.email}
                      {u.role === 'admin' && <Badge variant='outline' className='text-[10px]'>admin</Badge>}
                    </TableCell>
                    <TableCell>{u.name||'-'}</TableCell>
                    <TableCell>{formatCompactBytes(u.used)}</TableCell>
                    <TableCell>{formatCompactBytes(u.quota)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

