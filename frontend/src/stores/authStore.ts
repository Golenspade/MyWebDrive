import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'
import toast from 'react-hot-toast'

// 演示用的默认账号
const DEMO_ACCOUNTS = [
  {
    id: '1',
    name: '管理员',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin' as const,
    storageQuota: 107374182400, // 100GB
    storageUsed: 21474836480,   // 20GB
    uploadSlots: 0, // 管理员无限制
    pendingUploads: 0,
  },
  {
    id: '2', 
    name: '张三',
    email: 'user@example.com',
    password: 'user123',
    role: 'user' as const,
    storageQuota: 5368709120,   // 5GB
    storageUsed: 1073741824,    // 1GB
    uploadSlots: 3, // 用户最多3个slot
    pendingUploads: 1, // 当前有1个待审核
  },
  {
    id: '3',
    name: '李四',
    email: 'guest@example.com', 
    password: 'guest123',
    role: 'guest' as const,
    storageQuota: 0,   // 游客无存储空间
    storageUsed: 0,
    uploadSlots: 0, // 游客不能上传
    pendingUploads: 0,
  }
]

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
  storageQuota: number
  storageUsed: number
  uploadSlots: number // 上传slot数量限制
  pendingUploads: number // 当前待审核的上传数量
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, invitationCode?: string) => Promise<void>
  logout: () => void
  clearAuth: () => void // 清除所有认证状态
  refreshAccessToken: () => Promise<void>
  fetchUserProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          // 首先尝试使用演示账号
          const demoAccount = DEMO_ACCOUNTS.find(
            account => account.email === email && account.password === password
          )
          
          if (demoAccount) {
            // 使用演示账号登录
            const { password: _, ...user } = demoAccount
            set({
              user,
              accessToken: 'demo-token-' + demoAccount.id,
              refreshToken: 'demo-refresh-' + demoAccount.id,
              isAuthenticated: true,
            })
            toast.success(`欢迎回来，${demoAccount.name}！`)
            return
          }

          // 如果不是演示账号，尝试调用真实API
          const response = await api.post('/auth/login', { email, password })
          const { accessToken, refreshToken } = response.data
          
          set({
            accessToken,
            refreshToken,
            isAuthenticated: true,
          })

          // 获取用户信息
          await get().fetchUserProfile()
          
          toast.success('登录成功！')
        } catch (error: unknown) {
          const errorMessage = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { error?: string } } }).response?.data?.error || '登录失败，请检查邮箱和密码'
            : '登录失败，请检查邮箱和密码'
          toast.error(errorMessage)
          throw error
        }
      },

      register: async (name: string, email: string, password: string, invitationCode?: string) => {
        try {
          const payload: { name: string; email: string; password: string; invitationCode?: string } = {
            name,
            email,
            password,
          }

          if (invitationCode) {
            payload.invitationCode = invitationCode.trim()
          }

          await api.post('/auth/register', payload)
          toast.success('注册成功！请登录')
        } catch (error: unknown) {
          const errorMessage = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { error?: string } } }).response?.data?.error || '注册失败'
            : '注册失败'
          toast.error(errorMessage)
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
        toast.success('已退出登录')
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
        // 清除localStorage中的认证数据
        localStorage.removeItem('auth-storage')
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken
        if (!refreshToken) {
          get().logout()
          return
        }

        try {
          const response = await api.post('/auth/refresh', { refreshToken })
          const { accessToken } = response.data
          set({ accessToken })
        } catch (error) {
          get().logout()
          throw error
        }
      },

      fetchUserProfile: async () => {
        try {
          const response = await api.get('/users/me')
          set({ user: response.data })
        } catch (error: unknown) {
          console.error('Failed to fetch user profile:', error)

          // 如果是401错误，说明token无效，清除认证状态
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number } }
            if (axiosError.response?.status === 401) {
              console.warn('Token invalid, clearing auth state')
              get().logout()
            }
          }

          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
