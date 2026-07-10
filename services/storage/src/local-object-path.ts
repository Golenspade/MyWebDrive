import path from 'path'

const HASH_OBJECT_KEY_PATTERN = /^[a-f0-9]{64}$/
const UUID_OBJECT_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isOpaqueObjectKey(value: unknown): value is string {
  return typeof value === 'string' && (HASH_OBJECT_KEY_PATTERN.test(value) || UUID_OBJECT_KEY_PATTERN.test(value))
}

export function resolveLocalObjectPath(storageRoot: string, objectKey: string): string {
  if (!isOpaqueObjectKey(objectKey)) throw new Error('Invalid object key')

  const filesRoot = path.resolve(storageRoot, 'files')
  const candidate = path.resolve(filesRoot, objectKey)

  if (!candidate.startsWith(`${filesRoot}${path.sep}`)) throw new Error('Invalid object key')

  return candidate
}
