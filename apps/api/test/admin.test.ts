import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  AdminCrate,
  AdminImportResult,
  AdminNewsItem,
  AdminOverview,
  AdminUser,
  AlbumDetail,
  AlbumSummary,
  Crate,
  CrateCard,
  NewsItem,
  PublicProfile,
} from '@frisson/shared'
import {
  adminCreateCrateInput,
  adminImportInput,
  adminNewsItem,
  adminUpdateNewsInput,
} from '@frisson/shared'
import { albums, crates, newsItems, tracks, users } from '../src/db/schema.ts'
import { seedDemoContent } from '../src/services/demo-seed.ts'
import {
  addCrate,
  buildTestApp,
  createAdmin,
  signUp,
  type SignedIn,
  type TestApp,
} from './helpers.ts'

// The admin endpoints: overview, users, crates, news and all-or-nothing bulk import.
// Who may call them is covered in admin-access.test.ts.

let app: TestApp
let admin: SignedIn
beforeEach(async () => {
  app = await buildTestApp()
  admin = await createAdmin(app)
})
afterEach(() => app.close())

/** Every key anywhere in a JSON value. */
function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, inner]) => [key, ...allKeys(inner)])
}

const SECRET_KEYS = ['passwordHash', 'password_hash', 'demoSeedKey', 'seedKey']

function expectNoSecretKeys(value: unknown) {
  const keys = allKeys(value)
  for (const secret of SECRET_KEYS) expect(keys).not.toContain(secret)
}

function rowCounts() {
  const n = (table: typeof users | typeof crates | typeof albums | typeof tracks) =>
    app.db.select({ id: table.id }).from(table).all().length
  return {
    users: n(users),
    crates: n(crates),
    albums: n(albums),
    tracks: n(tracks),
    news: app.db.select({ id: newsItems.id }).from(newsItems).all().length,
  }
}

const asAdmin = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  app.inject({
    method,
    url,
    headers: admin.headers,
    ...(payload ? { payload } : {}),
  })

const adminCrates = async () => (await asAdmin('GET', '/api/admin/crates')).json<AdminCrate[]>()
const adminUsers = async () => (await asAdmin('GET', '/api/admin/users')).json<AdminUser[]>()
const publicNews = async () => (await app.inject({ url: '/api/news' })).json<NewsItem[]>()
const recommended = async () =>
  (await app.inject({ url: '/api/crates/recommended' })).json<CrateCard[]>()

const addAlbum = (crateId: number, title = 'Record') =>
  app.db
    .insert(albums)
    .values({ crateId, title, artist: 'Artist' })
    .returning({ id: albums.id })
    .get()

describe('GET /api/admin/overview', () => {
  it('counts a known fixture', async () => {
    const member = await signUp(app)
    const one = addCrate(app, 'One', 0, member.user.id)
    addCrate(app, 'Two', 1, admin.user.id)
    addCrate(app, 'Ownerless', 2, null)
    addAlbum(one.id)
    addAlbum(one.id)
    app.db.update(crates).set({ recommendedRank: 1 }).where(eq(crates.id, one.id)).run()
    await asAdmin('POST', '/api/admin/news', { title: 'T', summary: 'S', source: 'Src' })

    const res = await asAdmin('GET', '/api/admin/overview')

    expect(res.statusCode).toBe(200)
    expect(res.json<AdminOverview>()).toEqual({
      users: 2,
      crates: 3,
      suggestedCrates: 1,
      albums: 2,
      news: 1,
    })
  })
})

describe('GET /api/admin/users', () => {
  it('lists every user, with no credential or seed key anywhere', async () => {
    const member = await signUp(app, { displayName: 'Member' })
    addCrate(app, 'Mine', 0, member.user.id)
    addCrate(app, 'Also mine', 1, member.user.id)
    seedDemoContent(app.db)

    const res = await asAdmin('GET', '/api/admin/users')
    const list = res.json<AdminUser[]>()

    expect(res.statusCode).toBe(200)
    expect(list).toHaveLength(rowCounts().users)
    expectNoSecretKeys(list)
    expect(res.body).not.toContain('scrypt$')
    expect(res.body).not.toContain('demo-account-no-login')

    const row = list.find((u) => u.id === member.user.id)
    expect(row).toEqual({
      id: member.user.id,
      email: member.user.email,
      username: member.user.username,
      displayName: 'Member',
      role: 'user',
      verified: false,
      isDemo: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      crateCount: 2,
    })

    expect(list.find((u) => u.id === admin.user.id)).toMatchObject({
      role: 'admin',
      isDemo: false,
      crateCount: 0,
    })
    const demo = list.filter((u) => u.isDemo)
    expect(demo.length).toBeGreaterThan(0)
    expect(demo.every((u) => u.role === 'user' && u.crateCount > 0)).toBe(true)
  })

  it('shows the result of the existing verification route, here and on the profile', async () => {
    const member = await signUp(app)
    const { username } = member.user
    const verifiedInBoth = async () => ({
      list: (await adminUsers()).find((u) => u.username === username)?.verified,
      profile: (await app.inject({ url: `/api/users/${username}` })).json<PublicProfile>().verified,
    })
    const setVerified = (verified: boolean) =>
      asAdmin('PATCH', `/api/users/${username}/verified`, { verified })

    expect(await verifiedInBoth()).toEqual({ list: false, profile: false })

    expect((await setVerified(true)).statusCode).toBe(200)
    expect(await verifiedInBoth()).toEqual({ list: true, profile: true })

    expect((await setVerified(false)).statusCode).toBe(200)
    expect(await verifiedInBoth()).toEqual({ list: false, profile: false })
  })
})

describe('GET /api/admin/crates', () => {
  it('returns every crate, ownerless included, suggested first by rank', async () => {
    const member = await signUp(app, { displayName: 'Member' })
    const ownerless = addCrate(app, 'Ownerless', 0, null)
    const plain = addCrate(app, 'Plain', 1, member.user.id)
    const second = addCrate(app, 'Second', 2, member.user.id)
    const first = addCrate(app, 'First', 3, member.user.id)
    app.db.update(crates).set({ recommendedRank: 2 }).where(eq(crates.id, second.id)).run()
    app.db.update(crates).set({ recommendedRank: 1 }).where(eq(crates.id, first.id)).run()
    addAlbum(plain.id)

    const res = await asAdmin('GET', '/api/admin/crates')
    const list = res.json<AdminCrate[]>()

    expect(res.statusCode).toBe(200)
    expect(list.map((c) => c.id)).toEqual([first.id, second.id, ownerless.id, plain.id])
    expect(list[2]).toEqual({
      id: ownerless.id,
      name: 'Ownerless',
      label: null,
      color: '#c8a374',
      albumCount: 0,
      ownerUsername: null,
      ownerDisplayName: null,
      recommendedRank: null,
      isDemo: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })
    expect(list[3]).toMatchObject({
      albumCount: 1,
      ownerUsername: member.user.username,
      ownerDisplayName: 'Member',
    })
    expectNoSecretKeys(list)
  })

  it('flags demo crates without exposing their key', async () => {
    seedDemoContent(app.db)

    const list = await adminCrates()

    expect(list.length).toBeGreaterThan(0)
    expect(list.every((c) => c.isDemo)).toBe(true)
    expectNoSecretKeys(list)
  })
})

describe('POST /api/admin/crates', () => {
  it('creates a suggested crate owned by the admin, last among the recommended', async () => {
    seedDemoContent(app.db)
    const before = await recommended()

    const res = await asAdmin('POST', '/api/admin/crates', { name: 'Staff picks', suggested: true })
    const created = res.json<AdminCrate>()

    expect(res.statusCode).toBe(201)
    expect(created).toMatchObject({
      name: 'Staff picks',
      ownerUsername: admin.user.username,
      albumCount: 0,
      isDemo: false,
    })
    expect(created.recommendedRank).not.toBeNull()

    const publicCrates = (await app.inject({ url: '/api/crates' })).json<Crate[]>()
    const listed = publicCrates.find((c) => c.id === created.id)
    expect(listed?.ownerId).toBe(admin.user.id)
    expect(listed?.sortOrder).toBe(Math.max(...publicCrates.map((c) => c.sortOrder)))

    const after = await recommended()
    expect(after).toHaveLength(before.length + 1)
    expect(after.at(-1)?.id).toBe(created.id)

    // Home labels demo crates only, so an admin's pick must not read as demo.
    const cards = (await app.inject({ url: '/api/crates/recommended' })).json<
      { id: number; isDemo: boolean }[]
    >()
    expect(cards.find((card) => card.id === created.id)?.isDemo).toBe(false)
    expect(cards.filter((card) => card.id !== created.id).every((card) => card.isDemo)).toBe(true)
  })

  it('is not suggested unless asked, and starts ranks at 1', async () => {
    const plain = await asAdmin('POST', '/api/admin/crates', { name: 'Plain' })
    expect(plain.json<AdminCrate>().recommendedRank).toBeNull()
    expect(await recommended()).toEqual([])

    const first = await asAdmin('POST', '/api/admin/crates', { name: 'First', suggested: true })
    expect(first.json<AdminCrate>().recommendedRank).toBe(1)
  })

  it('rejects a blank name and writes nothing', async () => {
    const before = rowCounts()

    const res = await asAdmin('POST', '/api/admin/crates', { name: '   ' })

    expect(res.statusCode).toBe(400)
    expect(rowCounts()).toEqual(before)
  })
})

describe('PATCH /api/admin/crates/:id/suggested', () => {
  const setSuggested = (id: number, suggested: boolean) =>
    asAdmin('PATCH', `/api/admin/crates/${id}/suggested`, { suggested })

  it('removes a crate from the recommended list and adds it back at the end', async () => {
    const a = (
      await asAdmin('POST', '/api/admin/crates', { name: 'A', suggested: true })
    ).json<AdminCrate>()
    const b = (
      await asAdmin('POST', '/api/admin/crates', { name: 'B', suggested: true })
    ).json<AdminCrate>()
    expect((await recommended()).map((c) => c.id)).toEqual([a.id, b.id])

    const off = await setSuggested(a.id, false)
    expect(off.statusCode).toBe(200)
    expect(off.json<AdminCrate>().recommendedRank).toBeNull()
    expect((await recommended()).map((c) => c.id)).toEqual([b.id])

    const on = await setSuggested(a.id, true)
    expect(on.statusCode).toBe(200)
    expect(on.json<AdminCrate>().recommendedRank).toBeGreaterThan(b.recommendedRank as number)
    expect((await recommended()).map((c) => c.id)).toEqual([b.id, a.id])
  })

  it('keeps the rank when an already suggested crate is suggested again', async () => {
    const a = (
      await asAdmin('POST', '/api/admin/crates', { name: 'A', suggested: true })
    ).json<AdminCrate>()
    await asAdmin('POST', '/api/admin/crates', { name: 'B', suggested: true })

    const again = await setSuggested(a.id, true)

    expect(again.statusCode).toBe(200)
    expect(again.json<AdminCrate>().recommendedRank).toBe(a.recommendedRank)
  })

  it('answers 409 for an ownerless crate, leaving it alone', async () => {
    const ownerless = addCrate(app, 'Ownerless', 0, null)

    const res = await setSuggested(ownerless.id, true)

    expect(res.statusCode).toBe(409)
    const [row] = await adminCrates()
    expect(row?.recommendedRank).toBeNull()
  })

  it('still lets an ownerless crate be un-suggested', async () => {
    const ownerless = addCrate(app, 'Ownerless', 0, null)
    app.db.update(crates).set({ recommendedRank: 1 }).where(eq(crates.id, ownerless.id)).run()

    const res = await setSuggested(ownerless.id, false)

    expect(res.statusCode).toBe(200)
    expect(res.json<AdminCrate>().recommendedRank).toBeNull()
  })

  it('answers 404 for an unknown id, whichever way it is set', async () => {
    expect((await setSuggested(9999, true)).statusCode).toBe(404)
    expect((await setSuggested(9999, false)).statusCode).toBe(404)
  })

  it('keeps a demo crate un-suggested after the demo seed runs again', async () => {
    seedDemoContent(app.db)
    const [demo] = await recommended()
    if (!demo) throw new Error('expected a recommended demo crate')

    await setSuggested(demo.id, false)
    seedDemoContent(app.db)

    expect((await recommended()).map((c) => c.id)).not.toContain(demo.id)
  })
})

describe('admin news', () => {
  const NEWS = { title: 'Pressing plant reopens', summary: 'It is back.', source: 'Trade weekly' }

  const createNews = async (payload: object = NEWS) =>
    (await asAdmin('POST', '/api/admin/news', payload)).json<AdminNewsItem>()

  it('creates an item that comes first in the public news, with no seed key', async () => {
    seedDemoContent(app.db)

    const res = await asAdmin('POST', '/api/admin/news', NEWS)
    const created = res.json<AdminNewsItem>()

    expect(res.statusCode).toBe(201)
    expect(() => adminNewsItem.parse(created)).not.toThrow()
    expect(created).toMatchObject({ ...NEWS, isDemo: false })
    expectNoSecretKeys(created)

    const publicRes = await app.inject({ url: '/api/news' })
    const list = publicRes.json<NewsItem[]>()
    expect(list[0]).toEqual({
      id: created.id,
      ...NEWS,
      publishedAt: created.publishedAt,
      isDemo: false,
    })
    expectNoSecretKeys(list)
    expect(publicRes.body).not.toContain('admin:')
  })

  it('stores an admin: key that cannot collide with demo keys', async () => {
    const created = await createNews()

    const row = app.db
      .select({ seedKey: newsItems.seedKey })
      .from(newsItems)
      .where(eq(newsItems.id, created.id))
      .get()

    expect(row?.seedKey).toMatch(/^admin:[0-9a-f-]{36}$/)
  })

  it('sorts a second item from the same moment ahead of the first', async () => {
    const first = await createNews()
    const second = await createNews({ ...NEWS, title: 'Later', publishedAt: first.publishedAt })

    expect((await publicNews()).map((n) => n.id)).toEqual([second.id, first.id])
  })

  it('lists news in the public order and flags demo rows', async () => {
    seedDemoContent(app.db)
    await createNews()

    const res = await asAdmin('GET', '/api/admin/news')
    const list = res.json<AdminNewsItem[]>()

    expect(res.statusCode).toBe(200)
    expect(list.map((n) => n.id)).toEqual((await publicNews()).map((n) => n.id))
    expect(list[0]?.isDemo).toBe(false)
    expect(list.slice(1).every((n) => n.isDemo)).toBe(true)
    expectNoSecretKeys(list)
  })

  it('changes only the fields sent, and the public news shows it', async () => {
    const created = await createNews()

    const res = await asAdmin('PATCH', `/api/admin/news/${created.id}`, { title: 'New title' })

    expect(res.statusCode).toBe(200)
    expect(res.json<AdminNewsItem>()).toEqual({ ...created, title: 'New title' })
    expect((await publicNews())[0]).toMatchObject({ title: 'New title', summary: NEWS.summary })
  })

  it('accepts a new publishedAt', async () => {
    const created = await createNews()
    const publishedAt = '2020-02-03T04:05:06.000Z'

    const res = await asAdmin('PATCH', `/api/admin/news/${created.id}`, { publishedAt })

    expect(res.json<AdminNewsItem>().publishedAt).toBe(publishedAt)
  })

  it('never changes the seed key when patching, and allows editing a demo row', async () => {
    seedDemoContent(app.db)
    const [demo] = await publicNews()
    if (!demo) throw new Error('expected demo news')
    const keyOf = () =>
      app.db
        .select({ seedKey: newsItems.seedKey })
        .from(newsItems)
        .where(eq(newsItems.id, demo.id))
        .get()?.seedKey
    const key = keyOf()

    const res = await asAdmin('PATCH', `/api/admin/news/${demo.id}`, {
      title: 'Edited',
      seedKey: 'admin:hijacked',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json<AdminNewsItem>()).toMatchObject({ title: 'Edited', isDemo: true })
    expect(keyOf()).toBe(key)
  })

  it('rejects an empty PATCH', async () => {
    const created = await createNews()

    const res = await asAdmin('PATCH', `/api/admin/news/${created.id}`, {})

    expect(res.statusCode).toBe(400)
  })

  it('deletes an item from the public news, and a second delete is 404', async () => {
    const created = await createNews()

    const res = await asAdmin('DELETE', `/api/admin/news/${created.id}`)

    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
    expect(await publicNews()).toEqual([])
    expect((await asAdmin('DELETE', `/api/admin/news/${created.id}`)).statusCode).toBe(404)
  })

  it.each(['title', 'summary', 'source'] as const)(
    'answers 400 and writes nothing when %s is missing or blank',
    async (field) => {
      const missing = { ...NEWS, [field]: undefined } // JSON leaves the key out
      const before = rowCounts()

      expect((await asAdmin('POST', '/api/admin/news', missing)).statusCode).toBe(400)
      expect(
        (await asAdmin('POST', '/api/admin/news', { ...NEWS, [field]: '   ' })).statusCode,
      ).toBe(400)

      expect(rowCounts()).toEqual(before)
    },
  )

  it('answers 404 for an unknown id', async () => {
    expect((await asAdmin('PATCH', '/api/admin/news/9999', { title: 'X' })).statusCode).toBe(404)
    expect((await asAdmin('DELETE', '/api/admin/news/9999')).statusCode).toBe(404)
  })

  it('survives the demo seed unchanged, with no duplicates', async () => {
    seedDemoContent(app.db)
    const created = await createNews()
    const before = await asAdmin('GET', '/api/admin/news')

    seedDemoContent(app.db)

    const after = await asAdmin('GET', '/api/admin/news')
    expect(after.json()).toEqual(before.json())
    expect(after.json<AdminNewsItem[]>().filter((n) => n.id === created.id)).toEqual([created])
  })

  it('keeps an admin item when the demo seed first runs after it', async () => {
    const created = await createNews()

    seedDemoContent(app.db)

    const list = await publicNews()
    expect(list.filter((n) => n.id === created.id)).toHaveLength(1)
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length)
  })
})

describe('POST /api/admin/import', () => {
  const PAYLOAD = {
    crates: [
      {
        name: 'Imported one',
        label: 'One',
        color: '#112233',
        suggested: true,
        albums: [
          {
            title: 'First LP',
            artist: 'First Artist',
            year: 1979,
            genre: 'Dub',
            format: 'LP',
            tracks: [
              { side: 'A', position: 1, title: 'Opener' },
              { side: 'B', position: 1, title: 'Closer', durationSec: 200 },
            ],
          },
          { title: 'Second EP', artist: 'Second Artist', format: 'EP' },
        ],
      },
      { name: 'Imported two' },
      { name: 'Imported three', suggested: true },
    ],
    news: [
      { title: 'Item one', summary: 'S1', source: 'Src' },
      {
        title: 'Item two',
        summary: 'S2',
        source: 'Src',
        publishedAt: '2021-05-06T07:08:09.000Z',
      },
    ],
  }

  it('creates everything, readable through the public endpoints', async () => {
    addCrate(app, 'Already here', 4, admin.user.id)

    const res = await asAdmin('POST', '/api/admin/import', PAYLOAD)

    expect(res.statusCode).toBe(201)
    expect(res.json<AdminImportResult>()).toEqual({ crates: 3, albums: 2, tracks: 2, news: 2 })

    const shelf = (await app.inject({ url: '/api/crates' })).json<Crate[]>()
    expect(shelf.map((c) => [c.name, c.sortOrder])).toEqual([
      ['Already here', 4],
      ['Imported one', 5],
      ['Imported two', 6],
      ['Imported three', 7],
    ])
    expect(shelf.slice(1).every((c) => c.ownerId === admin.user.id)).toBe(true)
    const one = shelf[1]
    expect(one).toMatchObject({ label: 'One', color: '#112233', albumCount: 2 })

    expect((await recommended()).map((c) => c.name)).toEqual(['Imported one', 'Imported three'])

    const inCrate = (await app.inject({ url: `/api/albums?crateId=${one?.id}` })).json<
      AlbumSummary[]
    >()
    expect(inCrate.map((a) => [a.title, a.position, a.format])).toEqual([
      ['First LP', 0, 'LP'],
      ['Second EP', 1, 'EP'],
    ])

    const detail = (await app.inject({ url: `/api/albums/${inCrate[0]?.id}` })).json<AlbumDetail>()
    expect(detail).toMatchObject({ artist: 'First Artist', year: 1979, genre: 'Dub' })
    expect(detail.tracks.map((t) => [t.side, t.position, t.title, t.durationSec])).toEqual([
      ['A', 1, 'Opener', null],
      ['B', 1, 'Closer', 200],
    ])

    const news = await publicNews()
    expect(news.map((n) => n.title)).toEqual(['Item one', 'Item two'])
    expect(news[1]?.publishedAt).toBe('2021-05-06T07:08:09.000Z')
    expectNoSecretKeys(news)
  })

  it('continues the rank after existing suggested crates', async () => {
    seedDemoContent(app.db)
    const before = await recommended()

    await asAdmin('POST', '/api/admin/import', PAYLOAD)

    const after = await recommended()
    expect(after.slice(0, before.length)).toEqual(before)
    expect(after.slice(before.length).map((c) => c.name)).toEqual([
      'Imported one',
      'Imported three',
    ])
  })

  it('imports only news, or only crates', async () => {
    const onlyNews = await asAdmin('POST', '/api/admin/import', { news: PAYLOAD.news })
    const onlyCrates = await asAdmin('POST', '/api/admin/import', { crates: [{ name: 'Solo' }] })

    expect(onlyNews.json<AdminImportResult>()).toEqual({ crates: 0, albums: 0, tracks: 0, news: 2 })
    expect(onlyCrates.json<AdminImportResult>()).toEqual({
      crates: 1,
      albums: 0,
      tracks: 0,
      news: 0,
    })
  })

  it('answers 400 naming the failing entry, and writes nothing', async () => {
    const before = rowCounts()
    const noArtist = { ...PAYLOAD.crates[0]!.albums![1]!, artist: undefined } // left out of JSON
    const bad = {
      ...PAYLOAD,
      crates: [{ ...PAYLOAD.crates[0], albums: [PAYLOAD.crates[0]!.albums![0], noArtist] }],
    }

    const res = await asAdmin('POST', '/api/admin/import', bad)

    expect(res.statusCode).toBe(400)
    const paths = res.json<{ issues: { path: string }[] }>().issues.map((i) => i.path)
    expect(paths).toContain('body/crates/0/albums/1/artist')
    expect(rowCounts()).toEqual(before)
  })

  it('names a failing news entry too, and writes nothing', async () => {
    const before = rowCounts()

    const res = await asAdmin('POST', '/api/admin/import', {
      ...PAYLOAD,
      news: [PAYLOAD.news[0], { title: 'No summary', source: 'Src' }],
    })

    expect(res.statusCode).toBe(400)
    const paths = res.json<{ issues: { path: string }[] }>().issues.map((i) => i.path)
    expect(paths).toContain('body/news/1/summary')
    expect(rowCounts()).toEqual(before)
  })

  it('rejects an import with nothing in it', async () => {
    expect((await asAdmin('POST', '/api/admin/import', {})).statusCode).toBe(400)
    expect((await asAdmin('POST', '/api/admin/import', { crates: [], news: [] })).statusCode).toBe(
      400,
    )
  })

  it('rolls everything back if a write fails part way through', async () => {
    const before = rowCounts()
    // Validation cannot catch this: the last write of the transaction fails in the database.
    app.db.run(
      sql`CREATE TRIGGER fail_news BEFORE INSERT ON news_items
          BEGIN SELECT RAISE(ABORT, 'forced failure'); END`,
    )

    const res = await asAdmin('POST', '/api/admin/import', PAYLOAD)

    expect(res.statusCode).toBe(500)
    expect(rowCounts()).toEqual(before)
  })

  it('answers 413 to an oversized import, with zero rows written', async () => {
    const before = rowCounts()
    const news = Array.from({ length: 700 }, (_, i) => ({
      title: `Item ${i}`,
      summary: 'x'.repeat(2000),
      source: 'Src',
    }))
    expect(JSON.stringify({ news }).length).toBeGreaterThan(1024 * 1024)

    const res = await asAdmin('POST', '/api/admin/import', { news })

    expect(res.statusCode).toBe(413)
    expect(rowCounts()).toEqual(before)
  })
})

describe('admin request schemas', () => {
  it('defaults suggested to false and strips unknown keys', () => {
    expect(adminCreateCrateInput.parse({ name: 'Crate', ownerId: 1 })).toEqual({
      name: 'Crate',
      color: '#c8a374',
      sortBy: 'manual',
      suggested: false,
    })
  })

  it('requires at least one field to update, ignoring unknown keys', () => {
    expect(adminUpdateNewsInput.safeParse({}).success).toBe(false)
    expect(adminUpdateNewsInput.safeParse({ seedKey: 'x' }).success).toBe(false)
    expect(adminUpdateNewsInput.safeParse({ title: 'Ok' }).success).toBe(true)
  })

  it('requires at least one import entry', () => {
    expect(adminImportInput.safeParse({}).success).toBe(false)
    expect(adminImportInput.safeParse({ crates: [{ name: 'Ok' }] }).success).toBe(true)
  })
})
