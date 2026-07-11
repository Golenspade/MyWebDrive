import { describe, expect, test } from 'vitest'

import {
  AuthCookieMutationClosedError,
  CookieMutationCoordinator,
} from '../cookie-mutation-coordinator'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function nextMicrotask() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('CookieMutationCoordinator', () => {
  test('waits for an active refresh before making logout the final cookie response', async () => {
    const coordinator = new CookieMutationCoordinator()
    const gate = deferred()
    const events: string[] = []

    const refresh = coordinator.runSingleFlight('refresh', async () => {
      events.push('refresh:start')
      await gate.promise
      events.push('refresh:end')
      return 'access-token'
    })
    await nextMicrotask()

    const logout = coordinator.closeAndLogout(async () => {
      events.push('logout')
    })

    await expect(coordinator.run(async () => 'late writer')).rejects.toBeInstanceOf(
      AuthCookieMutationClosedError,
    )
    expect(events).toEqual(['refresh:start'])

    gate.resolve()
    await expect(refresh).resolves.toBe('access-token')
    await logout
    expect(events).toEqual(['refresh:start', 'refresh:end', 'logout'])
  })

  test('shares one serialized refresh between bootstrap and a 401 retry', async () => {
    const coordinator = new CookieMutationCoordinator()
    const gate = deferred()
    const events: string[] = []

    const bootstrapRefresh = coordinator.runSingleFlight('refresh', async () => {
      events.push('bootstrap-refresh:start')
      await gate.promise
      events.push('bootstrap-refresh:end')
      return 'bootstrap-token'
    })
    const retryRefresh = coordinator.runSingleFlight('refresh', async () => {
      events.push('retry-refresh:unexpected')
      return 'retry-token'
    })

    expect(retryRefresh).toBe(bootstrapRefresh)
    await nextMicrotask()
    expect(events).toEqual(['bootstrap-refresh:start'])
    gate.resolve()

    await expect(Promise.all([bootstrapRefresh, retryRefresh])).resolves.toEqual([
      'bootstrap-token',
      'bootstrap-token',
    ])
    expect(events).toEqual(['bootstrap-refresh:start', 'bootstrap-refresh:end'])
  })

  test('rejects a queued verify when logout closes behind an active verify', async () => {
    const coordinator = new CookieMutationCoordinator()
    const gate = deferred()
    const events: string[] = []

    const activeVerify = coordinator.run(async () => {
      events.push('verify-1:start')
      await gate.promise
      events.push('verify-1:end')
      return 'session-1'
    })
    const queuedVerify = coordinator.run(async () => {
      events.push('verify-2:unexpected')
      return 'session-2'
    })
    await nextMicrotask()

    const logout = coordinator.closeAndLogout(async () => {
      events.push('logout')
    })
    await expect(queuedVerify).rejects.toBeInstanceOf(AuthCookieMutationClosedError)

    gate.resolve()
    await expect(activeVerify).resolves.toBe('session-1')
    await logout
    expect(events).toEqual(['verify-1:start', 'verify-1:end', 'logout'])
  })

  test('serializes two verification writers', async () => {
    const coordinator = new CookieMutationCoordinator()
    const gate = deferred()
    const events: string[] = []

    const first = coordinator.run(async () => {
      events.push('verify-1:start')
      await gate.promise
      events.push('verify-1:end')
      return 1
    })
    const second = coordinator.run(async () => {
      events.push('verify-2:start')
      return 2
    })

    await nextMicrotask()
    expect(events).toEqual(['verify-1:start'])
    gate.resolve()
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2])
    expect(events).toEqual(['verify-1:start', 'verify-1:end', 'verify-2:start'])
  })
})
