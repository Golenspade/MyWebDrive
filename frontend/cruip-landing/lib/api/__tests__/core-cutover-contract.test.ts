import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const root = resolve(__dirname, '../../../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Core-first frontend source contract', () => {
  test('uses the Core file and version endpoints with string byte fields', () => {
    const source = read('frontend/cruip-landing/lib/api/files.ts')

    expect(source).toContain("apiClient.get<FilesResp>(`/files${")
    expect(source).toContain('/files/${encodeURIComponent(fileId)}/versions')
    expect(source).toContain('/admin/users/${encodeURIComponent(userId)}/files')
    expect(source).toMatch(/sizeBytes:\s*string/)
    expect(source).not.toContain('/files/me')
    expect(source).not.toContain('/files/admin/by-user')
    expect(source).not.toContain('/restore')
  })

  test('uploads through an intent and sends the storage grant on every byte request', () => {
    const source = read('frontend/cruip-landing/components/upload/upload-panel.tsx')

    expect(source).toContain("'/upload-intents'")
    expect(source).toContain("'Idempotency-Key'")
    expect(source).toContain('sizeBytes: String(file.size)')
    expect(source).toContain('/storage/uploads/${intent.objectKey}/parts/${partNumber}')
    expect(source).toContain('Authorization: `Bearer ${intent.uploadGrant}`')
    expect(source).toContain('/storage/uploads/${intent.objectKey}/complete')
    expect(source).toContain('/upload-intents/${intent.id}/cancel')
    for (const legacy of ['/storage/uploads\'', "method: 'PATCH'", '/finalize', '/draft', 'download-direct', '/storage/files/']) {
      expect(source).not.toContain(legacy)
    }
  })

  test('downloads private files and publications only with a fresh ticket grant', () => {
    const account = read('frontend/cruip-landing/app/account/page.tsx')
    const catalog = read('frontend/cruip-landing/components/download/catalog-page.tsx')

    expect(account).toContain('/files/${encodeURIComponent(file.id)}/download-ticket')
    expect(account).toContain('/storage/objects/${encodeURIComponent(ticket.objectKey)}')
    expect(account).toContain('Authorization: `Bearer ${ticket.downloadGrant}`')
    expect(account).toContain('currentVersion')
    expect(account).not.toContain('restore')
    expect(account).not.toContain('download-direct')

    expect(catalog).toContain("apiClient.get<PublicationsResponse>('/publications')")
    expect(catalog).toContain('/publications/${encodeURIComponent(publication.slug)}/download-ticket')
    expect(catalog).toContain('/storage/objects/${encodeURIComponent(ticket.objectKey)}')
    expect(catalog).toContain('Authorization: `Bearer ${ticket.downloadGrant}`')
    expect(catalog).toContain("status === 'loading'")
    expect(catalog).toContain("status === 'error'")
    expect(catalog).toContain('publications.length === 0')
    for (const fixture of ['SAMPLE_PROJECTS', 'example.com', 'download-direct', '/storage/files/']) {
      expect(catalog).not.toContain(fixture)
    }
  })

  test('does not retain the unmounted fixture catalog implementation', () => {
    expect(existsSync(resolve(root, 'frontend/cruip-landing/app/(default)/download/CatalogPage.tsx'))).toBe(false)
  })

  test('exposes the anonymous share-token ticket helper', () => {
    const source = read('frontend/cruip-landing/lib/api/files.ts')
    expect(source).toContain('/shares/${encodeURIComponent(token)}/download-ticket')
  })
})
