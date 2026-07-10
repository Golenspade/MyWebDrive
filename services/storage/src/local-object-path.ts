import path from 'path'

const OBJECT_KEY_PATTERN = /^[a-f0-9]{64}$/

export function isOpaqueObjectKey(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_KEY_PATTERN.test(value)
}

export function resolveLocalObjectPath(storageRoot: string, objectKey: string): string {
  if (!isOpaqueObjectKey(objectKey)) throw new Error('Invalid object key')

  const filesRoot = path.resolve(storageRoot, 'files')
  const candidate = path.resolve(filesRoot, objectKey)

  if (!candidate.startsWith(`${filesRoot}${path.sep}`)) throw new Error('Invalid object key')

  return candidate
}
