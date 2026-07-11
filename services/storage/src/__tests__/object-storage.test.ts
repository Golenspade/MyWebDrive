import { Readable } from 'node:stream'
import { mkdtemp, mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import { LocalObjectStorage } from '../object-storage/local.js'

const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'
const generation = '16232aef-1f26-4bb4-98ba-ccc72d7f3915'
const roots: string[] = []

async function root(): Promise<string> {
  const value = await mkdtemp(path.join(await realpath(tmpdir()), 'storage-object-test-'))
  roots.push(value)
  return value
}

async function streamText(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true })))
})

describe('LocalObjectStorage containment and streaming', () => {
  test.each([
    '../outside',
    '..%2Foutside',
    '%2e%2e%2foutside',
    '%252e%252e%252foutside',
    '/tmp/outside',
    '\\tmp\\outside',
    'file:///tmp/outside',
    `${objectKey}\0outside`,
    `${objectKey}/../outside`,
  ])('rejects hostile object key %s before filesystem access', async (hostile) => {
    const storage = new LocalObjectStorage(await root())
    await expect(storage.writePart(hostile, 1, Readable.from('owned'))).rejects.toThrow(
      'invalid object key',
    )
    await expect(storage.openRead(hostile)).rejects.toThrow('invalid object key')
  })

  test('rejects symlink escapes under both parts and files roots', async () => {
    const storageRoot = await root()
    const outside = await root()
    await mkdir(path.join(storageRoot, 'parts'), { recursive: true })
    await mkdir(path.join(storageRoot, 'files', 'pointers'), { recursive: true })
    await symlink(outside, path.join(storageRoot, 'parts', objectKey))
    await symlink(path.join(outside, 'final'), path.join(storageRoot, 'files', 'pointers', objectKey))
    await writeFile(path.join(outside, 'final'), 'secret')

    const storage = new LocalObjectStorage(storageRoot)
    await expect(storage.writePart(objectKey, 1, Readable.from('owned'))).rejects.toThrow(
      'unsafe storage path',
    )
    await expect(storage.openRead(objectKey)).rejects.toThrow('unsafe storage path')
    expect(await readFile(path.join(outside, 'final'), 'utf8')).toBe('secret')
  })

  test('rejects STORAGE_PATH itself and any configured ancestor symlink', async () => {
    const base = await root()
    const outside = await root()
    const rootLink = path.join(base, 'storage-link')
    await symlink(outside, rootLink)
    await expect(new LocalObjectStorage(rootLink).ready()).rejects.toThrow('unsafe storage path')

    const ancestorLink = path.join(base, 'ancestor-link')
    await symlink(outside, ancestorLink)
    await expect(new LocalObjectStorage(path.join(ancestorLink, 'nested')).ready()).rejects.toThrow('unsafe storage path')
  })

  test('canonicalizes a trusted system symlink prefix such as macOS /tmp', async () => {
    const unique = `storage-system-link-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const storageRoot = path.join('/tmp', unique)
    await expect(new LocalObjectStorage(storageRoot).ready()).resolves.toBeUndefined()
    roots.push(await realpath(storageRoot))
  })

  test('writes parts idempotently, composes in order, hashes, stats and reads without whole-object buffering', async () => {
    const storage = new LocalObjectStorage(await root())
    await storage.writePart(objectKey, 1, Readable.from(['wrong']))
    await storage.writePart(objectKey, 1, Readable.from(['hello ']))
    await storage.writePart(objectKey, 2, Readable.from(['world']))
    expect(await storage.inspectParts(objectKey, 2)).toEqual({
      complete: true,
      sizeBytes: 11n,
    })

    const completed = await storage.completeObject(objectKey, 2, generation, 11n)
    expect(completed).toEqual({
      sizeBytes: 11n,
      sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    })
    expect(await storage.stat(objectKey)).toEqual({ sizeBytes: 11n, generation })
    expect(await streamText(await storage.openRead(objectKey))).toBe('hello world')
    await storage.deleteParts(objectKey, 2)
    await expect(storage.inspectParts(objectKey, 2)).resolves.toEqual({ complete: false, sizeBytes: 0n })
  })

  test('does not publish a Local final when frozen expected size mismatches', async () => {
    const storage = new LocalObjectStorage(await root())
    await storage.writePart(objectKey, 1, Readable.from('abc'))
    await expect(storage.completeObject(objectKey, 1, generation, 4n)).rejects.toThrow(
      'object integrity mismatch',
    )
    await expect(storage.stat(objectKey)).resolves.toBeNull()
  })
})
