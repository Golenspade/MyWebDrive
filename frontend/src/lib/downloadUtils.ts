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
    // 使用预签名直链：先获取直链 JSON，再跳转（MinIO/S3 生效；本地模式回退到内部下载）
    const resp = await fetch(`/api/v1/storage/files/${fileId}/direct-url?ttl=600`)
    if (!resp.ok) {
      const status = resp.status
      if (status === 404) throw new Error('文件不存在或已被删除')
      if (status === 401) throw new Error('无权限下载此文件')
      if (status === 403) throw new Error('下载受限，请检查权限')
      throw new Error('直链获取失败')
    }
    const js = await resp.json() as { url: string }
    // 触发浏览器下载（遵循 302 或直链），不经过本服务的限速与并发闸门
    window.location.href = js.url

    toast({
      title: "开始下载",
      description: `文件 ${fallbackName} 即将开始下载`,
    })

    onSuccess?.(fallbackName)
  } catch (err: unknown) {
    console.error('下载失败:', err)

    let errorMessage = '下载失败'
    if (err && typeof err === 'object' && 'message' in err) {
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
