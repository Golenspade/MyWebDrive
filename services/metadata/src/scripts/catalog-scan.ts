import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { PrismaClient } from '../../prisma/client'

// Scan assetsReal directory and auto-infer catalog metadata from filenames and folder names
// Heuristics:
// - slug: first token (letters/digits) before version-like token
// - version: first token matching /\d+\.\d+(\.\d+([a-z0-9]+)?)?/
// - channel: detect 'beta'|'dev'|'rc' tokens else 'stable'
// - os: windows|darwin|linux tokens if present else 'any'
// - arch: amd64/x64/x86_64 -> amd64; arm64/aarch64 -> arm64; else 'any'
// - category: prefer immediate parent directory name if in {base,writing,model,script,bundle};
//             otherwise keyword mapping by slug tokens; fallback 'bundle'
// - public: true by default
// - url: /assets/<relative path from assetsReal>, encoded

const ALLOWED_CATEGORIES = new Set(['base','writing','model','script','bundle'])

function splitTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\.(zip|7z|tar\.gz|tgz|tar|dmg|exe|msi|deb|rpm)$/i, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
}

function stemWithoutExt(filename: string): string {
  return filename.replace(/\.(zip|7z|tar\.gz|tgz|tar|dmg|exe|msi|deb|rpm|txt)$/i, '')
}

function findVersionInStem(stem: string): { version: string; index: number } | undefined {
  const m = stem.match(/(\d+\.\d+(?:\.\d+(?:[a-z0-9]+)?)?)/i)
  if (m && typeof m.index === 'number') return { version: m[1], index: m.index }
  return undefined
}

function inferSlugFromStem(stem: string, versionInfo?: { version: string; index: number }): string {
  const prefix = versionInfo ? stem.slice(0, versionInfo.index) : stem
  const parts = prefix.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return (parts[0] || 'tool')
}

function inferChannel(tokens: string[]): 'stable' | 'beta' | 'dev' {
  if (tokens.includes('beta')) return 'beta'
  if (tokens.includes('dev') || tokens.includes('nightly') || tokens.includes('snapshot')) return 'dev'
  if (tokens.includes('rc')) return 'beta'
  return 'stable'
}

function inferOS(tokens: string[]): 'windows' | 'darwin' | 'linux' | 'any' {
  if (tokens.includes('windows') || tokens.includes('win')) return 'windows'
  if (tokens.includes('mac') || tokens.includes('macos') || tokens.includes('osx') || tokens.includes('darwin')) return 'darwin'
  if (tokens.includes('linux')) return 'linux'
  return 'any'
}

function inferArch(tokens: string[]): 'amd64' | 'arm64' | 'any' {
  if (tokens.includes('x86_64') || tokens.includes('x64') || tokens.includes('amd64')) return 'amd64'
  if (tokens.includes('arm64') || tokens.includes('aarch64')) return 'arm64'
  return 'any'
}

function keywordCategory(slug: string): 'base'|'writing'|'model'|'script'|'bundle' {
  if (/webgal/.test(slug)) return 'base'
  if (/live2d|l2dw/.test(slug)) return 'model'
  if (/anogo/.test(slug)) return 'script'
  if (/mygo/.test(slug)) return 'bundle'
  return 'bundle'
}

async function walk(dir: string, base: string = dir): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...await walk(p, base))
    } else {
      out.push(path.relative(base, p))
    }
  }
  return out
}

async function main() {
  process.env.METADATA_DATABASE_URL = process.env.METADATA_DATABASE_URL || 'file:./metadata.db'
  const prisma = new PrismaClient()

  const REPO_ROOT = path.resolve(process.cwd(), '../../')
  const assetsDir = path.resolve(REPO_ROOT, 'assetsReal')
  if (!existsSync(assetsDir)) {
    console.error('assetsReal directory not found at', assetsDir)
    process.exit(1)
  }

  const files = (await walk(assetsDir)).filter(r => /\.(zip|7z|tar\.gz|tgz|tar|dmg|exe|msi|deb|rpm|txt)$/i.test(r))
  if (!files.length) {
    console.log('no assets found under', assetsDir)
    process.exit(0)
  }

  for (const rel of files) {
    const abs = path.join(assetsDir, rel)
    const stat = await fs.stat(abs)
    if (!stat.isFile()) continue

    const parentDir = path.dirname(rel).split(path.sep).pop() || ''
    const base = path.basename(rel)
    const stem = stemWithoutExt(base)
    const tokens = splitTokens(stem)

    const vinfo = findVersionInStem(stem)
    const version = vinfo?.version || '1.0.0'
    const slug = inferSlugFromStem(stem, vinfo).replace(/[^a-z0-9-]/g, '')
    const channel = inferChannel(tokens)
    const os = inferOS(tokens)
    const arch = inferArch(tokens)

    let category: any = 'bundle'
    if (ALLOWED_CATEGORIES.has(parentDir)) category = parentDir
    else category = keywordCategory(slug)

    // Upsert File by name+ownerId='public'
    const ownerId = 'public'
    let file = await prisma.file.findFirst({ where: { name: base, ownerId, deletedAt: null } })
    if (!file) {
      file = await prisma.file.create({
        data: {
          id: randomUUID(),
          name: base,
          type: 'file',
          ownerId,
          parentId: null,
          path: '/' + base,
          size: stat.size,
          mimeType: 'application/octet-stream',
          version: 1,
        }
      })
      console.log('created file', file.id, base)
    } else {
      await prisma.file.update({ where: { id: file.id }, data: { size: stat.size, updatedAt: new Date() } })
      console.log('updated file size', file.id, base)
    }

    // Replace previous catalog:* tags
    await prisma.fileTag.deleteMany({ where: { fileId: file.id, tagName: { startsWith: 'catalog:' } } })

    const tags: string[] = []
    const push = (k: string, v: any) => {
      if (v === undefined || v === null || v === '') return
      tags.push(`catalog:${k}=${String(v)}`)
    }

    push('kind', 'asset')
    push('slug', slug)
    push('name', slug)
    push('category', category)
    push('version', version)
    push('channel', channel)
    push('public', 'true')
    if (os !== 'any') push('os', os)
    if (arch !== 'any') push('arch', arch)
    const relUrl = '/assets/' + rel.split(path.sep).map(encodeURIComponent).join('/')
    push('url', relUrl)

    for (const t of tags) {
      await prisma.fileTag.create({ data: { id: randomUUID(), fileId: file.id, tagName: t } })
    }
  }

  console.log('scan completed')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })

