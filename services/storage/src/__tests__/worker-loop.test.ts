import { describe, expect, test, vi } from 'vitest'

import { runWorker, WorkerLoopState } from '../worker.js'

describe('worker loop liveness', () => {
  test('backs off and resumes consumption after transient Redis read failure', async () => {
    const controller = new AbortController()
    const queue = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn()
        .mockRejectedValueOnce(new Error('redis reset'))
        .mockResolvedValueOnce([]),
      read: vi.fn(async () => {
        controller.abort()
        return []
      }),
    }
    const state = new WorkerLoopState()
    const sleep = vi.fn(async (_milliseconds: number) => undefined)
    await runWorker({
      storage: {} as never,
      queue: queue as never,
      callbackSecret: 'x'.repeat(32),
      coreApiUrl: 'http://core.test',
      signal: controller.signal,
      state,
      sleep,
    })
    expect(queue.reclaim).toHaveBeenCalledTimes(2)
    expect(queue.read).toHaveBeenCalledOnce()
    expect(sleep).toHaveBeenCalledWith(1_000)
    expect(state.isAlive()).toBe(false)
  })

  test('readiness state is alive only while the consumer loop is running', () => {
    const state = new WorkerLoopState()
    expect(state.isAlive()).toBe(false)
    state.markRunning()
    expect(state.isAlive()).toBe(true)
    state.markStopped()
    expect(state.isAlive()).toBe(false)
  })
})
