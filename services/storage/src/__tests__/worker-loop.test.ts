import { describe, expect, test, vi } from 'vitest'

import { runWorker, WorkerLoopState } from '../worker.js'

const poison = {
  id: '170-0', uploadIntentId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
  objectKey: '5dd0d998-ec26-4fbd-9589-eca8aa9a9311', parts: 1, expectedSize: 1n,
  generation: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
}
const fresh = {
  ...poison, id: '171-0', objectKey: '16a2d2b5-9cef-4e17-a0d5-c914cb137e08',
  generation: 'e4983ebf-91a9-427b-bd9f-fad43bc3b1b0',
}

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
    expect(state.isReady()).toBe(false)
    state.markPollSuccess()
    expect(state.isReady()).toBe(true)
    state.markPollFailure()
    expect(state.isReady()).toBe(false)
    state.markStopped()
    expect(state.isAlive()).toBe(false)
  })

  test('alternates reclaimed work with new messages so poison pending cannot starve fresh jobs', async () => {
    const controller = new AbortController()
    const state = new WorkerLoopState()
    const processed: string[] = []
    const queue = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => [poison]),
      read: vi.fn(async () => [fresh]),
      ack: vi.fn(async (id: string) => {
        processed.push(id)
        controller.abort()
      }),
      deadLetter: vi.fn(),
    }
    const storage = {
      completeObject: vi.fn(async (key: string) => {
        processed.push(key)
        if (key === poison.objectKey) throw new Error('poison')
        return { sizeBytes: 1n, sha256: 'a'.repeat(64) }
      }),
      deleteObject: vi.fn(),
      deleteParts: vi.fn(async () => undefined),
    }
    const callback = vi.fn(async () => {
      expect(state.isReady()).toBe(true)
      return { status: 200, body: '{}' }
    })
    await runWorker({
      storage: storage as never,
      queue: queue as never,
      callbackSecret: 'x'.repeat(32),
      coreApiUrl: 'http://core.test',
      signal: controller.signal,
      state,
      callback,
      sleep: vi.fn(async () => undefined),
    })
    expect(queue.reclaim).toHaveBeenCalledOnce()
    expect(queue.read).toHaveBeenCalledOnce()
    expect(storage.completeObject).toHaveBeenNthCalledWith(
      1, poison.objectKey, poison.parts, poison.generation, poison.expectedSize,
    )
    expect(storage.completeObject).toHaveBeenNthCalledWith(
      2, fresh.objectKey, fresh.parts, fresh.generation, fresh.expectedSize,
    )
    expect(callback).toHaveBeenCalledOnce()
  })
})
