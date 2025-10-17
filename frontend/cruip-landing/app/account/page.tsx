"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProtected } from '@/lib/hooks/use-protected'
import { useAuthStore } from '@/lib/stores/auth-store'
import { apiClient } from '@/lib/api/client'
import { usersApi } from '@/lib/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import UploadPanel from '@/components/upload/upload-panel'

export default function AccountPage() {
  const { ready } = useProtected('user')
  const router = useRouter()
  const { user, role, accessToken, logout, isAuthenticated, isLoading } = useAuthStore()
  const [profile, setProfile] = useState(user)
  const [nameInput, setNameInput] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ready) return
    ;(async () => {
      try {
        setLoading(true)
        const me = await usersApi.me()
        setProfile(me)
        if (!nameInput) setNameInput(me.name || '')
      } finally {
        setLoading(false)
      }
    })()
  }, [ready])

  async function saveName() {
    if (!nameInput || nameInput.trim().length < 2) return
    setSaving(true)
    try {
      const updated = await apiClient.patch('/users/me', { name: nameInput.trim() })
      // 简化：直接刷新 me
      const me = await usersApi.me()
      setProfile(me)
    } finally {
      setSaving(false)
    }
  }

  const quota = useMemo(() => ({
    used: Number(profile?.storageUsed || 0),
    total: Number(profile?.storageQuota || 0),
  }), [profile])

  const percent = useMemo(() => {
    const { used, total } = quota
    if (!total) return 0
    return Math.min(100, Math.round((used / total) * 100))
  }, [quota])

  function fmtBytes(n: number) {
    if (!n) return '0 B'
    const u = ['B','KB','MB','GB','TB']
    const i = Math.floor(Math.log(n)/Math.log(1024))
    return `${(n/Math.pow(1024,i)).toFixed(2)} ${u[i]}`
  }

  async function copyToken() {
    if (!accessToken) return
    await navigator.clipboard.writeText(accessToken)
    alert('已复制访问令牌到剪贴板')
  }

  async function onLogout() {
    await logout()
    router.replace('/signin')
  }

  if (!ready) return null

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">个人中心</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">用户ID</div>
                <div className="text-sm break-all">{profile?.id || '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">角色</div>
                <div className="text-sm">{role || 'user'}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">昵称</div>
              <div className="flex gap-2">
                <Input value={nameInput} onChange={(e)=>setNameInput(e.target.value)} placeholder="请输入昵称（≥2个字符）" />
                <Button onClick={saveName} disabled={saving || !nameInput || nameInput.trim().length<2}>保存</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">创建时间</div>
                <div className="text-sm">{profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">更新时间</div>
                <div className="text-sm">{profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : '-'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">存储空间</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">已用 {fmtBytes(quota.used)} / 配额 {quota.total ? fmtBytes(quota.total) : '未设置'}</div>
            <div className="h-2 w-full rounded bg-muted overflow-hidden">
              <div className="h-2 bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <div className="text-xs text-muted-foreground">使用率 {percent}%</div>
            <Button variant="outline" onClick={async()=>{
              const me = await usersApi.me(); setProfile(me)
            }}>刷新用量</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">安全与访问</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm break-all">
            <span className="text-muted-foreground mr-2">访问令牌</span>
            <span className="font-mono">{accessToken ? `${accessToken.slice(0,12)}...${accessToken.slice(-8)}` : '未登录'}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={copyToken} disabled={!accessToken}>复制令牌</Button>
            <Button variant="outline" onClick={()=>window.location.href='/signin'}>重新登录</Button>
            <Button variant="destructive" onClick={onLogout}>退出登录</Button>
          </div>
        </CardContent>
      </Card>
    </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">上传文件</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 简易上传面板 */}
          {/* @ts-expect-error client component import */}
          <UploadPanel onCompleted={() => { /* 可选：完成后刷新用量 */ }} />
        </CardContent>
      </Card>

  )
}

