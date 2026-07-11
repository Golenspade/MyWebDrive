import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'

import type { ObjectStorage } from './types.js'

export interface OssClient {
  putStream(key: string, body: Readable): Promise<unknown>
  getStream(key: string): Promise<{ stream: Readable }>
  head(key: string): Promise<{ contentLength?: number | string; res?: { headers?: Record<string, unknown> } }>
  delete(key: string): Promise<unknown>
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

  async writePart(objectKey: string, partNumber: number, body: Readable): Promise<void> {
    valid(objectKey, partNumber)
    await this.client.putStream(this.partKey(objectKey, partNumber), body)
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

  async completeObject(objectKey: string, parts: number): Promise<{ sizeBytes: bigint; sha256: string }> {
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
    await this.client.putStream(this.fileKey(objectKey), Readable.from(chunks()))
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
    return (await this.client.getStream(this.fileKey(objectKey))).stream
  }

  async stat(objectKey: string): Promise<{ sizeBytes: bigint } | null> {
    valid(objectKey)
    try {
      return { sizeBytes: sizeOf(await this.client.head(this.fileKey(objectKey))) }
    } catch (error) {
      if ([404, 'NoSuchKey'].includes((error as { status?: number; code?: string }).status ?? (error as { code?: string }).code ?? '')) return null
      throw error
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    valid(objectKey)
    await this.client.delete(this.fileKey(objectKey))
  }

  async ready(): Promise<void> {
    if (this.client.getBucketInfo) await this.client.getBucketInfo()
  }
}
