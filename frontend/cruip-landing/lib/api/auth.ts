import { apiClient } from './client'

export type Role = 'user' | 'superuser' | 'admin'

export type AuthUser = {
  id: string
  email: string
  role: Role
  name?: string | null
  storageQuota?: number
  storageUsed?: number
  createdAt?: string
  updatedAt?: string
}

export type EmailChallenge = {
  challengeId: string
  expiresInSeconds: number
  resendAfterSeconds: number
}

export type SessionResponse = {
  accessToken: string
  expiresInSeconds: number
  user: AuthUser
}

export const authApi = {
  requestEmail: (email: string) =>
    apiClient.postNoRetry<EmailChallenge>('/auth/email/request', { email }),
  verifyEmail: (data: { challengeId: string; email: string; code: string }) =>
    apiClient.postNoRetry<SessionResponse>('/auth/email/verify', data),
  refresh: () =>
    apiClient.postNoRetry<{ accessToken: string; expiresInSeconds: number }>('/auth/refresh'),
  me: () => apiClient.get<AuthUser>('/auth/me'),
  logout: () => apiClient.postNoRetry<void>('/auth/logout'),
}
