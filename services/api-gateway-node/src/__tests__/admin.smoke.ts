import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { spawn, ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const GATEWAY_PORT = process.env.GATEWAY_PORT || '9080'
const GATEWAY = process.env.API_BASE_URL || `http://localhost:${GATEWAY_PORT}`
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'

function bearer(role: 'admin' | 'user' = 'admin') {
  const token = jwt.sign({ user_id: 'test-admin', role, type: 'access' }, JWT_SECRET, { expiresIn: 60 * 10 })
  return `Bearer ${token}`
}

async function jget<T = any>(path: string): Promise<{ status: number; body: T }> {
  const resp = await fetch(`${GATEWAY}${path}`, { headers: { Authorization: bearer('admin') } })
  const status = resp.status
  const body = (status === 204 || status === 205) ? (undefined as any) : (await resp.json() as any)
  return { status, body } as { status: number; body: T }
}

async function jpost<T = any>(path: string, data?: any): Promise<{ status: number; body: T }> {
  const resp = await fetch(`${GATEWAY}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: bearer('admin') },
    body: data ? JSON.stringify(data) : undefined,
  })
  const status = resp.status
  const body = (status === 204 || status === 205) ? (undefined as any) : (await resp.json() as any)
  return { status, body } as { status: number; body: T }
}

test('setup services', async (t) => {
  // Start auth service if needed
  if (!(await isUp('http://localhost:7081/health'))) {
    auth = spawn(process.execPath, ['services/auth/dist/index.js'], {
      env: { ...process.env, AUTH_PORT: '7081', JWT_SECRET },
      stdio: 'ignore',
    })
    for (let i = 0; i < 20; i++) {
      if (await isUp('http://localhost:7081/health')) break
      await delay(200)
    }
    assert.ok(await isUp('http://localhost:7081/health'))
  }

  // Start gateway if needed
  if (!(await isUp(`http://localhost:${GATEWAY_PORT}/health`))) {
    gw = spawn(process.execPath, ['services/api-gateway-node/dist/index.js'], {
      env: {
        ...process.env,
        GATEWAY_PORT: GATEWAY_PORT,
        JWT_SECRET,
        AUTH_SERVICE_URL: 'http://localhost:7081',
        USER_SERVICE_URL: 'http://localhost:7082',
        METADATA_SERVICE_URL: 'http://localhost:7083',
        STORAGE_SERVICE_URL: 'http://localhost:7084',
        SHARING_SERVICE_URL: 'http://localhost:7085',
      },
      stdio: 'ignore',
    })
    for (let i = 0; i < 30; i++) {
      if (await isUp(`http://localhost:${GATEWAY_PORT}/health`)) break
      await delay(200)
    }
    assert.ok(await isUp(`http://localhost:${GATEWAY_PORT}/health`))
  }

  t.after(() => {
    if (gw) gw.kill()
    if (auth) auth.kill()
  })
})

test('admin overview aggregates', async () => {
  const { status, body } = await jget<any>('/api/v1/admin/overview')
  assert.equal(status, 200)
  assert.ok(body && typeof body === 'object')
  assert.ok(body.totals && typeof body.totals.total_files === 'number')
  assert.ok(body.today && Object.hasOwn(body.today, 'downloads_bytes'))
  assert.ok(body.today && Object.hasOwn(body.today, 'requests_count'))
})

test('invitations CRUD-ish', async (t) => {
  // list (empty ok)
  const list1 = await jget<any[]>('/api/v1/auth/invitations')
  assert.equal(list1.status, 200)
  assert.ok(Array.isArray(list1.body))

  // create
  const created = await jpost<any>('/api/v1/auth/invitations', { usageLimit: 1, notes: 'smoke' })
  assert.equal(created.status, 201)
  assert.ok(created.body?.code)

  // get
  const got = await jget<any>(`/api/v1/auth/invitations/${created.body.code}`)
  assert.equal(got.status, 200)
  assert.equal(got.body.code, created.body.code)

  // revoke
  const rev = await jpost<any>(`/api/v1/auth/invitations/${created.body.code}/revoke`)
  assert.equal(rev.status, 200)
})

test('admin users list ok', async () => {
  const { status, body } = await jget<any>('/api/v1/auth/admin/users')
  assert.equal(status, 200)
  assert.ok(body && typeof body === 'object')
  assert.ok(Array.isArray(body.items))
})

test('admin health ok', async () => {
  const { status, body } = await jget<any>('/api/v1/admin/health')
  assert.equal(status, 200)
  assert.ok(Array.isArray(body.services))
})

test.skip('admin notifications CRUD (memory)', async () => {
  // create one
  const created = await jpost<any>('/api/v1/admin/notifications', { title: 'Test notice', severity: 'info', description: 'hello' })
  assert.equal(created.status, 201)
  const list = await jget<any[]>('/api/v1/admin/notifications')
  assert.equal(list.status, 200)
  assert.ok(Array.isArray(list.body) && list.body.find((n: any) => n.id === created.body.id))

  // mark-read
  const mark = await jpost<any>('/api/v1/admin/notifications/mark-read', { ids: [created.body.id] })
  assert.equal(mark.status, 200)
})

test.skip('admin audit append/list (memory)', async () => {
  const created = await jpost<any>('/api/v1/admin/audit', { action: 'unit-test', target: 'notifications' })
  assert.equal(created.status, 201)
  const list = await jget<any[]>('/api/v1/admin/audit')
  assert.equal(list.status, 200)
  assert.ok(Array.isArray(list.body) && list.body.some((a: any) => a.id === created.body.id))
})
// Boot services if not running
async function isUp(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'GET' })
    return r.ok
  } catch {
    return false
  }
}

let gw: ChildProcess | null = null
let auth: ChildProcess | null = null
