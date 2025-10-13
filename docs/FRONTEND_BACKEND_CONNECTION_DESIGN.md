# 前后端连接设计文档

> **分支**: `设计后端链接版本`
> **版本**: v1.0 - 改进版
> **日期**: 2025-10-13

本文档描述如何将 MyWebDrive 前端（Next.js 15）与后端微服务（Node.js）连接，实现完整的用户认证、状态管理和权限控制。

---

## 📋 目录

1. [总体架构](#总体架构)
2. [技术栈](#技术栈)
3. [目录结构](#目录结构)
4. [核心模块实现](#核心模块实现)
5. [错误处理与边界情况](#错误处理与边界情况)
6. [Token 刷新机制](#token-刷新机制)
7. [路由保护](#路由保护)
8. [管理员面板](#管理员面板)
9. [测试方案](#测试方案)

---

## 总体架构

```
┌─────────────────────────────────────────────────────┐
│                 Next.js Frontend                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  UI Components (Pages/Forms)                 │   │
│  └────────────┬─────────────────────────────────┘   │
│               │                                      │
│  ┌────────────▼─────────────────────────────────┐   │
│  │  Auth Store (Zustand + Persist)              │   │
│  │  - user, tokens, isAuthenticated             │   │
│  │  - login(), register(), logout()             │   │
│  └────────────┬─────────────────────────────────┘   │
│               │                                      │
│  ┌────────────▼─────────────────────────────────┐   │
│  │  API Layer (auth.ts, admin.ts, users.ts)    │   │
│  └────────────┬─────────────────────────────────┘   │
│               │                                      │
│  ┌────────────▼─────────────────────────────────┐   │
│  │  API Client (client.ts)                      │   │
│  │  - request interceptor                       │   │
│  │  - auto token refresh (single-flight)       │   │
│  │  - unified error handling                    │   │
│  └────────────┬─────────────────────────────────┘   │
└───────────────┼─────────────────────────────────────┘
                │ /api/v1/* (Next.js rewrites)
                ▼
┌───────────────────────────────────────────────────┐
│  API Gateway (Node.js :9080)                      │
│  ┌─────────────────────────────────────────────┐ │
│  │  Auth Service    │  User Service            │ │
│  │  :7081          │  :7082                    │ │
│  └─────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**设计原则**：
- ✅ **分层解耦**：UI → Store → API → Client
- ✅ **单一职责**：Client 只负责 HTTP，Store 负责状态
- ✅ **依赖注入**：避免循环依赖，通过回调注入认证逻辑
- ✅ **错误规范化**：统一错误格式和处理流程
- ✅ **自动恢复**：Token 刷新单航班控制，避免重试风暴

---

## 技术栈

| 类别 | 技术 | 说明 |
|-----|------|------|
| 状态管理 | Zustand + persist | 轻量、简单、持久化支持 |
| HTTP 客户端 | fetch (原生) | 无额外依赖，Next.js 友好 |
| 表单验证 | React Hook Form + Zod | 类型安全、性能优化 |
| 错误提示 | Sonner (Toast) | 轻量级通知组件 |
| Token 存储 | localStorage | 可升级为 httpOnly cookie |

---

## 目录结构

```
frontend/cruip-landing/
├── lib/
│   ├── api/
│   │   ├── client.ts              # ✅ API 基础客户端（改进版）
│   │   ├── auth.ts                # 认证 API
│   │   ├── users.ts               # 用户 API (GET /users/me)
│   │   └── admin.ts               # 管理员 API
│   ├── stores/
│   │   └── auth-store.ts          # ✅ 认证状态管理（改进版）
│   ├── hooks/
│   │   ├── use-auth.ts            # 认证 hooks
│   │   └── use-protected.ts       # 路由保护 hook
│   └── types/
│       └── auth.ts                # 类型定义
├── components/
│   ├── auth/
│   │   ├── login-form.tsx         # 登录表单
│   │   ├── register-form.tsx      # 注册表单
│   │   └── protected-route.tsx    # ✅ 路由保护（改进版）
│   └── admin/
│       ├── invitation-manager.tsx # 邀请码管理
│       └── user-list.tsx          # 用户列表
└── app/
    ├── (auth)/
    │   ├── signin/page.tsx
    │   └── signup/page.tsx
    └── admin/
        ├── layout.tsx             # 管理员布局（需 admin 角色）
        └── invitations/page.tsx
```

---

## 核心模块实现

### 1. API Client（改进版）

**关键改进**：
- ✅ 处理 204/205 空响应
- ✅ 统一错误格式解析（支持两种后端错误格式）
- ✅ 依赖注入认证回调，避免循环依赖
- ✅ 单航班 Token 刷新
- ✅ 刷新端点白名单（避免递归）

```typescript
// lib/api/client.ts

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 认证回调接口（避免循环依赖）
interface AuthHandlers {
  getToken: () => string | null
  refreshToken: () => Promise<string>
  onAuthError: () => void
}

class ApiClient {
  private baseUrl = '/api/v1' // Next.js rewrites 已配置
  private authHandlers: AuthHandlers | null = null
  private refreshPromise: Promise<void> | null = null // 单航班控制

  // 依赖注入：Store 初始化后调用此方法
  setAuthHandlers(handlers: AuthHandlers) {
    this.authHandlers = handlers
  }

  // 基础请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    noRetry = false // 标记是否禁止重试（如刷新端点）
  ): Promise<T> {
    const token = this.authHandlers?.getToken()

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    })

    // 处理 204/205 空响应
    if (response.status === 204 || response.status === 205) {
      return undefined as T
    }

    if (!response.ok) {
      const error = await this.parseError(response)

      // 401 且允许重试 → 尝试刷新 Token
      if (response.status === 401 && !noRetry && this.authHandlers) {
        try {
          await this.handleTokenRefresh()
          // 重试原请求（只重试一次）
          return this.request<T>(endpoint, options, true)
        } catch {
          // 刷新失败 → 清除登录状态
          this.authHandlers.onAuthError()
          throw error
        }
      }

      throw error
    }

    return response.json()
  }

  // 统一错误解析（兼容两种后端格式）
  private async parseError(response: Response): Promise<ApiError> {
    const body = await response.json().catch(() => ({} as any))

    let code = 'UNKNOWN_ERROR'
    let message = response.statusText

    // 格式 1: { error: "Invalid credentials" }
    if (typeof body.error === 'string') {
      code = 'API_ERROR'
      message = body.error
    }
    // 格式 2: { error: { code: "INTERNAL_ERROR", message: "..." } }
    else if (body.error && typeof body.error === 'object') {
      code = body.error.code || code
      message = body.error.message || message
    }

    return new ApiError(response.status, code, message)
  }

  // 单航班 Token 刷新
  private async handleTokenRefresh(): Promise<void> {
    if (!this.authHandlers) throw new Error('Auth handlers not set')

    // 已有刷新请求在进行中 → 等待同一个 Promise
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      try {
        await this.authHandlers!.refreshToken()
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  // 公开方法
  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  post<T>(endpoint: string, data?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  patch<T>(endpoint: string, data?: any, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  // 无需重试的请求（如刷新端点）
  postNoRetry<T>(endpoint: string, data?: any, options?: RequestInit) {
    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      true // 禁止重试
    )
  }
}

export const apiClient = new ApiClient()
```

---

### 2. API 层

```typescript
// lib/api/auth.ts
import { apiClient } from './client'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  invitationCode?: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  // 注意：登录只返回 token，用户信息需另外获取
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/auth/login', data),

  register: (data: RegisterRequest) =>
    apiClient.post<AuthResponse>('/auth/register', data),

  logout: () =>
    apiClient.post<void>('/auth/logout'), // 返回 204，已支持

  // 刷新端点使用 postNoRetry 避免递归
  refresh: (refreshToken: string) =>
    apiClient.postNoRetry<{ accessToken: string }>('/auth/refresh', {
      refreshToken,
    }),
}

// lib/api/users.ts
export interface User {
  id: string
  name: string
  email: string
  storageQuota: number
  storageUsed: number
  createdAt: string
  updatedAt: string
}

export const usersApi = {
  // 获取当前用户信息（需要从 User 服务获取，Auth 服务只负责认证）
  me: () => apiClient.get<User>('/users/me'),
}

// lib/api/admin.ts
export interface InvitationCode {
  id: string
  code: string
  issuedBy: string
  issuedAt: string
  expiresAt: string | null
  usageLimit: number
  usedCount: number
  isActive: boolean
  notes: string | null
}

export const adminApi = {
  createInvitation: (data: {
    usageLimit?: number
    expiresAt?: string
    notes?: string
  }) => apiClient.post<InvitationCode>('/auth/invitations', data),

  listInvitations: () =>
    apiClient.get<InvitationCode[]>('/auth/invitations'),

  getInvitation: (code: string) =>
    apiClient.get<InvitationCode>(`/auth/invitations/${code}`),

  revokeInvitation: (code: string) =>
    apiClient.post<{ message: string }>(`/auth/invitations/${code}/revoke`),
}
```

---

### 3. Zustand Store（改进版）

**关键改进**：
- ✅ 登录后调用 `/users/me` 获取完整用户信息
- ✅ 注入认证回调到 `apiClient`
- ✅ 等待 hydration 完成标记
- ✅ 刷新逻辑解耦

```typescript
// lib/stores/auth-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authApi } from '@/lib/api/auth'
import { usersApi, User } from '@/lib/api/users'
import { apiClient } from '@/lib/api/client'

interface AuthState {
  // 状态
  user: User | null
  role: 'user' | 'admin' | null // 从 JWT 解析或 /users/me 获取
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  hasHydrated: boolean // 持久化恢复完成标记

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<void>
  setHasHydrated: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      role: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,

      setHasHydrated: () => set({ hasHydrated: true }),

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          // 1. 获取 Token
          const authResponse = await authApi.login({ email, password })

          // 2. 临时设置 Token（用于后续请求）
          set({
            accessToken: authResponse.accessToken,
            refreshToken: authResponse.refreshToken,
          })

          // 3. 获取用户完整信息（从 User 服务）
          const user = await usersApi.me()

          // 4. 解析角色（从 JWT 或用户信息）
          const decodedToken = parseJwt(authResponse.accessToken)
          const role = decodedToken?.role || 'user'

          // 5. 更新完整状态
          set({
            user,
            role,
            isAuthenticated: true,
          })
        } catch (error) {
          // 登录失败清除状态
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            role: null,
            isAuthenticated: false,
          })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (data) => {
        set({ isLoading: true })
        try {
          // 注册后逻辑与登录相同
          const authResponse = await authApi.register(data)

          set({
            accessToken: authResponse.accessToken,
            refreshToken: authResponse.refreshToken,
          })

          const user = await usersApi.me()
          const decodedToken = parseJwt(authResponse.accessToken)
          const role = decodedToken?.role || 'user'

          set({
            user,
            role,
            isAuthenticated: true,
          })
        } catch (error) {
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            role: null,
            isAuthenticated: false,
          })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          // 忽略登出错误（网络问题也允许本地清除）
        } finally {
          set({
            user: null,
            role: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        const response = await authApi.refresh(refreshToken)

        // 更新 accessToken，refreshToken 保持不变
        set({ accessToken: response.accessToken })
      },
    }),
    {
      name: 'mywebdrive-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只持久化这些字段
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        role: state.role,
      }),
      onRehydrateStorage: () => (state) => {
        // 持久化恢复完成后标记
        state?.setHasHydrated()
      },
    }
  )
)

// 初始化：注入认证回调到 apiClient
apiClient.setAuthHandlers({
  getToken: () => useAuthStore.getState().accessToken,
  refreshToken: async () => {
    await useAuthStore.getState().refreshAccessToken()
  },
  onAuthError: () => {
    useAuthStore.getState().logout()
  },
})

// 工具函数：解析 JWT（不验证签名，仅提取 payload）
function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}
```

---

### 4. 路由保护（改进版）

**关键改进**：
- ✅ 等待 hydration 完成再判断
- ✅ Loading 骨架屏，避免闪烁
- ✅ 角色权限检查

```typescript
// components/auth/protected-route.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode
  requireAdmin?: boolean
}) {
  const router = useRouter()
  const { isAuthenticated, role, hasHydrated } = useAuthStore()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // 等待持久化恢复完成
    if (!hasHydrated) return

    // 未登录 → 重定向登录页
    if (!isAuthenticated) {
      router.push('/signin')
      return
    }

    // 需要管理员但不是管理员 → 重定向首页
    if (requireAdmin && role !== 'admin') {
      router.push('/')
      return
    }

    // 权限检查通过
    setIsReady(true)
  }, [isAuthenticated, role, requireAdmin, hasHydrated, router])

  // Loading 骨架屏
  if (!hasHydrated || !isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return <>{children}</>
}
```

---

### 5. 登录表单实现

```typescript
// components/auth/login-form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/auth-store'
import { ApiError } from '@/lib/api/client'
import { toast } from 'sonner' // 可选：更好的用户反馈

export function LoginForm() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('请填写所有字段')
      return
    }

    try {
      await login(email, password)
      toast.success('登录成功')
      router.push('/dashboard') // 根据实际路由调整
    } catch (err) {
      if (err instanceof ApiError) {
        // 根据错误 code 提供友好提示
        const friendlyMessage = {
          'Invalid credentials': '邮箱或密码错误',
          API_ERROR: err.message,
          UNKNOWN_ERROR: '登录失败，请稍后重试',
        }[err.code] || err.message

        setError(friendlyMessage)
        toast.error(friendlyMessage)
      } else {
        setError('网络错误，请检查连接')
        toast.error('网络错误')
      }
    }
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold">登录到您的账户</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="email"
            >
              邮箱
            </label>
            <input
              id="email"
              className="form-input w-full py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="password"
            >
              密码
            </label>
            <input
              id="password"
              className="form-input w-full py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="btn w-full bg-gradient-to-t from-brand-primary-600 to-brand-primary-500 text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          还没有账户？
          <Link
            href="/signup"
            className="ml-1 text-brand-primary-600 hover:underline"
          >
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}
```

---

### 6. 注册表单实现

```typescript
// components/auth/register-form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/auth-store'
import { ApiError } from '@/lib/api/client'
import { toast } from 'sonner'

export function RegisterForm() {
  const router = useRouter()
  const { register, isLoading } = useAuthStore()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    invitationCode: '', // 添加邀请码字段
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name || !formData.email || !formData.password) {
      setError('请填写所有必填字段')
      return
    }

    // 密码强度检查（可选）
    if (formData.password.length < 8) {
      setError('密码至少需要 8 个字符')
      return
    }

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        invitationCode: formData.invitationCode || undefined,
      })
      toast.success('注册成功')
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        const friendlyMessage = {
          'Email already exists': '该邮箱已被注册',
          'Invalid or expired invitation code': '邀请码无效或已过期',
          API_ERROR: err.message,
        }[err.code] || err.message

        setError(friendlyMessage)
        toast.error(friendlyMessage)
      } else {
        setError('注册失败，请稍后重试')
      }
    }
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold">创建您的账户</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="name">
              姓名 *
            </label>
            <input
              id="name"
              type="text"
              className="form-input w-full py-2"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="张三"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
              邮箱 *
            </label>
            <input
              id="email"
              type="email"
              className="form-input w-full py-2"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
              密码 * <span className="text-xs text-gray-500">(至少 8 位)</span>
            </label>
            <input
              id="password"
              type="password"
              className="form-input w-full py-2"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="invitationCode"
            >
              邀请码 <span className="text-xs text-gray-500">(如需要)</span>
            </label>
            <input
              id="invitationCode"
              type="text"
              className="form-input w-full py-2"
              value={formData.invitationCode}
              onChange={(e) => setFormData({ ...formData, invitationCode: e.target.value })}
              placeholder="INV-XXXXXXXX"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="btn w-full bg-gradient-to-t from-brand-primary-600 to-brand-primary-500 text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '注册中...' : '注册'}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          已有账户？
          <Link href="/signin" className="ml-1 text-brand-primary-600 hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}
```

---

## 错误处理与边界情况

### 错误类型映射

| 后端错误 | HTTP 状态 | 友好提示 |
|---------|----------|---------|
| Invalid credentials | 401 | 邮箱或密码错误 |
| Email already exists | 409 | 该邮箱已被注册 |
| Invalid or expired invitation code | 403 | 邀请码无效或已过期 |
| Admin access required | 403 | 需要管理员权限 |
| INTERNAL_ERROR | 500 | 服务器错误，请稍后重试 |

### 边界情况处理

1. **网络断开**：显示友好错误，允许重试
2. **Token 过期**：自动刷新（单航班控制）
3. **刷新失败**：清除登录状态，重定向登录页
4. **并发请求 401**：共享同一个 `refreshPromise`，避免多次刷新
5. **Hydration 未完成**：显示 Loading，避免误跳转
6. **204 响应**：返回 `undefined`，不尝试解析 JSON

---

## Token 刷新机制

### 流程图

```
┌─────────────────────────────────────────────────┐
│ Request 1 → 401                                 │
│   ↓                                             │
│ Check refreshPromise → null                     │
│   ↓                                             │
│ Create refreshPromise = refresh()               │
│   ↓                                             │
│ await refreshPromise                            │
│   ↓                                             │
│ Retry Request 1 (with new token)                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Request 2 → 401 (同时发生)                      │
│   ↓                                             │
│ Check refreshPromise → exists!                  │
│   ↓                                             │
│ await refreshPromise (等待同一个 Promise)       │
│   ↓                                             │
│ Retry Request 2 (with new token)                │
└─────────────────────────────────────────────────┘
```

### 关键代码

```typescript
// 单航班控制
private refreshPromise: Promise<void> | null = null

private async handleTokenRefresh(): Promise<void> {
  if (this.refreshPromise) {
    return this.refreshPromise // 等待已存在的刷新
  }

  this.refreshPromise = (async () => {
    try {
      await this.authHandlers!.refreshToken()
    } finally {
      this.refreshPromise = null // 完成后重置
    }
  })()

  return this.refreshPromise
}
```

---

## 管理员面板

### 邀请码管理页面

```typescript
// app/admin/invitations/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { adminApi, InvitationCode } from '@/lib/api/admin'
import { ApiError } from '@/lib/api/client'
import { toast } from 'sonner'

export default function InvitationsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <InvitationManager />
    </ProtectedRoute>
  )
}

function InvitationManager() {
  const [invitations, setInvitations] = useState<InvitationCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadInvitations()
  }, [])

  const loadInvitations = async () => {
    try {
      const data = await adminApi.listInvitations()
      setInvitations(data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(`加载失败: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const createInvitation = async () => {
    setCreating(true)
    try {
      await adminApi.createInvitation({
        usageLimit: 10,
        notes: '手动创建',
      })
      toast.success('邀请码创建成功')
      await loadInvitations()
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(`创建失败: ${err.message}`)
      }
    } finally {
      setCreating(false)
    }
  }

  const revokeInvitation = async (code: string) => {
    if (!confirm('确定要撤销此邀请码吗？')) return

    try {
      await adminApi.revokeInvitation(code)
      toast.success('邀请码已撤销')
      await loadInvitations()
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(`撤销失败: ${err.message}`)
      }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">邀请码管理</h1>
        <button
          onClick={createInvitation}
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? '创建中...' : '创建邀请码'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                邀请码
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                使用情况
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                过期时间
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                状态
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                备注
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invitations.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{inv.code}</td>
                <td className="px-4 py-3 text-sm">
                  {inv.usedCount} / {inv.usageLimit}
                </td>
                <td className="px-4 py-3 text-sm">
                  {inv.expiresAt
                    ? new Date(inv.expiresAt).toLocaleString('zh-CN')
                    : '永不过期'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      inv.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {inv.isActive ? '有效' : '已撤销'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {inv.notes || '-'}
                </td>
                <td className="px-4 py-3">
                  {inv.isActive && (
                    <button
                      onClick={() => revokeInvitation(inv.code)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      撤销
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          暂无邀请码，点击上方按钮创建
        </div>
      )}
    </div>
  )
}
```

---

## 测试方案

### 1. 手动测试清单

```bash
# 1. 启动后端
./manage-services.sh start-backend

# 2. 创建管理员账户
pnpm --filter services/auth db:seed

# 3. 启动前端
cd frontend/cruip-landing
pnpm dev

# 4. 测试流程
✅ 访问 http://localhost:3100/signin
✅ 使用 admin@local / admin123456 登录
✅ 验证自动跳转到 /dashboard
✅ 访问 /admin/invitations（管理员面板）
✅ 创建邀请码
✅ 登出
✅ 使用新邀请码注册新用户
✅ 验证普通用户无法访问 /admin
```

### 2. 集成测试（可选）

```typescript
// __tests__/auth-flow.test.ts
import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '@/lib/stores/auth-store'

describe('Auth Flow', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuthStore())

    await act(async () => {
      await result.current.login('admin@local', 'admin123456')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).not.toBeNull()
    expect(result.current.role).toBe('admin')
  })

  it('should handle login failure', async () => {
    const { result } = renderHook(() => useAuthStore())

    await expect(
      act(async () => {
        await result.current.login('wrong@email.com', 'wrongpassword')
      })
    ).rejects.toThrow()

    expect(result.current.isAuthenticated).toBe(false)
  })
})
```

---

## 部署注意事项

### 环境变量

```bash
# frontend/cruip-landing/.env.local
API_BASE_URL=http://localhost:9080  # 开发环境
# API_BASE_URL=https://api.mywebdrive.com  # 生产环境
```

### 生产优化

1. **Token 存储升级**：使用 httpOnly cookie 存储 refresh token
2. **CORS 配置**：后端设置 `CORS_ALLOWED_ORIGINS`
3. **CSP 策略**：添加 Content Security Policy
4. **Rate Limiting**：防止暴力破解（后端已支持）
5. **HTTPS Only**：生产环境强制 HTTPS

---

## 总结

### ✅ 改进点

1. **204 响应处理**：正确处理空响应
2. **错误格式统一**：兼容两种后端错误格式
3. **循环依赖解决**：依赖注入认证回调
4. **单航班刷新**：避免并发刷新风暴
5. **完整用户信息**：登录后调用 `/users/me`
6. **Hydration 等待**：避免路由跳转闪烁

### 📦 依赖清单

```json
{
  "dependencies": {
    "zustand": "^4.5.0",
    "sonner": "^1.3.1"
  },
  "devDependencies": {
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.0"
  }
}
```

### 🚀 下一步

1. 实现密码重置功能
2. 添加 OAuth 登录（GitHub/Google）
3. 实现双因素认证（2FA）
4. 用户管理页面（管理员）
5. 活动日志（登录历史）

---

**版本历史**：
- v1.0 (2025-10-13): 初始版本，修正所有评价中的问题
