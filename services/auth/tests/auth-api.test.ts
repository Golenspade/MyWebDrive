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

// Helpers for owner login tests
async function getAppWithOwnerCode(ownerCode: string = 'owner-secret-code') {
  const hash = await bcrypt.hash(ownerCode, 10)
  process.env.OWNER_CODE_HASH = hash
  process.env.OWNER_COOKIE_SECRET = 'owner-test-secret'
  process.env.OWNER_COOKIE_TTL_SEC = '3600'
  process.env.COOKIE_SECURE = 'false'
  vi.resetModules()
  const mod = await import('../src/index.js')
  const app = (mod as any).app || (mod as any).default || (mod as any)
  return { app, ownerCode }
}

async function getAppWithoutOwnerCode() {
  process.env.OWNER_CODE_HASH = ''
  process.env.OWNER_COOKIE_SECRET = 'owner-test-secret'
  process.env.OWNER_COOKIE_TTL_SEC = '3600'
  process.env.COOKIE_SECURE = 'false'
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

  describe('invitation admin APIs', () => {
    it('requires admin role for creating invitations', async () => {
      const app = await getApp()

      // no token -> 401
      await request(app).post('/api/v1/auth/invitations').send({}).expect(401)

      // user token -> 403
      const userToken = makeUserToken('normal-user')
      await request(app)
        .post('/api/v1/auth/invitations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(403)
    })

    it('admin can create and list invitations', async () => {
      const app = await getApp()
      const adminId = 'admin-user-id'
      const adminToken = makeAdminToken(adminId)

      const createRes = await request(app)
        .post('/api/v1/auth/invitations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usageLimit: 5, notes: 'for testing' })
        .expect(201)

      expect(createRes.body).toHaveProperty('code')
      expect(createRes.body.issuedBy).toBe(adminId)
      expect(createRes.body.usageLimit).toBe(5)

      const listRes = await request(app)
        .get('/api/v1/auth/invitations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(Array.isArray(listRes.body)).toBe(true)
      const created = listRes.body.find((it: any) => it.code === createRes.body.code)
      expect(created).toBeTruthy()
    })

    it('admin can get invitation by code and revoke it', async () => {
      const app = await getApp()
      const adminToken = makeAdminToken('admin-user-id')

      const created = await prisma.invitationCode.create({
        data: {
          code: 'ADMIN-GET-REVOKE',
          issuedBy: 'admin-user-id',
          usageLimit: 3,
          usedCount: 0,
          isActive: true,
        },
      })

      const getRes = await request(app)
        .get(`/api/v1/auth/invitations/${created.code}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(getRes.body.code).toBe(created.code)

      await request(app)
        .post(`/api/v1/auth/invitations/${created.code}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const updated = await prisma.invitationCode.findUnique({ where: { code: created.code } })
      expect(updated?.isActive).toBe(false)

      await request(app)
        .post(`/api/v1/auth/invitations/${created.code}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('returns 404 when invitation not found for get', async () => {
      const app = await getApp()
      const adminToken = makeAdminToken('admin-user-id')

      await request(app)
        .get('/api/v1/auth/invitations/NON_EXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })
  })


  describe('owner login and logout', () => {
    it('fails with 400 when code is missing', async () => {
      const { app } = await getAppWithOwnerCode()

      await request(app).post('/api/v1/auth/owner-login').send({}).expect(400)
    })

    it('fails with 503 when owner code hash is not configured', async () => {
      const app = await getAppWithoutOwnerCode()

      await request(app)
        .post('/api/v1/auth/owner-login')
        .send({ code: 'anything' })
        .expect(503)
    })

    it('fails with 401 when owner code is incorrect', async () => {
      const { app } = await getAppWithOwnerCode('real-owner-code')

      await request(app)
        .post('/api/v1/auth/owner-login')
        .send({ code: 'wrong-code' })
        .expect(401)
    })

    it('sets owner cookie on successful login', async () => {
      const { app, ownerCode } = await getAppWithOwnerCode('my-owner-code')

      const res = await request(app)
        .post('/api/v1/auth/owner-login')
        .send({ code: ownerCode })
        .expect(200)

      const setCookie = res.headers['set-cookie']
      expect(setCookie).toBeDefined()
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie
      expect(cookieHeader).toContain('owner=')
      expect(cookieHeader).toContain('HttpOnly')
      expect(cookieHeader).toContain('SameSite=Lax')
      expect(cookieHeader).toContain('Max-Age=3600')
    })

    it('owner-logout always clears owner cookie', async () => {
      const app = await getAppWithoutOwnerCode()

      const res = await request(app).post('/api/v1/auth/owner-logout').send({}).expect(200)

      const setCookie = res.headers['set-cookie']
      expect(setCookie).toBeDefined()
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie
      expect(cookieHeader).toContain('owner=deleted')
      expect(cookieHeader).toContain('Max-Age=0')
    })

  })



  describe('admin users APIs', () => {
    it('requires admin role for listing users', async () => {
      const app = await getApp()

      await request(app).get('/api/v1/auth/admin/users').expect(401)

      const userToken = makeUserToken('normal-user')
      await request(app)
        .get('/api/v1/auth/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })

    it('admin can list users with pagination', async () => {
      const app = await getApp()
      const adminId = 'admin-list'
      const adminToken = makeAdminToken(adminId)

      await prisma.user.createMany({
        data: [
          {
            id: adminId,
            name: 'Admin User',
            email: 'admin-list@example.com',
            password: 'hash',
            role: 'admin',
          },
          {
            id: 'user-1',
            name: 'User One',
            email: 'user1@example.com',
            password: 'hash',
            role: 'user',
          },
          {
            id: 'user-2',
            name: 'User Two',
            email: 'user2@example.com',
            password: 'hash',
            role: 'user',
          },
        ],
      })

      const res = await request(app)
        .get('/api/v1/auth/admin/users?page=1&pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('items')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body).toHaveProperty('page')
      expect(res.body).toHaveProperty('pageSize')
      expect(res.body).toHaveProperty('total')
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(2)
    })

    it('admin can get user statistics', async () => {
      const app = await getApp()
      const adminId = 'admin-stats'
      const adminToken = makeAdminToken(adminId)

      const now = new Date()
      const past = new Date(now.getTime() - 10 * 24 * 3600 * 1000)

      await prisma.user.createMany({
        data: [
          {
            id: adminId,
            name: 'Admin Stats',
            email: 'admin-stats@example.com',
            password: 'hash',
            role: 'admin',
            createdAt: past,
            updatedAt: past,
          },
          {
            id: 'new-user',
            name: 'New User',
            email: 'new-user@example.com',
            password: 'hash',
            role: 'user',
            createdAt: now,
            updatedAt: now,
          },
        ],
      })

      const res = await request(app)
        .get('/api/v1/auth/admin/users/statistics?range=30d')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('totalUsers')
      expect(res.body).toHaveProperty('newUsers')
      expect(res.body.totalUsers).toBeGreaterThanOrEqual(2)
    })

    it('admin can get user by id and handle not found', async () => {
      const app = await getApp()
      const adminId = 'admin-get'
      const adminToken = makeAdminToken(adminId)

      await prisma.user.create({
        data: {
          id: adminId,
          name: 'Admin Get',
          email: 'admin-get@example.com',
          password: 'hash',
          role: 'admin',
        },
      })

      await prisma.user.create({
        data: {
          id: 'target-user',
          name: 'Target User',
          email: 'target@example.com',
          password: 'hash',
          role: 'user',
        },
      })

      const okRes = await request(app)
        .get('/api/v1/auth/admin/users/target-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(okRes.body.id).toBe('target-user')

      await request(app)
        .get('/api/v1/auth/admin/users/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('admin can update user role and handles invalid role and missing user', async () => {
      const app = await getApp()
      const adminId = 'admin-role'
      const adminToken = makeAdminToken(adminId)

      await prisma.user.create({
        data: {
          id: adminId,
          name: 'Admin Role',
          email: 'admin-role@example.com',
          password: 'hash',
          role: 'admin',
        },
      })

      await prisma.user.create({
        data: {
          id: 'role-target',
          name: 'Role Target',
          email: 'role-target@example.com',
          password: 'hash',
          role: 'user',
        },
      })

      await request(app)
        .patch('/api/v1/auth/admin/users/role-target/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid-role' })
        .expect(400)

      const patchRes = await request(app)
        .patch('/api/v1/auth/admin/users/role-target/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200)

      expect(patchRes.body.role).toBe('admin')

      await request(app)
        .patch('/api/v1/auth/admin/users/non-existent/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(404)
    })
  })

  it('logout returns 204', async () => {
    const app = await getApp()

    await request(app)
      .post('/api/v1/auth/logout')
      .expect(204)
  })

  it('register with valid invitation code succeeds and increments usage', async () => {
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

