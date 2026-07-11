'use client'

import { create } from 'zustand'
import { authApi, type AuthUser, type EmailChallenge } from '@/lib/api/auth'
import { apiClient } from '@/lib/api/client'
import { CookieMutationCoordinator } from '@/lib/auth/cookie-mutation-coordinator'

type Role = 'user' | 'admin'

type AuthState = {
  user: AuthUser | null
  role: Role | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  hasHydrated: boolean
  requestEmailCode: (email: string) => Promise<EmailChallenge>
  verifyEmailCode: (data: { challengeId: string; email: string; code: string }) => Promise<void>
  bootstrap: () => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<string>
}

let bootstrapPromise: Promise<void> | null = null
let authEpoch = 0
const cookieMutations = new CookieMutationCoordinator()

function refreshCookieSession() {
  return cookieMutations.runSingleFlight('refresh', () => authApi.refresh())
}

function signedOutState() {
  return {
    user: null,
    role: null,
    accessToken: null,
    isAuthenticated: false,
  } as const
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...signedOutState(),
  isLoading: false,
  hasHydrated: false,

  requestEmailCode: async (rawEmail) => {
    const email = rawEmail.trim().toLowerCase()
    set({ isLoading: true })
    try {
      return await authApi.requestEmail(email)
    } finally {
      set({ isLoading: false })
    }
  },

  verifyEmailCode: async ({ challengeId, email: rawEmail, code }) => {
    const email = rawEmail.trim().toLowerCase()
    set({ isLoading: true })
    try {
      const verified = await cookieMutations.runSingleFlight(`verify:${challengeId}`, async () => {
        const attemptEpoch = ++authEpoch
        const session = await authApi.verifyEmail({ challengeId, email, code })
        return { attemptEpoch, session }
      })
      const { attemptEpoch, session } = verified
      if (authEpoch !== attemptEpoch) return
      set({
        accessToken: session.accessToken,
        user: session.user,
        role: session.user.role,
        isAuthenticated: true,
        hasHydrated: true,
      })
    } finally {
      set({ isLoading: false })
    }
  },

  bootstrap: async () => {
    if (get().hasHydrated) return
    if (bootstrapPromise) return bootstrapPromise
    const startingEpoch = authEpoch
    bootstrapPromise = (async () => {
      try {
        const session = await refreshCookieSession()
        if (authEpoch !== startingEpoch) return
        set({ accessToken: session.accessToken })
        const user = await authApi.me()
        if (authEpoch !== startingEpoch) return
        set({
          user,
          role: user.role,
          isAuthenticated: true,
        })
      } catch {
        if (authEpoch === startingEpoch) set(signedOutState())
      } finally {
        set({ hasHydrated: true })
        bootstrapPromise = null
      }
    })()
    return bootstrapPromise
  },

  logout: async () => {
    authEpoch += 1
    set({ ...signedOutState(), hasHydrated: true })
    try {
      await cookieMutations.closeAndLogout(() => authApi.logout())
    } catch {
      // Local session state must still be cleared if the network is unavailable.
    }
    if (typeof window !== 'undefined') window.location.assign('/signin')
  },

  refreshAccessToken: async () => {
    const startingEpoch = authEpoch
    const session = await refreshCookieSession()
    if (authEpoch !== startingEpoch) throw new Error('Session changed during refresh')
    set({ accessToken: session.accessToken })
    return session.accessToken
  },
}))

apiClient.setAuthHandlers({
  getToken: () => useAuthStore.getState().accessToken,
  refreshSession: () => useAuthStore.getState().refreshAccessToken(),
  onAuthError: () => {
    authEpoch += 1
    useAuthStore.setState({ ...signedOutState(), hasHydrated: true })
  },
})
