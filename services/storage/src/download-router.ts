import express from 'express'
import { Readable } from 'stream'
import { verifyStorageGrant } from './access-grant.js'
import { isOpaqueObjectKey } from './local-object-path.js'

type DownloadRouterDependencies = {
  grantSecret: string
  consumeGrant: (jti: string, expiresAt: Date) => Promise<boolean>
  openObject: (objectKey: string) => Promise<Readable>
}

export class GrantConsumptionUnavailable extends Error {
  constructor() {
    super('Download authorization service unavailable')
  }
}

function parseBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization || ''
  const parts = header.split(' ')
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null
}

export function createDownloadRouter(dependencies: DownloadRouterDependencies): express.Router {
  const router = express.Router()

  router.get('/api/v1/storage/objects/:objectKey/download', async (req, res) => {
    const objectKey = req.params.objectKey
    if (!isOpaqueObjectKey(objectKey)) return res.status(400).json({ error: 'Invalid object key' })

    const token = parseBearerToken(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    let grant
    try {
      grant = verifyStorageGrant(token, dependencies.grantSecret, 'download')
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (grant.objectKey !== objectKey) {
      return res.status(403).json({ error: 'Storage grant does not allow this object' })
    }

    try {
      if (!(await dependencies.consumeGrant(grant.jti, grant.expiresAt))) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
    } catch (error) {
      if (error instanceof GrantConsumptionUnavailable) {
        return res.status(503).json({ error: error.message })
      }
      return res.status(503).json({ error: 'Download authorization service unavailable' })
    }

    try {
      const stream = await dependencies.openObject(objectKey)
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', 'attachment')
      stream.on('error', () => {
        if (!res.headersSent) res.status(404).json({ error: 'File not found' })
        else res.destroy()
      })
      stream.pipe(res)
    } catch {
      return res.status(404).json({ error: 'File not found' })
    }
  })

  for (const route of [
    '/api/v1/storage/files/:fileId/download',
    '/api/v1/storage/files/:fileId/direct-url',
    '/api/v1/storage/files/:fileId/download-direct',
  ]) {
    router.get(route, (_req, res) => res.status(410).json({ error: 'Legacy download endpoint disabled' }))
  }

  return router
}
