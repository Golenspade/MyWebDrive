import express from 'express'
import { createLogger, createHttpLogger, createMetrics } from '@mywebdrive/observability'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '../prisma/client'
import { randomUUID } from 'crypto'
import { getEnv } from '@mywebdrive/common'

const app = express()
app.disable('x-powered-by')

// Config
const JWT_SECRET = getEnv('JWT_SECRET', 'dev-secret')
const PORT = parseInt(process.env.METADATA_PORT || '7083', 10)
const DATABASE_URL = process.env.METADATA_DATABASE_URL || 'file:./metadata.db'

// DB
process.env.METADATA_DATABASE_URL = DATABASE_URL
const prisma = new PrismaClient()

// Middleware
app.use(express.json())
const logger = createLogger({ service: 'metadata-service-node' })
app.use(createHttpLogger(logger))

const { register, metricsMiddleware, metricsHandler } = createMetrics('metadata-service-node')
app.use(metricsMiddleware)

// Helpers
function parseBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization || ''
  const parts = header.split(' ')
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1]
  return null
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const token = parseBearerToken(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (!decoded?.user_id) return res.status(401).json({ error: 'Unauthorized' })
    ;(req as any).auth = { userId: decoded.user_id, role: decoded.role || 'user' }
    next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

// Health & metrics
app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'metadata-service-node' }))
app.get('/metrics', metricsHandler)

// -------- Catalog (Public read) --------
// Build a public software catalog from File + FileTag with "catalog:*" tags
// tag format: catalog:key=value; required: catalog:kind=project|asset, catalog:slug=..., catalog:public=true

function parseCatalogTags(tags: Array<{ tagName: string }>): Record<string, string> {
  const kv: Record<string, string> = {}
  for (const t of tags) {
    if (!t.tagName?.startsWith('catalog:')) continue
    const rest = t.tagName.slice('catalog:'.length)
    const eq = rest.indexOf('=')
    if (eq === -1) continue
    const key = rest.slice(0, eq).trim()
    const value = rest.slice(eq + 1).trim()
    if (key) kv[key] = value
  }
  return kv
}

function baseUrl(req: express.Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http'
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost'
  return `${proto}://${host}`
}

type CatalogAsset = {
  id: string
  filename: string
  sizeBytes: number
  sha256?: string
  os?: 'windows' | 'darwin' | 'linux' | 'any'
  arch?: 'amd64' | 'arm64' | 'any'
  channel: 'stable' | 'beta' | 'dev'
  version: string
  url?: string
}

type CatalogRelease = { version: string; channel: 'stable'|'beta'|'dev'; publishedAt?: string; assets: CatalogAsset[] }

type CatalogProject = { slug: string; name: string; description?: string; category?: string; license?: string; repo?: string; releases: CatalogRelease[] }

app.get('/api/v1/catalog', async (req, res, next) => {
  try {
    // Read all files and their tags; filter in memory for dev-scale data
    const files = await prisma.file.findMany({
      where: { deletedAt: null },
      include: { tags: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
    })

    const bySlug: Map<string, CatalogProject & { _assets: CatalogAsset[] }> = new Map()
    const pubOnly = true // gray switch via tag catalog:public=true

    for (const f of files) {
      const kv = parseCatalogTags(f.tags as any)
      if (kv.public !== 'true' && pubOnly) continue
      const kind = kv.kind // 'project' | 'asset' (optional 'release' not required for MVP)
      const slug = kv.slug
      if (!slug) continue

      if (kind === 'project') {
        const proj = bySlug.get(slug) || { slug, name: kv.name || slug, description: kv.description, category: kv.category, license: kv.license, repo: kv.repo, releases: [], _assets: [] }
        // fill missing fields but don't override existing
        proj.name ||= kv.name || slug
        proj.description ||= kv.description
        proj.category ||= kv.category
        proj.license ||= kv.license
        proj.repo ||= kv.repo
        bySlug.set(slug, proj)
        continue
      }

      if (kind === 'asset') {
        const version = kv.version || '1.0.0'
        const channel = (kv.channel as any) || 'stable'
        const os = (kv.os as any) || 'any'
        const arch = (kv.arch as any) || 'any'
        const url = kv.url // optional direct URL (e.g., OSS)
        const size = f.size ?? (f.versions?.[0]?.size || 0)
        const proj = bySlug.get(slug) || { slug, name: kv.name || slug, description: kv.description, category: kv.category, license: kv.license, repo: kv.repo, releases: [], _assets: [] }
        bySlug.set(slug, proj)
        const asset: CatalogAsset = {
          id: f.id,
          filename: f.name,
          sizeBytes: size,
          sha256: undefined,
          os, arch, channel: channel as any, version,
          url: url || `${baseUrl(req)}/api/v1/storage/files/${encodeURIComponent(f.id)}/download`,
        }
        proj._assets.push(asset)
      }
    }

    // Group assets into releases by version+channel
    const projects: CatalogProject[] = []
    for (const proj of bySlug.values()) {
      const groups = new Map<string, CatalogRelease>()
      for (const a of proj._assets) {
        const key = `${a.version}|${a.channel}`
        let r = groups.get(key)
        if (!r) { r = { version: a.version, channel: a.channel, assets: [] }; groups.set(key, r) }
        r.assets.push(a)
      }
      proj.releases = Array.from(groups.values()).sort((x, y) => x.version.localeCompare(y.version))
      delete (proj as any)._assets
      projects.push(proj)
    }

    res.json({ projects })
  } catch (err) {
    next(err)
  }
})

app.get('/api/v1/catalog/:slug', async (req, res, next) => {
  try {
    const slugQ = req.params.slug
    const files = await prisma.file.findMany({ where: { deletedAt: null }, include: { tags: true, versions: { orderBy: { version: 'desc' }, take: 1 } } })
    const filtered = files.filter(f => {
      const kv = parseCatalogTags(f.tags as any)
      return kv.public === 'true' && kv.slug === slugQ && (kv.kind === 'project' || kv.kind === 'asset')
    })
    if (filtered.length === 0) return res.status(404).json({ error: 'Not Found' })
    ;(req as any).url // no-op to satisfy linter
    // Reuse the builder via a fake request to include correct baseUrl
    const fakeReq = req
    const bySlug: Map<string, CatalogProject & { _assets: CatalogAsset[] }> = new Map()
    for (const f of filtered) {
      const kv = parseCatalogTags(f.tags as any)
      if (kv.kind === 'project') {
        const proj = bySlug.get(slugQ) || { slug: slugQ, name: kv.name || slugQ, description: kv.description, category: kv.category, license: kv.license, repo: kv.repo, releases: [], _assets: [] }
        bySlug.set(slugQ, proj)
      } else if (kv.kind === 'asset') {
        const proj = bySlug.get(slugQ) || { slug: slugQ, name: kv.name || slugQ, description: kv.description, category: kv.category, license: kv.license, repo: kv.repo, releases: [], _assets: [] }
        bySlug.set(slugQ, proj)
        const asset: CatalogAsset = {
          id: f.id,
          filename: f.name,
          sizeBytes: f.size ?? (f.versions?.[0]?.size || 0),
          os: (kv.os as any) || 'any', arch: (kv.arch as any) || 'any',
          channel: (kv.channel as any) || 'stable', version: kv.version || '1.0.0',
          url: kv.url || `${baseUrl(fakeReq)}/api/v1/storage/files/${encodeURIComponent(f.id)}/download`,
        }
        ;(proj as any)._assets.push(asset)
      }
    }
    const proj = Array.from(bySlug.values())[0]
    if (!proj) return res.status(404).json({ error: 'Not Found' })
    const groups = new Map<string, CatalogRelease>()
    for (const a of (proj as any)._assets as CatalogAsset[]) {
      const key = `${a.version}|${a.channel}`
      let r = groups.get(key)
      if (!r) { r = { version: a.version, channel: a.channel, assets: [] }; groups.set(key, r) }
      r.assets.push(a)
    }
    proj.releases = Array.from(groups.values())
    delete (proj as any)._assets
    res.json(proj)
  } catch (err) {
    next(err)
  }
})

// Types
type CreateFolderRequest = { name: string; parentId?: string | null }
type MoveRequest = { newParentId?: string | null }

// --- Folder routes ---
app.post('/api/v1/folders', requireAuth, async (req, res, next) => {
  try {
    const { name, parentId }: CreateFolderRequest = req.body || {}
    const userId = (req as any).auth.userId as string
    if (!name || typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Invalid name' })

    let parent: { id: string; path: string } | null = null
    if (parentId) {
      parent = await prisma.file.findFirst({ where: { id: parentId, ownerId: userId, type: 'folder', deletedAt: null }, select: { id: true, path: true } })
      if (!parent) return res.status(404).json({ error: 'Parent folder not found' })
    }

    const exists = await prisma.file.findFirst({
      where: {
        name,
        ownerId: userId,
        deletedAt: null,
        parentId: parent ? parent.id : null,
      },
      select: { id: true },
    })
    if (exists) return res.status(400).json({ error: 'Folder with the same name already exists' })

    const id = randomUUID()
    const path = parent ? `${parent.path}/${name}` : `/${name}`
    const folder = await prisma.file.create({
      data: {
        id,
        name,
        type: 'folder',
        parentId: parent ? parent.id : null,
        ownerId: userId,
        path,
      },
    })
    return res.status(201).json(folder)
  } catch (err) {
    next(err)
  }
})

app.get('/api/v1/folders/:folderId/children', requireAuth, async (req, res, next) => {
  try {
    const folderId = req.params.folderId
    const userId = (req as any).auth.userId as string
    const limitParam = Number.parseInt(String(req.query.limit || '50'), 10)
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 50
    const cursorRaw = String(req.query.cursor || '')
    // Offset-based cursor for simplicity: base64-encoded integer offset
    let offset = 0
    if (cursorRaw) {
      try {
        const decoded = Buffer.from(cursorRaw, 'base64').toString('utf8')
        const parsed = Number.parseInt(decoded, 10)
        if (Number.isFinite(parsed) && parsed >= 0) offset = parsed
      } catch {
        // ignore invalid cursor
      }
    }

    if (folderId !== 'root') {
      const folder = await prisma.file.findFirst({ where: { id: folderId, ownerId: userId, type: 'folder', deletedAt: null }, select: { id: true } })
      if (!folder) return res.status(404).json({ error: 'Folder not found' })
    }

    const items = await prisma.file.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        parentId: folderId === 'root' ? null : folderId,
      },
      orderBy: [
        { type: 'desc' },
        { name: 'asc' },
      ],
      skip: offset,
      take: limit,
    })
    const nextCursor = items.length === limit ? Buffer.from(String(offset + limit), 'utf8').toString('base64') : null
    return res.json({ items, nextCursor })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/v1/folders/:folderId', requireAuth, async (req, res, next) => {
  try {
    const folderId = req.params.folderId
    const userId = (req as any).auth.userId as string
    const { name } = (req.body || {}) as { name?: string }
    if (!name || typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Invalid name' })

    const folder = await prisma.file.findFirst({ where: { id: folderId, ownerId: userId, type: 'folder', deletedAt: null } })
    if (!folder) return res.status(404).json({ error: 'Folder not found' })

    // Duplicate name check in same parent
    const dup = await prisma.file.findFirst({
      where: {
        id: { not: folderId },
        ownerId: userId,
        parentId: folder.parentId ?? null,
        name,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (dup) return res.status(400).json({ error: 'Folder with the same name already exists' })

    const oldPath = folder.path
    const lastSlash = oldPath.lastIndexOf('/')
    const parentPath = lastSlash > 0 ? oldPath.slice(0, lastSlash) : ''
    const newPath = (parentPath ? parentPath : '') + '/' + name

    await prisma.$transaction(async (tx) => {
      await tx.file.update({ where: { id: folderId }, data: { name, path: newPath, updatedAt: new Date() } })

      // Update descendants' path by replacing prefix
      const descendants = await tx.file.findMany({
        where: { ownerId: userId, deletedAt: null, path: { startsWith: oldPath + '/' } },
        select: { id: true, path: true },
      })
      for (const d of descendants) {
        const suffix = d.path.slice(oldPath.length)
        await tx.file.update({ where: { id: d.id }, data: { path: newPath + suffix, updatedAt: new Date() } })
      }
    })

    const updated = await prisma.file.findFirst({ where: { id: folderId, ownerId: userId, deletedAt: null } })
    return res.json(updated)
  } catch (err) {
    next(err)
  }
})

async function listDescendantIds(rootId: string, userId: string): Promise<string[]> {
  const result: string[] = []
  const queue: string[] = [rootId]
  while (queue.length) {
    const id = queue.shift() as string
    result.push(id)
    const children = await prisma.file.findMany({ where: { ownerId: userId, parentId: id, deletedAt: null }, select: { id: true } })
    for (const c of children) queue.push(c.id)
  }
  return result
}

app.delete('/api/v1/folders/:folderId', requireAuth, async (req, res, next) => {
  try {
    const folderId = req.params.folderId
    const userId = (req as any).auth.userId as string

    const folder = await prisma.file.findFirst({ where: { id: folderId, ownerId: userId, type: 'folder', deletedAt: null }, select: { id: true } })
    if (!folder) return res.status(404).json({ error: 'Folder not found' })

    const ids = await listDescendantIds(folderId, userId)
    await prisma.file.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } })
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

app.post('/api/v1/folders/:folderId/move', requireAuth, async (req, res, next) => {
  try {
    const folderId = req.params.folderId
    const userId = (req as any).auth.userId as string
    const { newParentId }: MoveRequest = req.body || {}

    if (newParentId && newParentId === folderId) return res.status(400).json({ error: 'Cannot move folder to itself' })

    const folder = await prisma.file.findFirst({ where: { id: folderId, ownerId: userId, type: 'folder', deletedAt: null } })
    if (!folder) return res.status(404).json({ error: 'Folder not found' })

    let parent: { id: string; path: string } | null = null
    if (newParentId) {
      parent = await prisma.file.findFirst({ where: { id: newParentId, ownerId: userId, type: 'folder', deletedAt: null }, select: { id: true, path: true } })
      if (!parent) return res.status(404).json({ error: 'Target folder not found' })
      // Prevent moving into its own descendant
      if (parent.path === folder.path || parent.path.startsWith(folder.path + '/')) {
        return res.status(400).json({ error: 'Cannot move folder into its own descendant' })
      }
    }

    // Duplicate name check in target parent
    const dup = await prisma.file.findFirst({
      where: {
        id: { not: folderId },
        ownerId: userId,
        parentId: parent ? parent.id : null,
        name: folder.name,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (dup) return res.status(400).json({ error: 'An item with the same name exists in target folder' })

    const oldPath = folder.path
    const newPath = parent ? `${parent.path}/${folder.name}` : `/${folder.name}`

    await prisma.$transaction(async (tx) => {
      await tx.file.update({ where: { id: folderId }, data: { parentId: parent ? parent.id : null, path: newPath, updatedAt: new Date() } })

      const descendants = await tx.file.findMany({
        where: { ownerId: userId, deletedAt: null, path: { startsWith: oldPath + '/' } },
        select: { id: true, path: true },
      })
      for (const d of descendants) {
        const suffix = d.path.slice(oldPath.length)
        await tx.file.update({ where: { id: d.id }, data: { path: newPath + suffix, updatedAt: new Date() } })
      }
    })

    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- File routes ---
app.get('/api/v1/files/:fileId', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const userId = (req as any).auth.userId as string
    const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId, deletedAt: null } })
    if (!file) return res.status(404).json({ error: 'File not found' })
    return res.json(file)
  } catch (err) {
    next(err)
  }
})

app.patch('/api/v1/files/:fileId', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const userId = (req as any).auth.userId as string
    const { name } = (req.body || {}) as { name?: string }
    if (!name || typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Invalid name' })

    const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId, type: 'file', deletedAt: null } })
    if (!file) return res.status(404).json({ error: 'File not found' })

    // Duplicate name check in same parent
    const dup = await prisma.file.findFirst({
      where: {
        id: { not: fileId },
        ownerId: userId,
        parentId: file.parentId ?? null,
        name,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (dup) return res.status(400).json({ error: 'An item with the same name exists in this folder' })

    let parentPath = ''
    if (file.parentId) {
      const parent = await prisma.file.findFirst({ where: { id: file.parentId, ownerId: userId, type: 'folder', deletedAt: null }, select: { path: true } })
      parentPath = parent ? parent.path : ''
    }
    const newPath = (parentPath ? parentPath : '') + '/' + name
    await prisma.file.update({ where: { id: fileId }, data: { name, path: newPath, updatedAt: new Date() } })
    const updated = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId, deletedAt: null } })
    return res.json(updated)
  } catch (err) {
    next(err)
  }
})

app.delete('/api/v1/files/:fileId', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const userId = (req as any).auth.userId as string
    const result = await prisma.file.updateMany({ where: { id: fileId, ownerId: userId, type: 'file', deletedAt: null }, data: { deletedAt: new Date() } })
    if (result.count === 0) return res.status(404).json({ error: 'File not found' })
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

app.post('/api/v1/files/:fileId/move', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const userId = (req as any).auth.userId as string
    const { newParentId }: MoveRequest = req.body || {}

    const file = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId, type: 'file', deletedAt: null } })
    if (!file) return res.status(404).json({ error: 'File not found' })

    let parentPath = ''
    let parentId: string | null = null
    if (newParentId) {
      const parent = await prisma.file.findFirst({ where: { id: newParentId, ownerId: userId, type: 'folder', deletedAt: null }, select: { id: true, path: true } })
      if (!parent) return res.status(404).json({ error: 'Target folder not found' })
      parentPath = parent.path
      parentId = parent.id

      // Duplicate name check in target parent
      const dup = await prisma.file.findFirst({ where: { id: { not: fileId }, ownerId: userId, parentId: parent.id, name: file.name, deletedAt: null }, select: { id: true } })
      if (dup) return res.status(400).json({ error: 'An item with the same name exists in target folder' })
    } else {
      // root
      const dup = await prisma.file.findFirst({ where: { id: { not: fileId }, ownerId: userId, parentId: null, name: file.name, deletedAt: null }, select: { id: true } })
      if (dup) return res.status(400).json({ error: 'An item with the same name exists in target folder' })
    }

    const newPath = (parentPath ? parentPath : '') + '/' + file.name
    await prisma.file.update({ where: { id: fileId }, data: { parentId, path: newPath, updatedAt: new Date() } })
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// --- Versions ---
app.get('/api/v1/files/:fileId/versions', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const userId = (req as any).auth.userId as string
    const file = await prisma.file.findFirst({ where: { id: fileId, deletedAt: null }, select: { ownerId: true } })
    if (!file) return res.status(404).json({ error: 'File not found' })
    if (file.ownerId !== userId) return res.status(403).json({ error: 'Access denied' })

    const limitParam = Number.parseInt(String(req.query.limit || '20'), 10)
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 20
    const versions = await prisma.fileVersion.findMany({ where: { fileId }, orderBy: { version: 'desc' }, take: limit })
    return res.json({ versions })
  } catch (err) {
    next(err)
  }
})

app.post('/api/v1/files/:fileId/versions/:versionId/restore', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const versionId = req.params.versionId
    const userId = (req as any).auth.userId as string

    const file = await prisma.file.findFirst({ where: { id: fileId, deletedAt: null } })
    if (!file) return res.status(404).json({ error: 'File not found' })
    if (file.ownerId !== userId) return res.status(403).json({ error: 'Access denied' })

    const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId } })
    if (!version) return res.status(404).json({ error: 'Version not found' })

    const updated = await prisma.$transaction(async (tx) => {
      const newVersion = (file.version || 1) + 1
      await tx.fileVersion.create({
        data: {
          id: randomUUID(),
          fileId: file.id,
          version: newVersion,
          size: version.size,
          storagePath: version.storagePath,
          md5Hash: version.md5Hash,
          comment: `Restore from version ${version.version}`,
        },
      })

      await tx.file.update({
        where: { id: file.id },
        data: {
          version: newVersion,
          size: version.size,
          updatedAt: new Date(),
        },
      })

      return tx.file.findFirst({ where: { id: file.id } })
    })

    return res.json(updated)
  } catch (err) {
    next(err)
  }
})

// Create new file version or upsert file record (called by storage finalize)
app.post('/api/v1/files/:fileId/versions', requireAuth, async (req, res, next) => {
  try {
    const fileId = req.params.fileId
    const userId = (req as any).auth.userId as string
    const { fileName, size, mimeType, storagePath, md5Hash, parentId }: { fileName: string; size: number; mimeType?: string; storagePath: string; md5Hash: string; parentId?: string | null } = req.body || ({} as any)
    if (!fileName || typeof size !== 'number' || !storagePath || !md5Hash) return res.status(400).json({ error: 'Invalid request' })

    // Optional parent validation
    let parent: { id: string; path: string } | null = null
    if (parentId) {
      parent = await prisma.file.findFirst({ where: { id: parentId, ownerId: userId, type: 'folder', deletedAt: null }, select: { id: true, path: true } })
      if (!parent) return res.status(404).json({ error: 'Parent folder not found' })
    }

    const existing = await prisma.file.findFirst({ where: { id: fileId, ownerId: userId } })
    let newVersion = 1
    if (!existing) {
      const path = parent ? `${parent.path}/${fileName}` : `/${fileName}`
      await prisma.file.create({
        data: {
          id: fileId,
          name: fileName,
          type: 'file',
          parentId: parent ? parent.id : null,
          ownerId: userId,
          path,
          size,
          mimeType: mimeType || 'application/octet-stream',
          version: 1,
        },
      })
      newVersion = 1
    } else {
      newVersion = (existing.version || 1) + 1
      await prisma.file.update({
        where: { id: fileId },
        data: {
          name: fileName,
          size,
          mimeType: mimeType || existing.mimeType || 'application/octet-stream',
          version: newVersion,
          updatedAt: new Date(),
        },
      })
    }

    await prisma.fileVersion.create({
      data: {
        id: randomUUID(),
        fileId,
        version: newVersion,
        size,
        storagePath,
        md5Hash,
        comment: 'Uploaded via storage finalize',
      },
    })

    return res.status(201).json({ ok: true, version: newVersion })
  } catch (err) {
    next(err)
  }
})

// --- Batch operations ---
// Move multiple files/folders in one request
// Body: { items: Array<{ id: string; newParentId?: string | null }> }
app.post('/api/v1/files/batch/move', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).auth.userId as string
    const items = ((req.body || {}).items as Array<{ id: string; newParentId?: string | null }>) || []
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' })

    const results: Array<{ id: string; status: 'ok' | 'error'; error?: string }> = []
    for (const it of items) {
      const { id, newParentId } = it
      try {
        const f = await prisma.file.findFirst({ where: { id, ownerId: userId, deletedAt: null } })
        if (!f) { results.push({ id, status: 'error', error: 'Not found' }); continue }

        let parent: { id: string; path: string } | null = null
        if (newParentId) {
          parent = await prisma.file.findFirst({ where: { id: newParentId, ownerId: userId, type: 'folder', deletedAt: null }, select: { id: true, path: true } })
          if (!parent) { results.push({ id, status: 'error', error: 'Target folder not found' }); continue }
          if (f.type === 'folder') {
            if (parent.path === f.path || parent.path.startsWith(f.path + '/')) { results.push({ id, status: 'error', error: 'Invalid move (descendant)' }); continue }
          }
        }

        // Duplicate name check in target parent
        const dup = await prisma.file.findFirst({ where: { id: { not: id }, ownerId: userId, parentId: parent ? parent.id : null, name: f.name, deletedAt: null }, select: { id: true } })
        if (dup) { results.push({ id, status: 'error', error: 'Name exists in target' }); continue }

        const oldPath = f.path
        const newPath = parent ? `${parent.path}/${f.name}` : `/${f.name}`

        if (f.type === 'folder') {
          await prisma.$transaction(async (tx) => {
            await tx.file.update({ where: { id }, data: { parentId: parent ? parent.id : null, path: newPath, updatedAt: new Date() } })
            const descendants = await tx.file.findMany({ where: { ownerId: userId, deletedAt: null, path: { startsWith: oldPath + '/' } }, select: { id: true, path: true } })
            for (const d of descendants) {
              const suffix = d.path.slice(oldPath.length)
              await tx.file.update({ where: { id: d.id }, data: { path: newPath + suffix, updatedAt: new Date() } })
            }
          })
        } else {
          await prisma.file.update({ where: { id }, data: { parentId: parent ? parent.id : null, path: newPath, updatedAt: new Date() } })
        }
        results.push({ id, status: 'ok' })
      } catch (e: any) {
        results.push({ id: it.id, status: 'error', error: e?.message || 'Failed' })
      }
    }

    return res.json({ results })
  } catch (err) {
    next(err)
  }
})

// Batch delete files/folders
// Body: { ids: string[] }
app.post('/api/v1/files/batch/delete', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).auth.userId as string
    const ids = ((req.body || {}).ids as string[]) || []
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No ids provided' })

    let deleted = 0
    for (const id of ids) {
      const f = await prisma.file.findFirst({ where: { id, ownerId: userId, deletedAt: null } })
      if (!f) continue
      if (f.type === 'folder') {
        const allIds = await listDescendantIds(id, userId)
        const res = await prisma.file.updateMany({ where: { id: { in: allIds } }, data: { deletedAt: new Date() } })
        deleted += res.count
      } else {
        const res = await prisma.file.updateMany({ where: { id, ownerId: userId, deletedAt: null }, data: { deletedAt: new Date() } })
        deleted += res.count
      }
    }
    return res.json({ deleted })
  } catch (err) {
    next(err)
  }
})

// --- Search ---
// Query: q=keyword&only=files|folders|all (default all)
app.get('/api/v1/search', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).auth.userId as string
    const q = String(req.query.q || '').trim()
    const only = String(req.query.only || 'all')
    if (!q) return res.status(400).json({ error: 'Missing q' })

    const where: any = { ownerId: userId, deletedAt: null, name: { contains: q } }
    if (only === 'files') where.type = 'file'
    if (only === 'folders') where.type = 'folder'

    const items = await prisma.file.findMany({ where, orderBy: [{ updatedAt: 'desc' }], take: 50 })
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500
  const message = err?.message || 'Internal Server Error'
  logger.error({ err, status }, 'unhandled error')
  res.status(status).json({ error: { code: 'INTERNAL_ERROR', message } })
})

async function ensureSchema() {
  // Best-effort SQLite init for dev environments where prisma db push is unavailable
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS File (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER,
      mimeType TEXT,
      parentId TEXT,
      ownerId TEXT NOT NULL,
      path TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS File_parentId_idx ON File(parentId)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS File_ownerId_idx ON File(ownerId)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS File_type_idx ON File(type)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS File_path_idx ON File(path)`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS FileVersion (
      id TEXT PRIMARY KEY,
      fileId TEXT NOT NULL,
      version INTEGER NOT NULL,
      size INTEGER NOT NULL,
      storagePath TEXT NOT NULL,
      md5Hash TEXT NOT NULL,
      comment TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS FileVersion_fileId_version_unique ON FileVersion(fileId, version)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS FileVersion_fileId_idx ON FileVersion(fileId)`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS FileTag (
      id TEXT PRIMARY KEY,
      fileId TEXT NOT NULL,
      tagName TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS FileTag_fileId_idx ON FileTag(fileId)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS FileTag_tagName_idx ON FileTag(tagName)`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS FileAccessLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileId TEXT NOT NULL,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      accessedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS FileAccessLog_fileId_idx ON FileAccessLog(fileId)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS FileAccessLog_userId_idx ON FileAccessLog(userId)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS FileAccessLog_accessedAt_idx ON FileAccessLog(accessedAt)`)
  } catch {
    // ignore
  }
}

app.listen(PORT, async () => {
  await ensureSchema()
  logger.info({ port: PORT }, 'metadata-service-node listening')
})
