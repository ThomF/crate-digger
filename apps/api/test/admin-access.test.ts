import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RouteOptions } from 'fastify'
import { newsItems } from '../src/db/schema.ts'
import {
  addCrate,
  buildTestApp,
  createAdmin,
  signUp,
  type SignedIn,
  type TestApp,
} from './helpers.ts'

// AC4: every /api/admin route, collected from Fastify itself rather than a list written here, plus
// the verification route. Signed out is 401, role=user is 403, and neither changes a row.

type Call = { method: string; url: string; label: string; payload?: object }

const VERIFIED_ROUTE = '/api/users/:username/verified'

/** Bodies that would succeed if a guard were missing, so a refused call proves the guard. */
function bodyFor(method: string, url: string): object | undefined {
  if (!['POST', 'PATCH', 'PUT'].includes(method)) return undefined
  if (url === VERIFIED_ROUTE) return { verified: true }
  if (url === '/api/admin/crates/:id/suggested') return { suggested: true }
  if (url === '/api/admin/crates') return { name: 'Should not exist', suggested: true }
  if (url === '/api/admin/import') return { crates: [{ name: 'Should not exist' }] }
  if (url.startsWith('/api/admin/news')) return { title: 'T', summary: 'S', source: 'Src' }
  return {}
}

let app: TestApp
let admin: SignedIn
let member: SignedIn
const routes: RouteOptions[] = []
let calls: Call[]

/** Row counts of every table in the database, found from SQLite rather than listed by hand. */
function allRowCounts() {
  const tables = app.db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  )
  return Object.fromEntries(
    tables.map(({ name }) => {
      const [row] = app.db.all<{ n: number }>(
        sql`SELECT count(*) AS n FROM ${sql.identifier(name)}`,
      )
      return [name, row?.n]
    }),
  )
}

beforeAll(async () => {
  app = await buildTestApp({ onRoute: (route) => routes.push(route) })
  admin = await createAdmin(app)
  member = await signUp(app)
  // A row behind every :id, so a missing guard would change something rather than 404.
  addCrate(app, 'Existing crate', 0, member.user.id)
  app.db
    .insert(newsItems)
    .values({
      seedKey: 'news:access-test',
      title: 'Existing',
      summary: 'Existing',
      source: 'Existing',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    .run()

  const collected = routes.flatMap((route) =>
    (Array.isArray(route.method) ? route.method : [route.method]).map((method) => ({
      method: String(method),
      url: route.url,
    })),
  )
  calls = [
    ...collected.filter(({ url }) => url.startsWith('/api/admin')),
    { method: 'PATCH', url: VERIFIED_ROUTE },
  ].map(({ method, url }) => ({
    method,
    label: `${method} ${url}`,
    url: url.replace(':id', '1').replace(':username', member.user.username),
    payload: bodyFor(method, url),
  }))
})
afterAll(() => app.close())

const send = (call: Call, headers: Record<string, string> = {}) =>
  app.inject({
    method: call.method as 'GET',
    url: call.url,
    headers,
    ...(call.payload ? { payload: call.payload } : {}),
  })

describe('admin access', () => {
  it('collects the real admin routes from Fastify', () => {
    const labels = calls.map((call) => call.label)

    expect(labels.filter((label) => label.includes('/api/admin')).length).toBeGreaterThan(0)
    expect(labels).toEqual(
      expect.arrayContaining([
        'GET /api/admin/overview',
        'GET /api/admin/users',
        'GET /api/admin/crates',
        'POST /api/admin/crates',
        'PATCH /api/admin/crates/:id/suggested',
        'GET /api/admin/news',
        'POST /api/admin/news',
        'PATCH /api/admin/news/:id',
        'DELETE /api/admin/news/:id',
        'POST /api/admin/import',
        `PATCH ${VERIFIED_ROUTE}`,
      ]),
    )
  })

  it('answers 401 signed out and writes nothing', async () => {
    const before = allRowCounts()

    for (const call of calls) {
      const res = await send(call)
      expect(res.statusCode, call.label).toBe(401)
    }

    expect(allRowCounts()).toEqual(before)
  })

  it('answers 403 to a role=user account and writes nothing', async () => {
    const before = allRowCounts()

    for (const call of calls) {
      const res = await send(call, member.headers)
      expect(res.statusCode, call.label).toBe(403)
    }

    expect(allRowCounts()).toEqual(before)
  })

  it('refuses a signed-out oversized or malformed body before reading it', async () => {
    const oversized = await app.inject({
      method: 'POST',
      url: '/api/admin/import',
      headers: { 'content-type': 'application/json' },
      payload: 'x'.repeat(2 * 1024 * 1024),
    })
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/admin/news',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    })

    expect(oversized.statusCode).toBe(401)
    expect(malformed.statusCode).toBe(401)
  })

  // Last: this one really does write.
  it('never answers 401 or 403 to an admin', async () => {
    for (const call of calls) {
      const res = await send(call, admin.headers)
      expect(res.statusCode, call.label).not.toBe(401)
      expect(res.statusCode, call.label).not.toBe(403)
    }
  })
})
