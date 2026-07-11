import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, lstat, mkdir, open, realpath, rename, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import type { Readable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'

import type { ObjectStorage } from './types.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PARTS = 100_000

function invalidObjectKey(): never {
  throw new Error('invalid object key')
}

function validateObjectKey(value: string): void {
  if (!UUID_PATTERN.test(value)) invalidObjectKey()
}

function validateParts(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_PARTS) {
    throw new Error('invalid part number')
  }
}

async function ensureSafeRoot(root: string): Promise<void> {
  await mkdir(root, { recursive: true })
  const metadata = await lstat(root)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('unsafe storage path')
  await realpath(root)
}

async function rejectLinkIfPresent(candidate: string, directory: boolean): Promise<void> {
  try {
    const metadata = await lstat(candidate)
    if (metadata.isSymbolicLink() || (directory ? !metadata.isDirectory() : !metadata.isFile())) {
      throw new Error('unsafe storage path')
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function safeReadable(filePath: string): Promise<Readable> {
  await rejectLinkIfPresent(filePath, false)
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW)
  return handle.createReadStream({ autoClose: true })
}

export class LocalObjectStorage implements ObjectStorage {
  private readonly filesRoot: string
  private readonly partsRoot: string

  constructor(storageRoot: string) {
    const resolved = path.resolve(storageRoot)
    this.filesRoot = path.join(resolved, 'files')
    this.partsRoot = path.join(resolved, 'parts')
  }

  private async roots(): Promise<void> {
    await ensureSafeRoot(this.filesRoot)
    await ensureSafeRoot(this.partsRoot)
  }

  private async partDirectory(objectKey: string, create: boolean): Promise<string> {
    validateObjectKey(objectKey)
    await this.roots()
    const directory = path.join(this.partsRoot, objectKey)
    await rejectLinkIfPresent(directory, true)
    if (create) {
      await mkdir(directory)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error
      })
      await rejectLinkIfPresent(directory, true)
    }
    return directory
  }

  private async filePath(objectKey: string): Promise<string> {
    validateObjectKey(objectKey)
    await this.roots()
    const candidate = path.join(this.filesRoot, objectKey)
    await rejectLinkIfPresent(candidate, false)
    return candidate
  }

  async writePart(objectKey: string, partNumber: number, body: Readable): Promise<void> {
    validateParts(partNumber)
    const directory = await this.partDirectory(objectKey, true)
    const destination = path.join(directory, String(partNumber))
    await rejectLinkIfPresent(destination, false)
    const temporary = path.join(directory, `.part-${partNumber}-${randomUUID()}`)
    const handle = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    try {
      await pipeline(body, handle.createWriteStream({ autoClose: true }))
      await rejectLinkIfPresent(directory, true)
      await rejectLinkIfPresent(destination, false)
      await rename(temporary, destination)
    } catch (error) {
      await handle.close().catch(() => undefined)
      await rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async inspectParts(objectKey: string, parts: number): Promise<{ complete: boolean; sizeBytes: bigint }> {
    validateParts(parts)
    const directory = await this.partDirectory(objectKey, false)
    let sizeBytes = 0n
    for (let part = 1; part <= parts; part += 1) {
      const candidate = path.join(directory, String(part))
      try {
        const metadata = await lstat(candidate)
        if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error('unsafe storage path')
        sizeBytes += BigInt(metadata.size)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { complete: false, sizeBytes }
        throw error
      }
    }
    return { complete: true, sizeBytes }
  }

  async completeObject(objectKey: string, parts: number): Promise<{ sizeBytes: bigint; sha256: string }> {
    validateParts(parts)
    const inspected = await this.inspectParts(objectKey, parts)
    if (!inspected.complete) throw new Error('missing upload part')
    const directory = await this.partDirectory(objectKey, false)
    const destination = await this.filePath(objectKey)
    const temporary = path.join(this.filesRoot, `.object-${objectKey}-${randomUUID()}`)
    const handle = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    const output = handle.createWriteStream({ autoClose: true })
    const hash = createHash('sha256')
    let sizeBytes = 0n
    try {
      for (let part = 1; part <= parts; part += 1) {
        const input = await safeReadable(path.join(directory, String(part)))
        for await (const chunk of input) {
          const bytes = Buffer.from(chunk as Uint8Array)
          hash.update(bytes)
          sizeBytes += BigInt(bytes.length)
          if (!output.write(bytes)) await once(output, 'drain')
        }
      }
      output.end()
      await finished(output)
      await rejectLinkIfPresent(destination, false)
      await rename(temporary, destination)
      return { sizeBytes, sha256: hash.digest('hex') }
    } catch (error) {
      output.destroy()
      await handle.close().catch(() => undefined)
      await rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async openRead(objectKey: string): Promise<Readable> {
    return safeReadable(await this.filePath(objectKey))
  }

  async stat(objectKey: string): Promise<{ sizeBytes: bigint } | null> {
    const candidate = await this.filePath(objectKey)
    try {
      const metadata = await lstat(candidate)
      if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error('unsafe storage path')
      return { sizeBytes: BigInt(metadata.size) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    const candidate = await this.filePath(objectKey)
    await unlink(candidate).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }

  async ready(): Promise<void> {
    await this.roots()
    await access(this.filesRoot, constants.R_OK | constants.W_OK)
    await access(this.partsRoot, constants.R_OK | constants.W_OK)
  }
}
