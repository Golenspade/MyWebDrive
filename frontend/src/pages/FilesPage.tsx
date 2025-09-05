// import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FolderOpen, 
  FileText, 
  Image, 
  Video, 
  Music,
  Download,
  Share2,
  Trash2,
  MoreVertical,
  Upload
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/app-layout'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadFileById, handleDownloadPermission } from '@/lib/downloadUtils'
// import { Badge } from '@/components/ui/badge'

// 模拟文件数据
const mockFiles = [
  {
    id: '1',
    name: '工作文档',
    type: 'folder',
    size: null,
    modified: '2024-01-15',
    shared: false,
  },
  {
    id: '2',
    name: '项目报告.pdf',
    type: 'pdf',
    size: 2048000, // 2MB
    modified: '2024-01-14',
    shared: true,
  },
  {
    id: '3',
    name: '设计图.png',
    type: 'image',
    size: 5242880, // 5MB
    modified: '2024-01-13',
    shared: false,
  },
  {
    id: '4',
    name: '演示视频.mp4',
    type: 'video',
    size: 52428800, // 50MB
    modified: '2024-01-12',
    shared: true,
  },
  {
    id: '5',
    name: '背景音乐.mp3',
    type: 'audio',
    size: 3145728, // 3MB
    modified: '2024-01-11',
    shared: false,
  },
]

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function getFileIcon(type: string) {
  switch (type) {
    case 'folder':
      return FolderOpen
    case 'image':
      return Image
    case 'video':
      return Video
    case 'audio':
      return Music
    default:
      return FileText
  }
}

function getFileTypeColor(type: string) {
  switch (type) {
    case 'folder':
      return 'bg-blue-100 text-blue-800'
    case 'image':
      return 'bg-green-100 text-green-800'
    case 'video':
      return 'bg-purple-100 text-purple-800'
    case 'audio':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function FilesPage() {
  // const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const handleDownload = async (file: { id: string; name: string }) => {
    // 检查权限
    if (!handleDownloadPermission(user, navigate, file.id, '/files')) {
      return
    }

    try {
      await downloadFileById(file.id, file.name)
    } catch (err) {
      // 错误已在 downloadFileById 中处理
    }
  }

  return (
    <AppLayout>
      <PageWrapper>
      <PageHeader
        title="我的文件"
        description="管理您的文件和文件夹。"
      >
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          上传文件
        </Button>
      </PageHeader>

      {/* 文件网格视图 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {mockFiles.map((file) => {
          const Icon = getFileIcon(file.type)
          
          return (
            <Card key={file.id} className="group hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex flex-col items-center space-y-2">
                  {/* 文件图标 */}
                  <div className="relative">
                    <div className={`p-3 rounded-lg ${getFileTypeColor(file.type)}`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    {file.shared && (
                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
                        <Share2 className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  
                  {/* 文件信息 */}
                  <div className="text-center w-full">
                    <p className="text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>{file.modified}</span>
                      {file.size && (
                        <span>{formatFileSize(file.size)}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* 操作菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(file)}>
                        <Download className="mr-2 h-4 w-4" />
                        下载
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share2 className="mr-2 h-4 w-4" />
                        分享
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 空状态提示 */}
      {mockFiles.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium">没有文件</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            开始上传您的第一个文件。
          </p>
          <div className="mt-6">
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              上传文件
            </Button>
          </div>
        </div>
      )}
      </PageWrapper>
    </AppLayout>
  )
}
