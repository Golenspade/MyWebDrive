export type ResourceState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'stale' | 'unavailable'
  data: T | null
  error: string | null
  updatedAt: string | null
}

export function emptyResource<T>(): ResourceState<T> {
  return { status: 'idle', data: null, error: null, updatedAt: null }
}

export function loadingResource<T>(previous: ResourceState<T>): ResourceState<T> {
  return { ...previous, status: 'loading', error: null }
}

export function readyResource<T>(data: T, updatedAt = new Date().toISOString()): ResourceState<T> {
  return { status: 'ready', data, error: null, updatedAt }
}

export function rejectedResource<T>(previous: ResourceState<T>, error: unknown): ResourceState<T> {
  const message = error instanceof Error ? error.message : 'Request failed'
  return {
    status: previous.data ? 'stale' : 'unavailable',
    data: previous.data,
    error: message,
    updatedAt: previous.updatedAt,
  }
}
