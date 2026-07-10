import jwt from 'jsonwebtoken'
import request from 'supertest'
import { expect, test } from 'vitest'
import { app } from '../index.js'

test('disables user-controlled storage adjustments', async () => {
  const token = jwt.sign({ user_id: 'user-1', role: 'user' }, 'dev-secret')

  await request(app)
    .post('/api/v1/users/me/storage/adjust')
    .set('Authorization', `Bearer ${token}`)
    .send({ delta: -1_000_000 })
    .expect(410, { error: 'Storage adjustment endpoint disabled' })
})
