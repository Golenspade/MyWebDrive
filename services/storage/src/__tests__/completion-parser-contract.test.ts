import request from 'supertest'
import { describe, expect, test } from 'vitest'

import { createStorageApi } from '../api.js'
import { createStorageApiApp } from '../server.js'

describe('storage completion parser contract', () => {
  test('preserves Express default HTML for oversized completion JSON', async () => {
    const app = createStorageApiApp({
      router: createStorageApi({} as never),
    })

    const response = await request(app)
      .post('/api/v1/storage/uploads/object-key/complete')
      .set('Content-Type', 'application/json')
      .send({ padding: 'x'.repeat(2048) })

    expect(response.status).toBe(413)
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(response.text).toMatch(/^<!DOCTYPE html>/)
  })
})
