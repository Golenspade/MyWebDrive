import type { PrismaClient } from '@prisma/client'
import express from 'express'

import { createAccessMiddleware } from '../auth/middleware.js'
import { decodeCursor, InvalidCursorError } from '../files/service.js'
import {
  createShare,
  InvalidPublicationError,
  InvalidShareOptionsError,
  issuePrivateTicket,
  issuePublicationTicket,
  issueShareTicket,
  listPublications,
  listShares,
  publicationCursorContext,
  PublicationSlugUnavailableError,
  PublicationUnavailableError,
  putPublication,
  revokeShare,
  SharingNotFoundError,
  ShareUnavailableError,
  validSharePassword,
} from './service.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const MAX_DOWNLOADS = 2_147_483_647

function parseLimit(value: unknown): number {
  if (value === undefined) return 50
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new InvalidCursorError()
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > 100) throw new InvalidCursorError()
  return parsed
}

function parseShareOptions(body: unknown, now: Date) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidShareOptionsError()
  }
  const value = body as Record<string, unknown>
  let expiresAt: Date | undefined
  if (value.expiresAt !== undefined) {
    if (typeof value.expiresAt !== 'string') throw new InvalidShareOptionsError()
    expiresAt = new Date(value.expiresAt)
    if (
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt.toISOString() !== value.expiresAt ||
      expiresAt <= now
    ) {
      throw new InvalidShareOptionsError()
    }
  }
  if (
    value.maxDownloads !== undefined &&
    (!Number.isInteger(value.maxDownloads) ||
      Number(value.maxDownloads) < 1 ||
      Number(value.maxDownloads) > MAX_DOWNLOADS)
  ) {
    throw new InvalidShareOptionsError()
  }
  if (value.password !== undefined && !validSharePassword(value.password)) {
    throw new InvalidShareOptionsError()
  }
  return {
    ...(value.password !== undefined ? { password: value.password as string } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(value.maxDownloads !== undefined
      ? { maxDownloads: value.maxDownloads as number }
      : {}),
  }
}

export function createSharingRouter(input: {
  prisma: PrismaClient
  sessionSecret: string
  grantSecret: string
  now: () => Date
  randomBytes: (size: number) => Buffer
}): express.Router {
  const router = express.Router()
  const requireAccess = createAccessMiddleware(input)

  router.post('/files/:fileId/shares', requireAccess, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.fileId ?? '')) {
      return res.status(404).json({ error: 'file not found' })
    }
    try {
      const result = await createShare({
        prisma: input.prisma,
        fileId: req.params.fileId,
        ownerId: req.authUser!.id,
        options: parseShareOptions(req.body, input.now()),
        randomBytes: input.randomBytes,
      })
      return res.status(201).json(result)
    } catch (error) {
      if (error instanceof InvalidShareOptionsError) {
        return res.status(400).json({ error: 'invalid share options' })
      }
      if (error instanceof SharingNotFoundError) {
        return res.status(404).json({ error: 'file not found' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/files/:fileId/shares', requireAccess, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.fileId ?? '')) {
      return res.status(404).json({ error: 'file not found' })
    }
    try {
      return res.json(
        await listShares({
          prisma: input.prisma,
          fileId: req.params.fileId,
          ownerId: req.authUser!.id,
        }),
      )
    } catch (error) {
      if (error instanceof SharingNotFoundError) {
        return res.status(404).json({ error: 'file not found' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.post('/shares/:shareId/revoke', requireAccess, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.shareId ?? '')) {
      return res.status(404).json({ error: 'share not found' })
    }
    try {
      await revokeShare({
        prisma: input.prisma,
        shareId: req.params.shareId,
        ownerId: req.authUser!.id,
      })
      return res.status(204).end()
    } catch (error) {
      if (error instanceof SharingNotFoundError) {
        return res.status(404).json({ error: 'share not found' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.post('/files/:fileId/download-ticket', requireAccess, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.fileId ?? '')) {
      return res.status(404).json({ error: 'file not found' })
    }
    try {
      return res.json(
        await issuePrivateTicket({
          prisma: input.prisma,
          fileId: req.params.fileId,
          ownerId: req.authUser!.id,
          now: input.now(),
          grantSecret: input.grantSecret,
        }),
      )
    } catch (error) {
      if (error instanceof SharingNotFoundError) {
        return res.status(404).json({ error: 'file not found' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.post('/shares/:token/download-ticket', async (req, res) => {
    if (!SHARE_TOKEN_PATTERN.test(req.params.token ?? '')) {
      return res.status(404).json({ error: 'share unavailable' })
    }
    try {
      return res.json(
        await issueShareTicket({
          prisma: input.prisma,
          token: req.params.token,
          password:
            typeof req.body === 'object' && req.body !== null
              ? (req.body as Record<string, unknown>).password
              : undefined,
          now: input.now(),
          grantSecret: input.grantSecret,
        }),
      )
    } catch (error) {
      if (error instanceof ShareUnavailableError) {
        return res.status(404).json({ error: 'share unavailable' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.put('/files/:fileId/publication', requireAccess, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.fileId ?? '')) {
      return res.status(404).json({ error: 'file not found' })
    }
    const body =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as Record<string, unknown>)
        : {}
    try {
      if (typeof body.slug !== 'string' || typeof body.status !== 'string') {
        throw new InvalidPublicationError()
      }
      return res.json(
        await putPublication({
          prisma: input.prisma,
          fileId: req.params.fileId,
          ownerId: req.authUser!.id,
          slug: body.slug,
          status: body.status,
        }),
      )
    } catch (error) {
      if (error instanceof InvalidPublicationError) {
        return res.status(400).json({ error: 'invalid publication' })
      }
      if (error instanceof SharingNotFoundError) {
        return res.status(404).json({ error: 'file not found' })
      }
      if (error instanceof PublicationSlugUnavailableError) {
        return res.status(409).json({ error: 'publication slug unavailable' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/publications', async (req, res) => {
    try {
      const context = publicationCursorContext()
      return res.json(
        await listPublications({
          prisma: input.prisma,
          limit: parseLimit(req.query.limit),
          cursor: decodeCursor(
            typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
            input.sessionSecret,
            context,
          ),
          cursorSecret: input.sessionSecret,
        }),
      )
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        return res.status(400).json({ error: 'invalid cursor' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.post('/publications/:slug/download-ticket', async (req, res) => {
    try {
      return res.json(
        await issuePublicationTicket({
          prisma: input.prisma,
          slug: req.params.slug,
          now: input.now(),
          grantSecret: input.grantSecret,
        }),
      )
    } catch (error) {
      if (error instanceof PublicationUnavailableError) {
        return res.status(404).json({ error: 'publication unavailable' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  return router
}
