import { createHmac } from 'node:crypto'

import { describe, expect, test, vi } from 'vitest'

import {
  type DownloadCallbackRequest,
  processDownloadEvent,
} from '../download-events/callback.js'
import { processFinalizationJob } from '../worker.js'

const job = {
  id: '171-0',
  uploadIntentId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
  objectKey: '5dd0d998-ec26-4fbd-9589-eca8aa9a9311',
  parts: 2,
  expectedSize: 11n,
  generation: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
}
const secret = 'core-callback-test-secret-at-least-32-bytes'

function deps(statuses: number[]) {
  const storage = {
    completeObject: vi.fn(async () => ({ sizeBytes: 11n, sha256: 'a'.repeat(64) })),
    deleteObject: vi.fn(),
    deleteParts: vi.fn(async () => undefined),
  }
  const callback = vi.fn(async (_input: unknown) => ({ status: statuses.shift() ?? 503, body: '{}' }))
  const queue = {
    ack: vi.fn(),
    deadLetter: vi.fn(),
  }
  return { storage, callback, queue }
}

describe('finalization worker callback contract', () => {
  test('signs the exact transmitted bytes and acknowledges a 2xx response', async () => {
    const subject = deps([200])
    await processFinalizationJob(job, {
      ...subject,
      callbackSecret: secret,
      now: () => new Date('2026-07-11T10:00:00.000Z'),
      sleep: vi.fn(async (_milliseconds: number) => undefined),
    })

    const sent = subject.callback.mock.calls[0]?.[0] as {
      rawBody: Buffer
      timestamp: string
      signature: string
    }
    expect(sent.rawBody.toString('utf8')).toBe(
      `{"objectKey":"${job.objectKey}","sizeBytes":"11","sha256":"${'a'.repeat(64)}"}`,
    )
    expect(sent.signature).toBe(
      createHmac('sha256', secret)
        .update(`${sent.timestamp}.`)
        .update(sent.rawBody)
        .digest('hex'),
    )
    expect(subject.queue.ack).toHaveBeenCalledWith(job.id)
    expect(subject.storage.deleteParts).toHaveBeenCalledWith(job.objectKey, job.parts)
    expect(subject.storage.deleteObject).not.toHaveBeenCalled()
  })

  test('retries transient callback failures at 1/2/4/8/16 seconds then leaves pending', async () => {
    const subject = deps([503, 503, 503, 503, 503, 503])
    const sleep = vi.fn(async (_milliseconds: number) => undefined)
    await processFinalizationJob(job, {
      ...subject,
      callbackSecret: secret,
      now: () => new Date(),
      sleep,
    })
    expect(subject.callback).toHaveBeenCalledTimes(6)
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000,
    ])
    expect(subject.queue.ack).not.toHaveBeenCalled()
    expect(subject.queue.deadLetter).not.toHaveBeenCalled()
    expect(subject.storage.deleteObject).not.toHaveBeenCalled()
  })

  test('dead-letters a permanent conflict with opaque identifiers and code, then acknowledges', async () => {
    const subject = deps([409])
    await processFinalizationJob(job, {
      ...subject,
      callbackSecret: secret,
      now: () => new Date(),
      sleep: vi.fn(async (_milliseconds: number) => undefined),
    })
    expect(subject.queue.deadLetter).toHaveBeenCalledWith({
      id: job.id,
      uploadIntentId: job.uploadIntentId,
      objectKey: job.objectKey,
      errorCode: 'core_conflict',
    })
    expect(subject.queue.ack).not.toHaveBeenCalled()
    expect(subject.storage.deleteObject).not.toHaveBeenCalled()
  })

  test('deletes a mismatched final and atomically dead-letters integrity failure without callback', async () => {
    const subject = deps([200])
    subject.storage.completeObject.mockResolvedValueOnce({ sizeBytes: 10n, sha256: 'a'.repeat(64) })
    await processFinalizationJob(job, {
      ...subject,
      callbackSecret: secret,
      now: () => new Date(),
      sleep: vi.fn(async (_milliseconds: number) => undefined),
    })
    expect(subject.callback).not.toHaveBeenCalled()
    expect(subject.queue.ack).not.toHaveBeenCalled()
    expect(subject.storage.deleteParts).not.toHaveBeenCalled()
    expect(subject.storage.deleteObject).toHaveBeenCalledWith(job.objectKey)
    expect(subject.queue.deadLetter).toHaveBeenCalledWith({
      id: job.id,
      uploadIntentId: job.uploadIntentId,
      objectKey: job.objectKey,
      errorCode: 'integrity_mismatch',
    })
  })

  test('leaves accepted job pending when part cleanup fails', async () => {
    const subject = deps([200])
    subject.storage.deleteParts.mockRejectedValueOnce(new Error('cleanup unavailable'))
    await expect(processFinalizationJob(job, {
      ...subject,
      callbackSecret: secret,
      now: () => new Date(),
      sleep: vi.fn(async (_milliseconds: number) => undefined),
    })).rejects.toThrow('cleanup unavailable')
    expect(subject.queue.ack).not.toHaveBeenCalled()
    expect(subject.storage.deleteObject).not.toHaveBeenCalled()
  })
})

describe('download worker callback contract', () => {
  const started = {
    id: '271-0',
    kind: 'started' as const,
    attemptId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
    fileVersionId: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
    expectedBytes: 11n,
    occurredAt: new Date('2026-07-12T12:00:00.000Z'),
  }

  test('signs the exact started body and acknowledges only a 2xx callback', async () => {
    const callback = vi.fn(async (_request: DownloadCallbackRequest) => ({
      status: 200,
      body: '{"idempotent":true}',
    }))
    const queue = {
      ack: vi.fn(async () => undefined),
      deadLetter: vi.fn(async () => undefined),
    }
    await processDownloadEvent(started, {
      queue,
      callback,
      callbackSecret: secret,
      now: () => new Date('2026-07-12T12:00:10.000Z'),
    })
    const sent = callback.mock.calls[0]?.[0]
    if (!sent) throw new Error('missing callback request')
    expect(sent?.attemptId).toBe(started.attemptId)
    expect(sent?.kind).toBe('started')
    expect(sent?.rawBody.toString('utf8')).toBe(JSON.stringify({
      fileVersionId: started.fileVersionId,
      expectedBytes: '11',
      occurredAt: started.occurredAt.toISOString(),
    }))
    expect(sent?.signature).toBe(createHmac('sha256', secret)
      .update(`${sent.timestamp}.`)
      .update(sent.rawBody)
      .digest('hex'))
    expect(queue.ack).toHaveBeenCalledWith(started.id)
  })

  test('uses bytes for completed and leaves transient callback failures pending', async () => {
    const callback = vi.fn(async (_request: DownloadCallbackRequest) => ({ status: 503, body: '' }))
    const queue = {
      ack: vi.fn(async () => undefined),
      deadLetter: vi.fn(async () => undefined),
    }
    await processDownloadEvent({
      id: '272-0', kind: 'completed', attemptId: started.attemptId,
      fileVersionId: started.fileVersionId, bytes: 11n,
      occurredAt: new Date('2026-07-12T12:00:01.000Z'),
    }, {
      queue,
      callback,
      callbackSecret: secret,
      now: () => new Date('2026-07-12T12:00:10.000Z'),
    })
    const sent = callback.mock.calls[0]?.[0]
    if (!sent) throw new Error('missing callback request')
    expect(sent.rawBody.toString('utf8')).toContain('"bytes":"11"')
    expect(sent.rawBody.toString('utf8')).not.toContain('expectedBytes')
    expect(queue.ack).not.toHaveBeenCalled()
  })

  test('dead-letters a permanent identity conflict so it cannot poison reclaim forever', async () => {
    const callback = vi.fn(async (_request: DownloadCallbackRequest) => ({ status: 409, body: '' }))
    const queue = {
      ack: vi.fn(async () => undefined),
      deadLetter: vi.fn(async () => undefined),
    }
    await processDownloadEvent(started, {
      queue,
      callback,
      callbackSecret: secret,
      now: () => new Date('2026-07-12T12:00:10.000Z'),
    })
    expect(queue.deadLetter).toHaveBeenCalledWith({
      id: started.id,
      attemptId: started.attemptId,
      kind: started.kind,
      errorCode: 'core_rejected_409',
    })
    expect(queue.ack).not.toHaveBeenCalled()
  })

  test('retains a completed 425 because its started callback is still pending', async () => {
    const callback = vi.fn(async (_request: DownloadCallbackRequest) => ({ status: 425, body: '' }))
    const queue = {
      ack: vi.fn(async () => undefined),
      deadLetter: vi.fn(async () => undefined),
    }
    await processDownloadEvent({
      id: '272-0', kind: 'completed', attemptId: started.attemptId,
      fileVersionId: started.fileVersionId, bytes: 11n,
      occurredAt: new Date('2026-07-12T12:00:01.000Z'),
    }, {
      queue,
      callback,
      callbackSecret: secret,
      now: () => new Date('2026-07-12T12:00:10.000Z'),
    })
    expect(queue.ack).not.toHaveBeenCalled()
    expect(queue.deadLetter).not.toHaveBeenCalled()
  })

  test('dead-letters a terminal completed 409 identity conflict', async () => {
    const callback = vi.fn(async (_request: DownloadCallbackRequest) => ({ status: 409, body: '' }))
    const queue = {
      ack: vi.fn(async () => undefined),
      deadLetter: vi.fn(async () => undefined),
    }
    const completed = {
      id: '272-0', kind: 'completed' as const, attemptId: started.attemptId,
      fileVersionId: started.fileVersionId, bytes: 11n,
      occurredAt: new Date('2026-07-12T12:00:01.000Z'),
    }
    await processDownloadEvent(completed, {
      queue,
      callback,
      callbackSecret: secret,
      now: () => new Date('2026-07-12T12:00:10.000Z'),
    })
    expect(queue.deadLetter).toHaveBeenCalledWith({
      id: completed.id,
      attemptId: completed.attemptId,
      kind: completed.kind,
      errorCode: 'core_rejected_409',
    })
    expect(queue.ack).not.toHaveBeenCalled()
  })
})
