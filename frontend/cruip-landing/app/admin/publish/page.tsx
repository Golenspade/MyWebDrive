"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api/client'

import UploadPanel from '@/components/upload/upload-panel'

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
  const [previewData, setPreviewData] = useState<any>(null)

  // Search files
  async function searchFiles() {
    if (!isAuthenticated || role !== 'admin') return
    setLoading(true)
    try {
      const qs = `?q=${encodeURIComponent(searchQuery)}&only=files`
      const response = await apiClient.get<{ items: FileItem[] }>(`/search${qs}`)
      setFiles(response.items || [])
    } catch (err: any) {
      toast({
        title: '搜索失败',
        description: err.message || '无法搜索文件',
      })
    } finally {
      setLoading(false)
    }
  }

  // Select file for publishing
  function selectFile(file: FileItem) {
    setSelectedFile(file)
    // Auto-fill some fields
    const baseName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
    setFormData(prev => ({
      ...prev,
      slug: prev.slug || baseName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name: prev.name || baseName,
    }))
  }

  // Publish catalog
  async function publishCatalog() {
    if (!selectedFile) {
      toast({
        title: '错误',
        description: '请先选择要发布的文件',
      })
      return
    }

    if (!formData.slug || !formData.version) {
      toast({
        title: '错误',
        description: 'Slug 和 Version 是必填项',
      })
      return
    }

    setLoading(true)
    try {
      const response = await apiClient.put(`/files/${selectedFile.id}/catalog`, formData)

      toast({
        title: '发布成功',
        description: `项目 ${formData.slug} 版本 ${formData.version} 已发布`,
      })

      // Fetch preview
      const catalogData = await apiClient.get(`/catalog/${formData.slug}`)
      setPreviewData(catalogData)
      setPreviewOpen(true)
    } catch (err: any) {
      toast({
        title: '发布失败',
        description: err.message || '无法发布项目',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>发布管理</h1>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Left: File Selection */}
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
              <div className='p-3 bg-blue-50 border border-blue-200 rounded-md'>
                <div className='text-sm font-medium text-blue-900'>已选择文件</div>
                <div className='text-sm text-blue-700'>{selectedFile.name}</div>
                <div className='text-xs text-blue-600'>ID: {selectedFile.id}</div>
              </div>
            )}

            <div className='max-h-96 overflow-y-auto space-y-2'>
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                    selectedFile?.id === file.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onClick={() => selectFile(file)}
                >
                  <div className='text-sm font-medium'>{file.name}</div>
                  <div className='text-xs text-gray-500'>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Publish Form */}
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
                <Select value={formData.category || undefined} onValueChange={(v: any) => setFormData({ ...formData, category: v })}>
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
                <Select value={formData.channel} onValueChange={(v: any) => setFormData({ ...formData, channel: v })}>
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
                <Select value={formData.os} onValueChange={(v: any) => setFormData({ ...formData, os: v })}>
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
                <Select value={formData.arch} onValueChange={(v: any) => setFormData({ ...formData, arch: v })}>
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
              <input
                type='checkbox'
                id='public'
                checked={formData.public}
                onChange={(e) => setFormData({ ...formData, public: e.target.checked })}
                className='w-4 h-4'
              />
              <Label htmlFor='public' className='cursor-pointer'>公开（在目录中可见）</Label>
            </div>

            <Button onClick={publishCatalog} disabled={loading || !selectedFile} className='w-full'>
              {loading ? '发布中...' : '发布'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>发布预览</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className='space-y-4'>
              <div>
                <div className='text-sm font-medium text-gray-500'>项目标识</div>
                <div className='text-lg font-bold'>{previewData.slug}</div>
              </div>
              <div>
                <div className='text-sm font-medium text-gray-500'>名称</div>
                <div>{previewData.name}</div>
              </div>
              {previewData.description && (
                <div>
                  <div className='text-sm font-medium text-gray-500'>描述</div>
                  <div className='text-sm'>{previewData.description}</div>
                </div>
              )}
              <div>
                <div className='text-sm font-medium text-gray-500'>版本</div>
                <div className='space-y-2 mt-2'>
                  {previewData.releases?.map((rel: any, idx: number) => (
                    <div key={idx} className='p-3 border rounded-md'>
                      <div className='font-medium'>
                        {rel.version} ({rel.channel})
                      </div>
                      <div className='text-sm text-gray-600 mt-1'>
                        {rel.assets?.length || 0} 个资产
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className='pt-4 border-t'>
                <div className='text-sm text-gray-500'>API 接口</div>
                <code className='text-xs bg-gray-100 p-2 rounded block mt-1'>
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

