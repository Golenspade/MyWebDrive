export class AuthCookieMutationClosedError extends Error {
  constructor() {
    super('Authentication cookie mutation is closed')
    this.name = 'AuthCookieMutationClosedError'
  }
}

type QueueEntry = {
  task: () => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

type CoordinatorState = 'open' | 'closing' | 'closed'

/**
 * Serializes every response that can write the refresh cookie.
 *
 * Closing cancels queued work, waits for the already-started response to
 * settle, and runs logout last so no late Set-Cookie can restore a session.
 */
export class CookieMutationCoordinator {
  private state: CoordinatorState = 'open'
  private queue: QueueEntry[] = []
  private activeSettled: Promise<void> | null = null
  private logoutPromise: Promise<void> | null = null
  private singleFlights = new Map<string, Promise<unknown>>()

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.state !== 'open') return Promise.reject(new AuthCookieMutationClosedError())

    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve: (value) => resolve(value as T),
        reject,
      })
      this.pump()
    })
    return promise
  }

  runSingleFlight<T>(key: string, task: () => Promise<T>): Promise<T> {
    if (this.state !== 'open') return Promise.reject(new AuthCookieMutationClosedError())
    const existing = this.singleFlights.get(key)
    if (existing) return existing as Promise<T>

    const promise = this.run(task)
    this.singleFlights.set(key, promise)
    const clear = () => {
      if (this.singleFlights.get(key) === promise) this.singleFlights.delete(key)
    }
    void promise.then(clear, clear)
    return promise
  }

  closeAndLogout(logout: () => Promise<void>): Promise<void> {
    if (this.logoutPromise) return this.logoutPromise

    this.state = 'closing'
    const closedError = new AuthCookieMutationClosedError()
    for (const queued of this.queue.splice(0)) queued.reject(closedError)

    const activeSettled = this.activeSettled ?? Promise.resolve()
    this.logoutPromise = activeSettled
      .then(logout)
      .finally(() => {
        this.state = 'closed'
      })
    return this.logoutPromise
  }

  private pump() {
    if (this.state !== 'open' || this.activeSettled) return
    const next = this.queue.shift()
    if (!next) return

    const result = Promise.resolve().then(next.task)
    this.activeSettled = result.then(
      () => undefined,
      () => undefined,
    )
    void result.then(next.resolve, next.reject).finally(() => {
      this.activeSettled = null
      this.pump()
    })
  }
}
