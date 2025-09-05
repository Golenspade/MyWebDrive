import { useState } from 'react'
import { 
  Check, 
  X, 
  Eye, 
  Download, 
  User, 
  Calendar, 
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

// 接口定义
interface UploadRequest {
  id: string
  fileName: string
  fileSize: string
  uploadedBy: string
  uploadedAt: string
  status: 'pending' | 'approved' | 'rejected'
  description: string
  category: string
}

// 模拟的上传请求数据
const PENDING_UPLOADS: UploadRequest[] = [
  {
    id: '1',
    fileName: 'project-report.pdf',
    fileSize: '2.5 MB',
    uploadedBy: '张三',
    uploadedAt: '2024-01-15 14:30:00',
    status: 'pending',
    description: '项目进度报告文档',
    category: '工作文档'
  },
  {
    id: '2',
    fileName: 'design-mockup.zip',
    fileSize: '15.8 MB',
    uploadedBy: '李四',
    uploadedAt: '2024-01-15 13:45:00',
    status: 'pending',
    description: '产品设计原型文件',
    category: '设计资源'
  },
  {
    id: '3',
    fileName: 'database-backup.sql',
    fileSize: '45.2 MB',
    uploadedBy: '王五',
    uploadedAt: '2024-01-15 12:15:00',
    status: 'pending',
    description: '数据库备份文件',
    category: '技术文档'
  },
  {
    id: '4',
    fileName: 'marketing-video.mp4',
    fileSize: '125.6 MB',
    uploadedBy: '张三',
    uploadedAt: '2024-01-14 16:20:00',
    status: 'approved',
    description: '产品宣传视频',
    category: '营销材料'
  },
  {
    id: '5',
    fileName: 'old-document.docx',
    fileSize: '1.2 MB',
    uploadedBy: '李四',
    uploadedAt: '2024-01-14 10:30:00',
    status: 'rejected',
    description: '过期的文档资料',
    category: '文档'
  }
]

export default function UploadManagePage() {
  const [uploads, setUploads] = useState<UploadRequest[]>(PENDING_UPLOADS)
  const [selectedUpload, setSelectedUpload] = useState<UploadRequest | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const { toast } = useToast()

  const filteredUploads = filterStatus === 'all' 
    ? uploads 
    : uploads.filter(upload => upload.status === filterStatus)

  const pendingCount = uploads.filter(upload => upload.status === 'pending').length
  const approvedCount = uploads.filter(upload => upload.status === 'approved').length
  const rejectedCount = uploads.filter(upload => upload.status === 'rejected').length

  const handleApprove = (uploadId: string) => {
    setUploads(prev => prev.map(upload => 
      upload.id === uploadId 
        ? { ...upload, status: 'approved' as const }
        : upload
    ))
    toast({
      title: "上传已批准",
      description: "文件已成功批准并可供下载",
    })
  }

  const handleReject = (uploadId: string) => {
    setUploads(prev => prev.map(upload => 
      upload.id === uploadId 
        ? { ...upload, status: 'rejected' as const }
        : upload
    ))
    toast({
      title: "上传已拒绝",
      description: "文件上传请求已被拒绝",
      variant: "destructive",
    })
  }

  const handleViewDetails = (upload: UploadRequest) => {
    setSelectedUpload(upload)
    setIsDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />待审核</Badge>
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />已批准</Badge>
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />已拒绝</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <PageWrapper>
      <PageHeader 
        title="上传管理" 
        description="管理用户上传的文件，审核批准或拒绝上传请求"
      >
        <div className="flex gap-2">
          <Button 
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
          >
            全部 ({uploads.length})
          </Button>
          <Button 
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('pending')}
          >
            待审核 ({pendingCount})
          </Button>
          <Button 
            variant={filterStatus === 'approved' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('approved')}
          >
            已批准 ({approvedCount})
          </Button>
          <Button 
            variant={filterStatus === 'rejected' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('rejected')}
          >
            已拒绝 ({rejectedCount})
          </Button>
        </div>
      </PageHeader>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待审核</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">需要您的审核</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已批准</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">本月批准</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已拒绝</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground">本月拒绝</p>
          </CardContent>
        </Card>
      </div>

      {/* 上传列表 */}
      <Card>
        <CardHeader>
          <CardTitle>上传请求</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>状态</TableHead>
                <TableHead>文件名</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>上传者</TableHead>
                <TableHead>上传时间</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell>
                    {getStatusBadge(upload.status)}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span>{upload.fileName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{upload.fileSize}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{upload.uploadedBy}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{upload.uploadedAt}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{upload.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(upload)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {upload.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(upload.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(upload.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {upload.status === 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedUpload && getStatusIcon(selectedUpload.status)}
              <span>文件详情</span>
            </DialogTitle>
            <DialogDescription>
              查看上传文件的详细信息
            </DialogDescription>
          </DialogHeader>
          {selectedUpload && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">文件名</label>
                <p className="text-sm">{selectedUpload.fileName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">文件大小</label>
                <p className="text-sm">{selectedUpload.fileSize}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">上传者</label>
                <p className="text-sm">{selectedUpload.uploadedBy}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">上传时间</label>
                <p className="text-sm">{selectedUpload.uploadedAt}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">分类</label>
                <p className="text-sm">{selectedUpload.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">描述</label>
                <p className="text-sm">{selectedUpload.description}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">状态</label>
                <div className="mt-1">
                  {getStatusBadge(selectedUpload.status)}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedUpload?.status === 'pending' && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleReject(selectedUpload.id)
                    setIsDialogOpen(false)
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  拒绝
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(selectedUpload.id)
                    setIsDialogOpen(false)
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  批准
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
