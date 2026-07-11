import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'

import { ObjectIntegrityError, type ObjectStorage } from './types.js'

export interface OssClient {
  putStream(key: string, body: Readable): Promise<unknown>
  getStream(key: string): Promise<{ stream: Readable }>
  head(key: string): Promise<{ contentLength?: number | string; generation?: string; res?: { headers?: Record<string, unknown> } }>
  delete(key: string): Promise<unknown>
  /** Atomically server-side copies or renames tempKey to finalKey with generation metadata. */
  publishTemp(tempKey: string, finalKey: string, generation: string): Promise<void>
  getBucketInfo?(): Promise<unknown>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function valid(objectKey: string, part?: number): void {
  if (!UUID_PATTERN.test(objectKey)) throw new Error('invalid object key')
  if (part !== undefined && (!Number.isInteger(part) || part < 1 || part > 100_000)) {
    throw new Error('invalid part number')
  }
}

function validGeneration(generation: string): void {
  if (!UUID_PATTERN.test(generation)) throw new Error('invalid upload generation')
}

function sizeOf(value: Awaited<ReturnType<OssClient['head']>>): bigint {
  const raw = value.contentLength ?? value.res?.headers?.['content-length']
  if ((typeof raw !== 'number' && typeof raw !== 'string') || !/^\d+$/.test(String(raw))) {
    throw new Error('invalid object metadata')
  }
  return BigInt(raw)
}

export class OssObjectStorage implements ObjectStorage {
  constructor(private readonly client: OssClient, private readonly prefix = '') {}

  private key(value: string): string {
    return this.prefix ? `${this.prefix.replace(/\/$/, '')}/${value}` : value
  }

  private partKey(objectKey: string, part: number): string {
    return this.key(`parts/${objectKey}/${part}`)
  }

  private fileKey(objectKey: string): string {
    return this.key(`files/${objectKey}`)
  }

  async writePart(
    objectKey: string,
    partNumber: number,
    body: Readable,
    expectedSize: bigint,
  ): Promise<void> {
    valid(objectKey, partNumber)
    if (expectedSize < 1n) throw new ObjectIntegrityError()
    const key = this.partKey(objectKey, partNumber)
    let sizeBytes = 0n
    const counting = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += BigInt(chunk.length)
        callback(null, chunk)
      },
    })
    try {
      await this.client.putStream(key, body.pipe(counting))
      if (sizeBytes !== expectedSize) throw new ObjectIntegrityError()
    } catch (error) {
      await this.client.delete(key).catch(() => undefined)
      throw error
    }
  }

  async inspectParts(objectKey: string, parts: number): Promise<{ complete: boolean; sizeBytes: bigint }> {
    valid(objectKey, parts)
    let sizeBytes = 0n
    for (let part = 1; part <= parts; part += 1) {
      try {
        sizeBytes += sizeOf(await this.client.head(this.partKey(objectKey, part)))
      } catch (error) {
        if ([404, 'NoSuchKey'].includes((error as { status?: number; code?: string }).status ?? (error as { code?: string }).code ?? '')) {
          return { complete: false, sizeBytes }
        }
        throw error
      }
    }
    return { complete: true, sizeBytes }
  }

  async completeObject(objectKey: string, parts: number, generation: string, expectedSize: bigint): Promise<{ sizeBytes: bigint; sha256: string }> {
    validGeneration(generation)
    const stagingKey = this.key(`staging/${objectKey}/${generation}`)
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
      await this.client.delete(stagingKey).catch(() => undefined)
      return { sizeBytes, sha256: hash.digest('hex') }
    }
    const inspected = await this.inspectParts(objectKey, parts)
    if (!inspected.complete) throw new Error('missing upload part')
    const self = this
    async function* chunks() {
      for (let part = 1; part <= parts; part += 1) {
        for await (const chunk of (await self.client.getStream(self.partKey(objectKey, part))).stream) {
          yield chunk
        }
      }
    }
    const hash = createHash('sha256')
    let sizeBytes = 0n
    const hashing = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk)
        sizeBytes += BigInt(chunk.length)
        callback(null, chunk)
      },
    })
    try {
      await this.client.putStream(stagingKey, Readable.from(chunks()).pipe(hashing))
      if (sizeBytes !== expectedSize) throw new ObjectIntegrityError()
      await this.client.publishTemp(stagingKey, this.fileKey(objectKey), generation)
      await this.client.delete(stagingKey)
    } catch (error) {
      await this.client.delete(stagingKey).catch(() => undefined)
      throw error
    }
    return { sizeBytes, sha256: hash.digest('hex') }
  }

  async openRead(objectKey: string): Promise<Readable> {
    valid(objectKey)
    return (await this.client.getStream(this.fileKey(objectKey))).stream
  }

  async stat(objectKey: string): Promise<{ sizeBytes: bigint; generation?: string } | null> {
    valid(objectKey)
    try {
      const metadata = await this.client.head(this.fileKey(objectKey))
      return {
        sizeBytes: sizeOf(metadata),
        ...(metadata.generation ? { generation: metadata.generation } : {}),
      }
    } catch (error) {
      if ([404, 'NoSuchKey'].includes((error as { status?: number; code?: string }).status ?? (error as { code?: string }).code ?? '')) return null
      throw error
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    valid(objectKey)
    await this.client.delete(this.fileKey(objectKey))
  }

  async deletePart(objectKey: string, partNumber: number): Promise<void> {
    valid(objectKey, partNumber)
    await this.client.delete(this.partKey(objectKey, partNumber))
  }

  async deleteParts(objectKey: string, parts: number): Promise<void> {
    valid(objectKey, parts)
    for (let part = 1; part <= parts; part += 1) {
      await this.client.delete(this.partKey(objectKey, part))
    }
  }

  async ready(): Promise<void> {
    if (this.client.getBucketInfo) await this.client.getBucketInfo()
  }
}
