import React from 'react'
import { AppLayout } from '@/components/app-layout'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listInvitations, createInvitation, revokeInvitation, type InvitationCode } from '@/lib/invitationsApi'

export default function InvitationsPage() {
  const [items, setItems] = React.useState<InvitationCode[]>([])
  const [loading, setLoading] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [usageLimit, setUsageLimit] = React.useState<number>(10)
  const [expiresAt, setExpiresAt] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listInvitations()
      setItems(data)
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await createInvitation({ usageLimit, expiresAt: expiresAt || undefined, notes: notes || undefined })
      setUsageLimit(10)
      setExpiresAt('')
      setNotes('')
      await load()
    } catch (e: any) {
      setError(e?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const onRevoke = async (code: string) => {
    setError(null)
    try {
      await revokeInvitation(code)
      await load()
    } catch (e: any) {
      setError(e?.message || '撤销失败')
    }
  }

  const formatDT = (s?: string | null) => (s ? new Date(s).toLocaleString() : '-')

  return (
    <AppLayout>
      <PageWrapper>
        <PageHeader title="邀请码管理" description="创建和管理注册邀请码" />

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>创建邀请码</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="usageLimit">使用次数</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    min={1}
                    max={100}
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(Math.max(1, Math.min(100, Number(e.target.value || 1))))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">过期时间（可选，RFC3339）</Label>
                  <Input
                    id="expiresAt"
                    placeholder="2025-12-31T00:00:00Z"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">备注（可选）</Label>
                  <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" disabled={creating}>{creating ? '创建中...' : '创建'}</Button>
                {error && <div className="text-sm text-red-500">{error}</div>}
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>邀请码列表</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">加载中...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>使用</TableHead>
                      <TableHead>有效</TableHead>
                      <TableHead>发放/过期</TableHead>
                      <TableHead>使用者</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.code}</TableCell>
                        <TableCell>{inv.usedCount} / {inv.usageLimit}</TableCell>
                        <TableCell>{inv.isActive ? '是' : '否'}</TableCell>
                        <TableCell>
                          <div className="text-xs">发放：{formatDT(inv.issuedAt)}</div>
                          <div className="text-xs">过期：{formatDT(inv.expiresAt)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">{inv.usedBy || '-'}</div>
                          <div className="text-xs">{formatDT(inv.usedAt)}</div>
                        </TableCell>
                        <TableCell className="text-xs">{inv.notes || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!inv.isActive}
                            onClick={() => onRevoke(inv.code)}
                          >
                            撤销
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    </AppLayout>
  )
}

