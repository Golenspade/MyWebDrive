import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../prisma/client/index.js'

const prisma = new PrismaClient()

function makeAdminToken(userId = 'admin-user-id') {
  const secret = process.env.JWT_SECRET || 'test-secret-key'
  return jwt.sign({ user_id: userId, role: 'admin' }, secret, { expiresIn: 3600 })
}

function makeUserToken(userId = 'user-id') {
  const secret = process.env.JWT_SECRET || 'test-secret-key'
  return jwt.sign({ user_id: userId, role: 'user' }, secret, { expiresIn: 3600 })
}

// We rely on NODE_ENV=test so index.ts does NOT call app.listen
beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret-key'
  process.env.ACCESS_TOKEN_TTL = '900'
  process.env.REFRESH_TOKEN_TTL = '604800'
  process.env.REGISTRATION_REQUIRE_INVITE = 'false'
  vi.resetModules()
  process.env.AUTH_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/auth?schema=public'

  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.user.deleteMany({})
  await prisma.invitationCode.deleteMany({})
})

afterAll(async () => {
  await prisma.$disconnect()
})

// Lazy import to ensure env is set (REGISTRATION_REQUIRE_INVITE=false)
async function getApp() {
  const mod = await import('../src/index.js')
  const app = (mod as any).app || (mod as any).default || (mod as any)
  return app
}

// For invitation tests we need REQUIRE_INVITE=true.
// This helper flips the env flag, resets module cache, and imports a fresh app instance.
async function getAppWithInviteRequired() {
  process.env.REGISTRATION_REQUIRE_INVITE = 'true'
  vi.resetModules()
  const mod = await import('../src/index.js')
  const app = (mod as any).app || (mod as any).default || (mod as any)
  return app
}

describe('auth API basic flows', () => {
  it('register + login + refresh happy path', async () => {
    const app = await getApp()

    // 1) register
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'test-user',
        email: 'test@example.com',
        password: 'password123',
      })
      .expect(201)

    expect(reg.body).toHaveProperty('id')
    expect(reg.body).toHaveProperty('accessToken')
    expect(reg.body).toHaveProperty('refreshToken')

    // 2) login with correct password
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200)

    expect(login.body).toHaveProperty('accessToken')
    expect(login.body).toHaveProperty('refreshToken')

    const refreshToken = login.body.refreshToken

    // 3) refresh happy path
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200)

    expect(refresh.body).toHaveProperty('accessToken')
  })

  it('login fails with wrong password', async () => {
    const app = await getApp()

    // prepare user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'test-user',
        email: 'login-wrong@example.com',
        password: 'password123',
      })
      .expect(201)

    // wrong password
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login-wrong@example.com', password: 'not-correct' })
      .expect(401)
  })

  it('refresh fails with invalid token', async () => {
    const app = await getApp()

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'totally-invalid-token' })
      .expect(401)
  })

  it('register fails with missing fields', async () => {
    const app = await getApp()

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'missing-name@example.com',
        password: 'password123',
      })
      .expect(400)

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'missing-email',
        password: 'password123',
      })
      .expect(400)

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'missing-password',
        email: 'missing-password@example.com',
      })
      .expect(400)
  })

  it('register fails when email already exists', async () => {
    const app = await getApp()

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'first-user',
        email: 'duplicate@example.com',
        password: 'password123',
      })
      .expect(201)

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'second-user',
        email: 'duplicate@example.com',
        password: 'password123',
      })
      .expect(409)
  })

  it('login fails when user does not exist', async () => {
    const app = await getApp()

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'does-not-exist@example.com', password: 'password123' })
      .expect(401)
  })

  it('login fails with missing fields', async () => {
    const app = await getApp()

    await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'password123' })
      .expect(400)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'missing-password@example.com' })
      .expect(400)
  })

  it('logout returns 204', async () => {
    const app = await getApp()

    await request(app)
      .post('/api/v1/auth/logout')
      .expect(204)
  })

  it('register with valid invitation code succeeds and increments usage', async () => {
    // prepare an active invitation, expired yesterday
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    const invite = await prisma.invitationCode.create({
      data: {
        code: 'INVITE-OK',
        issuedBy: 'admin-user',
        usageLimit: 2,
        usedCount: 0,
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    })

    const app = await getAppWithInviteRequired()

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'invited-user',
        email: 'invited@example.com',
        password: 'password123',
        invitationCode: invite.code,
      })
      .expect(201)

    expect(res.body).toHaveProperty('id')

    const updatedInvite = await prisma.invitationCode.findUnique({ where: { code: invite.code } })
    expect(updatedInvite).not.toBeNull()
    expect(updatedInvite!.usedCount).toBe(1)
  })

  it('register fails when invite is expired', async () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    await prisma.invitationCode.create({
      data: {
        code: 'INVITE-EXPIRED',
        issuedBy: 'admin-user',
        usageLimit: 2,
        usedCount: 0,
        isActive: true,
        expiresAt: yesterday,
      },
    })

    const app = await getAppWithInviteRequired()

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'expired-user',
        email: 'expired@example.com',
        password: 'password123',
        invitationCode: 'INVITE-EXPIRED',
      })
      .expect(403)
  })

  it('register fails when invite usage limit is reached', async () => {
    await prisma.invitationCode.create({
      data: {
        code: 'INVITE-LIMIT',
        issuedBy: 'admin-user',
        usageLimit: 1,
        usedCount: 1,
        isActive: true,
      },
    })

    const app = await getAppWithInviteRequired()

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'limit-user',
        email: 'limit@example.com',
        password: 'password123',
        invitationCode: 'INVITE-LIMIT',
      })
      .expect(403)
  })

  it('register fails with invalid invitation code when invite required', async () => {
    const app = await getAppWithInviteRequired()

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'no-invite-user',
        email: 'no-invite@example.com',
        password: 'password123',
        invitationCode: 'NON-EXISTENT',
      })
      .expect(403)
  })
})

