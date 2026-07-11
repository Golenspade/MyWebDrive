import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'

import type { Client } from 'minio'

import { ObjectIntegrityError, type ObjectStorage } from './types.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MINIO_MULTIPART_PART_BYTES = 64 * 1024 * 1024

function valid(objectKey: string, part?: number): void {
  if (!UUID_PATTERN.test(objectKey)) throw new Error('invalid object key')
  if (part !== undefined && (!Number.isInteger(part) || part < 1 || part > 100_000)) {
    throw new Error('invalid part number')
  }
}

function validGeneration(generation: string): void {
  if (!UUID_PATTERN.test(generation)) throw new Error('invalid upload generation')
}

async function verifyMinioUpload(
  client: Client,
  bucket: string,
  key: string,
  expectedSize: bigint,
  metadata: Readonly<Record<string, string>>,
): Promise<void> {
  const published = await client.statObject(bucket, key)
  if (BigInt(published.size) !== expectedSize) throw new ObjectIntegrityError()
  for (const [name, value] of Object.entries(metadata)) {
    const normalized = name.toLowerCase().replace(/^x-amz-meta-/, '')
    const actual = published.metaData?.[normalized] ??
      published.metaData?.[`x-amz-meta-${normalized}`]
    if (String(actual ?? '') !== value) throw new ObjectIntegrityError()
  }
}

export async function uploadMinioStreamAtomic(
  client: Client,
  bucket: string,
  key: string,
  source: Readable,
  expectedSize: bigint,
  metadata: Readonly<Record<string, string>> = {},
  partSizeBytes = MINIO_MULTIPART_PART_BYTES,
): Promise<void> {
  if (
    expectedSize < 1n ||
    !Number.isSafeInteger(partSizeBytes) ||
    partSizeBytes < 1
  ) {
    throw new ObjectIntegrityError()
  }

  let uploadId: string | undefined
  let completed = false
  try {
    const uploadHeaders = Object.fromEntries(
      Object.entries(metadata).map(([name, value]) => [`X-Amz-Meta-${name}`, value]),
    )
    uploadId = await client.initiateNewMultipartUpload(bucket, key, uploadHeaders)
    const etags: Array<{ part: number; etag: string }> = []
    let partNumber = 1
    let totalBytes = 0n
    let buffer = Buffer.allocUnsafe(partSizeBytes)
    let bufferedBytes = 0

    const uploadBufferedPart = async (): Promise<void> => {
      const payload = buffer.subarray(0, bufferedBytes)
      const result = await client.uploadPart(
        {
          bucketName: bucket,
          objectName: key,
          uploadID: uploadId!,
          partNumber,
          headers: {
            'Content-Length': payload.length,
            'Content-MD5': createHash('md5').update(payload).digest('base64'),
          },
        },
        payload,
      )
      etags.push({ part: partNumber, etag: result.etag })
      partNumber += 1
      buffer = Buffer.allocUnsafe(partSizeBytes)
      bufferedBytes = 0
    }

    for await (const chunk of source) {
      const bytes = Buffer.from(chunk as Uint8Array)
      if (totalBytes + BigInt(bytes.length) > expectedSize) throw new ObjectIntegrityError()
      totalBytes += BigInt(bytes.length)
      let offset = 0
      while (offset < bytes.length) {
        const copied = bytes.copy(
          buffer,
          bufferedBytes,
          offset,
          Math.min(bytes.length, offset + partSizeBytes - bufferedBytes),
        )
        offset += copied
        bufferedBytes += copied
        if (bufferedBytes === partSizeBytes) await uploadBufferedPart()
      }
    }
    if (totalBytes !== expectedSize) throw new ObjectIntegrityError()
    if (bufferedBytes > 0) await uploadBufferedPart()
    await client.completeMultipartUpload(bucket, key, uploadId, etags)
    completed = true
  } catch (error) {
    if (uploadId && !completed) {
      await client.abortMultipartUpload(bucket, key, uploadId).catch(() => undefined)
    }
    throw error
  }

  await verifyMinioUpload(client, bucket, key, expectedSize, metadata)
}

export class MinioObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: Client,
    private readonly bucket: string,
    private readonly multipartPartBytes = MINIO_MULTIPART_PART_BYTES,
  ) {}

  private partKey(objectKey: string, part: number): string {
    return `parts/${objectKey}/${part}`
  }

  private fileKey(objectKey: string): string {
    return `files/${objectKey}`
  }

  async writePart(
    objectKey: string,
    partNumber: number,
    body: Readable,
    expectedSize: bigint,
  ): Promise<void> {
    valid(objectKey, partNumber)
    await uploadMinioStreamAtomic(
      this.client,
      this.bucket,
      this.partKey(objectKey, partNumber),
      body,
      expectedSize,
      {},
      this.multipartPartBytes,
    )
  }

  async inspectParts(objectKey: string, parts: number): Promise<{ complete: boolean; sizeBytes: bigint }> {
    valid(objectKey, parts)
    let sizeBytes = 0n
    for (let part = 1; part <= parts; part += 1) {
      try {
        const metadata = await this.client.statObject(this.bucket, this.partKey(objectKey, part))
        sizeBytes += BigInt(metadata.size)
      } catch (error) {
        if (['NotFound', 'NoSuchKey'].includes((error as { code?: string }).code ?? '')) {
          return { complete: false, sizeBytes }
        }
        throw error
      }
    }
    return { complete: true, sizeBytes }
  }

  async completeObject(objectKey: string, parts: number, generation: string, expectedSize: bigint): Promise<{ sizeBytes: bigint; sha256: string }> {
    validGeneration(generation)
    const existing = await this.stat(objectKey)
    if (existing) {
      if (existing.generation !== generation || existing.sizeBytes !== expectedSize) {
        throw new ObjectIntegrityError()
      }
      const hash = createHash('sha256')
      let sizeBytes = 0n
      for await (const chunk of await this.openRead(objectKey)) {
        const bytes = Buffer.from(chunk as Uint8Array)
        hash.update(bytes)
        sizeBytes += BigInt(bytes.length)
      }
      if (sizeBytes !== expectedSize) throw new ObjectIntegrityError()
      return { sizeBytes, sha256: hash.digest('hex') }
    }
    const inspected = await this.inspectParts(objectKey, parts)
    if (!inspected.complete) throw new Error('missing upload part')
    if (inspected.sizeBytes !== expectedSize) throw new ObjectIntegrityError()
    const hash = createHash('sha256')
    let sizeBytes = 0n
    const self = this
    async function* chunks() {
      for (let part = 1; part <= parts; part += 1) {
        for await (const chunk of await self.client.getObject(self.bucket, self.partKey(objectKey, part))) {
          yield chunk
        }
      }
    }
    const hashing = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk)
        sizeBytes += BigInt(chunk.length)
        callback(null, chunk)
      },
    })
    await uploadMinioStreamAtomic(
      this.client,
      this.bucket,
      this.fileKey(objectKey),
      Readable.from(chunks()).pipe(hashing),
      expectedSize,
      { 'storage-generation': generation },
      this.multipartPartBytes,
    )
    if (sizeBytes !== expectedSize) throw new ObjectIntegrityError()
    return { sizeBytes, sha256: hash.digest('hex') }
  }

  async openRead(objectKey: string): Promise<Readable> {
    valid(objectKey)
    return this.client.getObject(this.bucket, this.fileKey(objectKey))
  }

  async stat(objectKey: string): Promise<{ sizeBytes: bigint; generation?: string } | null> {
    valid(objectKey)
    try {
      const metadata = await this.client.statObject(this.bucket, this.fileKey(objectKey))
      const generation = String(
        metadata.metaData?.['storage-generation'] ??
        metadata.metaData?.['x-amz-meta-storage-generation'] ?? '',
      )
      return { sizeBytes: BigInt(metadata.size), ...(generation ? { generation } : {}) }
    } catch (error) {
      if (['NotFound', 'NoSuchKey'].includes((error as { code?: string }).code ?? '')) return null
      throw error
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    valid(objectKey)
    await this.client.removeObject(this.bucket, this.fileKey(objectKey))
  }

  async deletePart(objectKey: string, partNumber: number): Promise<void> {
    valid(objectKey, partNumber)
    await this.client.removeObject(this.bucket, this.partKey(objectKey, partNumber))
  }

  async deleteParts(objectKey: string, parts: number): Promise<void> {
    valid(objectKey, parts)
    const failures = await this.client.removeObjects(
      this.bucket,
      Array.from({ length: parts }, (_, index) => this.partKey(objectKey, index + 1)),
    )
    if (failures.length > 0) throw new Error('part cleanup failed')
  }

  async ready(): Promise<void> {
    if (!(await this.client.bucketExists(this.bucket))) throw new Error('bucket unavailable')
  }
}
