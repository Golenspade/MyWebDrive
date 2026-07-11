import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, lstat, mkdir, open, realpath, rename, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { Readable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'

import { ObjectIntegrityError, type ObjectStorage } from './types.js'

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

async function rejectSymlinkChain(candidate: string): Promise<void> {
  const absolute = path.resolve(candidate)
  const parsed = path.parse(absolute)
  let current = parsed.root
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('unsafe storage path')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
  }
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
  private readonly requestedRoot: string
  private initializePromise?: Promise<void>
  private storageRoot = ''
  private filesRoot = ''
  private partsRoot = ''
  private dataRoot = ''
  private pointersRoot = ''
  private stagingRoot = ''

  constructor(storageRoot: string) {
    this.requestedRoot = path.resolve(storageRoot)
  }

  private async initialize(): Promise<void> {
    let existing = this.requestedRoot
    for (;;) {
      try {
        const metadata = await lstat(existing)
        const trustedSystemAlias =
          process.platform === 'darwin' && existing !== this.requestedRoot &&
          (existing === '/tmp' || existing === '/var')
        if (metadata.isSymbolicLink() && !trustedSystemAlias) throw new Error('unsafe storage path')
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        const parent = path.dirname(existing)
        if (parent === existing) throw error
        existing = parent
      }
    }
    const canonicalAncestor = await realpath(existing)
    this.storageRoot = path.resolve(canonicalAncestor, path.relative(existing, this.requestedRoot))
    await mkdir(this.storageRoot, { recursive: true })
    const rootMetadata = await lstat(this.storageRoot)
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) throw new Error('unsafe storage path')
    this.filesRoot = path.join(this.storageRoot, 'files')
    this.partsRoot = path.join(this.storageRoot, 'parts')
    this.dataRoot = path.join(this.filesRoot, 'data')
    this.pointersRoot = path.join(this.filesRoot, 'pointers')
    this.stagingRoot = path.join(this.filesRoot, 'staging')
  }

  private async roots(): Promise<void> {
    this.initializePromise ??= this.initialize()
    await this.initializePromise
    // Local mode assumes a trusted single process; repeated checks narrow parent-swap windows.
    await rejectSymlinkChain(this.storageRoot)
    await ensureSafeRoot(this.filesRoot)
    await ensureSafeRoot(this.partsRoot)
    await ensureSafeRoot(this.dataRoot)
    await ensureSafeRoot(this.pointersRoot)
    await ensureSafeRoot(this.stagingRoot)
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

  private async pointerPath(objectKey: string): Promise<string> {
    validateObjectKey(objectKey)
    await this.roots()
    const candidate = path.join(this.pointersRoot, objectKey)
    await rejectLinkIfPresent(candidate, false)
    return candidate
  }

  private async publishedGeneration(objectKey: string): Promise<string | null> {
    const pointer = await this.pointerPath(objectKey)
    try {
      const handle = await open(pointer, constants.O_RDONLY | constants.O_NOFOLLOW)
      const generation = (await handle.readFile('utf8').finally(() => handle.close())).trim()
      if (!UUID_PATTERN.test(generation)) throw new ObjectIntegrityError()
      return generation
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  private async dataPath(objectKey: string, generation: string, create = false): Promise<string> {
    validateObjectKey(objectKey)
    if (!UUID_PATTERN.test(generation)) throw new Error('invalid upload generation')
    await this.roots()
    const directory = path.join(this.dataRoot, objectKey)
    await rejectLinkIfPresent(directory, true)
    if (create) {
      await mkdir(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error
      })
      await rejectLinkIfPresent(directory, true)
    }
    const candidate = path.join(directory, generation)
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

  async completeObject(objectKey: string, parts: number, generation: string, expectedSize: bigint): Promise<{ sizeBytes: bigint; sha256: string }> {
    validateParts(parts)
    if (!UUID_PATTERN.test(generation)) throw new Error('invalid upload generation')
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
    const directory = await this.partDirectory(objectKey, false)
    const destination = await this.dataPath(objectKey, generation, true)
    const temporary = path.join(this.stagingRoot, `${objectKey}-${generation}-${randomUUID()}`)
    const handle = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    const output = handle.createWriteStream({ autoClose: true })
    const hash = createHash('sha256')
    let sizeBytes = 0n
    let pointerTemp: string | undefined
    let dataRenamed = false
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
      if (sizeBytes !== expectedSize) throw new ObjectIntegrityError()
      await rejectLinkIfPresent(destination, false)
      await rename(temporary, destination)
      dataRenamed = true
      const pointer = await this.pointerPath(objectKey)
      pointerTemp = path.join(this.stagingRoot, `.pointer-${objectKey}-${generation}-${randomUUID()}`)
      const pointerHandle = await open(
        pointerTemp,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
        0o600,
      )
      await pipeline(Readable.from(generation), pointerHandle.createWriteStream({ autoClose: true }))
      await rename(pointerTemp, pointer)
      return { sizeBytes, sha256: hash.digest('hex') }
    } catch (error) {
      output.destroy()
      await handle.close().catch(() => undefined)
      await rm(temporary, { force: true }).catch(() => undefined)
      if (pointerTemp) await rm(pointerTemp, { force: true }).catch(() => undefined)
      if (dataRenamed) await rm(destination, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async openRead(objectKey: string): Promise<Readable> {
    const generation = await this.publishedGeneration(objectKey)
    if (!generation) throw Object.assign(new Error('object not found'), { code: 'ENOENT' })
    return safeReadable(await this.dataPath(objectKey, generation))
  }

  async stat(objectKey: string): Promise<{ sizeBytes: bigint; generation?: string } | null> {
    const generation = await this.publishedGeneration(objectKey)
    if (!generation) return null
    const candidate = await this.dataPath(objectKey, generation)
    try {
      const metadata = await lstat(candidate)
      if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error('unsafe storage path')
      return { sizeBytes: BigInt(metadata.size), generation }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    const pointer = await this.pointerPath(objectKey)
    await unlink(pointer).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
    const directory = path.join(this.dataRoot, objectKey)
    await rejectLinkIfPresent(directory, true)
    await rm(directory, { recursive: true, force: true })
  }

  async deletePart(objectKey: string, partNumber: number): Promise<void> {
    validateParts(partNumber)
    const directory = await this.partDirectory(objectKey, false)
    await rejectLinkIfPresent(directory, true)
    const candidate = path.join(directory, String(partNumber))
    await rejectLinkIfPresent(candidate, false)
    await unlink(candidate).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }

  async deleteParts(objectKey: string, parts: number): Promise<void> {
    validateParts(parts)
    const directory = await this.partDirectory(objectKey, false)
    await rejectLinkIfPresent(directory, true)
    await rm(directory, { recursive: true, force: true })
  }

  async ready(): Promise<void> {
    await this.roots()
    await access(this.filesRoot, constants.R_OK | constants.W_OK)
    await access(this.partsRoot, constants.R_OK | constants.W_OK)
  }
}
