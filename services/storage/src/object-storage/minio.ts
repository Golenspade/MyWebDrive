import { createHash } from 'node:crypto'
import type { Readable } from 'node:stream'

import { CopyDestinationOptions, CopySourceOptions, type Client } from 'minio'

import type { ObjectStorage } from './types.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function valid(objectKey: string, part?: number): void {
  if (!UUID_PATTERN.test(objectKey)) throw new Error('invalid object key')
  if (part !== undefined && (!Number.isInteger(part) || part < 1 || part > 100_000)) {
    throw new Error('invalid part number')
  }
}

export class MinioObjectStorage implements ObjectStorage {
  constructor(private readonly client: Client, private readonly bucket: string) {}

  private partKey(objectKey: string, part: number): string {
    return `parts/${objectKey}/${part}`
  }

  private fileKey(objectKey: string): string {
    return `files/${objectKey}`
  }

  async writePart(objectKey: string, partNumber: number, body: Readable): Promise<void> {
    valid(objectKey, partNumber)
    await this.client.putObject(this.bucket, this.partKey(objectKey, partNumber), body)
  }

  async inspectParts(objectKey: string, parts: number): Promise<{ complete: boolean; sizeBytes: bigint }> {
    valid(objectKey, parts)
    let sizeBytes = 0n
    for (let part = 1; part <= parts; part += 1) {
      try {
        const metadata = await this.client.statObject(this.bucket, this.partKey(objectKey, part))
        sizeBytes += BigInt(metadata.size)
      } catch (error) {
        if ((error as { code?: string }).code === 'NotFound') return { complete: false, sizeBytes }
        throw error
      }
    }
    return { complete: true, sizeBytes }
  }

  async completeObject(objectKey: string, parts: number): Promise<{ sizeBytes: bigint; sha256: string }> {
    const inspected = await this.inspectParts(objectKey, parts)
    if (!inspected.complete) throw new Error('missing upload part')
    await this.client.composeObject(
      new CopyDestinationOptions({ Bucket: this.bucket, Object: this.fileKey(objectKey) }),
      Array.from({ length: parts }, (_, index) =>
        new CopySourceOptions({
          Bucket: this.bucket,
          Object: this.partKey(objectKey, index + 1),
        }),
      ),
    )
    const hash = createHash('sha256')
    let sizeBytes = 0n
    for await (const chunk of await this.openRead(objectKey)) {
      const bytes = Buffer.from(chunk as Uint8Array)
      hash.update(bytes)
      sizeBytes += BigInt(bytes.length)
    }
    return { sizeBytes, sha256: hash.digest('hex') }
  }

  async openRead(objectKey: string): Promise<Readable> {
    valid(objectKey)
    return this.client.getObject(this.bucket, this.fileKey(objectKey))
  }

  async stat(objectKey: string): Promise<{ sizeBytes: bigint } | null> {
    valid(objectKey)
    try {
      const metadata = await this.client.statObject(this.bucket, this.fileKey(objectKey))
      return { sizeBytes: BigInt(metadata.size) }
    } catch (error) {
      if ((error as { code?: string }).code === 'NotFound') return null
      throw error
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    valid(objectKey)
    await this.client.removeObject(this.bucket, this.fileKey(objectKey))
  }

  async ready(): Promise<void> {
    if (!(await this.client.bucketExists(this.bucket))) throw new Error('bucket unavailable')
  }
}
