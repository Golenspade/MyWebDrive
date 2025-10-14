"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Simple token provider: store/retrieve admin JWT from localStorage
function useAdminToken() {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    setToken(localStorage.getItem("token"))
  }, [])
  const save = (t: string) => {
    localStorage.setItem("token", t)
    setToken(t)
  }
  const clear = () => {
    localStorage.removeItem("token")
    setToken(null)
  }
  return { token, save, clear }
}

type AdminUser = { id: string; name: string | null; email: string; role: "user" | "admin"; createdAt: string }

type UsersResp = { items: AdminUser[]; page: number; pageSize: number; total: number }

export default function AdminUsersPage() {
  const { token, save, clear } = useAdminToken()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<UsersResp>({ items: [], page: 1, pageSize: 10, total: 0 })
  const [showTokenDlg, setShowTokenDlg] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / pageSize)), [data.total, pageSize])

  async function fetchUsers() {
    if (!token) { setShowTokenDlg(true); return }
    setLoading(true)
    try {
      const url = new URL(`/api/v1/auth/admin/users`, window.location.origin)
      url.searchParams.set("query", query)
      url.searchParams.set("page", String(page))
      url.searchParams.set("pageSize", String(pageSize))
      const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      if (!resp.ok) throw new Error(`Load users failed: ${resp.status}`)
      const js = await resp.json()
      setData(js)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [token, page, pageSize])

  async function changeRole(id: string, role: "user" | "admin") {
    if (!token) return setShowTokenDlg(true)
    const resp = await fetch(`/api/v1/auth/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    })
    if (resp.ok) {
      setData((prev) => ({ ...prev, items: prev.items.map(u => u.id === id ? { ...u, role } : u) }))
    }
  }

  // Storage quota dialog state
  const [quotaDlgOpen, setQuotaDlgOpen] = useState(false)
  const [quotaUserId, setQuotaUserId] = useState<string | null>(null)
  const [quotaInput, setQuotaInput] = useState<string>("")
  const [quotaInfo, setQuotaInfo] = useState<{ storageQuota: number; storageUsed: number } | null>(null)

  async function openQuota(id: string) {
    if (!token) return setShowTokenDlg(true)
    setQuotaUserId(id)
    setQuotaDlgOpen(true)
    const r = await fetch(`/api/v1/users/${id}/storage`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) {
      const js = await r.json()
      setQuotaInfo(js)
      setQuotaInput(String(js.storageQuota))
    } else {
      setQuotaInfo(null)
    }
  }

  async function saveQuota() {
    if (!token || !quotaUserId) return
    const val = Number.parseInt(quotaInput, 10)
    if (!Number.isFinite(val) || val < 0) return
    const r = await fetch(`/api/v1/users/${quotaUserId}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ storageQuota: val }),
    })
    if (r.ok) {
      // refresh info
      const rr = await fetch(`/api/v1/users/${quotaUserId}/storage`, { headers: { Authorization: `Bearer ${token}` } })
      if (rr.ok) setQuotaInfo(await rr.json())
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowTokenDlg(true)}>设置令牌</Button>
          <Button onClick={fetchUsers} disabled={loading}>刷新</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 pb-4">
            <Input placeholder="搜索邮箱/姓名" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') { setPage(1); fetchUsers() } }} />
            <Button onClick={() => { setPage(1); fetchUsers() }} disabled={loading}>搜索</Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                        <Select value={u.role} onValueChange={(v)=>changeRole(u.id, v as any)}>
                          <SelectTrigger className="w-[120px]"><SelectValue placeholder="角色" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">user</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(u.createdAt), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={()=>openQuota(u.id)}>存储</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">共 {data.total} 个用户</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</Button>
              <div className="text-sm">第 {page} / {totalPages} 页</div>
              <Button variant="outline" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>下一页</Button>
              <Select value={String(pageSize)} onValueChange={(v)=>{ setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger className="w-[110px]"><SelectValue placeholder="每页" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">每页 10</SelectItem>
                  <SelectItem value="20">每页 20</SelectItem>
                  <SelectItem value="50">每页 50</SelectItem>
                  <SelectItem value="100">每页 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Dialog */}
      <Dialog open={showTokenDlg} onOpenChange={setShowTokenDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置管理员令牌</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input placeholder="粘贴 Bearer Token" onChange={(e)=>save(e.target.value)} defaultValue={token||""} />
            <div className="text-xs text-muted-foreground">保存在 localStorage 的 token 将自动用于调用 /api/v1/* 接口。</div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=>{ clear(); setShowTokenDlg(false) }}>清除</Button>
            <Button onClick={()=>setShowTokenDlg(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quota Dialog */}
      <Dialog open={quotaDlgOpen} onOpenChange={setQuotaDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>存储配额</DialogTitle>
          </DialogHeader>
          {quotaInfo ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">已用 {quotaInfo.storageUsed} / 配额 {quotaInfo.storageQuota} 字节</div>
              <div className="flex items-center gap-2">
                <Input value={quotaInput} onChange={(e)=>setQuotaInput(e.target.value)} />
                <Button onClick={saveQuota}>保存</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">正在加载...</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setQuotaDlgOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

