import express from 'express'
import { Readable } from 'stream'
import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { signStorageGrant } from '../access-grant.js'
import { GrantConsumptionUnavailable, createDownloadRouter } from '../download-router.js'

const secret = 'storage-grant-secret-that-is-long-enough-for-tests'
const objectKey = 'c'.repeat(64)

function createTestApp(options?: { consumeGrant?: () => Promise<boolean> }) {
  const app = express()
  app.use(createDownloadRouter({
    grantSecret: secret,
    consumeGrant: options?.consumeGrant || (async () => true),
    openObject: async () => Readable.from(['payload']),
  }))
  return app
}

describe('storage download router', () => {
  test('rejects a request without a download grant', async () => {
    await request(createTestApp())
      .get(`/api/v1/storage/objects/${objectKey}/download`)
      .expect(401, { error: 'Unauthorized' })
  })

  test('rejects an encoded traversal key before opening storage', async () => {
    const grant = signStorageGrant({ objectKey, purpose: 'download' }, secret)

    await request(createTestApp())
      .get('/api/v1/storage/objects/..%2F..%2F.env/download')
      .set('Authorization', `Bearer ${grant}`)
      .expect(400, { error: 'Invalid object key' })
  })

  test('rejects a grant for a different object', async () => {
    const grant = signStorageGrant({ objectKey, purpose: 'download' }, secret)

    await request(createTestApp())
      .get(`/api/v1/storage/objects/${'d'.repeat(64)}/download`)
      .set('Authorization', `Bearer ${grant}`)
      .expect(403, { error: 'Storage grant does not allow this object' })
  })

  test('fails closed when one-time grant storage is unavailable', async () => {
    const grant = signStorageGrant({ objectKey, purpose: 'download' }, secret)

    await request(createTestApp({
      consumeGrant: async () => { throw new GrantConsumptionUnavailable() },
    }))
      .get(`/api/v1/storage/objects/${objectKey}/download`)
      .set('Authorization', `Bearer ${grant}`)
      .expect(503, { error: 'Download authorization service unavailable' })
  })

  test('streams a matching one-time download grant', async () => {
    const grant = signStorageGrant({ objectKey, purpose: 'download' }, secret)

    const response = await request(createTestApp())
      .get(`/api/v1/storage/objects/${objectKey}/download`)
      .set('Authorization', `Bearer ${grant}`)
      .expect(200)

    expect(response.body.toString()).toBe('payload')
    expect(response.headers['content-disposition']).toBe('attachment')
  })

  test.each([
    '/api/v1/storage/files/legacy/download',
    '/api/v1/storage/files/legacy/direct-url',
    '/api/v1/storage/files/legacy/download-direct',
  ])('disables legacy public route %s', async (url) => {
    await request(createTestApp()).get(url).expect(410, { error: 'Legacy download endpoint disabled' })
  })
})
