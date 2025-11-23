import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '../prisma/client/index.js'

// We will set envs in the test process before importing app

let app: any
const prisma = new PrismaClient()

function makeJwt(payload: any): string {
  const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken')
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret')
}

describe('metadata API - folders & files basic flows', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'dev-secret'
    if (!process.env.METADATA_DATABASE_URL) {
      process.env.METADATA_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/metadata?schema=public'
    }
    const mod = await import('../src/index.js')
    app = (mod as any).app || mod.default || mod
  })

  beforeEach(async () => {
    await prisma.fileTag.deleteMany()
    await prisma.fileVersion.deleteMany()
    await prisma.file.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates folder in root and lists children', async () => {
    const userId = 'user-folder-1'
    const token = makeJwt({ user_id: userId, role: 'user' })

    const createRes = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Docs' })
      .expect(201)

    expect(createRes.body).toHaveProperty('id')
    expect(createRes.body).toMatchObject({ name: 'Docs', ownerId: userId, type: 'folder', parentId: null, path: '/Docs' })

    const folderId = createRes.body.id as string

    const listRoot = await request(app)
      .get('/api/v1/folders/root/children')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(Array.isArray(listRoot.body.items)).toBe(true)
    expect(listRoot.body.items.length).toBe(1)
    expect(listRoot.body.items[0]).toMatchObject({ id: folderId, name: 'Docs', type: 'folder', parentId: null })
  })
})

