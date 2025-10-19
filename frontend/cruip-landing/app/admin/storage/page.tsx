"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adminApi } from '@/lib/api/admin'
import { usersApi } from '@/lib/api/users'
import { formatCompactBytes } from '@/lib/utils/format-bytes'
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from 'recharts'

// Admin Storage Panel: show per-user used vs quota with chart
export default function AdminStoragePage(){
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Array<{ id:string; name:string|null; email:string; used:number; quota:number }>>([])

  async function load(){
    setLoading(true)
    try {
      const list = await adminApi.listUsers({ page:1, pageSize:100 })
      const enriched = await Promise.all(list.items.map(async (u)=>{
        try{
          const s = await usersApi.getStorageById(u.id)
          return { id:u.id, name:u.name, email:u.email, used: s.storageUsed||0, quota: s.storageQuota||0 }
        }catch{
          return { id:u.id, name:u.name, email:u.email, used: 0, quota: 0 }
        }
      }))
      setItems(enriched)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() },[])

  const chartData = useMemo(()=>items.map(u=>({ name: u.email, used: Math.round(u.used/1024/1024), remain: Math.max(0, Math.round((u.quota-u.used)/1024/1024)) })),[items])

  return (
    <div className='p-6 space-y-6'>
      <h1 className='text-2xl font-bold'>存储面板</h1>

      <Card>
        <CardHeader><CardTitle className='text-base'>按用户使用情况（MB）</CardTitle></CardHeader>
        <CardContent style={{height:300}}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="used" stackId="a" fill="#3b82f6" name="已用(MB)" />
              <Bar dataKey="remain" stackId="a" fill="#e5e7eb" name="剩余(MB)" />
            </BarChart>
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
                    <TableCell className='font-medium'>{u.email}</TableCell>
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

