import { Readable } from 'node:stream'

import { describe, expect, test, vi } from 'vitest'

import {
  ALI_OSS_SINGLE_COPY_MAX_BYTES,
  AliOssClient,
  type AliOssSdkClient,
} from '../object-storage/ali-oss-client.js'
import { parseAliOssConfig } from '../runtime.js'

const generation = '16232aef-1f26-4bb4-98ba-ccc72d7f3915'

function sdk(size: bigint, publishedGeneration = generation): AliOssSdkClient {
  return {
    putStream: vi.fn(async () => ({ name: 'staging', res: {} as never })),
    getStream: vi.fn(async () => ({ stream: Readable.from('bytes'), res: {} as never })),
    head: vi.fn(async (key: string) => ({
      status: 200,
      meta: (key.startsWith('files/') ? { 'storage-generation': publishedGeneration } : {}) as never,
      res: { headers: { 'content-length': size.toString() } } as never,
    })),
    delete: vi.fn(async () => ({ res: {} as never })),
    copy: vi.fn(async () => ({ data: {} as never, res: {} as never })),
    multipartUploadCopy: vi.fn(async () => ({
      bucket: 'bucket', name: 'final', etag: 'etag', res: {} as never,
    })),
    getBucketInfo: vi.fn(async () => ({})),
  }
}

describe('deployable Aliyun OSS provider', () => {
  test('uses CopyObject with generation metadata at or below the single-copy limit', async () => {
    const client = sdk(ALI_OSS_SINGLE_COPY_MAX_BYTES)
    const provider = new AliOssClient(client, 'bucket')
    await provider.publishTemp('staging/object/generation', 'files/object', generation)
    expect(client.copy).toHaveBeenCalledWith(
      'files/object', 'staging/object/generation',
      { meta: { 'storage-generation': generation } },
    )
    expect(client.multipartUploadCopy).not.toHaveBeenCalled()
  })

  test('uses atomic multipart upload-copy above the CopyObject limit and verifies generation', async () => {
    const client = sdk(ALI_OSS_SINGLE_COPY_MAX_BYTES + 1n)
    const provider = new AliOssClient(client, 'bucket')
    await provider.publishTemp('staging/object/generation', 'files/object', generation)
    expect(client.copy).not.toHaveBeenCalled()
    expect(client.multipartUploadCopy).toHaveBeenCalledWith(
      'files/object',
      {
        sourceKey: 'staging/object/generation',
        sourceBucketName: 'bucket',
        startOffset: 0,
        endOffset: Number(ALI_OSS_SINGLE_COPY_MAX_BYTES + 1n),
      },
      expect.objectContaining({
        meta: { 'storage-generation': generation },
        partSize: expect.any(Number),
      }),
    )
    expect(client.head).toHaveBeenLastCalledWith('files/object')
  })

  test('preserves a final object whose generation does not match for reconciliation', async () => {
    const client = sdk(1n, 'different-generation')
    const provider = new AliOssClient(client, 'bucket')
    await expect(
      provider.publishTemp('staging/object/generation', 'files/object', generation),
    ).rejects.toThrow('OSS generation metadata mismatch')
    expect(client.delete).not.toHaveBeenCalledWith('files/object')
  })

  test('requires deployable runtime credentials and parses endpoint/secure without defaults for secrets', () => {
    expect(() => parseAliOssConfig({})).toThrow('OSS_REGION must be set')
    expect(() => parseAliOssConfig({ OSS_REGION: 'oss-cn-test' })).toThrow(
      'OSS_ACCESS_KEY_ID must be set',
    )
    expect(parseAliOssConfig({
      OSS_REGION: 'oss-cn-test',
      OSS_ACCESS_KEY_ID: 'id',
      OSS_ACCESS_KEY_SECRET: 'secret',
      OSS_BUCKET: 'bucket',
      OSS_ENDPOINT: 'https://oss.example.test',
      OSS_SECURE: 'false',
    })).toEqual({
      region: 'oss-cn-test',
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      bucket: 'bucket',
      endpoint: 'https://oss.example.test',
      secure: false,
    })
  })
})
