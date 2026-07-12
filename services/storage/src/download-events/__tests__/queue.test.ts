import { describe, expect, test, vi } from 'vitest'

import { DownloadEventQueue, downloadEventQueueContract } from '../queue.js'

const attemptId = '126b455f-b9e7-49b9-aab6-4cb1ff971328'
const fileVersionId = '16232aef-1f26-4bb4-98ba-ccc72d7f3915'
const occurredAt = new Date('2026-07-12T11:00:00.000Z')

function redis() {
  return {
    ping: vi.fn(async () => 'PONG'),
    xadd: vi.fn(async () => '171-0'),
    xgroup: vi.fn(async () => 'OK'),
    xreadgroup: vi.fn(async () => null as unknown),
    xautoclaim: vi.fn(async () => ['0-0', []] as unknown),
    xpending: vi.fn(async () => [0, null, null, []] as unknown),
    xack: vi.fn(async () => 1),
    eval: vi.fn(async () => 1),
  }
}

describe('two-phase download event queue', () => {
  test('reports the consumer-group pending summary', async () => {
    const client = redis()
    client.xpending.mockResolvedValueOnce([3, '170-0', '172-0', []])
    const queue = new DownloadEventQueue(client, 'consumer-1')

    await expect(queue.pendingCount()).resolves.toBe(3)
    expect(client.xpending).toHaveBeenCalledWith(
      downloadEventQueueContract.stream,
      downloadEventQueueContract.group,
    )
  })

  test('appends started before transfer with immutable version, size and occurrence input', async () => {
    const client = redis()
    const queue = new DownloadEventQueue(client, 'consumer-1')
    expect(await queue.appendStarted({
      attemptId,
      fileVersionId,
      expectedBytes: 5n,
      occurredAt,
    })).toBe('171-0')
    expect(client.xadd).toHaveBeenCalledWith(
      downloadEventQueueContract.stream,
      '*',
      'kind', 'started',
      'attemptId', attemptId,
      'fileVersionId', fileVersionId,
      'expectedBytes', '5',
      'occurredAt', occurredAt.toISOString(),
    )
  })

  test('appends completed only with the observed matching byte count', async () => {
    const client = redis()
    const queue = new DownloadEventQueue(client, 'consumer-1')
    await queue.appendCompleted({ attemptId, fileVersionId, bytes: 5n, occurredAt })
    expect(client.xadd).toHaveBeenCalledWith(
      downloadEventQueueContract.stream,
      '*',
      'kind', 'completed',
      'attemptId', attemptId,
      'fileVersionId', fileVersionId,
      'bytes', '5',
      'occurredAt', occurredAt.toISOString(),
    )
  })

  test('reads fresh started and completed events without losing unknown-timeout input', async () => {
    const client = redis()
    client.xreadgroup.mockResolvedValueOnce([
      [downloadEventQueueContract.stream, [
        ['171-0', [
          'kind', 'started', 'attemptId', attemptId, 'fileVersionId', fileVersionId,
          'expectedBytes', '5', 'occurredAt', occurredAt.toISOString(),
        ]],
        ['172-0', [
          'kind', 'completed', 'attemptId', attemptId, 'fileVersionId', fileVersionId,
          'bytes', '5', 'occurredAt', new Date(occurredAt.getTime() + 1000).toISOString(),
        ]],
      ]],
    ])
    const queue = new DownloadEventQueue(client, 'consumer-1')
    expect(await queue.read(2, 10)).toEqual([
      {
        id: '171-0', kind: 'started', attemptId, fileVersionId,
        expectedBytes: 5n, occurredAt,
      },
      {
        id: '172-0', kind: 'completed', attemptId, fileVersionId,
        bytes: 5n, occurredAt: new Date(occurredAt.getTime() + 1000),
      },
    ])
  })

  test('returns an explicit poison entry with raw Redis ID for malformed fields', async () => {
    const client = redis()
    client.xreadgroup.mockResolvedValueOnce([
      [downloadEventQueueContract.stream, [
        ['171-0', ['kind', 'completed', 'attemptId', 'not-a-uuid', 'bytes', 'NaN']],
      ]],
    ])
    const queue = new DownloadEventQueue(client, 'consumer-1')
    expect(await queue.read(1, 10)).toEqual([{
      id: '171-0',
      kind: 'malformed',
      errorCode: 'invalid_download_event',
    }])
  })

  test('reclaims pending entries and advances the claim cursor', async () => {
    const client = redis()
    client.xautoclaim.mockResolvedValueOnce([
      '173-0',
      [[
        '171-0', [
          'kind', 'started', 'attemptId', attemptId, 'fileVersionId', fileVersionId,
          'expectedBytes', '5', 'occurredAt', occurredAt.toISOString(),
        ],
      ]],
    ])
    const queue = new DownloadEventQueue(client, 'consumer-1')
    expect(await queue.reclaim(30_000, 1)).toHaveLength(1)
    client.xautoclaim.mockResolvedValueOnce(['0-0', []])
    await queue.reclaim(30_000, 1)
    expect(client.xautoclaim).toHaveBeenNthCalledWith(
      2,
      downloadEventQueueContract.stream,
      downloadEventQueueContract.group,
      'consumer-1',
      30_000,
      '173-0',
      'COUNT',
      1,
    )
  })

  test('acknowledges idempotently', async () => {
    const client = redis()
    client.xack.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    const queue = new DownloadEventQueue(client, 'consumer-1')
    await queue.ack('171-0')
    await queue.ack('171-0')
    expect(client.xack).toHaveBeenCalledTimes(2)
  })

  test('atomically dead-letters and acknowledges a permanent Core rejection', async () => {
    const client = redis()
    const queue = new DownloadEventQueue(client, 'consumer-1')
    await queue.deadLetter({
      id: '171-0',
      attemptId,
      kind: 'completed',
      errorCode: 'core_rejected_409',
    })
    expect(client.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      downloadEventQueueContract.stream,
      downloadEventQueueContract.deadLetterStream,
      downloadEventQueueContract.group,
      '171-0',
      attemptId,
      'completed',
      'core_rejected_409',
    )
  })
})
