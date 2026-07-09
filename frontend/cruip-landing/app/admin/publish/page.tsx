"use client"

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api/client'

type FileItem = {
  id: string
  name: string
  size: number
  mimeType?: string
  createdAt: string
  updatedAt: string
}

type CatalogFormData = {
  slug: string
  name: string
  description: string
  category: string
  license: string
  repo: string
  version: string
  channel: 'stable' | 'beta' | 'dev'
  os: 'windows' | 'darwin' | 'linux' | 'any'
  arch: 'amd64' | 'arm64' | 'any'
  public: boolean
  url: string
}
type CatalogRelease = {
  version: string
  channel: string
  assets?: unknown[]
}

type CatalogPreview = {
  slug: string
  name?: string
  description?: string
  releases?: CatalogRelease[]
}

function fmtSize(n: number) {
  if (!n) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export default function AdminPublishPage() {
  const { isAuthenticated, role } = useAuthStore()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)

  const [formData, setFormData] = useState<CatalogFormData>({
    slug: '',
    name: '',
    description: '',
    category: '',
    license: '',
    repo: '',
    version: '1.0.0',
    channel: 'stable',
    os: 'any',
    arch: 'any',
    public: true,
    url: '',
  })

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<CatalogPreview | null>(null)

  // Search files in uploaded assets for admin to publish.
  const searchFiles = useCallback(async () => {
    if (!isAuthenticated || role !== 'admin') return
    setLoading(true)
    try {
      const qs = `?q=${encodeURIComponent(searchQuery)}&only=files`
      const response = await apiClient.get<{ items: FileItem[] }>(`/search${qs}`)
      setFiles(response.items || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast({
        title: '搜索失败',
        description: message || '无法搜索文件',
      })
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, role, searchQuery, toast])

  function selectFile(file: FileItem) {
    setSelectedFile(file)
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    setFormData(prev => ({
      ...prev,
      slug: prev.slug || baseName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name: prev.name || baseName,
    }))
  }

  async function publishCatalog() {
    if (!selectedFile) {
      toast({ title: '错误', description: '请先选择要发布的文件' })
      return
    }

    if (!formData.slug || !formData.version) {
      toast({ title: '错误', description: 'Slug 和 Version 是必填项' })
      return
    }

    setLoading(true)
    try {
      await apiClient.put(`/files/${selectedFile.id}/catalog`, formData)

      toast({
        title: '发布成功',
        description: `项目 ${formData.slug} 版本 ${formData.version} 已发布`,
      })

      // Fetch preview
      const catalogData = await apiClient.get<CatalogPreview>(`/catalog/${formData.slug}`)
      setPreviewData(catalogData)
      setPreviewOpen(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast({
        title: '发布失败',
        description: message || '无法发布项目',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-nothing-head font-semibold text-nothing-display'>发布管理</h1>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* 左侧：从已上传文件中选择要发布到 Catalog 的文件 */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>选择文件</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex gap-2'>
              <Input
                placeholder='搜索文件名...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchFiles() }}
              />
              <Button onClick={searchFiles} disabled={loading}>搜索</Button>
            </div>

            {selectedFile && (
              <div className='p-3 bg-nothing-raised border border-nothing-line-2 rounded-[var(--nothing-r-sm)]'>
                <div className='text-sm font-nothing-head font-medium text-nothing-display'>已选择文件</div>
                <div className='text-sm text-nothing-primary'>{selectedFile.name}</div>
                <div className='text-xs text-nothing-muted font-nothing-mono'>ID: {selectedFile.id}</div>
              </div>
            )}

            <div className='max-h-96 overflow-y-auto space-y-2'>
              {files.map((file) => {
                const selected = selectedFile?.id === file.id
                return (
                  <div
                    key={file.id}
                    className={cn(
                      'p-3 border rounded-[var(--nothing-r-sm)] cursor-pointer transition-colors duration-200 ease-in-out hover:bg-nothing-raised',
                      selected
                        ? 'border-nothing-display bg-nothing-raised border-l-2 border-l-nothing-display'
                        : 'border-nothing-line-2'
                    )}
                    onClick={() => selectFile(file)}
                  >
                    <div className='text-sm font-nothing-ui font-medium text-nothing-primary'>{file.name}</div>
                    <div className='text-xs text-nothing-secondary font-nothing-mono'>
                      {fmtSize(file.size)}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 右侧：填写 Catalog 元数据并发起发布 + 预览 */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>发布信息</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='slug'>项目标识 *</Label>
                <Input
                  id='slug'
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder='my-project'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='version'>版本号 *</Label>
                <Input
                  id='version'
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder='1.0.0'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='name'>名称</Label>
              <Input
                id='name'
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder='我的项目'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>描述</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder='项目描述...'
                rows={3}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='category'>分类</Label>
                <Select value={formData.category || undefined} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder='选择分类' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='base'>基础工具</SelectItem>
                    <SelectItem value='writing'>写作工具</SelectItem>
                    <SelectItem value='model'>模型工具</SelectItem>
                    <SelectItem value='script'>脚本工具</SelectItem>
                    <SelectItem value='bundle'>整合包</SelectItem>
                    <SelectItem value='modelAsset'>模型</SelectItem>
                    <SelectItem value='article'>文章</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='license'>许可证</Label>
                <Input
                  id='license'
                  value={formData.license}
                  onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                  placeholder='MIT'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='repo'>代码仓库</Label>
              <Input
                id='repo'
                value={formData.repo}
                onChange={(e) => setFormData({ ...formData, repo: e.target.value })}
                placeholder='https://github.com/user/repo'
              />
            </div>

            <div className='grid grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='channel'>通道</Label>
                <Select value={formData.channel} onValueChange={(v) => setFormData({ ...formData, channel: v as CatalogFormData['channel'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='stable'>稳定</SelectItem>
                    <SelectItem value='beta'>测试</SelectItem>
                    <SelectItem value='dev'>开发</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='os'>操作系统</Label>
                <Select value={formData.os} onValueChange={(v) => setFormData({ ...formData, os: v as CatalogFormData['os'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='any'>通用</SelectItem>
                    <SelectItem value='windows'>Windows</SelectItem>
                    <SelectItem value='darwin'>macOS</SelectItem>
                    <SelectItem value='linux'>Linux</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='arch'>架构</Label>
                <Select value={formData.arch} onValueChange={(v) => setFormData({ ...formData, arch: v as CatalogFormData['arch'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='any'>通用</SelectItem>
                    <SelectItem value='amd64'>AMD64</SelectItem>
                    <SelectItem value='arm64'>ARM64</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='url'>自定义下载 URL（可选）</Label>
              <Input
                id='url'
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder='https://cdn.example.com/file.zip'
              />
            </div>

            <div className='flex items-center gap-2'>
              <Checkbox
                id='public'
                checked={formData.public}
                onCheckedChange={(v) => setFormData({ ...formData, public: Boolean(v) })}
              />
              <Label htmlFor='public' className='cursor-pointer'>公开（在目录中可见）</Label>
            </div>

            <Button onClick={publishCatalog} disabled={loading || !selectedFile} className='w-full'>
              {loading ? '发布中...' : '发布'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>发布预览</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className='space-y-4'>
              <div>
                <div className='text-sm font-nothing-mono uppercase tracking-[0.08em] text-nothing-secondary'>项目标识</div>
                <div className='text-lg font-nothing-head font-semibold text-nothing-display'>{previewData.slug}</div>
              </div>
              <div>
                <div className='text-sm font-nothing-mono uppercase tracking-[0.08em] text-nothing-secondary'>名称</div>
                <div className='text-nothing-primary'>{previewData.name}</div>
              </div>
              {previewData.description && (
                <div>
                  <div className='text-sm font-nothing-mono uppercase tracking-[0.08em] text-nothing-secondary'>描述</div>
                  <div className='text-sm text-nothing-primary'>{previewData.description}</div>
                </div>
              )}
              <div>
                <div className='text-sm font-nothing-mono uppercase tracking-[0.08em] text-nothing-secondary'>版本</div>
                <div className='space-y-2 mt-2'>
                  {previewData.releases?.map((rel: CatalogRelease, idx: number) => (
                    <div key={idx} className='p-3 border border-nothing-line-2 rounded-[var(--nothing-r-sm)]'>
                      <div className='font-nothing-ui font-medium text-nothing-primary'>
                        {rel.version} ({rel.channel})
                      </div>
                      <div className='text-sm text-nothing-secondary font-nothing-mono mt-1'>
                        <span className='font-nothing-display'>{rel.assets?.length || 0}</span> 个资产
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className='pt-4 border-t border-nothing-line'>
                <div className='text-sm font-nothing-mono uppercase tracking-[0.08em] text-nothing-secondary'>API 接口</div>
                <code className='text-xs font-nothing-mono text-nothing-primary bg-nothing-raised p-2 rounded-[var(--nothing-r-sm)] block mt-1'>
                  GET /catalog/{previewData.slug}
                </code>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
