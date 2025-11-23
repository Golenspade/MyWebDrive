"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProtected } from '@/lib/hooks/use-protected'
import { useAuthStore } from '@/lib/stores/auth-store'
import { apiClient } from '@/lib/api/client'
import { usersApi } from '@/lib/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCompactBytes } from '@/lib/utils/format-bytes'
import { userFilesApi, userFileVersionsApi, type FileItem, type FileVersion } from '@/lib/api/files'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'



import UploadPanel from '@/components/upload/upload-panel'

export default function AccountPage() {
  const { ready } = useProtected('user')
  const router = useRouter()
  const { user, role, accessToken, logout } = useAuthStore()
  const [profile, setProfile] = useState(user)
  const [nameInput, setNameInput] = useState(user?.name || '')
  const [myFiles, setMyFiles] = useState<FileItem[]>([])
  const [filesCursor, setFilesCursor] = useState<string | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)

  const loadMyFiles = useCallback(async (cursor?: string) => {
    setFilesLoading(true)
    try {
      const r = await userFilesApi.listMine({ limit: 20, cursor })
      setMyFiles(prev => cursor ? [...prev, ...r.items] : r.items)
      setFilesCursor(r.nextCursor)
    } finally {
      setFilesLoading(false)
    }
  }, [])

  const [verOpenFor, setVerOpenFor] = useState<FileItem|null>(null)
  const [versions, setVersions] = useState<FileVersion[]>([])
  const [verLoading, setVerLoading] = useState(false)

  async function openVersions(f: FileItem){
    setVerOpenFor(f)
    setVerLoading(true)
    try{ const r = await userFileVersionsApi.list(f.id, 20); setVersions(r.versions||[]) } finally { setVerLoading(false) }
  }
  async function restoreVersion(v: FileVersion){
    if (!verOpenFor) return
    if (!confirm(`确认回滚到版本 ${v.version} 吗？`)) return
    await userFileVersionsApi.restore(verOpenFor.id, v.id)
    await loadMyFiles() // refresh list
    await openVersions(verOpenFor) // refresh versions
  }
  async function previewFile(f: FileItem){
    try{
      const token = (typeof window!=='undefined' ? localStorage.getItem('accessToken') : accessToken) || accessToken || ''
      const r = await fetch(`/api/v1/files/${f.id}/preview`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) { alert('预览失败'); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const w = window.open('about:blank')
      if (w) { w.location.href = url } else { window.location.href = url }
      setTimeout(()=> URL.revokeObjectURL(url), 60_000)
    }catch{
      alert('预览失败')
    }
  }



  const [saving, setSaving] = useState(false)
  const [, setLoading] = useState(false)

  useEffect(() => {
    if (!ready) return
    ;(async () => {
      try {
        setLoading(true)
        const me = await usersApi.me()
        setProfile(me)
        if (!nameInput) setNameInput(me.name || '')
        await loadMyFiles()
      } finally {
        setLoading(false)
      }
    })()
  }, [ready, loadMyFiles, nameInput])

  async function saveName() {
    if (!nameInput || nameInput.trim().length < 2) return
    setSaving(true)
    try {
      await apiClient.patch('/users/me', { name: nameInput.trim() })
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
    return formatCompactBytes(Number(n || 0))
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">上传文件</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 简易上传面板 */}
          <UploadPanel onCompleted={() => { /* 可选：完成后刷新用量 */ }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">我的上传</CardTitle>
            <Button variant="outline" onClick={()=>loadMyFiles()} disabled={filesLoading}>刷新</Button>
          </div>
        </CardHeader>
        <CardContent>
          {myFiles.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无上传内容</div>
          ) : (
            <div className="text-sm">
              <div className="grid grid-cols-5 gap-2 text-muted-foreground mb-2">
                <div>文件名</div>
                <div>大小 / 类型</div>
                <div>版本</div>
                <div>更新时间</div>
                <div className="text-right">操作</div>
              </div>
              {myFiles.map(f => (
                <div key={f.id} className="grid grid-cols-5 gap-2 py-1 border-b last:border-b-0 items-center">
                  <div className="truncate" title={f.name}>
                    <a className="text-primary hover:underline" href={`/api/v1/storage/files/${f.id}/download`}>
                      {f.name}
                    </a>
                  </div>
                  <div>{fmtBytes(f.size||0)}{f.mimeType?` · ${f.mimeType}`:''}</div>
                  <div>{typeof f.version === 'number' ? f.version : '-'}</div>
                  <div>{new Date(f.updatedAt).toLocaleString()}</div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={()=>previewFile(f)}>
                      预览
                    </Button>
                    <Button size="sm" variant="outline" onClick={()=>navigator.clipboard?.writeText(`${window.location.origin}/api/v1/storage/files/${f.id}/download-direct?ttl=600`)}>
                      复制下载链接
                    </Button>
                    <Button size="sm" variant="outline" onClick={()=>openVersions(f)}>
                      版本历史
                    </Button>
                  </div>
                </div>
              ))}
              {filesCursor && (
                <div className="mt-3">
                  <Button variant="outline" onClick={()=>loadMyFiles(filesCursor!)} disabled={filesLoading}>加载更多</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!verOpenFor} onOpenChange={(o)=>{ if(!o){ setVerOpenFor(null); setVersions([]) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>版本历史 {verOpenFor ? `- ${verOpenFor.name}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            {verLoading ? (
              <div className="text-muted-foreground">加载中...</div>
            ) : versions.length === 0 ? (
              <div className="text-muted-foreground">暂无版本</div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-2 text-muted-foreground">
                  <div>版本</div>
                  <div>大小</div>
                  <div>创建时间</div>
                  <div className="text-right">操作</div>
                </div>
                {versions.map(v => (
                  <div key={v.id} className="grid grid-cols-4 gap-2 py-1 border-b last:border-b-0 items-center">
                    <div>{v.version}</div>
                    <div>{fmtBytes(v.size)}</div>
                    <div>{new Date(v.createdAt).toLocaleString()}</div>
                    <div className="text-right">
                      <Button size="sm" variant="outline" onClick={()=>restoreVersion(v)}>回滚</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>



    </div>


  )
}

