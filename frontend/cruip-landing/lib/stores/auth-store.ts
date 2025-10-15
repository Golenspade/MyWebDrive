// Auth state store with persist and API integration
// Style: 2-space indent, single quotes, no semicolons

'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authApi } from '@/lib/api/auth'
import { usersApi, type User } from '@/lib/api/users'
import { apiClient } from '@/lib/api/client'

type Role = 'user' | 'admin'

function parseJwt(token: string | null): any | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(Array.prototype.map.call(payload, (c: string) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join('')))
  } catch {
    try {
      return JSON.parse(atob(parts[1]))
    } catch {
      return null
    }
  }
}

type AuthState = {
  user: User | null
  role: Role | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  hasHydrated: boolean

  setHasHydrated: () => void
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; password: string; invitationCode?: string }) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
          const auth = await authApi.login({ email, password })
          set({ accessToken: auth.accessToken, refreshToken: auth.refreshToken })
          const me = await usersApi.me()
          const decoded = parseJwt(auth.accessToken)
          const role: Role = (decoded?.role as Role) || (me.role as Role) || 'user'
          set({ user: me, role, isAuthenticated: true })
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (data) => {
        set({ isLoading: true })
        try {
          const auth = await authApi.register(data)
          set({ accessToken: auth.accessToken, refreshToken: auth.refreshToken })
          const me = await usersApi.me()
          const decoded = parseJwt(auth.accessToken)
          const role: Role = (decoded?.role as Role) || (me.role as Role) || 'user'
          set({ user: me, role, isAuthenticated: true })
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        try { await authApi.logout() } catch {}
        set({ user: null, role: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      refreshAccessToken: async () => {
        const rt = get().refreshToken
        if (!rt) throw new Error('No refresh token')
        const res = await authApi.refresh(rt)
        set({ accessToken: res.accessToken })
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user, role: s.role, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // after hydration, mark ready
        state?.setHasHydrated()
      },
    }
  )
)

// Wire store to apiClient for token refresh & injection
apiClient.setAuthHandlers({
  getToken: () => useAuthStore.getState().accessToken,
  refreshToken: async () => {
    await useAuthStore.getState().refreshAccessToken()
    return useAuthStore.getState().accessToken as string
  },
  onAuthError: () => {
    useAuthStore.setState({ user: null, role: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },
})

