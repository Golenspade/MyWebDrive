// Auth API wrappers
// Style: 2-space indent, single quotes, no semicolons

import { apiClient } from './client'

export type LoginRequest = { email: string; password: string }
export type RegisterRequest = { name: string; email: string; password: string; invitationCode?: string }
export type AuthResponse = { accessToken: string; refreshToken: string }

export const authApi = {
  login: (data: LoginRequest) => apiClient.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterRequest) => apiClient.post<AuthResponse>('/auth/register', data),
  logout: () => apiClient.post<void>('/auth/logout'),
  refresh: (refreshToken: string) => apiClient.postNoRetry<{ accessToken: string }>('/auth/refresh', { refreshToken }),
}

