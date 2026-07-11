import { describe, expect, test, vi } from 'vitest'

import { FinalizationQueue, finalizationQueueContract, type StreamRedis } from '../finalization-queue.js'

const uploadIntentId = '126b455f-b9e7-49b9-aab6-4cb1ff971328'
const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'

function redis(): StreamRedis {
  return {
    ping: vi.fn(async () => 'PONG'),
    eval: vi.fn(async () => [1, '171-0']),
    xgroup: vi.fn(async () => 'OK'),
    xreadgroup: vi.fn(async () => null),
    xautoclaim: vi.fn(async () => ['0-0', [], []]),
    xack: vi.fn(async () => 1),
  }
}

describe('finalization Redis Stream contract', () => {
  test('reads new jobs and reclaims pending jobs through the storage-workers group', async () => {
    const client = redis()
    vi.mocked(client.xreadgroup).mockResolvedValue([
      [finalizationQueueContract.stream, [['171-0', ['uploadIntentId', uploadIntentId, 'objectKey', objectKey, 'parts', '2', 'expectedSize', '11', 'generation', '16232aef-1f26-4bb4-98ba-ccc72d7f3915']]]],
    ])
    vi.mocked(client.xautoclaim).mockResolvedValueOnce([
      '171-0',
      [['170-0', ['uploadIntentId', uploadIntentId, 'objectKey', objectKey, 'parts', '2', 'expectedSize', '11', 'generation', '16232aef-1f26-4bb4-98ba-ccc72d7f3915']]],
      [],
    ]).mockResolvedValueOnce(['0-0', [], []])
    const queue = new FinalizationQueue(client, 'worker-a')
    await expect(queue.read()).resolves.toEqual([{
      id: '171-0', uploadIntentId, objectKey, parts: 2, expectedSize: 11n, generation: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
    }])
    await expect(queue.reclaim()).resolves.toEqual([{
      id: '170-0', uploadIntentId, objectKey, parts: 2,
      expectedSize: 11n, generation: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
    }])
    await queue.reclaim()
    expect(client.xreadgroup).toHaveBeenCalledWith(
      'GROUP', 'storage-workers', 'worker-a', 'COUNT', 1, 'BLOCK', 5_000,
      'STREAMS', 'storage:finalize', '>',
    )
    expect(client.xautoclaim).toHaveBeenCalledWith(
      'storage:finalize', 'storage-workers', 'worker-a', 120_000, '0-0', 'COUNT', 1,
    )
    expect(vi.mocked(client.xautoclaim).mock.calls[1]).toContain('171-0')
  })

  test('atomically reserves cumulative bytes, forbids overwrite and freezes one generation', async () => {
    const client = redis()
    vi.mocked(client.eval)
      .mockResolvedValueOnce(['reserved'])
      .mockResolvedValueOnce(['committed'])
      .mockResolvedValueOnce(['exists'])
      .mockResolvedValueOnce(['enqueued', '171-0', '3', '16232aef-1f26-4bb4-98ba-ccc72d7f3915'])
    const queue = new FinalizationQueue(client, 'worker-a')

    await expect(queue.reservePart({ uploadIntentId, objectKey, partNumber: 1, sizeBytes: 3n, maxBytes: 3n, reservationId: 'r1' })).resolves.toBe('reserved')
    await expect(queue.commitPart({ uploadIntentId, partNumber: 1, sizeBytes: 3n, reservationId: 'r1' })).resolves.toBe('committed')
    await expect(queue.reservePart({ uploadIntentId, objectKey, partNumber: 1, sizeBytes: 3n, maxBytes: 3n, reservationId: 'r2' })).resolves.toBe('exists')
    await expect(queue.freezeAndEnqueue({ uploadIntentId, objectKey, parts: 1, maxBytes: 3n, generation: '16232aef-1f26-4bb4-98ba-ccc72d7f3915' })).resolves.toEqual({ enqueued: true, id: '171-0', expectedSize: 3n, generation: '16232aef-1f26-4bb4-98ba-ccc72d7f3915' })
    expect(vi.mocked(client.eval).mock.calls.every((call) => call[0].toString().includes('storage:finalize') || call[0].toString().includes('HSET'))).toBe(true)
  })

  test('dead-letter entries contain only opaque identifiers and an error code', async () => {
    const client = redis()
    const queue = new FinalizationQueue(client, 'worker-a')
    await queue.deadLetter({ id: '171-0', uploadIntentId, objectKey, errorCode: 'core_conflict' })
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('XACK'"),
      2,
      'storage:finalize',
      'storage:finalize:dead-letter',
      'storage-workers',
      '171-0',
      uploadIntentId,
      objectKey,
      'core_conflict',
    )
    expect(JSON.stringify(vi.mocked(client.eval).mock.calls.at(-1))).not.toMatch(/body|sha256|email|token/i)
  })
})
