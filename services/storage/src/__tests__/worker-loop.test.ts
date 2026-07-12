import { describe, expect, test, vi } from 'vitest'
import { createAppTelemetry, createStorageWorkerMetrics } from '@mywebdrive/observability'

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
  test('updates bounded worker metrics for reclaim, completion, and dead letter', async () => {
    const controller = new AbortController()
    const telemetry = createAppTelemetry({ service: 'storage-worker' })
    const metrics = createStorageWorkerMetrics(telemetry.register)
    const malformed = {
      id: '271-0',
      kind: 'malformed' as const,
      errorCode: 'invalid_download_event' as const,
    }
    const queue = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => [fresh]),
      read: vi.fn(async () => []),
      ack: vi.fn(async () => undefined),
      deadLetter: vi.fn(async () => undefined),
      pendingCount: vi.fn(async () => 2),
    }
    const downloadEvents = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => [malformed]),
      read: vi.fn(async () => []),
      ack: vi.fn(async () => undefined),
      deadLetter: vi.fn(async () => controller.abort()),
      pendingCount: vi.fn(async () => 3),
    }

    await runWorker({
      storage: {
        completeObject: vi.fn(async () => ({ sizeBytes: 1n, sha256: 'a'.repeat(64) })),
        deleteParts: vi.fn(async () => undefined),
      } as never,
      queue: queue as never,
      downloadEvents: downloadEvents as never,
      callbackSecret: 'x'.repeat(32),
      coreApiUrl: 'http://core.test',
      signal: controller.signal,
      callback: vi.fn(async () => ({ status: 200, body: '{}' })),
      sleep: vi.fn(async () => undefined),
      metrics,
    })

    const output = await telemetry.register.metrics()
    expect(output).toMatch(/storage_worker_events_total\{[^}]*outcome="reclaimed"[^}]*\} 2/)
    expect(output).toMatch(/storage_worker_events_total\{[^}]*outcome="completed"[^}]*\} 1/)
    expect(output).toMatch(/storage_worker_events_total\{[^}]*outcome="dead-letter"[^}]*\} 1/)
    expect(output).toMatch(/storage_worker_pending\{[^}]*\} 5/)
  })

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
      downloadEvents: {
        ensureGroup: vi.fn(async () => undefined),
        reclaim: vi.fn(async () => []),
        read: vi.fn(async () => []),
      } as never,
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
      downloadEvents: {
        ensureGroup: vi.fn(async () => undefined),
        reclaim: vi.fn(async () => []),
        read: vi.fn(async () => []),
      } as never,
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

  test('polls download work fairly even while upload reclaim keeps returning poison', async () => {
    const controller = new AbortController()
    const uploadQueue = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => [poison]),
      read: vi.fn(async () => []),
      ack: vi.fn(),
      deadLetter: vi.fn(),
    }
    const downloadEvent = {
      id: '271-0', kind: 'started' as const,
      attemptId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
      fileVersionId: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
      expectedBytes: 1n,
      occurredAt: new Date('2026-07-12T12:00:00.000Z'),
    }
    const downloadEvents = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => [downloadEvent]),
      read: vi.fn(async () => []),
      ack: vi.fn(async () => controller.abort()),
    }
    const downloadCallback = vi.fn(async () => ({ status: 200, body: '{}' }))
    await runWorker({
      storage: {
        completeObject: vi.fn(async () => { throw new Error('poison') }),
      } as never,
      queue: uploadQueue as never,
      downloadEvents: downloadEvents as never,
      callbackSecret: 'x'.repeat(32),
      coreApiUrl: 'http://core.test',
      signal: controller.signal,
      callback: vi.fn(),
      downloadCallback,
      sleep: vi.fn(async () => undefined),
    })
    expect(uploadQueue.reclaim).toHaveBeenCalled()
    expect(downloadEvents.reclaim).toHaveBeenCalled()
    expect(downloadCallback).toHaveBeenCalledOnce()
    expect(downloadEvents.ack).toHaveBeenCalledWith(downloadEvent.id)
  })

  test('attempts an earlier started callback before completed after outage reordering', async () => {
    const controller = new AbortController()
    const started = {
      id: '271-0', kind: 'started' as const,
      attemptId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
      fileVersionId: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
      expectedBytes: 1n,
      occurredAt: new Date('2026-07-12T12:00:00.000Z'),
    }
    const completed = {
      id: '272-0', kind: 'completed' as const,
      attemptId: started.attemptId,
      fileVersionId: started.fileVersionId,
      bytes: 1n,
      occurredAt: new Date('2026-07-12T12:00:01.000Z'),
    }
    const uploadQueue = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => []),
      read: vi.fn(async () => []),
    }
    const downloadEvents = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => [completed, started]),
      read: vi.fn(async () => []),
      ack: vi.fn(),
      deadLetter: vi.fn(),
    }
    const attempted: string[] = []
    const downloadCallback = vi.fn(async (request: { kind: string }) => {
      attempted.push(request.kind)
      if (request.kind === 'completed') controller.abort()
      return { status: request.kind === 'started' ? 503 : 425, body: '' }
    })
    await runWorker({
      storage: {} as never,
      queue: uploadQueue as never,
      downloadEvents: downloadEvents as never,
      callbackSecret: 'x'.repeat(32),
      coreApiUrl: 'http://core.test',
      signal: controller.signal,
      callback: vi.fn(),
      downloadCallback: downloadCallback as never,
      sleep: vi.fn(async () => undefined),
    })
    expect(attempted).toEqual(['started', 'completed'])
    expect(downloadEvents.ack).not.toHaveBeenCalled()
    expect(downloadEvents.deadLetter).not.toHaveBeenCalled()
  })

  test('dead-letters a malformed stream entry by raw ID without invoking Core', async () => {
    const controller = new AbortController()
    const uploadQueue = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => []),
      read: vi.fn(async () => []),
    }
    const poison = {
      id: '371-0',
      kind: 'malformed' as const,
      errorCode: 'invalid_download_event' as const,
    }
    const downloadEvents = {
      ensureGroup: vi.fn(async () => undefined),
      reclaim: vi.fn(async () => [poison]),
      read: vi.fn(async () => {
        controller.abort()
        return []
      }),
      ack: vi.fn(),
      deadLetter: vi.fn(async () => controller.abort()),
    }
    const downloadCallback = vi.fn()
    await runWorker({
      storage: {} as never,
      queue: uploadQueue as never,
      downloadEvents: downloadEvents as never,
      callbackSecret: 'x'.repeat(32),
      coreApiUrl: 'http://core.test',
      signal: controller.signal,
      callback: vi.fn(),
      downloadCallback,
      sleep: vi.fn(async () => undefined),
    })
    expect(downloadEvents.deadLetter).toHaveBeenCalledWith({
      id: poison.id,
      kind: poison.kind,
      errorCode: poison.errorCode,
    })
    expect(downloadCallback).not.toHaveBeenCalled()
  })
})
