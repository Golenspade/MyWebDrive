import { create } from 'zustand'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size?: number
  mimeType?: string
  parentId: string | null
  path: string
  createdAt: string
  updatedAt: string
}

interface FileState {
  currentFolderId: string | null
  files: FileItem[]
  selectedFiles: Set<string>
  isLoading: boolean
  uploadProgress: Map<string, number>
  
  setCurrentFolder: (folderId: string | null) => void
  fetchFiles: (folderId?: string) => Promise<void>
  createFolder: (name: string, parentId?: string) => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  deleteFolder: (folderId: string) => Promise<void>
  renameItem: (itemId: string, newName: string, type: 'file' | 'folder') => Promise<void>
  moveItem: (itemId: string, newParentId: string | null, type: 'file' | 'folder') => Promise<void>
  toggleFileSelection: (fileId: string) => void
  clearSelection: () => void
  selectAll: () => void
  setUploadProgress: (fileId: string, progress: number) => void
}

export const useFileStore = create<FileState>((set, get) => ({
  currentFolderId: null,
  files: [],
  selectedFiles: new Set(),
  isLoading: false,
  uploadProgress: new Map(),

  setCurrentFolder: (folderId) => {
    set({ currentFolderId: folderId })
  },

  fetchFiles: async (folderId = 'root') => {
    set({ isLoading: true })
    try {
      const endpoint = folderId === 'root' 
        ? '/folders/root/children' 
        : `/folders/${folderId}/children`
      
      const response = await api.get(endpoint)
      set({ 
        files: response.data.items,
        currentFolderId: folderId === 'root' ? null : folderId,
        isLoading: false 
      })
    } catch (error: unknown) {
      toast.error('获取文件列表失败')
      set({ isLoading: false })
    }
  },

  createFolder: async (name, parentId) => {
    try {
      await api.post('/folders', {
        name,
        parentId: parentId || get().currentFolderId
      })
      toast.success('文件夹创建成功')
      // 刷新文件列表
      await get().fetchFiles(get().currentFolderId || 'root')
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error || '创建文件夹失败'
        : '创建文件夹失败'
      toast.error(errorMessage)
    }
  },

  deleteFile: async (fileId) => {
    try {
      await api.delete(`/files/${fileId}`)
      toast.success('文件已删除')
      // 刷新文件列表
      await get().fetchFiles(get().currentFolderId || 'root')
    } catch (error: unknown) {
      toast.error('删除文件失败')
    }
  },

  deleteFolder: async (folderId) => {
    try {
      await api.delete(`/folders/${folderId}`)
      toast.success('文件夹已删除')
      // 刷新文件列表
      await get().fetchFiles(get().currentFolderId || 'root')
    } catch (error: unknown) {
      toast.error('删除文件夹失败')
    }
  },

  renameItem: async (itemId, newName, type) => {
    try {
      const endpoint = type === 'file' ? `/files/${itemId}` : `/folders/${itemId}`
      await api.patch(endpoint, { name: newName })
      toast.success('重命名成功')
      // 刷新文件列表
      await get().fetchFiles(get().currentFolderId || 'root')
    } catch (error: unknown) {
      toast.error('重命名失败')
    }
  },

  moveItem: async (itemId, newParentId, type) => {
    try {
      const endpoint = type === 'file'
        ? `/files/${itemId}/move`
        : `/folders/${itemId}/move`
      await api.post(endpoint, { newParentId })
      toast.success('移动成功')
      // 刷新文件列表
      await get().fetchFiles(get().currentFolderId || 'root')
    } catch (error: unknown) {
      toast.error('移动失败')
    }
  },

  toggleFileSelection: (fileId) => {
    set((state) => {
      const newSelection = new Set(state.selectedFiles)
      if (newSelection.has(fileId)) {
        newSelection.delete(fileId)
      } else {
        newSelection.add(fileId)
      }
      return { selectedFiles: newSelection }
    })
  },

  clearSelection: () => {
    set({ selectedFiles: new Set() })
  },

  selectAll: () => {
    set((state) => ({
      selectedFiles: new Set(state.files.map(f => f.id))
    }))
  },

  setUploadProgress: (fileId, progress) => {
    set((state) => {
      const newProgress = new Map(state.uploadProgress)
      if (progress >= 100) {
        newProgress.delete(fileId)
      } else {
        newProgress.set(fileId, progress)
      }
      return { uploadProgress: newProgress }
    })
  },
}))
