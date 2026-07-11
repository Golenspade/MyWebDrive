import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'

import type { Client } from 'minio'

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
        if (['NotFound', 'NoSuchKey'].includes((error as { code?: string }).code ?? '')) {
          return { complete: false, sizeBytes }
        }
        throw error
      }
    }
    return { complete: true, sizeBytes }
  }

  async completeObject(objectKey: string, parts: number): Promise<{ sizeBytes: bigint; sha256: string }> {
    const existing = await this.stat(objectKey)
    if (existing) {
      const hash = createHash('sha256')
      let sizeBytes = 0n
      for await (const chunk of await this.openRead(objectKey)) {
        const bytes = Buffer.from(chunk as Uint8Array)
        hash.update(bytes)
        sizeBytes += BigInt(bytes.length)
      }
      return { sizeBytes, sha256: hash.digest('hex') }
    }
    const inspected = await this.inspectParts(objectKey, parts)
    if (!inspected.complete) throw new Error('missing upload part')
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
    await this.client.putObject(
      this.bucket,
      this.fileKey(objectKey),
      Readable.from(chunks()).pipe(hashing),
    )
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
