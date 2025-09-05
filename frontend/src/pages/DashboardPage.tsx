import React from 'react'
import { Users, Activity, Download, HardDrive, FileText, Upload as UploadIcon } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { StatsCard } from '@/components/ui/stats-card'
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { fetchAdminOverview, type Overview } from '@/lib/adminApi'

export default function DashboardPage() {
  const [overview, setOverview] = React.useState<Overview | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchAdminOverview()
      .then((data) => {
        if (mounted) setOverview(data)
      })
      .catch((err) => {
        if (mounted) setError(err?.message || '加载失败')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes)) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    let v = bytes
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024
      i++
    }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
  }

  return (
    <AppLayout>
      <PageWrapper>
      {/* 页面顶部区域，包含标题和主要操作 */}
      <PageHeader 
        title="仪表盘" 
        description="欢迎回来！这是您的业务概览。"
      >
        {/* 允许用户筛选数据的时间范围 */}
        <DatePickerWithRange />
        {/* 提供数据导出功能 */}
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          导出报告
        </Button>
      </PageHeader>

      {/* 关键指标卡片网格布局 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard 
          title="存储总量"
          value={overview ? formatBytes(overview.totals?.total_storage_bytes || 0) : '—'}
          change={loading ? '加载中...' : ''}
          icon={HardDrive}
        />
        <StatsCard 
          title="文件数量"
          value={overview ? String(overview.totals?.total_files || 0) : '—'}
          change={loading ? '加载中...' : ''}
          icon={FileText}
        />
        <StatsCard 
          title="上传次数"
          value={overview ? String(overview.today?.uploads_count || 0) : '—'}
          change={loading ? '加载中...' : ''}
          icon={UploadIcon}
        />
        <StatsCard 
          title="活跃用户"
          value={overview ? String(overview.today?.active_users || 0) : '—'}
          change={loading ? '加载中...' : ''}
          icon={Activity}
        />
      </div>

      {/* 主要内容区域，包含图表和列表 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        {/* 主要数据可视化图表，占据较大空间 */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>存储使用趋势</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {/* TODO: 集成图表库 (recharts 或 nivo) */}
              {loading && '加载中...'}
              {!loading && error && `加载失败：${error}`}
              {!loading && !error && '图表组件将在这里显示'}
            </div>
          </CardContent>
        </Card>

        {/* 最近活动列表 */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>本月新增了 265 个文件。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* TODO: 实现真实的活动数据 */}
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <UploadIcon className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">上传了新文件</p>
                  <p className="text-xs text-muted-foreground">document.pdf - 2分钟前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">新用户注册</p>
                  <p className="text-xs text-muted-foreground">张三 - 5分钟前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">文件分享</p>
                  <p className="text-xs text-muted-foreground">shared_folder - 10分钟前</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </PageWrapper>
    </AppLayout>
  )
}
