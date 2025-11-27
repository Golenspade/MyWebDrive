import { describe, it, expect, beforeAll } from 'vitest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test-secret-key'

process.env.JWT_SECRET = TEST_SECRET
process.env.ACCESS_TOKEN_TTL = '900'
process.env.REFRESH_TOKEN_TTL = '604800'

let signAccess: (userId: string, role: string) => string
let signRefresh: (userId: string) => string

beforeAll(async () => {
  const mod = await import('../src/index.js')
  signAccess = (mod as any).signAccess
  signRefresh = (mod as any).signRefresh
})

describe('auth JWT helpers', () => {
  it('signAccess embeds user_id, role and type=access', () => {
    const token = signAccess('user-1', 'admin')
    const decoded = jwt.verify(token, TEST_SECRET) as any
    expect(decoded.user_id).toBe('user-1')
    expect(decoded.role).toBe('admin')
    expect(decoded.type).toBe('access')
  })

  it('signRefresh embeds user_id and type=refresh', () => {
    const token = signRefresh('user-2')
    const decoded = jwt.verify(token, TEST_SECRET) as any
    expect(decoded.user_id).toBe('user-2')
    expect(decoded.type).toBe('refresh')
  })
})

