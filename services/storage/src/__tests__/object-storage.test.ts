import { Readable } from 'node:stream'
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import { LocalObjectStorage } from '../object-storage/local.js'

const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'
const roots: string[] = []

async function root(): Promise<string> {
  const value = await mkdtemp(path.join(tmpdir(), 'storage-object-test-'))
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
    await mkdir(path.join(storageRoot, 'files'), { recursive: true })
    await symlink(outside, path.join(storageRoot, 'parts', objectKey))
    await symlink(path.join(outside, 'final'), path.join(storageRoot, 'files', objectKey))
    await writeFile(path.join(outside, 'final'), 'secret')

    const storage = new LocalObjectStorage(storageRoot)
    await expect(storage.writePart(objectKey, 1, Readable.from('owned'))).rejects.toThrow(
      'unsafe storage path',
    )
    await expect(storage.openRead(objectKey)).rejects.toThrow('unsafe storage path')
    expect(await readFile(path.join(outside, 'final'), 'utf8')).toBe('secret')
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

    const completed = await storage.completeObject(objectKey, 2)
    expect(completed).toEqual({
      sizeBytes: 11n,
      sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    })
    expect(await storage.stat(objectKey)).toEqual({ sizeBytes: 11n })
    expect(await streamText(await storage.openRead(objectKey))).toBe('hello world')
  })
})
