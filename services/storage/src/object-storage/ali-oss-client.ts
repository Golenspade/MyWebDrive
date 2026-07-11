import type { Readable } from 'node:stream'

import type OSS from 'ali-oss'

import type { OssClient } from './oss.js'

export const ALI_OSS_SINGLE_COPY_MAX_BYTES = 1024n * 1024n * 1024n
const MULTIPART_COPY_PART_SIZE = 100 * 1024 * 1024

export type AliOssSdkClient = Pick<
  OSS,
  | 'putStream'
  | 'getStream'
  | 'head'
  | 'delete'
  | 'copy'
  | 'multipartUploadCopy'
  | 'getBucketInfo'
>

function contentLength(result: Awaited<ReturnType<AliOssSdkClient['head']>>): bigint {
  const value = (result.res.headers as Record<string, unknown>)['content-length']
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
    throw new Error('invalid OSS object metadata')
  }
  return BigInt(value)
}

export class AliOssClient implements OssClient {
  constructor(
    private readonly client: AliOssSdkClient,
    private readonly bucket: string,
  ) {}

  async putStream(key: string, body: Readable): Promise<void> {
    await this.client.putStream(key, body)
  }

  async getStream(key: string): Promise<{ stream: Readable }> {
    const result = await this.client.getStream(key)
    if (!result.stream) throw new Error('OSS object stream unavailable')
    return { stream: result.stream as Readable }
  }

  async head(key: string): Promise<{ contentLength: string; generation?: string }> {
    const result = await this.client.head(key)
    const generation = result.meta?.['storage-generation']
    return {
      contentLength: contentLength(result).toString(),
      ...(generation === undefined ? {} : { generation: String(generation) }),
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(key)
  }

  async publishTemp(tempKey: string, finalKey: string, generation: string): Promise<void> {
    const source = await this.client.head(tempKey)
    // DefinitelyTyped's UserMeta incorrectly requires example uid/pid fields; OSS accepts any key.
    const metadata = { 'storage-generation': generation } as unknown as OSS.UserMeta
    if (contentLength(source) <= ALI_OSS_SINGLE_COPY_MAX_BYTES) {
      await this.client.copy(finalKey, tempKey, { meta: metadata })
    } else {
      await this.client.multipartUploadCopy(
        finalKey,
        {
          sourceKey: tempKey,
          sourceBucketName: this.bucket,
          startOffset: 0,
          endOffset: Number(contentLength(source)),
        },
        {
          parallel: 4,
          partSize: MULTIPART_COPY_PART_SIZE,
          meta: metadata,
        },
      )
    }
    const published = await this.head(finalKey)
    if (published.generation !== generation) {
      throw new Error('OSS generation metadata mismatch')
    }
  }

  async getBucketInfo(): Promise<unknown> {
    return this.client.getBucketInfo(this.bucket)
  }
}
