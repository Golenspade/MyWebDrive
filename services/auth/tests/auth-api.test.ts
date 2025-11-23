import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '../prisma/client/index.js'

const prisma = new PrismaClient()

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

// Lazy import to ensure env is set
async function getApp() {
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

})

