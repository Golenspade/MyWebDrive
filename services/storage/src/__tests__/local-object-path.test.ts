import { describe, expect, test } from 'vitest'
import { resolveLocalObjectPath } from '../local-object-path.js'

describe('local object paths', () => {
  test('resolves an opaque object key beneath the files root', () => {
    const objectKey = 'b'.repeat(64)

    expect(resolveLocalObjectPath('/tmp/storage', objectKey)).toBe(`/tmp/storage/files/${objectKey}`)
  })

  test('resolves an existing UUID object key beneath the files root', () => {
    const objectKey = '8c7f15d0-2d69-479f-9144-4ca736f10ed2'

    expect(resolveLocalObjectPath('/tmp/storage', objectKey)).toBe(`/tmp/storage/files/${objectKey}`)
  })

  test.each(['../.env', '..%2F..%2F.env', '/etc/passwd', 'nested/file', 'not-a-hash'])(
    'rejects non-opaque object key %s',
    (objectKey) => expect(() => resolveLocalObjectPath('/tmp/storage', objectKey)).toThrow('Invalid object key'),
  )
})
