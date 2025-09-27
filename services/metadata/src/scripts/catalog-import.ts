import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { PrismaClient } from '../../prisma/client'

/*
  Import catalog assets from assetsReal/catalog-import.json into Metadata DB.
  - Creates/updates File records (type=file, ownerId='public') with size and name
  - Adds catalog:* tags so /api/v1/catalog can aggregate
  - url uses /assets/<filename> (served by gateway in dev)

  Mapping file format (JSON array):
  [{
    filename: string,
    slug: string,
    name?: string,
    description?: string,
    category?: string, // base | writing | model | script | bundle
    version?: string,  // default 1.0.0
    channel?: 'stable'|'beta'|'dev', // default 'stable'
    public?: boolean, // default true
    license?: string,
    repo?: string,
    os?: 'windows'|'darwin'|'linux'|'any', // optional
    arch?: 'amd64'|'arm64'|'any',          // optional
  }]
*/

async function main() {
  process.env.METADATA_DATABASE_URL = process.env.METADATA_DATABASE_URL || 'file:./metadata.db'
  const prisma = new PrismaClient()
  // Assume running from services/metadata; repo root is two levels up
  const REPO_ROOT = path.resolve(process.cwd(), '../../')
  const assetsDir = path.resolve(REPO_ROOT, 'assetsReal')
  const mapPath = path.resolve(assetsDir, 'catalog-import.json')

  if (!existsSync(mapPath)) {
    console.error('catalog-import.json not found at', mapPath)
    process.exit(1)
  }

  const raw = await fs.readFile(mapPath, 'utf8')
  const items: Array<any> = JSON.parse(raw)

  for (const it of items) {
    const filename = String(it.filename)
    const filePath = path.resolve(assetsDir, filename)
    if (!existsSync(filePath)) {
      console.warn('skip missing file:', filename)
      continue
    }
    const stat = await fs.stat(filePath)

    // Upsert File by name+ownerId='public' (simple dev strategy)
    const ownerId = 'public'
    let file = await prisma.file.findFirst({ where: { name: filename, ownerId, deletedAt: null } })
    if (!file) {
      file = await prisma.file.create({
        data: {
          id: randomUUID(),
          name: filename,
          type: 'file',
          ownerId,
          parentId: null,
          path: '/' + filename,
          size: stat.size,
          mimeType: 'application/octet-stream',
          version: 1,
        }
      })
      console.log('created file', file.id, filename)
    } else {
      await prisma.file.update({ where: { id: file.id }, data: { size: stat.size, updatedAt: new Date() } })
      console.log('updated file size', file.id, filename)
    }

    // Clean previous catalog:* tags
    await prisma.fileTag.deleteMany({ where: { fileId: file.id, tagName: { startsWith: 'catalog:' } } })

    const tags: string[] = []
    const push = (k: string, v: string | number | boolean | undefined) => {
      if (v === undefined || v === null) return
      tags.push(`catalog:${k}=${String(v)}`)
    }

    push('kind', 'asset')
    push('slug', it.slug)
    push('name', it.name)
    push('description', it.description)
    push('category', it.category)
    push('version', it.version || '1.0.0')
    push('channel', it.channel || 'stable')
    push('public', it.public === false ? 'false' : 'true')
    push('license', it.license)
    push('repo', it.repo)
    push('os', it.os)
    push('arch', it.arch)
    // url uses gateway static mapping
    push('url', `/assets/${filename}`)

    for (const t of tags) {
      await prisma.fileTag.create({ data: { id: randomUUID(), fileId: file.id, tagName: t } })
    }
  }

  console.log('import completed')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })

