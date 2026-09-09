import type { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../../app.js'
import { issueAccessToken } from '../../auth/access-token.js'

const sessionSecret = 'admin-router-session-secret-at-least-32-bytes'
const now = new Date('2026-07-15T06:00:00.000Z')
const admin = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.test',
  displayName: 'Admin',
  role: 'admin',
  status: 'active',
  createdAt: new Date('2026-07-14T06:00:00.000Z'),
}
const member = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'member@example.test',
  displayName: 'Member',
  role: 'user',
  status: 'active',
  createdAt: new Date('2026-07-13T06:00:00.000Z'),
  quotaAccount: {
    limitBytes: 1_000n,
    reservedBytes: 100n,
    committedBytes: 300n,
  },
}

function token(user: { id: string; role: string }) {
  return issueAccessToken(user, sessionSecret)
}

function dependencies(prisma: PrismaClient): CoreDependencies {
  return {
    prisma,
    redis: { ping: vi.fn(async () => 'PONG') } as unknown as CoreDependencies['redis'],
    emailSender: { sendOtp: vi.fn(async () => undefined) },
    now: () => now,
    randomBytes: (size) => Buffer.alloc(size, 1),
    identity: {
      sessionSecret,
      otpPepper: 'admin-router-otp-pepper-at-least-32-bytes',
      adminEmails: '',
      production: false,
      defaultUserQuotaBytes: 1_000n,
    },
    storage: {
      grantSecret: 'admin-router-storage-secret-at-least-32-bytes',
      callbackSecret: 'admin-router-callback-secret-at-least-32-bytes',
    },
    quota: {
      poolBytes: 10_000n,
      platformReserveBytes: 0n,
    },
  }
}

function usersPrisma(role = 'admin') {
  return {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === admin.id) return { ...admin, role }
        if (where.id === member.id) return member
        return null
      }),
      count: vi.fn(async () => 1),
      findMany: vi.fn(async () => [member]),
      update: vi.fn(async () => ({ id: member.id, role: 'admin' })),
    },
  } as unknown as PrismaClient
}

function poolPrisma(role = 'admin') {
  const prisma = {
    user: {
      findUnique: vi.fn(async () => ({ ...admin, role })),
      findMany: vi.fn(async () => [
        {
          id: member.id,
          role: 'user',
          status: 'active',
          quotaAccount: member.quotaAccount,
        },
      ]),
    },
    quotaReservation: {
      findMany: vi.fn(async () => []),
    },
    quotaAccount: {
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => [
        { userId: member.id, limitBytes: member.quotaAccount.limitBytes },
      ]),
    },
    quotaLedgerEntry: {
      create: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async (operation: (tx: unknown) => unknown) => operation(prisma)),
  }
  return prisma as unknown as PrismaClient
}

function notificationsPrisma(role = 'admin') {
  const notification = {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Core release completed',
    description: 'All active services are healthy',
    severity: 'success',
    service: 'core-api',
    unread: true,
    createdAt: now,
    meta: { status: 'healthy' },
  }
  return {
    user: {
      findUnique: vi.fn(async () => ({ ...admin, role })),
    },
    adminNotification: {
      create: vi.fn(async () => notification),
      count: vi.fn(async () => 1),
      findMany: vi.fn(async () => [notification]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  } as unknown as PrismaClient
}

describe('Core admin users contract', () => {
  test('lists authoritative Core identities with decimal quota balances', async () => {
    const prisma = usersPrisma()
    const response = await request(createCoreApp(dependencies(prisma)))
      .get('/api/v1/admin/users?query=member&page=1&pageSize=10')
      .set('Authorization', `Bearer ${token(admin)}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      items: [
        {
          id: member.id,
          name: 'Member',
          email: member.email,
          role: 'user',
          status: 'active',
          createdAt: member.createdAt.toISOString(),
          quota: {
            limitBytes: '1000',
            reservedBytes: '100',
            committedBytes: '300',
            availableBytes: '600',
          },
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    })
    expect((prisma.user.findMany as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { email: { contains: 'member', mode: 'insensitive' } },
            { displayName: { contains: 'member', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
      }),
    )
  })

  test('returns one Core user and changes roles through the same admin surface', async () => {
    const prisma = usersPrisma()
    const app = createCoreApp(dependencies(prisma))

    const detail = await request(app)
      .get(`/api/v1/admin/users/${member.id}`)
      .set('Authorization', `Bearer ${token(admin)}`)
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({
      id: member.id,
      name: 'Member',
      quota: { committedBytes: '300', limitBytes: '1000' },
    })

    await request(app)
      .patch(`/api/v1/admin/users/${member.id}/role`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .send({ role: 'admin' })
      .expect(200, { id: member.id, role: 'admin' })
  })

  test('lets an administrator assign the superuser role', async () => {
    const prisma = usersPrisma()
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: member.id,
      role: 'superuser',
    })

    await request(createCoreApp(dependencies(prisma)))
      .patch(`/api/v1/admin/users/${member.id}/role`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .send({ role: 'superuser' })
      .expect(200, { id: member.id, role: 'superuser' })
  })

  test('lets a superuser read users but not change roles', async () => {
    const prisma = usersPrisma('superuser')
    const app = createCoreApp(dependencies(prisma))
    const authorization = `Bearer ${token({ ...admin, role: 'superuser' })}`

    await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', authorization)
      .expect(200)

    await request(app)
      .patch(`/api/v1/admin/users/${member.id}/role`)
      .set('Authorization', authorization)
      .send({ role: 'user' })
      .expect(403, { error: 'admin access required' })
  })

  test('lets a superuser preview the pool but not rebalance it', async () => {
    const prisma = poolPrisma('superuser')
    const app = createCoreApp(dependencies(prisma))
    const authorization = `Bearer ${token({ ...admin, role: 'superuser' })}`

    const preview = await request(app)
      .get('/api/v1/admin/quota/pool')
      .set('Authorization', authorization)
    expect(preview.status).toBe(200)
    expect(preview.body.poolBytes).toBe('10000')
    expect(preview.body.allocableBytes).toBe('9600')

    await request(app)
      .post('/api/v1/admin/quota/rebalance')
      .set('Authorization', authorization)
      .expect(403, { error: 'admin access required' })
  })

  test('lets an administrator persist a pool rebalance', async () => {
    const prisma = poolPrisma()
    const response = await request(createCoreApp(dependencies(prisma)))
      .post('/api/v1/admin/quota/rebalance')
      .set('Authorization', `Bearer ${token(admin)}`)

    expect(response.status).toBe(200)
    expect(response.body.overcommitted).toBe(false)
    expect(prisma.quotaAccount.update).toHaveBeenCalled()
    expect(prisma.quotaLedgerEntry.create).toHaveBeenCalled()
  })

  test('rejects a manual quota that exceeds the remaining pool', async () => {
    const prisma = poolPrisma()
    await request(createCoreApp(dependencies(prisma)))
      .patch(`/api/v1/admin/users/${member.id}/quota`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .send({ limitBytes: '20000' })
      .expect(409, { error: 'pool exceeded' })
  })

  test('requires a live Core administrator', async () => {
    const prisma = usersPrisma('user')
    await request(createCoreApp(dependencies(prisma)))
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token({ ...admin, role: 'user' })}`)
      .expect(403, { error: 'admin access required' })
  })
})

describe('Core admin notifications contract', () => {
  test('creates, filters and marks persistent notifications as read', async () => {
    const prisma = notificationsPrisma()
    const app = createCoreApp(dependencies(prisma))
    const authorization = `Bearer ${token(admin)}`

    const created = await request(app)
      .post('/api/v1/admin/notifications')
      .set('Authorization', authorization)
      .send({
        title: 'Core release completed',
        description: 'All active services are healthy',
        severity: 'success',
        service: 'core-api',
        meta: { status: 'healthy' },
      })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      id: '33333333-3333-4333-8333-333333333333',
      severity: 'success',
      unread: true,
    })

    const listed = await request(app)
      .get('/api/v1/admin/notifications?unreadOnly=true&service=core-api&severity=success&q=release&page=1&pageSize=12')
      .set('Authorization', authorization)
    expect(listed.status).toBe(200)
    expect(listed.body).toMatchObject({ page: 1, pageSize: 12, total: 1 })
    expect(listed.body.items).toHaveLength(1)

    await request(app)
      .post('/api/v1/admin/notifications/mark-read')
      .set('Authorization', authorization)
      .send({ ids: ['33333333-3333-4333-8333-333333333333'] })
      .expect(200, { ok: true, updated: 1 })
  })

  test('rejects invalid notification input and non-admin callers', async () => {
    const prisma = notificationsPrisma('user')
    const app = createCoreApp(dependencies(prisma))

    await request(app)
      .get('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${token({ ...admin, role: 'user' })}`)
      .expect(403, { error: 'admin access required' })

    const adminPrisma = notificationsPrisma()
    await request(createCoreApp(dependencies(adminPrisma)))
      .post('/api/v1/admin/notifications')
      .set('Authorization', `Bearer ${token(admin)}`)
      .send({ title: '', severity: 'unknown' })
      .expect(400, { error: 'invalid notification' })
  })
})
