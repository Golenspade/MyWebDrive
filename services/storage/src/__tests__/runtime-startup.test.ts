import { describe, expect, test, vi } from 'vitest'

import { connectRuntimeRedis } from '../runtime.js'

describe('storage runtime startup', () => {
  test('explicitly connects Redis before startup continues', async () => {
    const connect = vi.fn(async () => undefined)

    await expect(connectRuntimeRedis({ connect })).resolves.toBeUndefined()

    expect(connect).toHaveBeenCalledOnce()
  })

  test('fails closed when the initial Redis connection fails', async () => {
    const unavailable = new Error('redis unavailable')

    await expect(
      connectRuntimeRedis({ connect: vi.fn(async () => Promise.reject(unavailable)) }),
    ).rejects.toBe(unavailable)
  })
})
