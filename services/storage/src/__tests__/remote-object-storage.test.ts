import { Readable } from 'node:stream'

import type { Client } from 'minio'
import { describe, expect, test, vi } from 'vitest'

import { MinioObjectStorage } from '../object-storage/minio.js'
import { OssObjectStorage, type OssClient } from '../object-storage/oss.js'

const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'

async function text(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

describe('remote object adapter arbitrary part contract', () => {
  test('MinIO concatenates arbitrary tiny parts in order without composeObject', async () => {
    const outputs = new Map<string, string>()
    const client = {
      statObject: vi.fn(async (_bucket: string, key: string) => {
        if (key.startsWith('files/')) throw Object.assign(new Error('missing'), { code: 'NotFound' })
        return { size: key.endsWith('/1') ? 1 : 2 }
      }),
      getObject: vi.fn(async (_bucket: string, key: string) => Readable.from(key.endsWith('/1') ? 'a' : 'bc')),
      putObject: vi.fn(async (_bucket: string, key: string, body: Readable) => outputs.set(key, await text(body))),
      removeObject: vi.fn(),
      removeObjects: vi.fn(async () => []),
      bucketExists: vi.fn(async () => true),
      composeObject: vi.fn(),
    }
    const storage = new MinioObjectStorage(client as unknown as Client, 'bucket')
    await expect(storage.completeObject(objectKey, 2)).resolves.toEqual({
      sizeBytes: 3n,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    })
    expect(outputs.get(`files/${objectKey}`)).toBe('abc')
    expect(client.composeObject).not.toHaveBeenCalled()
  })

  test('OSS concatenates arbitrary tiny parts and supports idempotent cleanup', async () => {
    const outputs = new Map<string, string>()
    const client: OssClient = {
      head: vi.fn(async (key) => {
        if (key.startsWith('files/')) throw Object.assign(new Error('missing'), { status: 404 })
        return { contentLength: key.endsWith('/1') ? 1 : 2 }
      }),
      getStream: vi.fn(async (key) => ({ stream: Readable.from(key.endsWith('/1') ? 'a' : 'bc') })),
      putStream: vi.fn(async (key, body) => outputs.set(key, await text(body))),
      delete: vi.fn(async () => undefined),
    }
    const storage = new OssObjectStorage(client)
    await expect(storage.completeObject(objectKey, 2)).resolves.toMatchObject({ sizeBytes: 3n })
    expect(outputs.get(`files/${objectKey}`)).toBe('abc')
    await storage.deleteParts(objectKey, 2)
    expect(client.delete).toHaveBeenCalledTimes(2)
  })
})
