import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'

import type { Client } from 'minio'
import { describe, expect, test, vi } from 'vitest'

import {
  MinioObjectStorage,
  publishMinioMultipart,
  publishMinioStaging,
} from '../object-storage/minio.js'
import { OssObjectStorage, type OssClient } from '../object-storage/oss.js'

const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'
const generation = '16232aef-1f26-4bb4-98ba-ccc72d7f3915'

async function text(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

describe('remote object adapter arbitrary part contract', () => {
  test('MinIO explicit multipart uses bounded sequential parts and exact generation metadata', async () => {
    const source = Readable.from([Buffer.from('abc'), Buffer.from('defgh'), Buffer.from('ij')])
    expect(source.readableLength).toBe(0)
    const uploaded: Buffer[] = []
    const client = {
      initiateNewMultipartUpload: vi.fn(async () => 'new-upload-id'),
      getObject: vi.fn(async () => source),
      uploadPart: vi.fn(async (
        config: { partNumber: number; headers: Record<string, unknown> },
        payload: Buffer,
      ) => {
        uploaded.push(Buffer.from(payload))
        return { etag: `etag-${config.partNumber}`, key: `files/${objectKey}`, part: config.partNumber }
      }),
      completeMultipartUpload: vi.fn(async () => ({ etag: 'final-etag', versionId: null })),
      abortMultipartUpload: vi.fn(async () => undefined),
      statObject: vi.fn(async () => ({
        size: 10,
        metaData: { 'storage-generation': generation },
      })),
      putObject: vi.fn(),
      copyObject: vi.fn(),
      composeObject: vi.fn(),
      findUploadId: vi.fn(),
    }
    await publishMinioMultipart(
      client as unknown as Client,
      'bucket',
      `staging/${objectKey}/${generation}`,
      `files/${objectKey}`,
      generation,
      10n,
      4,
    )
    expect(client.initiateNewMultipartUpload).toHaveBeenCalledWith(
      'bucket',
      `files/${objectKey}`,
      { 'X-Amz-Meta-storage-generation': generation },
    )
    expect(uploaded.map((part) => part.toString())).toEqual(['abcd', 'efgh', 'ij'])
    expect(uploaded.every((part) => part.length <= 4)).toBe(true)
    expect(client.uploadPart.mock.calls.map(([config, payload]) => ({
      partNumber: config.partNumber,
      length: payload.length,
      headers: config.headers,
    }))).toEqual(uploaded.map((part, index) => ({
      partNumber: index + 1,
      length: part.length,
      headers: {
        'Content-Length': part.length,
        'Content-MD5': createHash('md5').update(part).digest('base64'),
      },
    })))
    expect(client.completeMultipartUpload).toHaveBeenCalledWith(
      'bucket',
      `files/${objectKey}`,
      'new-upload-id',
      [
        { part: 1, etag: 'etag-1' },
        { part: 2, etag: 'etag-2' },
        { part: 3, etag: 'etag-3' },
      ],
    )
    expect(client.findUploadId).not.toHaveBeenCalled()
    expect(client.putObject).not.toHaveBeenCalled()
    expect(client.copyObject).not.toHaveBeenCalled()
    expect(client.composeObject).not.toHaveBeenCalled()
    expect(client.abortMultipartUpload).not.toHaveBeenCalled()
  })

  test.each([
    ['short', Buffer.from('123456789'), 10n],
    ['long', Buffer.from('12345678901'), 10n],
  ])('MinIO explicit multipart aborts a %s stream without completing', async (_case, bytes, expectedSize) => {
    const client = {
      initiateNewMultipartUpload: vi.fn(async () => 'new-upload-id'),
      getObject: vi.fn(async () => Readable.from(bytes)),
      uploadPart: vi.fn(async (config: { partNumber: number }) => ({
        etag: `etag-${config.partNumber}`, key: 'final', part: config.partNumber,
      })),
      completeMultipartUpload: vi.fn(),
      abortMultipartUpload: vi.fn(async () => undefined),
      statObject: vi.fn(),
    }
    await expect(publishMinioMultipart(
      client as unknown as Client,
      'bucket',
      'staging/key',
      'files/key',
      generation,
      expectedSize,
      4,
    )).rejects.toThrow('object integrity mismatch')
    expect(client.abortMultipartUpload).toHaveBeenCalledWith('bucket', 'files/key', 'new-upload-id')
    expect(client.completeMultipartUpload).not.toHaveBeenCalled()
    expect(client.statObject).not.toHaveBeenCalled()
  })

  test.each(['upload', 'complete'])('MinIO explicit multipart aborts when %s fails', async (failureAt) => {
    const failure = new Error(`${failureAt} failed`)
    const client = {
      initiateNewMultipartUpload: vi.fn(async () => 'new-upload-id'),
      getObject: vi.fn(async () => Readable.from('1234567890')),
      uploadPart: vi.fn(async (config: { partNumber: number }) => {
        if (failureAt === 'upload') throw failure
        return { etag: `etag-${config.partNumber}`, key: 'final', part: config.partNumber }
      }),
      completeMultipartUpload: vi.fn(async () => {
        if (failureAt === 'complete') throw failure
        return { etag: 'final', versionId: null }
      }),
      abortMultipartUpload: vi.fn(async () => undefined),
      statObject: vi.fn(),
    }
    await expect(publishMinioMultipart(
      client as unknown as Client,
      'bucket',
      'staging/key',
      'files/key',
      generation,
      10n,
      4,
    )).rejects.toBe(failure)
    expect(client.abortMultipartUpload).toHaveBeenCalledWith('bucket', 'files/key', 'new-upload-id')
    expect(client.statObject).not.toHaveBeenCalled()
  })

  test('MinIO preserves a completed final whose post-publication stat mismatches', async () => {
    const client = {
      initiateNewMultipartUpload: vi.fn(async () => 'new-upload-id'),
      getObject: vi.fn(async () => Readable.from('1234567890')),
      uploadPart: vi.fn(async (config: { partNumber: number }) => ({
        etag: `etag-${config.partNumber}`, key: 'final', part: config.partNumber,
      })),
      completeMultipartUpload: vi.fn(async () => ({ etag: 'final', versionId: null })),
      abortMultipartUpload: vi.fn(async () => undefined),
      statObject: vi.fn(async () => ({ size: 10, metaData: { 'storage-generation': 'wrong' } })),
      removeObject: vi.fn(),
    }
    await expect(publishMinioMultipart(
      client as unknown as Client,
      'bucket',
      'staging/key',
      'files/key',
      generation,
      10n,
      4,
    )).rejects.toThrow('object integrity mismatch')
    expect(client.completeMultipartUpload).toHaveBeenCalledOnce()
    expect(client.abortMultipartUpload).not.toHaveBeenCalled()
    expect(client.removeObject).not.toHaveBeenCalled()
  })

  test('MinIO concatenates arbitrary tiny parts then publishes with CopyObject metadata', async () => {
    const outputs = new Map<string, string>()
    let published = false
    const client = {
      statObject: vi.fn(async (_bucket: string, key: string) => {
        if (key.startsWith('files/')) {
          if (!published) throw Object.assign(new Error('missing'), { code: 'NotFound' })
          return { size: 3, metaData: { 'storage-generation': generation } }
        }
        return { size: key.endsWith('/1') ? 1 : 2 }
      }),
      getObject: vi.fn(async (_bucket: string, key: string) => Readable.from(key.endsWith('/1') ? 'a' : 'bc')),
      putObject: vi.fn(async (_bucket: string, key: string, body: Readable) => outputs.set(key, await text(body))),
      removeObject: vi.fn(async () => undefined),
      removeObjects: vi.fn(async () => []),
      composeObject: vi.fn(),
      copyObject: vi.fn(async (_source: unknown, _destination: unknown) => {
        published = true
        return {}
      }),
      bucketExists: vi.fn(async () => true),
    }
    const storage = new MinioObjectStorage(client as unknown as Client, 'bucket')
    await expect(storage.completeObject(objectKey, 2, generation, 3n)).resolves.toEqual({
      sizeBytes: 3n,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    })
    expect(outputs.get(`staging/${objectKey}/${generation}`)).toBe('abc')
    expect(client.putObject).not.toHaveBeenCalledWith('bucket', `files/${objectKey}`, expect.anything())
    expect(client.composeObject).not.toHaveBeenCalled()
    expect(client.copyObject).toHaveBeenCalledOnce()
    const [source, destination] = client.copyObject.mock.calls[0]!
    expect(source).toMatchObject({ Bucket: 'bucket', Object: `staging/${objectKey}/${generation}` })
    expect(destination).toMatchObject({
      Bucket: 'bucket',
      Object: `files/${objectKey}`,
      MetadataDirective: 'REPLACE',
      UserMetadata: { 'storage-generation': generation },
    })
  })

  test('MinIO above 5 GiB starts a new multipart lifecycle and never uses put/copy/compose', async () => {
    const client = {
      initiateNewMultipartUpload: vi.fn(async () => 'generation-specific-upload'),
      getObject: vi.fn(async () => Readable.from('short source')),
      uploadPart: vi.fn(),
      completeMultipartUpload: vi.fn(),
      abortMultipartUpload: vi.fn(async () => undefined),
      findUploadId: vi.fn(),
      putObject: vi.fn(),
      composeObject: vi.fn(),
      copyObject: vi.fn(),
    }
    const sizeBytes = 5n * 1024n * 1024n * 1024n + 1n
    await expect(publishMinioStaging(
      client as unknown as Client,
      'bucket',
      `staging/${objectKey}/${generation}`,
      `files/${objectKey}`,
      generation,
      sizeBytes,
    )).rejects.toThrow('object integrity mismatch')
    expect(client.initiateNewMultipartUpload).toHaveBeenCalledOnce()
    expect(client.findUploadId).not.toHaveBeenCalled()
    expect(client.abortMultipartUpload).toHaveBeenCalledWith(
      'bucket', `files/${objectKey}`, 'generation-specific-upload',
    )
    expect(client.completeMultipartUpload).not.toHaveBeenCalled()
    expect(client.composeObject).not.toHaveBeenCalled()
    expect(client.copyObject).not.toHaveBeenCalled()
    expect(client.putObject).not.toHaveBeenCalled()
  })

  test('MinIO aborts a fresh multipart when reading staging fails', async () => {
    const failure = new Error('staging read failed')
    const source = new Readable({
      read() {
        this.destroy(failure)
      },
    })
    const client = {
      initiateNewMultipartUpload: vi.fn(async () => 'new-upload-id'),
      getObject: vi.fn(async () => source),
      uploadPart: vi.fn(),
      completeMultipartUpload: vi.fn(),
      abortMultipartUpload: vi.fn(async () => undefined),
      putObject: vi.fn(),
      composeObject: vi.fn(),
      copyObject: vi.fn(),
    }
    await expect(publishMinioStaging(
      client as unknown as Client,
      'bucket',
      `staging/${objectKey}/${generation}`,
      `files/${objectKey}`,
      generation,
      5n * 1024n * 1024n * 1024n + 1n,
    )).rejects.toBe(failure)
    expect(client.abortMultipartUpload).toHaveBeenCalledWith('bucket', `files/${objectKey}`, 'new-upload-id')
    expect(client.completeMultipartUpload).not.toHaveBeenCalled()
    expect(client.putObject).not.toHaveBeenCalled()
    expect(client.copyObject).not.toHaveBeenCalled()
    expect(client.composeObject).not.toHaveBeenCalled()
  })

  test('MinIO CopyObject preserves a final whose post-publication size mismatches', async () => {
    const client = {
      copyObject: vi.fn(async () => ({})),
      statObject: vi.fn(async () => ({
        size: 2,
        metaData: { 'storage-generation': generation },
      })),
      removeObject: vi.fn(),
    }
    await expect(publishMinioStaging(
      client as unknown as Client,
      'bucket',
      'staging/key',
      'files/key',
      generation,
      3n,
    )).rejects.toThrow('object integrity mismatch')
    expect(client.copyObject).toHaveBeenCalledOnce()
    expect(client.statObject).toHaveBeenCalledWith('bucket', 'files/key')
    expect(client.removeObject).not.toHaveBeenCalled()
  })

  test('MinIO retry recovers from an already published final with matching generation', async () => {
    const client = {
      statObject: vi.fn(async (_bucket: string, key: string) => {
        if (key === `files/${objectKey}`) {
          return { size: 3, metaData: { 'storage-generation': generation } }
        }
        throw Object.assign(new Error('unexpected stat'), { code: 'NotFound' })
      }),
      getObject: vi.fn(async (_bucket: string, key: string) => {
        if (key === `files/${objectKey}`) return Readable.from('abc')
        throw new Error('unexpected read')
      }),
      putObject: vi.fn(),
      copyObject: vi.fn(),
      composeObject: vi.fn(),
      removeObject: vi.fn(async () => undefined),
    }
    const storage = new MinioObjectStorage(client as unknown as Client, 'bucket')
    await expect(storage.completeObject(objectKey, 2, generation, 3n)).resolves.toEqual({
      sizeBytes: 3n,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    })
    expect(client.putObject).not.toHaveBeenCalled()
    expect(client.copyObject).not.toHaveBeenCalled()
    expect(client.composeObject).not.toHaveBeenCalled()
    expect(client.removeObject).toHaveBeenCalledWith('bucket', `staging/${objectKey}/${generation}`)
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
