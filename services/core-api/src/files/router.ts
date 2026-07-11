import type { PrismaClient } from '@prisma/client'
import express from 'express'

import { createAccessMiddleware, requireAdmin } from '../auth/middleware.js'
import {
  decodeCursor,
  fileCursorContext,
  FileNotFoundError,
  InvalidCursorError,
  listFiles,
  listVersions,
  userExists,
  versionCursorContext,
} from './service.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseLimit(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new InvalidCursorError()
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new InvalidCursorError()
  return parsed
}

function parseParent(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === 'null') return null
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new InvalidCursorError()
  return value
}

export function createFilesRouter(input: {
  prisma: PrismaClient
  sessionSecret: string
}): express.Router {
  const router = express.Router()
  const requireAccess = createAccessMiddleware(input)

  router.get('/files', requireAccess, async (req, res) => {
    try {
      const parentId = parseParent(req.query.parentId)
      const cursorContext = fileCursorContext({
        endpoint: 'user',
        ownerId: req.authUser!.id,
        parentId,
      })
      const result = await listFiles({
        prisma: input.prisma,
        ownerId: req.authUser!.id,
        parentId,
        limit: parseLimit(req.query.limit, 50, 100),
        cursor: decodeCursor(
          typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
          input.sessionSecret,
          cursorContext,
        ),
        secret: input.sessionSecret,
        cursorContext,
      })
      return res.json(result)
    } catch (error) {
      if (error instanceof InvalidCursorError) return res.status(400).json({ error: 'invalid cursor' })
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/files/:fileId/versions', requireAccess, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.fileId ?? '')) {
      return res.status(404).json({ error: 'file not found' })
    }
    try {
      const cursorContext = versionCursorContext(req.params.fileId)
      const result = await listVersions({
        prisma: input.prisma,
        fileId: req.params.fileId,
        viewerId: req.authUser!.id,
        viewerRole: req.authUser!.role,
        limit: parseLimit(req.query.limit, 20, 100),
        cursor: decodeCursor(
          typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
          input.sessionSecret,
          cursorContext,
        ),
        secret: input.sessionSecret,
        cursorContext,
      })
      return res.json(result)
    } catch (error) {
      if (error instanceof FileNotFoundError) return res.status(404).json({ error: 'file not found' })
      if (error instanceof InvalidCursorError) return res.status(400).json({ error: 'invalid cursor' })
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/admin/users/:userId/files', requireAccess, requireAdmin, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.userId ?? '')) {
      return res.status(404).json({ error: 'user not found' })
    }
    try {
      if (!(await userExists(input.prisma, req.params.userId))) {
        return res.status(404).json({ error: 'user not found' })
      }
      const cursorContext = fileCursorContext({
        endpoint: 'admin',
        ownerId: req.params.userId,
        parentId: undefined,
      })
      const result = await listFiles({
        prisma: input.prisma,
        ownerId: req.params.userId,
        limit: parseLimit(req.query.limit, 50, 100),
        cursor: decodeCursor(
          typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
          input.sessionSecret,
          cursorContext,
        ),
        secret: input.sessionSecret,
        cursorContext,
      })
      return res.json(result)
    } catch (error) {
      if (error instanceof InvalidCursorError) return res.status(400).json({ error: 'invalid cursor' })
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  return router
}
