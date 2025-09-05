import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileIcon, FolderPlus } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'
import { useAuthStore } from '@/stores/authStore'
import * as tus from 'tus-js-client'
import toast from 'react-hot-toast'

interface UploadFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  upload?: tus.Upload
}

export default function UploadButton() {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const { createFolder, currentFolderId, fetchFiles } = useFileStore()
  const user = useAuthStore((state) => state.user)

  const onDrop = (acceptedFiles: File[]) => {
    // 检查用户权限和上传slot限制
    if (!user) {
      toast.error('请先登录')
      return
    }

    if (user.role === 'guest') {
      toast.error('游客无法上传文件，请注册成为用户')
      return
    }

    // 检查上传slot限制
    const availableSlots = user.uploadSlots - user.pendingUploads
    if (user.role === 'user' && availableSlots <= 0) {
      toast.error('您已达到上传限制（3个slot），请等待管理员审核现有上传')
      return
    }

    if (user.role === 'user' && acceptedFiles.length > availableSlots) {
      toast.error(`您只能再上传 ${availableSlots} 个文件`)
      return
    }

    const newUploads: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'pending' as const
    }))

    setUploadFiles(prev => [...prev, ...newUploads])
    setShowUploadModal(true)

    // 开始上传
    newUploads.forEach(uploadFile => {
      startUpload(uploadFile)
    })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true
  })

  const startUpload = (uploadFile: UploadFile) => {
    const upload = new tus.Upload(uploadFile.file, {
      endpoint: '/api/v1/storage/uploads',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: uploadFile.file.name,
        filetype: uploadFile.file.type,
        parentId: currentFolderId || '',
      },
      onError: (error) => {
        console.error('Upload failed:', error)
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error' as const }
            : f
        ))
        toast.error(`上传失败: ${uploadFile.file.name}`)
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, progress: percentage }
            : f
        ))
      },
      onSuccess: async () => {
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
        ))
        
        // 完成上传后通知后端处理
        try {
          await fetch(`/api/v1/storage/uploads/${upload.url?.split('/').pop()}/finalize`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
              'Content-Type': 'application/json'
            }
          })
          toast.success(`上传完成: ${uploadFile.file.name}`)
          // 刷新文件列表
          fetchFiles(currentFolderId || 'root')
        } catch (error) {
          console.error('Failed to finalize upload:', error)
        }
      }
    })

    upload.start()
    
    setUploadFiles(prev => prev.map(f => 
      f.id === uploadFile.id 
        ? { ...f, upload, status: 'uploading' as const }
        : f
    ))
  }

  const cancelUpload = (uploadFile: UploadFile) => {
    if (uploadFile.upload) {
      uploadFile.upload.abort()
    }
    setUploadFiles(prev => prev.filter(f => f.id !== uploadFile.id))
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    
    try {
      await createFolder(newFolderName.trim(), currentFolderId || undefined)
      setNewFolderName('')
      setShowNewFolderModal(false)
    } catch (error) {
      // 错误已在store中处理
    }
  }

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <>
      {/* 拖拽上传区域 */}
      <div {...getRootProps()} className={`fixed inset-0 z-40 ${isDragActive ? '' : 'pointer-events-none'}`}>
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute inset-0 bg-primary-500 bg-opacity-20 flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-dashed border-primary-500">
              <Upload className="w-16 h-16 text-primary-500 mx-auto mb-4" />
              <p className="text-xl font-medium text-gray-900">拖拽文件到这里上传</p>
            </div>
          </div>
        )}
      </div>

      {/* 悬浮操作按钮 */}
      <div className="fixed bottom-6 right-6 flex flex-col space-y-3">
        <button
          onClick={() => setShowNewFolderModal(true)}
          className="bg-gray-600 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          title="新建文件夹"
        >
          <FolderPlus className="w-6 h-6" />
        </button>
        
        <button
          onClick={() => document.getElementById('file-upload')?.click()}
          className="bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
          title="上传文件"
        >
          <Upload className="w-6 h-6" />
        </button>
        
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              onDrop(Array.from(e.target.files))
            }
          }}
        />
      </div>

      {/* 上传进度模态框 */}
      {showUploadModal && uploadFiles.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">文件上传</h3>
                <button
                  onClick={() => {
                    // 取消所有上传
                    uploadFiles.forEach(cancelUpload)
                    setShowUploadModal(false)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {uploadFiles.map(uploadFile => (
                  <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(uploadFile.file.size)}
                      </p>
                      
                      {uploadFile.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full transition-all"
                              style={{ width: `${uploadFile.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{uploadFile.progress}%</p>
                        </div>
                      )}
                      
                      {uploadFile.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-1">上传完成</p>
                      )}
                      
                      {uploadFile.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">上传失败</p>
                      )}
                    </div>
                    
                    {uploadFile.status === 'uploading' && (
                      <button
                        onClick={() => cancelUpload(uploadFile)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 新建文件夹模态框 */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">新建文件夹</h3>
                <button
                  onClick={() => setShowNewFolderModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="文件夹名称"
                  className="input-field"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFolder()
                    }
                  }}
                />

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowNewFolderModal(false)}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    className="btn-primary"
                    disabled={!newFolderName.trim()}
                  >
                    创建
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}