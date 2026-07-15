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

  test('uses only Core-native admin identity and quota routes', () => {
    const admin = read('frontend/cruip-landing/lib/api/admin.ts')
    const usersPage = read('frontend/cruip-landing/app/admin/users/page.tsx')
    const storagePage = read('frontend/cruip-landing/app/admin/storage/page.tsx')

    expect(admin).toContain("apiClient.get<UsersResp>(`/admin/users${")
    expect(admin).toContain('/admin/users/${encodeURIComponent(id)}')
    expect(admin).toContain('/admin/users/${encodeURIComponent(id)}/role')
    expect(admin).toContain('/admin/users/${encodeURIComponent(id)}/quota')
    expect(admin).toMatch(/committedBytes:\s*string/)
    expect(usersPage).not.toContain('usersApi')
    expect(storagePage).not.toContain('usersApi')

    for (const legacy of ['/auth/admin/users', '/users/${id}/storage', '/users/${id}/quota']) {
      expect(admin).not.toContain(legacy)
      expect(usersPage).not.toContain(legacy)
      expect(storagePage).not.toContain(legacy)
    }
  })

  test('publishes only versioned owned files through the Core publication model', () => {
    const source = read('frontend/cruip-landing/app/admin/publish/page.tsx')

    expect(source).toContain("apiClient.get<FilesResponse>('/files?limit=100')")
    expect(source).toContain('cursor=${encodeURIComponent(cursor)}')
    expect(source).toContain('setNextCursor(response.nextCursor)')
    expect(source).toContain('loadFiles(nextCursor)')
    expect(source).toContain('/files/${encodeURIComponent(selectedFile.id)}/publication')
    expect(source).toContain("status: publicationStatus")
    expect(source).toContain('file.currentVersion')
    expect(source).toContain("status === 'loading'")
    expect(source).toContain("status === 'error'")
    expect(source).toContain("status === 'ready' && !nextCursor && visibleFiles.length === 0")
    expect(source).toMatch(/async function publish\(\) \{[\s\S]*?setPublished\(null\)[\s\S]*?try/)
    expect(source).toMatch(/\.slice\(0, 64\)\s*\.replace\(\/-\+\$\/g, ''\)/)
    for (const legacy of ['/search', '/catalog/', '/catalog`', '/catalog\'', 'CatalogFormData']) {
      expect(source).not.toContain(legacy)
    }
  })
})
