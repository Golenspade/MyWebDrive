import { createHmac } from 'node:crypto'

import { describe, expect, test, vi } from 'vitest'

import { processFinalizationJob } from '../worker.js'

const job = {
  id: '171-0',
  uploadIntentId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
  objectKey: '5dd0d998-ec26-4fbd-9589-eca8aa9a9311',
  parts: 2,
  expectedSize: 11n,
  generation: '7',
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

  test('does not callback or ack when composed bytes differ from frozen expectedSize', async () => {
    const subject = deps([200])
    subject.storage.completeObject.mockResolvedValueOnce({ sizeBytes: 10n, sha256: 'a'.repeat(64) })
    await expect(processFinalizationJob(job, {
      ...subject,
      callbackSecret: secret,
      now: () => new Date(),
      sleep: vi.fn(async (_milliseconds: number) => undefined),
    })).rejects.toThrow('finalized size mismatch')
    expect(subject.callback).not.toHaveBeenCalled()
    expect(subject.queue.ack).not.toHaveBeenCalled()
    expect(subject.storage.deleteParts).not.toHaveBeenCalled()
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
