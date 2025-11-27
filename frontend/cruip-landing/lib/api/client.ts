// API client with token injection, single-flight refresh, and unified error parsing
// Style: 2-space indent, single quotes, no semicolons

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type AuthHandlers = {
  getToken: () => string | null
  refreshToken: () => Promise<string>
  onAuthError: () => void
}

class ApiClient {
  private baseUrl = '/api/v1'
  private authHandlers: AuthHandlers | null = null
  private refreshPromise: Promise<void> | null = null

  setAuthHandlers(handlers: AuthHandlers) {
    this.authHandlers = handlers
  }

  async get<T>(endpoint: string, options: RequestInit = {}) {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data != null ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data != null ? JSON.stringify(data) : undefined,
    })
  }


  async patch<T>(endpoint: string, data?: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data != null ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string, options: RequestInit = {}) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  async postNoRetry<T>(endpoint: string, data?: any, options: RequestInit = {}) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data != null ? JSON.stringify(data) : undefined,
    }, true)
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, noRetry = false): Promise<T> {
    const token = this.authHandlers?.getToken()
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })

    if (response.status === 204 || response.status === 205) {
      return undefined as T
    }

    if (!response.ok) {
      const error = await this.parseError(response)
      if (response.status === 401 && !noRetry && this.authHandlers) {
        try {
          await this.handleTokenRefresh()
          return this.request<T>(endpoint, options, true)
        } catch {
          this.authHandlers.onAuthError()
          throw error
        }
      }
      throw error
    }

    return response.json()
  }

  private async parseError(response: Response): Promise<ApiError> {
    let code = 'UNKNOWN_ERROR'
    let message = response.statusText || 'Request failed'
    try {
      const body: any = await response.json()
      if (typeof body?.error === 'string') {
        code = 'API_ERROR'
        message = body.error
      } else if (body?.error && typeof body.error === 'object') {
        code = body.error.code || code
        message = body.error.message || message
      }
    } catch {
      // ignore parse failure
    }
    return new ApiError(response.status, code, message)
  }

  private async handleTokenRefresh(): Promise<void> {
    if (!this.authHandlers) throw new Error('Auth handlers not set')
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = (async () => {
      try {
        await this.authHandlers!.refreshToken()
      } finally {
        this.refreshPromise = null
      }
    })()
    return this.refreshPromise
  }
}

export const apiClient = new ApiClient()

