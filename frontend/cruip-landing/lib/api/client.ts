// API client with bearer injection, cookie sessions and single-flight refresh.

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
  refreshSession: () => Promise<string>
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
    return this.requestJson<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown, options: RequestInit = {}) {
    return this.requestJson<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data != null ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown, options: RequestInit = {}) {
    return this.requestJson<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data != null ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: unknown, options: RequestInit = {}) {
    return this.requestJson<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data != null ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string, options: RequestInit = {}) {
    return this.requestJson<T>(endpoint, { ...options, method: 'DELETE' })
  }

  async postNoRetry<T>(endpoint: string, data?: unknown, options: RequestInit = {}) {
    return this.requestJson<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data != null ? JSON.stringify(data) : undefined,
    }, true)
  }

  async raw(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return this.requestResponse(endpoint, options)
  }

  private async requestJson<T>(
    endpoint: string,
    options: RequestInit = {},
    noRetry = false,
  ): Promise<T> {
    const response = await this.requestResponse(endpoint, options, noRetry)
    if (response.status === 204 || response.status === 205) return undefined as T
    return response.json() as Promise<T>
  }

  private async requestResponse(
    endpoint: string,
    options: RequestInit = {},
    noRetry = false,
  ): Promise<Response> {
    const token = this.authHandlers?.getToken()
    const hasBody = options.body != null
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(hasBody && typeof options.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })

    if (response.ok) return response

    if (response.status === 401 && !noRetry && this.authHandlers) {
      try {
        await this.handleTokenRefresh()
        return this.requestResponse(endpoint, options, true)
      } catch {
        this.authHandlers.onAuthError()
      }
    }

    throw await this.parseError(response)
  }

  private async parseError(response: Response): Promise<ApiError> {
    let code = 'UNKNOWN_ERROR'
    let message = response.statusText || 'Request failed'
    try {
      const body = (await response.json()) as unknown
      if (body && typeof body === 'object') {
        const err = (body as { error?: string | { code?: string; message?: string } }).error
        if (typeof err === 'string') {
          code = 'API_ERROR'
          message = err
        } else if (err && typeof err === 'object') {
          code = err.code || code
          message = err.message || message
        }
      }
    } catch {
      // Preserve the HTTP status text when the response is not JSON.
    }
    return new ApiError(response.status, code, message)
  }

  private async handleTokenRefresh(): Promise<void> {
    if (!this.authHandlers) throw new Error('Auth handlers not set')
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = (async () => {
      try {
        await this.authHandlers!.refreshSession()
      } finally {
        this.refreshPromise = null
      }
    })()
    return this.refreshPromise
  }
}

export const apiClient = new ApiClient()
