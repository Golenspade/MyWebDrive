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

  it('rejects invalid folder names and duplicate names in same parent', async () => {
    const userId = 'user-folder-2'
    const token = makeJwt({ user_id: userId, role: 'user' })

    // empty / whitespace name
    await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' })
      .expect(400)

    await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' })
      .expect(400)

    // create first folder
    const res1 = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Docs' })
      .expect(201)

    const rootFolderId = res1.body.id as string

    // duplicate name in same parent (root)
    await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Docs' })
      .expect(400)

    // create child under root, then duplicate under same parent
    const childRes = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Work', parentId: rootFolderId })
      .expect(201)

    expect(childRes.body.parentId).toBe(rootFolderId)
    expect(childRes.body.path).toBe('/Docs/Work')

    await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Work', parentId: rootFolderId })
      .expect(400)
  })

  it('lists children for nested folders and handles not-found folder', async () => {
    const userId = 'user-folder-3'
    const token = makeJwt({ user_id: userId, role: 'user' })

    // root -> A -> B
    const resRootA = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })
      .expect(201)

    const aId = resRootA.body.id as string

    const resAB = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B', parentId: aId })
      .expect(201)

    const bId = resAB.body.id as string
    expect(resAB.body.parentId).toBe(aId)

    // list root children -> only A
    const listRoot = await request(app)
      .get('/api/v1/folders/root/children')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listRoot.body.items.map((it: any) => it.name)).toEqual(['A'])
    expect(listRoot.body.items[0].parentId).toBeNull()

    // list A children -> only B
    const listA = await request(app)
      .get(`/api/v1/folders/${aId}/children`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listA.body.items.map((it: any) => it.name)).toEqual(['B'])

    // not found folder id
    await request(app)
      .get('/api/v1/folders/non-existent/children')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('renames folder and updates paths of descendants', async () => {
    const userId = 'user-folder-rename-1'
    const token = makeJwt({ user_id: userId, role: 'user' })

    const resA = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })
      .expect(201)

    const aId = resA.body.id as string

    const resB = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B', parentId: aId })
      .expect(201)

    const bId = resB.body.id as string

    const file = await prisma.file.create({
      data: {
        id: 'file-rename-note',
        name: 'note.txt',
        type: 'file',
        ownerId: userId,
        parentId: bId,
        path: '/A/B/note.txt',
        size: 10,
        version: 1,
      },
    })

    const renameRes = await request(app)
      .patch(`/api/v1/folders/${aId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A-renamed' })
      .expect(200)

    expect(renameRes.body).toMatchObject({ id: aId, name: 'A-renamed', path: '/A-renamed' })

    const updatedB = await prisma.file.findUnique({ where: { id: bId } })
    expect(updatedB?.path).toBe('/A-renamed/B')

    const updatedFile = await prisma.file.findUnique({ where: { id: file.id } })
    expect(updatedFile?.path).toBe('/A-renamed/B/note.txt')
  })

  it('rejects invalid or duplicate folder rename and not-found folder', async () => {
    const userId = 'user-folder-rename-2'
    const token = makeJwt({ user_id: userId, role: 'user' })

    // invalid name
    await request(app)
      .patch('/api/v1/folders/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' })
      .expect(400)

    const resA = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })
      .expect(201)

    const aId = resA.body.id as string

    const resB = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B' })
      .expect(201)

    const bId = resB.body.id as string

    // duplicate rename: B -> A
    await request(app)
      .patch(`/api/v1/folders/${bId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })
      .expect(400)

    // not-found folder
    await request(app)
      .patch('/api/v1/folders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' })
      .expect(404)
  })

  it('soft-deletes folder and all its descendants', async () => {
    const userId = 'user-folder-delete-1'
    const token = makeJwt({ user_id: userId, role: 'user' })

    const resA = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })
      .expect(201)

    const aId = resA.body.id as string

    const resB = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B', parentId: aId })
      .expect(201)

    const bId = resB.body.id as string

    const fileInA = await prisma.file.create({
      data: {
        id: 'file-delete-root',
        name: 'root.txt',
        type: 'file',
        ownerId: userId,
        parentId: aId,
        path: '/A/root.txt',
        size: 10,
        version: 1,
      },
    })

    const fileInB = await prisma.file.create({
      data: {
        id: 'file-delete-child',
        name: 'child.txt',
        type: 'file',
        ownerId: userId,
        parentId: bId,
        path: '/A/B/child.txt',
        size: 20,
        version: 1,
      },
    })

    const resC = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'C' })
      .expect(201)

    const cId = resC.body.id as string

    await request(app)
      .delete(`/api/v1/folders/${aId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    const a = await prisma.file.findUnique({ where: { id: aId } })
    const b = await prisma.file.findUnique({ where: { id: bId } })
    const fa = await prisma.file.findUnique({ where: { id: fileInA.id } })
    const fb = await prisma.file.findUnique({ where: { id: fileInB.id } })
    const c = await prisma.file.findUnique({ where: { id: cId } })

    expect(a?.deletedAt).toBeTruthy()
    expect(b?.deletedAt).toBeTruthy()
    expect(fa?.deletedAt).toBeTruthy()
    expect(fb?.deletedAt).toBeTruthy()
    expect(c?.deletedAt).toBeNull()
  })

  it('moves folder between parents and rejects invalid moves', async () => {
    const userId = 'user-folder-move-1'
    const token = makeJwt({ user_id: userId, role: 'user' })

    const resA = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })
      .expect(201)

    const aId = resA.body.id as string

    const resB = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B', parentId: aId })
      .expect(201)

    const bId = resB.body.id as string

    const resC = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'C' })
      .expect(201)

    const cId = resC.body.id as string

    const fileInB = await prisma.file.create({
      data: {
        id: 'file-move-child',
        name: 'child.txt',
        type: 'file',
        ownerId: userId,
        parentId: bId,
        path: '/A/B/child.txt',
        size: 5,
        version: 1,
      },
    })

    // valid move: B from A -> C
    await request(app)
      .post(`/api/v1/folders/${bId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: cId })
      .expect(204)

    const movedB = await prisma.file.findUnique({ where: { id: bId } })
    const movedFile = await prisma.file.findUnique({ where: { id: fileInB.id } })

    expect(movedB?.parentId).toBe(cId)
    expect(movedB?.path).toBe('/C/B')
    expect(movedFile?.path).toBe('/C/B/child.txt')

    // cannot move folder to itself (any folder)
    await request(app)
      .post(`/api/v1/folders/${aId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: aId })
      .expect(400)

    // cannot move ancestor into its descendant: C -> B (C is ancestor of B after previous move)
    await request(app)
      .post(`/api/v1/folders/${cId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: bId })
      .expect(400)

    // target not found
    await request(app)
      .post(`/api/v1/folders/${aId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: '00000000-0000-0000-0000-000000000000' })
      .expect(404)

    // duplicate name in target folder
    const resD = await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'D' })
      .expect(201)

    const dId = resD.body.id as string

    // create folder named E under D
    await request(app)
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B', parentId: dId })
      .expect(201)

    // try to move B under D again (name conflict)
    await request(app)
      .post(`/api/v1/folders/${bId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: dId })
      .expect(400)
  })

  it('gets file by id and respects ownership', async () => {
    const userId = 'user-file-get-1'
    const otherUserId = 'user-file-get-2'
    const tokenUser = makeJwt({ user_id: userId, role: 'user' })
    const tokenOther = makeJwt({ user_id: otherUserId, role: 'user' })

    const folder = await prisma.file.create({
      data: {
        id: 'folder-file-get-root',
        name: 'Docs',
        type: 'folder',
        ownerId: userId,
        path: '/Docs',
      },
    })

    const file = await prisma.file.create({
      data: {
        id: 'file-get-1',
        name: 'report.txt',
        type: 'file',
        ownerId: userId,
        parentId: folder.id,
        path: '/Docs/report.txt',
        size: 0,
      },
    })

    const res = await request(app)
      .get(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${tokenUser}`)
      .expect(200)

    expect(res.body).toMatchObject({
      id: file.id,
      name: 'report.txt',
      ownerId: userId,
      type: 'file',
      parentId: folder.id,
    })

    await request(app)
      .get('/api/v1/files/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenUser}`)
      .expect(404)

    await request(app)
      .get(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${tokenOther}`)
      .expect(404)
  })

  it('renames file and updates its path with validation', async () => {
    const userId = 'user-file-rename-1'
    const token = makeJwt({ user_id: userId, role: 'user' })

    const folder = await prisma.file.create({
      data: {
        id: 'folder-file-rename-root',
        name: 'Docs',
        type: 'folder',
        ownerId: userId,
        path: '/Docs',
      },
    })

    const file = await prisma.file.create({
      data: {
        id: 'file-rename-1',
        name: 'report.txt',
        type: 'file',
        ownerId: userId,
        parentId: folder.id,
        path: '/Docs/report.txt',
        size: 0,
      },
    })

    const renameRes = await request(app)
      .patch(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'report-final.txt' })
      .expect(200)

    expect(renameRes.body).toMatchObject({
      id: file.id,
      name: 'report-final.txt',
      path: '/Docs/report-final.txt',
    })

    const updated = await prisma.file.findUnique({ where: { id: file.id } })
    expect(updated?.path).toBe('/Docs/report-final.txt')

    await request(app)
      .patch(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' })
      .expect(400)

    const otherFile = await prisma.file.create({
      data: {
        id: 'file-rename-dup',
        name: 'another.txt',
        type: 'file',
        ownerId: userId,
        parentId: folder.id,
        path: '/Docs/another.txt',
        size: 0,
      },
    })

    await request(app)
      .patch(`/api/v1/files/${otherFile.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'report-final.txt' })
      .expect(400)

    await request(app)
      .patch('/api/v1/files/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'nope.txt' })
      .expect(404)
  })
  it('deletes file softly and returns 404 for missing', async () => {
    const userId = 'user-file-delete-1'
    const otherUserId = 'user-file-delete-2'
    const tokenUser = makeJwt({ user_id: userId, role: 'user' })
    const tokenOther = makeJwt({ user_id: otherUserId, role: 'user' })

    const folder = await prisma.file.create({
      data: {
        id: 'folder-file-delete-root',
        name: 'Docs',
        type: 'folder',
        ownerId: userId,
        path: '/Docs',
      },
    })

    const file = await prisma.file.create({
      data: {
        id: 'file-delete-1',
        name: 'old.txt',
        type: 'file',
        ownerId: userId,
        parentId: folder.id,
        path: '/Docs/old.txt',
        size: 123,
      },
    })

    await request(app)
      .delete(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${tokenUser}`)
      .expect(204)

    const deleted = await prisma.file.findUnique({ where: { id: file.id } })
    expect(deleted?.deletedAt).toBeTruthy()

    await request(app)
      .delete(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${tokenUser}`)
      .expect(404)

    await request(app)
      .delete(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${tokenOther}`)
      .expect(404)
  })

  it('moves file between folders and validates target', async () => {
    const userId = 'user-file-move-1'
    const token = makeJwt({ user_id: userId, role: 'user' })

    const root = await prisma.file.create({
      data: {
        id: 'folder-file-move-root',
        name: 'Root',
        type: 'folder',
        ownerId: userId,
        path: '/Root',
      },
    })

    const dest = await prisma.file.create({
      data: {
        id: 'folder-file-move-dest',
        name: 'Dest',
        type: 'folder',
        ownerId: userId,
        path: '/Dest',
      },
    })

    const file = await prisma.file.create({
      data: {
        id: 'file-move-1',
        name: 'note.txt',
        type: 'file',
        ownerId: userId,
        parentId: root.id,
        path: '/Root/note.txt',
        size: 10,
      },
    })

    await request(app)
      .post(`/api/v1/files/${file.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: dest.id })
      .expect(204)

    const moved = await prisma.file.findUnique({ where: { id: file.id } })
    expect(moved?.parentId).toBe(dest.id)
    expect(moved?.path).toBe('/Dest/note.txt')

    const conflict = await prisma.file.create({
      data: {
        id: 'file-move-conflict',
        name: 'note.txt',
        type: 'file',
        ownerId: userId,
        parentId: root.id,
        path: '/Root/note.txt',
      },
    })

    await request(app)
      .post(`/api/v1/files/${conflict.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: dest.id })
      .expect(400)

    await request(app)
      .post(`/api/v1/files/${file.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: '00000000-0000-0000-0000-000000000000' })
      .expect(404)

    await request(app)
      .post('/api/v1/files/00000000-0000-0000-0000-000000000000/move')
      .set('Authorization', `Bearer ${token}`)
      .send({ newParentId: dest.id })
      .expect(404)
  })


})

