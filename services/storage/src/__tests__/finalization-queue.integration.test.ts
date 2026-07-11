import Redis from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { FinalizationQueue, type StreamRedis } from '../finalization-queue.js'

const redisUrl = process.env.STORAGE_TEST_REDIS_URL
const integration = describe.runIf(Boolean(redisUrl))
const uploadIntentId = '126b455f-b9e7-49b9-aab6-4cb1ff971328'
const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'
const generation = '16232aef-1f26-4bb4-98ba-ccc72d7f3915'

integration('finalization queue with real Redis', () => {
  let redis: Redis

  beforeAll(async () => {
    redis = new Redis(redisUrl!, { maxRetriesPerRequest: 1 })
  })
  beforeEach(async () => redis.flushdb())
  afterAll(async () => {
    await redis.flushdb()
    redis.disconnect()
  })

  test('concurrent completion enqueues once and a second consumer reclaims pending work', async () => {
    const first = new FinalizationQueue(redis as unknown as StreamRedis, 'worker-a')
    await first.ensureGroup()
    expect(await first.reservePart({ uploadIntentId, objectKey, partNumber: 1, sizeBytes: 11n, maxBytes: 11n, reservationId: 'concurrent-a' })).toBe('reserved')
    expect(await first.commitPart({ uploadIntentId, partNumber: 1, sizeBytes: 11n, reservationId: 'concurrent-a' })).toBe('committed')
    const results = await Promise.all(
      Array.from({ length: 10 }, () => first.freezeAndEnqueue({
        uploadIntentId, objectKey, parts: 1, maxBytes: 11n, generation,
      })),
    )
    expect(results.filter((result) => result.enqueued)).toHaveLength(1)
    expect(new Set(results.map((result) => result.id)).size).toBe(1)
    expect(await redis.xlen('storage:finalize')).toBe(1)

    const [read] = await first.read(1, 50)
    expect(read).toMatchObject({ uploadIntentId, objectKey, parts: 1, expectedSize: 11n, generation })
    expect((await redis.xpending('storage:finalize', 'storage-workers'))[0]).toBe(1)

    const second = new FinalizationQueue(redis as unknown as StreamRedis, 'worker-b')
    const [reclaimed] = await second.reclaim(0, 1)
    expect(reclaimed).toMatchObject({ id: read!.id, uploadIntentId, objectKey, parts: 1 })
    await second.deadLetter({
      id: reclaimed!.id,
      uploadIntentId,
      objectKey,
      errorCode: 'core_conflict',
    })
    expect((await redis.xpending('storage:finalize', 'storage-workers'))[0]).toBe(0)
    const dead = await redis.xrange('storage:finalize:dead-letter', '-', '+')
    expect(dead).toHaveLength(1)
    expect(dead[0]?.[1]).toEqual([
      'sourceEntryId', reclaimed!.id,
      'uploadIntentId', uploadIntentId,
      'objectKey', objectKey,
      'errorCode', 'core_conflict',
    ])
  })

  test('enforces cumulative maxBytes, immutable parts and a single frozen generation atomically', async () => {
    const queue = new FinalizationQueue(redis as unknown as StreamRedis, 'worker-ledger')
    expect(await queue.reservePart({ uploadIntentId, objectKey, partNumber: 1, sizeBytes: 3n, maxBytes: 5n, reservationId: 'reserve-a' })).toBe('reserved')
    expect(await queue.commitPart({ uploadIntentId, partNumber: 1, sizeBytes: 3n, reservationId: 'reserve-a' })).toBe('committed')
    await expect(queue.freezeAndEnqueue({ uploadIntentId, objectKey, parts: 1, maxBytes: 5n, generation })).rejects.toThrow('size_mismatch')
    expect(await queue.reservePart({ uploadIntentId, objectKey, partNumber: 1, sizeBytes: 3n, maxBytes: 5n, reservationId: 'reserve-b' })).toBe('exists')
    expect(await queue.reservePart({ uploadIntentId, objectKey, partNumber: 2, sizeBytes: 3n, maxBytes: 5n, reservationId: 'reserve-c' })).toBe('too_large')
    expect(await queue.reservePart({ uploadIntentId, objectKey, partNumber: 2, sizeBytes: 2n, maxBytes: 5n, reservationId: 'reserve-d' })).toBe('reserved')
    expect(await queue.commitPart({ uploadIntentId, partNumber: 2, sizeBytes: 2n, reservationId: 'reserve-d' })).toBe('committed')
    const first = await queue.freezeAndEnqueue({ uploadIntentId, objectKey, parts: 2, maxBytes: 5n, generation })
    const replay = await queue.freezeAndEnqueue({ uploadIntentId, objectKey, parts: 2, maxBytes: 5n, generation: 'e4983ebf-91a9-427b-bd9f-fad43bc3b1b0' })
    expect(first).toMatchObject({ enqueued: true, expectedSize: 5n })
    expect(replay).toEqual({ ...first, enqueued: false })
    expect(await queue.reservePart({ uploadIntentId, objectKey, partNumber: 3, sizeBytes: 1n, maxBytes: 5n, reservationId: 'reserve-e' })).toBe('frozen')
  })

  test('compares cumulative byte counts exactly above JavaScript safe integers', async () => {
    const queue = new FinalizationQueue(redis as unknown as StreamRedis, 'worker-bigint')
    const intent = 'd271411a-e19c-4161-8192-3bfadce25354'
    const key = '16a2d2b5-9cef-4e17-a0d5-c914cb137e08'
    const max = 9_007_199_254_740_993n
    expect(await queue.reservePart({ uploadIntentId: intent, objectKey: key, partNumber: 1, sizeBytes: max - 1n, maxBytes: max, reservationId: 'big-a' })).toBe('reserved')
    expect(await queue.commitPart({ uploadIntentId: intent, partNumber: 1, sizeBytes: max - 1n, reservationId: 'big-a' })).toBe('committed')
    expect(await queue.reservePart({ uploadIntentId: intent, objectKey: key, partNumber: 2, sizeBytes: 1n, maxBytes: max, reservationId: 'big-b' })).toBe('reserved')
    expect(await queue.commitPart({ uploadIntentId: intent, partNumber: 2, sizeBytes: 1n, reservationId: 'big-b' })).toBe('committed')
    expect(await queue.reservePart({ uploadIntentId: intent, objectKey: key, partNumber: 3, sizeBytes: 1n, maxBytes: max, reservationId: 'big-c' })).toBe('too_large')
    await expect(queue.freezeAndEnqueue({ uploadIntentId: intent, objectKey: key, parts: 2, maxBytes: max, generation })).resolves.toMatchObject({ expectedSize: max, generation })
  })
})
