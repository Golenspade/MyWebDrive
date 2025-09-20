import axios from 'axios'
import { toast } from '@/hooks/use-toast'

/**
 * 通用文件下载工具函数
 * @param fileId 文件ID
 * @param fallbackName 备用文件名（当无法从响应头获取时使用）
 * @param onSuccess 下载成功回调
 * @param onError 下载失败回调
 */
export async function downloadFileById(
  fileId: string,
  fallbackName: string = 'download',
  onSuccess?: (filename: string) => void,
  onError?: (error: unknown) => void
): Promise<void> {
  try {
    console.warn('开始下载文件:', fileId)
    
    const res = await axios.get(`/api/v1/storage/files/${fileId}/download`, {
      responseType: 'blob'
    })

    // 从响应头获取文件名
    let filename = fallbackName
    const contentDisposition = res.headers['content-disposition']
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
        // 处理UTF-8编码的文件名
        if (filename.startsWith('UTF-8\'\'')) {
          filename = decodeURIComponent(filename.substring(7))
        }
      }
    }

    // 创建下载链接
    const blob = new Blob([res.data])
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)

    console.warn('文件下载成功:', filename)

    toast({
      title: "下载成功",
      description: `文件 ${filename} 已开始下载`,
    })

    onSuccess?.(filename)
  } catch (err: unknown) {
    console.error('下载失败:', err)

    let errorMessage = '下载失败'
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosError = err as { response?: { status?: number } }
      if (axiosError.response?.status === 404) {
        errorMessage = '文件不存在或已被删除'
      } else if (axiosError.response?.status === 401) {
        errorMessage = '无权限下载此文件'
      } else if (axiosError.response?.status === 403) {
        errorMessage = '下载受限，请检查权限'
      } else if (axiosError.response?.status === 429) {
        errorMessage = '下载并发已达上限，请稍后重试'
      }
    } else if (err && typeof err === 'object' && 'message' in err) {
      errorMessage = (err as { message: string }).message
    }

    toast({
      title: "下载失败",
      description: errorMessage,
      variant: "destructive"
    })

    onError?.(err)
    throw err
  }
}

/**
 * 检查用户下载权限
 * @param user 用户对象
 * @returns 是否有下载权限
 */
export function canUserDownload(_user: { role?: string } | null): boolean {
  // 匿名用户也允许下载
  return true
}

/**
 * 处理下载权限检查和跳转
 * @param user 用户对象
 * @param navigate 路由导航函数
 * @param fileId 文件ID
 * @param returnUrl 返回URL
 * @returns 是否通过权限检查
 */
export function handleDownloadPermission(
  _user: { role?: string } | null,
  _navigate: (path: string, options?: { state?: Record<string, unknown> }) => void,
  _fileId: string,
  _returnUrl: string = '/files'
): boolean {
  // 匿名用户可直接下载，不做前端拦截
  return true
}
