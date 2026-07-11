import { createHmac, timingSafeEqual } from 'node:crypto'

import { Prisma, type PrismaClient } from '@prisma/client'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class InvalidCursorError extends Error {}
export class FileNotFoundError extends Error {}

type Cursor = { createdAt: Date; id: string }

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function encodeCursor(cursor: Cursor, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
  ).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function decodeCursor(value: string | undefined, secret: string): Cursor | null {
  if (value === undefined) return null
  const parts = value.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[0-9a-f]{64}$/.test(parts[1])) {
    throw new InvalidCursorError()
  }
  const expected = Buffer.from(sign(parts[0], secret), 'hex')
  const supplied = Buffer.from(parts[1], 'hex')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new InvalidCursorError()
  }
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string, unknown>
    if (
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      throw new InvalidCursorError()
    }
    const createdAt = new Date(parsed.createdAt)
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== parsed.createdAt) {
      throw new InvalidCursorError()
    }
    return { createdAt, id: parsed.id }
  } catch (error) {
    if (error instanceof InvalidCursorError) throw error
    throw new InvalidCursorError()
  }
}

function afterCursor(cursor: Cursor | null): Prisma.FileWhereInput | undefined {
  if (!cursor) return undefined
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  }
}

export async function listFiles(input: {
  prisma: PrismaClient
  ownerId: string
  parentId?: string | null
  limit: number
  cursor: Cursor | null
  secret: string
}) {
  const rows = await input.prisma.file.findMany({
    where: {
      ownerId: input.ownerId,
      deletedAt: null,
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...afterCursor(input.cursor),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
    select: {
      id: true,
      ownerId: true,
      parentId: true,
      name: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  const hasMore = rows.length > input.limit
  const items = rows.slice(0, input.limit)
  const last = items.at(-1)
  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    nextCursor:
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id }, input.secret)
        : null,
  }
}

export async function listVersions(input: {
  prisma: PrismaClient
  fileId: string
  viewerId: string
  viewerRole: string
  limit: number
  cursor: Cursor | null
  secret: string
}) {
  const file = await input.prisma.file.findFirst({
    where: {
      id: input.fileId,
      deletedAt: null,
      ...(input.viewerRole === 'admin' ? {} : { ownerId: input.viewerId }),
    },
    select: { id: true },
  })
  if (!file) throw new FileNotFoundError()
  const rows = await input.prisma.fileVersion.findMany({
    where: {
      fileId: input.fileId,
      ...(input.cursor
        ? {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
    select: {
      id: true,
      fileId: true,
      version: true,
      sizeBytes: true,
      mimeType: true,
      sha256: true,
      createdAt: true,
    },
  })
  const hasMore = rows.length > input.limit
  const items = rows.slice(0, input.limit)
  const last = items.at(-1)
  return {
    items: items.map((item) => ({
      ...item,
      sizeBytes: item.sizeBytes.toString(),
      createdAt: item.createdAt.toISOString(),
    })),
    nextCursor:
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id }, input.secret)
        : null,
  }
}
