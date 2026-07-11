import express from 'express'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { issueAccessToken } from '../access-token.js'
import { createAccessMiddleware, requireAdmin } from '../middleware.js'

const secret = 'middleware-test-secret-at-least-32-bytes'

function appFor(user: { id: string; email: string; role: string; status: string } | null) {
  const app = express()
  const prisma = {
    user: { findUnique: vi.fn(async () => user) },
  }
  app.use(createAccessMiddleware({ prisma: prisma as never, sessionSecret: secret }))
  app.get('/user', (req, res) => res.json(req.authUser))
  app.get('/admin', requireAdmin, (_req, res) => res.json({ ok: true }))
  return { app, prisma }
}

describe('Core access middleware', () => {
  test.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer one two']) (
    'rejects missing or malformed Authorization (%s)',
    async (authorization) => {
      const { app } = appFor({ id: 'user-1', email: 'user@example.test', role: 'user', status: 'active' })
      const call = request(app).get('/user')
      if (authorization !== undefined) call.set('Authorization', authorization)
      const response = await call
      expect(response.status).toBe(401)
      expect(response.body).toEqual({ error: 'invalid access token' })
    },
  )

  test('reloads the active user and ignores a stale role claim for authorization', async () => {
    const token = issueAccessToken({ id: 'admin-1', role: 'admin' }, secret)
    const { app, prisma } = appFor({
      id: 'admin-1',
      email: 'former-admin@example.test',
      role: 'user',
      status: 'active',
    })

    await request(app).get('/admin').set('Authorization', `Bearer ${token}`).expect(403)
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      select: { id: true, email: true, role: true, status: true },
    })
  })

  test('rejects disabled and deleted users after otherwise valid token verification', async () => {
    const token = issueAccessToken({ id: 'user-1', role: 'user' }, secret)
    const disabled = appFor({
      id: 'user-1',
      email: 'disabled@example.test',
      role: 'user',
      status: 'disabled',
    })
    await request(disabled.app)
      .get('/user')
      .set('Authorization', `Bearer ${token}`)
      .expect(401, { error: 'invalid access token' })

    const deleted = appFor(null)
    await request(deleted.app)
      .get('/user')
      .set('Authorization', `Bearer ${token}`)
      .expect(401, { error: 'invalid access token' })
  })
})
