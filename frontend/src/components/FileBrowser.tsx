import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Folder,
  File,
  MoreVertical,
  Download,
  Trash2,
  Edit2,
  Move,
  Share2,
  Grid,
  List
} from 'lucide-react'
import { useFileStore, FileItem } from '@/stores/fileStore'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { downloadFileById, handleDownloadPermission } from '@/lib/downloadUtils'

export default function FileBrowser() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null)
  
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { clearAuth } = useAuthStore()
  const { toast } = useToast()
  
  const {
    files,
    isLoading,
    selectedFiles,
    fetchFiles,
    toggleFileSelection,
    deleteFile,
    deleteFolder,
  } = useFileStore()

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }

  const handleDownload = async (file: FileItem) => {
    // 检查权限
    if (!handleDownloadPermission(user, navigate, file.id, '/files')) {
      setContextMenu(null)
      return
    }

    try {
      await downloadFileById(file.id, file.name)
    } catch (err) {
      // 错误已在 downloadFileById 中处理
    } finally {
      setContextMenu(null)
    }
  }

  const handleDelete = async (item: FileItem) => {
    if (confirm(`确定要删除 ${item.name} 吗？`)) {
      if (item.type === 'file') {
        await deleteFile(item.id)
      } else {
        await deleteFolder(item.id)
      }
    }
    setContextMenu(null)
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {files.length} 个项目
          </div>
          {/* 临时测试按钮 */}
          <button
            onClick={() => {
              clearAuth()
              toast({ title: "已清除登录状态", description: "现在可以测试未登录下载" })
            }}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
          >
            清除登录(测试)
          </button>
        </div>
      </div>

      {/* 文件列表 */}
      {viewMode === 'list' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  大小
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  修改时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.map((file) => (
                <tr
                  key={file.id}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selectedFiles.has(file.id) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => toggleFileSelection(file.id)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {file.type === 'folder' ? (
                        <Folder className="w-5 h-5 text-blue-500 mr-3" />
                      ) : (
                        <File className="w-5 h-5 text-gray-400 mr-3" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(file.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleContextMenu(e, file)
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-6 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className={`p-4 border rounded-lg hover:shadow-md cursor-pointer ${
                  selectedFiles.has(file.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => toggleFileSelection(file.id)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <div className="flex flex-col items-center">
                  {file.type === 'folder' ? (
                    <Folder className="w-12 h-12 text-blue-500 mb-2" />
                  ) : (
                    <File className="w-12 h-12 text-gray-400 mb-2" />
                  )}
                  <span className="text-sm text-center text-gray-900 truncate w-full">
                    {file.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button 
              onClick={() => handleDownload(contextMenu.file)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              下载
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center">
              <Share2 className="w-4 h-4 mr-2" />
              分享
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center">
              <Edit2 className="w-4 h-4 mr-2" />
              重命名
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center">
              <Move className="w-4 h-4 mr-2" />
              移动
            </button>
            <hr className="my-1" />
            <button
              onClick={() => handleDelete(contextMenu.file)}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </button>
          </div>
        </>
      )}
    </div>
  )
}
