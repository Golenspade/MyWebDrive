import { Readable } from 'node:stream'

import type { Client } from 'minio'
import { describe, expect, test, vi } from 'vitest'

import { MinioObjectStorage, publishMinioStaging } from '../object-storage/minio.js'
import { OssObjectStorage, type OssClient } from '../object-storage/oss.js'

const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'
const generation = '16232aef-1f26-4bb4-98ba-ccc72d7f3915'

async function text(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

describe('remote object adapter arbitrary part contract', () => {
  test('MinIO concatenates arbitrary tiny parts then publishes with single-source compose', async () => {
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
      composeObject: vi.fn(async (_destination: unknown, _sources: unknown[]) => ({})),
      copyObject: vi.fn(),
      bucketExists: vi.fn(async () => true),
    }
    const storage = new MinioObjectStorage(client as unknown as Client, 'bucket')
    await expect(storage.completeObject(objectKey, 2, generation, 3n)).resolves.toEqual({
      sizeBytes: 3n,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    })
    expect(outputs.get(`staging/${objectKey}/${generation}`)).toBe('abc')
    expect(client.putObject).not.toHaveBeenCalledWith('bucket', `files/${objectKey}`, expect.anything())
    expect(client.copyObject).not.toHaveBeenCalled()
    expect(client.composeObject).toHaveBeenCalledOnce()
    const [destination, sources] = client.composeObject.mock.calls[0]!
    const [source] = sources
    expect(source).toMatchObject({ Bucket: 'bucket', Object: `staging/${objectKey}/${generation}` })
    expect(destination).toMatchObject({ Bucket: 'bucket', Object: `files/${objectKey}` })
  })

  test('MinIO uses multipart compose publication for a single staging source above 5 GiB', async () => {
    const client = { composeObject: vi.fn(async () => ({})), copyObject: vi.fn() }
    await publishMinioStaging(
      client as unknown as Client,
      'bucket',
      `staging/${objectKey}/${generation}`,
      `files/${objectKey}`,
      generation,
      5n * 1024n * 1024n * 1024n + 1n,
    )
    expect(client.composeObject).toHaveBeenCalledOnce()
    expect(client.copyObject).not.toHaveBeenCalled()
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
      publishTemp: vi.fn(async () => undefined),
    }
    const storage = new OssObjectStorage(client)
    await expect(storage.completeObject(objectKey, 2, generation, 3n)).resolves.toMatchObject({ sizeBytes: 3n })
    expect(outputs.get(`staging/${objectKey}/${generation}`)).toBe('abc')
    expect(client.publishTemp).toHaveBeenCalledWith(
      `staging/${objectKey}/${generation}`, `files/${objectKey}`, generation,
    )
    await storage.deleteParts(objectKey, 2)
    expect(vi.mocked(client.delete).mock.calls.slice(-2)).toEqual([
      [`parts/${objectKey}/1`],
      [`parts/${objectKey}/2`],
    ])
  })

  test('remote adapters remove generation staging and never publish on expected-size mismatch', async () => {
    const minio = {
      statObject: vi.fn(async (_bucket: string, key: string) => {
        if (key.startsWith('files/')) throw Object.assign(new Error('missing'), { code: 'NotFound' })
        return { size: 3 }
      }),
      getObject: vi.fn(async () => Readable.from('abc')),
      putObject: vi.fn(async (_bucket: string, _key: string, body: Readable) => { await text(body) }),
      copyObject: vi.fn(),
      composeObject: vi.fn(),
      removeObject: vi.fn(async () => undefined),
    }
    const storage = new MinioObjectStorage(minio as unknown as Client, 'bucket')
    await expect(storage.completeObject(objectKey, 1, generation, 4n)).rejects.toThrow(
      'object integrity mismatch',
    )
    expect(minio.copyObject).not.toHaveBeenCalled()
    expect(minio.composeObject).not.toHaveBeenCalled()
    expect(minio.removeObject).toHaveBeenCalledWith('bucket', `staging/${objectKey}/${generation}`)
  })
})
