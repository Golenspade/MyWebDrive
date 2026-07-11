import { createHash, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'

import { Prisma, type PrismaClient } from '@prisma/client'

import { encodeCursor, type CursorContext } from '../files/service.js'
import {
  issueDownloadStorageGrant,
  type StorageGrantPurpose,
} from '../grants/storage-grant.js'

const TOKEN_BYTES = 32
const PASSWORD_MAX_BYTES = 1024
const SCRYPT_VERSION = 1
const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEY_BYTES = 32
const SCRYPT_MAX_N = SCRYPT_N
const SCRYPT_MAX_R = 8
const SCRYPT_MAX_P = 1
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const PUBLICATION_CURSOR_CONTEXT = 'publications:published'
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

type RandomBytes = (size: number) => Buffer
type Cursor = { createdAt: Date; id: string }

export class SharingNotFoundError extends Error {}
export class ShareUnavailableError extends Error {}
export class PublicationUnavailableError extends Error {}
export class InvalidShareOptionsError extends Error {}
export class InvalidPublicationError extends Error {}
export class PublicationSlugUnavailableError extends Error {}

export type ShareOptions = {
  password?: string
  expiresAt?: Date
  maxDownloads?: number
}

function deriveScrypt(
  password: string,
  salt: Buffer,
  keyBytes: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      keyBytes,
      { ...options, maxmem: SCRYPT_MAX_MEMORY },
      (error, derivedKey) => {
        if (error) reject(error)
        else resolve(derivedKey)
      },
    )
  })
}

function digestShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function parsePasswordHash(value: string): {
  n: number
  r: number
  p: number
  keyBytes: number
  salt: Buffer
  digest: Buffer
} | null {
  const match = /^scrypt\$v=(\d+)\$n=(\d+),r=(\d+),p=(\d+),l=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(
    value,
  )
  if (!match) return null
  const version = Number(match[1])
  const n = Number(match[2])
  const r = Number(match[3])
  const p = Number(match[4])
  const keyBytes = Number(match[5])
  if (
    version !== SCRYPT_VERSION ||
    !Number.isSafeInteger(n) ||
    n < 2 ||
    n > SCRYPT_MAX_N ||
    (n & (n - 1)) !== 0 ||
    !Number.isSafeInteger(r) ||
    r < 1 ||
    r > SCRYPT_MAX_R ||
    !Number.isSafeInteger(p) ||
    p < 1 ||
    p > SCRYPT_MAX_P ||
    keyBytes !== SCRYPT_KEY_BYTES ||
    !match[6] ||
    !match[7]
  ) {
    return null
  }
  const salt = Buffer.from(match[6], 'base64url')
  const digest = Buffer.from(match[7], 'base64url')
  if (salt.length !== 16 || digest.length !== keyBytes) return null
  return { n, r, p, keyBytes, salt, digest }
}

export function validSharePassword(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length > 0 &&
    Buffer.byteLength(password, 'utf8') <= PASSWORD_MAX_BYTES
  )
}

export async function hashSharePassword(
  password: string,
  randomBytes: RandomBytes,
): Promise<string> {
  if (!validSharePassword(password)) throw new InvalidShareOptionsError()
  const salt = randomBytes(16)
  if (!Buffer.isBuffer(salt) || salt.length !== 16) throw new Error('invalid random bytes source')
  const digest = await deriveScrypt(password, salt, SCRYPT_KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt$v=${SCRYPT_VERSION}$n=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P},l=${SCRYPT_KEY_BYTES}$${salt.toString('base64url')}$${digest.toString('base64url')}`
}

export async function verifySharePassword(
  password: unknown,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash)
  if (!parsed || !validSharePassword(password)) return false
  try {
    const actual = await deriveScrypt(password, parsed.salt, parsed.keyBytes, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
    })
    return actual.length === parsed.digest.length && timingSafeEqual(actual, parsed.digest)
  } catch {
    return false
  }
}

function serializeShare(share: {
  id: string
  fileId: string
  expiresAt: Date | null
  maxDownloads: number | null
  downloadCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: share.id,
    fileId: share.fileId,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    maxDownloads: share.maxDownloads,
    downloadCount: share.downloadCount,
    isActive: share.isActive,
    createdAt: share.createdAt.toISOString(),
    updatedAt: share.updatedAt.toISOString(),
  }
}

export async function createShare(input: {
  prisma: PrismaClient
  fileId: string
  ownerId: string
  options: ShareOptions
  randomBytes: RandomBytes
}) {
  const file = await input.prisma.file.findFirst({
    where: {
      id: input.fileId,
      ownerId: input.ownerId,
      type: 'file',
      deletedAt: null,
      versions: { some: {} },
    },
    select: { id: true },
  })
  if (!file) throw new SharingNotFoundError()
  const passwordHash = input.options.password
    ? await hashSharePassword(input.options.password, input.randomBytes)
    : null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const tokenBytes = input.randomBytes(TOKEN_BYTES)
    if (!Buffer.isBuffer(tokenBytes) || tokenBytes.length !== TOKEN_BYTES) {
      throw new Error('invalid random bytes source')
    }
    const token = tokenBytes.toString('base64url')
    try {
      const share = await input.prisma.share.create({
        data: {
          token: digestShareToken(token),
          fileId: input.fileId,
          ownerId: input.ownerId,
          passwordHash,
          expiresAt: input.options.expiresAt,
          maxDownloads: input.options.maxDownloads,
        },
        select: { expiresAt: true, maxDownloads: true },
      })
      return {
        token,
        expiresAt: share.expiresAt?.toISOString() ?? null,
        maxDownloads: share.maxDownloads,
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        attempt < 2
      ) {
        continue
      }
      throw error
    }
  }
  throw new Error('share token generation failed')
}

export async function listShares(input: {
  prisma: PrismaClient
  fileId: string
  ownerId: string
}) {
  const file = await input.prisma.file.findFirst({
    where: { id: input.fileId, ownerId: input.ownerId, type: 'file', deletedAt: null },
    select: { id: true },
  })
  if (!file) throw new SharingNotFoundError()
  const shares = await input.prisma.share.findMany({
    where: { fileId: input.fileId, ownerId: input.ownerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      fileId: true,
      expiresAt: true,
      maxDownloads: true,
      downloadCount: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return { items: shares.map(serializeShare) }
}

export async function revokeShare(input: {
  prisma: PrismaClient
  shareId: string
  ownerId: string
}): Promise<void> {
  const result = await input.prisma.share.updateMany({
    where: { id: input.shareId, ownerId: input.ownerId },
    data: { isActive: false },
  })
  if (result.count !== 1) throw new SharingNotFoundError()
}

function ticket(input: {
  purpose: Exclude<StorageGrantPurpose, 'upload'>
  objectKey: string
  fileName: string
  mimeType: string
  now: Date
  grantSecret: string
}) {
  return {
    objectKey: input.objectKey,
    downloadGrant: issueDownloadStorageGrant({
      purpose: input.purpose,
      objectKey: input.objectKey,
      now: input.now,
      secret: input.grantSecret,
    }),
    expiresInSeconds: 60,
    fileName: input.fileName,
    mimeType: input.mimeType,
  }
}

export async function issuePrivateTicket(input: {
  prisma: PrismaClient
  fileId: string
  ownerId: string
  now: Date
  grantSecret: string
}) {
  const file = await input.prisma.file.findFirst({
    where: { id: input.fileId, ownerId: input.ownerId, type: 'file', deletedAt: null },
    select: {
      name: true,
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { objectKey: true, mimeType: true },
      },
    },
  })
  const version = file?.versions[0]
  if (!file || !version) throw new SharingNotFoundError()
  return ticket({
    purpose: 'download-private',
    objectKey: version.objectKey,
    fileName: file.name,
    mimeType: version.mimeType,
    now: input.now,
    grantSecret: input.grantSecret,
  })
}

export async function issueShareTicket(input: {
  prisma: PrismaClient
  token: string
  password: unknown
  now: Date
  grantSecret: string
}) {
  const digest = digestShareToken(input.token)
  const snapshot = await input.prisma.share.findUnique({
    where: { token: digest },
    select: { id: true, passwordHash: true },
  })
  if (!snapshot) throw new ShareUnavailableError()
  if (
    snapshot.passwordHash &&
    !(await verifySharePassword(input.password, snapshot.passwordHash))
  ) {
    throw new ShareUnavailableError()
  }

  const selected = await input.prisma.$transaction(async (tx) => {
    const share = await tx.share.findFirst({
      where: {
        id: snapshot.id,
        token: digest,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
        owner: { status: 'active' },
        file: { type: 'file', deletedAt: null },
      },
      select: {
        file: {
          select: {
            name: true,
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { objectKey: true, mimeType: true },
            },
          },
        },
      },
    })
    const version = share?.file.versions[0]
    if (!share || !version) throw new ShareUnavailableError()
    const consumed = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "Share" AS share
      SET "downloadCount" = share."downloadCount" + 1,
          "updatedAt" = ${input.now}
      WHERE share."id" = ${snapshot.id}
        AND share."token" = ${digest}
        AND share."isActive" = TRUE
        AND (share."expiresAt" IS NULL OR share."expiresAt" > ${input.now})
        AND (share."maxDownloads" IS NULL OR share."downloadCount" < share."maxDownloads")
        AND EXISTS (
          SELECT 1 FROM "User" AS owner
          WHERE owner."id" = share."ownerId" AND owner."status" = 'active'
        )
        AND EXISTS (
          SELECT 1 FROM "File" AS file
          WHERE file."id" = share."fileId"
            AND file."type" = 'file'
            AND file."deletedAt" IS NULL
        )
      RETURNING share."id"
    `)
    if (consumed.length !== 1) throw new ShareUnavailableError()
    return { fileName: share.file.name, ...version }
  })

  return ticket({
    purpose: 'download-share',
    objectKey: selected.objectKey,
    fileName: selected.fileName,
    mimeType: selected.mimeType,
    now: input.now,
    grantSecret: input.grantSecret,
  })
}

export async function putPublication(input: {
  prisma: PrismaClient
  fileId: string
  ownerId: string
  slug: string
  status: string
}) {
  if (!SLUG_PATTERN.test(input.slug) || !['draft', 'published', 'disabled'].includes(input.status)) {
    throw new InvalidPublicationError()
  }
  const file = await input.prisma.file.findFirst({
    where: {
      id: input.fileId,
      ownerId: input.ownerId,
      type: 'file',
      deletedAt: null,
      versions: { some: {} },
    },
    select: { id: true },
  })
  if (!file) throw new SharingNotFoundError()
  try {
    const publication = await input.prisma.publication.upsert({
      where: { fileId: input.fileId },
      create: { fileId: input.fileId, slug: input.slug, status: input.status },
      update: { slug: input.slug, status: input.status },
    })
    return {
      id: publication.id,
      fileId: publication.fileId,
      slug: publication.slug,
      status: publication.status,
      createdAt: publication.createdAt.toISOString(),
      updatedAt: publication.updatedAt.toISOString(),
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PublicationSlugUnavailableError()
    }
    throw error
  }
}

function afterCursor(cursor: Cursor | null): Prisma.PublicationWhereInput | undefined {
  if (!cursor) return undefined
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  }
}

export function publicationCursorContext(): CursorContext {
  return PUBLICATION_CURSOR_CONTEXT
}

export async function listPublications(input: {
  prisma: PrismaClient
  limit: number
  cursor: Cursor | null
  cursorSecret: string
}) {
  const rows = await input.prisma.publication.findMany({
    where: {
      status: 'published',
      ...afterCursor(input.cursor),
      file: {
        type: 'file',
        deletedAt: null,
        owner: { status: 'active' },
        versions: { some: {} },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
    select: {
      id: true,
      fileId: true,
      slug: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      file: {
        select: {
          name: true,
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { sizeBytes: true, mimeType: true },
          },
        },
      },
    },
  })
  const hasMore = rows.length > input.limit
  const items = rows.slice(0, input.limit)
  const last = items.at(-1)
  return {
    items: items.map((publication) => ({
      id: publication.id,
      fileId: publication.fileId,
      slug: publication.slug,
      status: publication.status,
      fileName: publication.file.name,
      mimeType: publication.file.versions[0]!.mimeType,
      sizeBytes: publication.file.versions[0]!.sizeBytes.toString(),
      createdAt: publication.createdAt.toISOString(),
      updatedAt: publication.updatedAt.toISOString(),
    })),
    nextCursor:
      hasMore && last
        ? encodeCursor(
            { createdAt: last.createdAt, id: last.id },
            input.cursorSecret,
            PUBLICATION_CURSOR_CONTEXT,
          )
        : null,
  }
}

export async function issuePublicationTicket(input: {
  prisma: PrismaClient
  slug: string
  now: Date
  grantSecret: string
}) {
  const publication = await input.prisma.publication.findFirst({
    where: {
      slug: input.slug,
      status: 'published',
      file: { type: 'file', deletedAt: null, owner: { status: 'active' } },
    },
    select: {
      file: {
        select: {
          name: true,
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { objectKey: true, mimeType: true },
          },
        },
      },
    },
  })
  const version = publication?.file.versions[0]
  if (!publication || !version) throw new PublicationUnavailableError()
  return ticket({
    purpose: 'download-publication',
    objectKey: version.objectKey,
    fileName: publication.file.name,
    mimeType: version.mimeType,
    now: input.now,
    grantSecret: input.grantSecret,
  })
}
