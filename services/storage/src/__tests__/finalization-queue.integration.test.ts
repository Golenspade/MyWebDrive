import Redis from 'ioredis'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { FinalizationQueue, type StreamRedis } from '../finalization-queue.js'

const redisUrl = process.env.STORAGE_TEST_REDIS_URL
const integration = describe.runIf(Boolean(redisUrl))
const uploadIntentId = '126b455f-b9e7-49b9-aab6-4cb1ff971328'
const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'

integration('finalization queue with real Redis', () => {
  const redis = new Redis(redisUrl!, { maxRetriesPerRequest: 1 })

  beforeAll(async () => redis.flushdb())
  afterAll(async () => {
    await redis.flushdb()
    redis.disconnect()
  })

  test('concurrent completion enqueues once and a second consumer reclaims pending work', async () => {
    const first = new FinalizationQueue(redis as unknown as StreamRedis, 'worker-a')
    await first.ensureGroup()
    const results = await Promise.all(
      Array.from({ length: 10 }, () => first.enqueueOnce({ uploadIntentId, objectKey, parts: 2 })),
    )
    expect(results.filter((result) => result.enqueued)).toHaveLength(1)
    expect(new Set(results.map((result) => result.id)).size).toBe(1)
    expect(await redis.xlen('storage:finalize')).toBe(1)

    const [read] = await first.read(1, 50)
    expect(read).toMatchObject({ uploadIntentId, objectKey, parts: 2 })
    expect((await redis.xpending('storage:finalize', 'storage-workers'))[0]).toBe(1)

    const second = new FinalizationQueue(redis as unknown as StreamRedis, 'worker-b')
    const [reclaimed] = await second.reclaim(0, 1)
    expect(reclaimed).toMatchObject({ id: read!.id, uploadIntentId, objectKey, parts: 2 })
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
})
