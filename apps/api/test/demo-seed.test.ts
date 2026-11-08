import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAlbumInput, createCrateInput, signupInput, trackInput } from '@frisson/shared'
import { eq, isNotNull } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../src/db/client.ts'
import { DEMO_CRATES, DEMO_NEWS, DEMO_USERS } from '../src/db/demo-content.ts'
import {
  albums,
  crates,
  follows,
  newsItems,
  sessions,
  tracks,
  userLinks,
  users,
} from '../src/db/schema.ts'
import {
  DEMO_PASSWORD_HASH,
  seedDemoContent,
  seedDemoFromEnv,
  shouldSeedDemo,
} from '../src/services/demo-seed.ts'
import { verifyPassword } from '../src/services/passwords.ts'
import { createSession } from '../src/services/sessions.ts'
import { createUser } from '../src/services/users.ts'
import { addCrate, buildTestApp, signUp, type TestApp } from './helpers.ts'

const NOW = Date.parse('2026-11-08T00:00:00.000Z')
const DEMO_ALBUMS = DEMO_CRATES.flatMap((c) => c.albums)
const DEMO_TRACK_COUNT = DEMO_ALBUMS.reduce(
  (sum, a) => sum + Object.values(a.sides).flat().length,
  0,
)

const apps: TestApp[] = []
const cleanups: (() => void)[] = []
async function newApp() {
  const app = await buildTestApp()
  apps.push(app)
  return app
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/** The size of every table the seed could touch. */
function rowCounts(db: Db) {
  return {
    users: db.$count(users),
    crates: db.$count(crates),
    albums: db.$count(albums),
    tracks: db.$count(tracks),
    news: db.$count(newsItems),
  }
}
async function counts(db: Db) {
  const c = rowCounts(db)
  return {
    users: await c.users,
    crates: await c.crates,
    albums: await c.albums,
    tracks: await c.tracks,
    news: await c.news,
  }
}

/** The same deletes `npm run db:seed` makes. Demo users survive it; everything below goes. */
function wipeLikeDbSeed(db: Db) {
  db.transaction((tx) => {
    tx.delete(tracks).run()
    tx.delete(albums).run()
    tx.delete(crates).run()
  })
}

function quietLog() {
  const warnings: string[] = []
  return { warnings, log: { info: () => {}, warn: (msg: string) => void warnings.push(msg) } }
}

describe('demo content module', () => {
  it('meets the minimum counts', () => {
    expect(DEMO_USERS.length).toBeGreaterThanOrEqual(6)
    expect(DEMO_CRATES.length).toBeGreaterThanOrEqual(8)
    expect(DEMO_NEWS.length).toBeGreaterThanOrEqual(8)
    expect(
      DEMO_CRATES.filter((c) => c.recommendedRank !== undefined).length,
    ).toBeGreaterThanOrEqual(6)
    for (const crate of DEMO_CRATES) {
      expect(crate.albums.length, crate.name).toBeGreaterThanOrEqual(4)
      for (const album of crate.albums) {
        expect(Object.values(album.sides).flat().length, album.title).toBeGreaterThan(0)
      }
    }
  })

  it('states in a header comment that the data is fictional', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(resolve(here, '../src/db/demo-content.ts'), 'utf8')
    expect(source.startsWith('// FICTIONAL DEMO DATA.')).toBe(true)
  })

  it('uses unique seed keys with the right prefix on every row', () => {
    const groups = [
      ['user:', DEMO_USERS.map((u) => u.seedKey)],
      ['crate:', DEMO_CRATES.map((c) => c.seedKey)],
      ['album:', DEMO_ALBUMS.map((a) => a.seedKey)],
      ['news:', DEMO_NEWS.map((n) => n.seedKey)],
    ] as const
    for (const [prefix, keys] of groups) {
      expect(new Set(keys).size).toBe(keys.length)
      for (const key of keys) expect(key.startsWith(prefix), key).toBe(true)
    }
  })

  it('uses unique ranks, and every crate owner is a demo user', () => {
    const ranks = DEMO_CRATES.flatMap((c) => c.recommendedRank ?? [])
    expect(new Set(ranks).size).toBe(ranks.length)
    const userKeys = new Set(DEMO_USERS.map((u) => u.seedKey))
    for (const crate of DEMO_CRATES) expect(userKeys.has(crate.ownerSeedKey), crate.name).toBe(true)
  })

  it('has fixed, distinct dates in the past', () => {
    for (const dates of [
      DEMO_CRATES.map((c) => c.createdAt),
      DEMO_NEWS.map((n) => n.publishedAt),
    ]) {
      expect(new Set(dates).size).toBe(dates.length)
      for (const date of dates) {
        expect(new Date(date).toISOString()).toBe(date)
        expect(Date.parse(date)).toBeLessThan(NOW)
      }
    }
  })

  it('uses #rrggbb colours', () => {
    const hex = /^#[0-9a-f]{6}$/
    for (const crate of DEMO_CRATES) expect(crate.color).toMatch(hex)
    for (const album of DEMO_ALBUMS) expect(album.sleeveColor).toMatch(hex)
  })

  it('has no name containing "ai", which the Recommended section forbids', () => {
    const names = [
      ...DEMO_USERS.flatMap((u) => [u.username, u.displayName]),
      ...DEMO_CRATES.flatMap((c) => [c.name, c.label]),
      ...DEMO_ALBUMS.flatMap((a) => [a.title, a.artist]),
    ]
    expect(names.filter((name) => /ai/i.test(name))).toEqual([])
  })

  it('contains no links anywhere', () => {
    const text = JSON.stringify([DEMO_USERS, DEMO_CRATES, DEMO_NEWS])
    expect(text).not.toMatch(/https?:|www\./i)
  })

  it('fits the same rules real users have to follow', () => {
    for (const user of DEMO_USERS) {
      const parsed = signupInput.parse({ ...user, password: 'long-enough-password' })
      expect(parsed.username, 'already normalised').toBe(user.username)
      expect(parsed.email, 'already normalised').toBe(user.email)
    }
    for (const crate of DEMO_CRATES) {
      createCrateInput.parse({ name: crate.name, label: crate.label, color: crate.color })
      for (const album of crate.albums) {
        const { title, artist, year, genre, format, sleeveColor, rating } = album
        createAlbumInput.parse({
          crateId: 1,
          title,
          artist,
          year,
          genre,
          format,
          sleeveColor,
          rating,
        })
        for (const [side, titles] of Object.entries(album.sides)) {
          titles.forEach((t, i) => trackInput.parse({ side, position: i + 1, title: t }))
        }
      }
    }
  })
})

describe('seedDemoContent', () => {
  it('adds every row on an empty database and reports the counts', async () => {
    const app = await newApp()

    const added = seedDemoContent(app.db)

    const expected = {
      users: DEMO_USERS.length,
      crates: DEMO_CRATES.length,
      albums: DEMO_ALBUMS.length,
      tracks: DEMO_TRACK_COUNT,
      news: DEMO_NEWS.length,
    }
    expect(added).toEqual(expected)
    expect(await counts(app.db)).toEqual(expected)
  })

  it('makes demo users identifiable and inert (AC23)', async () => {
    const app = await newApp()
    seedDemoContent(app.db)

    const rows = app.db.select().from(users).all()
    expect(rows).toHaveLength(DEMO_USERS.length)
    for (const row of rows) {
      expect(row.demoSeedKey).toMatch(/^user:/)
      expect(row.username.startsWith('demo-'), row.username).toBe(true)
      expect(row.email).toBe(`${row.username}@frisson.invalid`)
      expect(row.verified).toBe(false)
      expect(row.role).toBe('user')
      expect(row.avatarPath).toBeNull()
      expect(row.passwordHash).toBe(DEMO_PASSWORD_HASH)
    }
    expect(await app.db.$count(userLinks)).toBe(0)
    expect(await app.db.$count(follows)).toBe(0)
    expect(await app.db.$count(sessions)).toBe(0)
  })

  it('stores crates and albums with owner, rank, order and no cover', async () => {
    const app = await newApp()
    seedDemoContent(app.db)

    const rows = app.db.select().from(crates).all()
    const owners = new Map(
      app.db
        .select()
        .from(users)
        .all()
        .map((u) => [u.demoSeedKey, u.id]),
    )
    for (const fixture of DEMO_CRATES) {
      const row = rows.find((r) => r.demoSeedKey === fixture.seedKey)!
      expect(row.name).toBe(fixture.name)
      expect(row.ownerId).toBe(owners.get(fixture.ownerSeedKey))
      expect(row.recommendedRank).toBe(fixture.recommendedRank ?? null)
      expect(row.createdAt.toISOString()).toBe(fixture.createdAt)

      const shelved = app.db.select().from(albums).where(eq(albums.crateId, row.id)).all()
      expect(shelved.map((a) => a.position).sort()).toEqual(fixture.albums.map((_, i) => i))
      for (const album of shelved) expect(album.coverPath).toBeNull()
    }
    expect(rows.map((r) => r.sortOrder)).toEqual(rows.map((_, i) => i))
  })

  it('stores news with its fixed date', async () => {
    const app = await newApp()
    seedDemoContent(app.db)

    const rows = app.db.select().from(newsItems).all()
    expect(rows.map((n) => n.publishedAt.toISOString()).sort()).toEqual(
      DEMO_NEWS.map((n) => n.publishedAt).sort(),
    )
  })

  it('adds no rows when run a second and third time (AC22)', async () => {
    const app = await newApp()
    seedDemoContent(app.db)
    const before = await counts(app.db)
    const rowsBefore = app.db.select().from(crates).all()

    const zero = { users: 0, crates: 0, albums: 0, tracks: 0, news: 0 }
    expect(seedDemoContent(app.db)).toEqual(zero)
    expect(seedDemoContent(app.db)).toEqual(zero)

    expect(await counts(app.db)).toEqual(before)
    expect(app.db.select().from(crates).all()).toEqual(rowsBefore)
  })

  it('keeps the new name of a renamed demo crate, with no duplicate (AC22)', async () => {
    const app = await newApp()
    seedDemoContent(app.db)
    const key = DEMO_CRATES[0]!.seedKey
    app.db.update(crates).set({ name: 'Renamed by hand' }).where(eq(crates.demoSeedKey, key)).run()
    const before = await counts(app.db)

    seedDemoContent(app.db)

    expect(await counts(app.db)).toEqual(before)
    const rows = app.db.select().from(crates).where(eq(crates.demoSeedKey, key)).all()
    expect(rows.map((r) => r.name)).toEqual(['Renamed by hand'])
    expect(app.db.select().from(crates).where(eq(crates.name, DEMO_CRATES[0]!.name)).all()).toEqual(
      [],
    )
  })

  it('restores crates, albums and tracks after a db:seed style wipe (AC22)', async () => {
    const app = await newApp()
    seedDemoContent(app.db)
    const before = await counts(app.db)

    wipeLikeDbSeed(app.db)
    // What db:seed then puts back, with no demo key and no owner.
    addCrate(app, 'Guitars', 0)
    addCrate(app, 'Beats & Bass', 1)

    const added = seedDemoContent(app.db)

    expect(added.users).toBe(0)
    expect(added.crates).toBe(DEMO_CRATES.length)
    expect(added.albums).toBe(DEMO_ALBUMS.length)
    expect(added.tracks).toBe(DEMO_TRACK_COUNT)
    expect(await counts(app.db)).toEqual({ ...before, crates: before.crates + 2 })

    const ranked = app.db.select().from(crates).where(isNotNull(crates.recommendedRank)).all()
    expect(ranked).toHaveLength(DEMO_CRATES.filter((c) => c.recommendedRank).length)
    expect(ranked.every((c) => c.ownerId !== null)).toBe(true)
  })

  it('brings back one deleted demo album with its tracks, at the end of its crate', async () => {
    const app = await newApp()
    seedDemoContent(app.db)
    const before = await counts(app.db)
    const fixture = DEMO_CRATES[0]!.albums[1]!
    const crateId = app.db
      .select()
      .from(albums)
      .where(eq(albums.demoSeedKey, fixture.seedKey))
      .get()!.crateId
    app.db.delete(albums).where(eq(albums.demoSeedKey, fixture.seedKey)).run()
    expect((await counts(app.db)).albums).toBe(before.albums - 1)

    const added = seedDemoContent(app.db)

    expect(added).toEqual({
      users: 0,
      crates: 0,
      albums: 1,
      tracks: Object.values(fixture.sides).flat().length,
      news: 0,
    })
    expect(await counts(app.db)).toEqual(before)
    const back = app.db.select().from(albums).where(eq(albums.demoSeedKey, fixture.seedKey)).get()!
    expect(back.crateId).toBe(crateId)
    const positions = app.db
      .select()
      .from(albums)
      .where(eq(albums.crateId, crateId))
      .all()
      .map((a) => a.position)
    expect(new Set(positions).size).toBe(positions.length)
    expect(back.position).toBe(Math.max(...positions))
  })

  it('does not change an edited demo album, or add tracks to it', async () => {
    const app = await newApp()
    seedDemoContent(app.db)
    const key = DEMO_ALBUMS[0]!.seedKey
    const album = app.db.select().from(albums).where(eq(albums.demoSeedKey, key)).get()!
    app.db.update(albums).set({ title: 'Edited' }).where(eq(albums.id, album.id)).run()
    app.db.delete(tracks).where(eq(tracks.albumId, album.id)).run()
    const edited = app.db.select().from(albums).where(eq(albums.id, album.id)).get()

    seedDemoContent(app.db)

    expect(app.db.select().from(albums).where(eq(albums.id, album.id)).get()).toEqual(edited)
    expect(app.db.select().from(tracks).where(eq(tracks.albumId, album.id)).all()).toEqual([])
  })

  it('brings back a deleted demo news item, and leaves an edited one alone', async () => {
    const app = await newApp()
    seedDemoContent(app.db)
    const [gone, edited] = DEMO_NEWS
    app.db.delete(newsItems).where(eq(newsItems.seedKey, gone!.seedKey)).run()
    app.db
      .update(newsItems)
      .set({ title: 'Edited' })
      .where(eq(newsItems.seedKey, edited!.seedKey))
      .run()

    expect(seedDemoContent(app.db).news).toBe(1)

    const row = (key: string) =>
      app.db.select().from(newsItems).where(eq(newsItems.seedKey, key)).get()
    expect(row(gone!.seedKey)?.title).toBe(gone!.title)
    expect(row(edited!.seedKey)?.title).toBe('Edited')
  })

  it("leaves every owner's existing row unchanged, and shelves demo crates after them", async () => {
    const app = await newApp()
    const owner = await signUp(app, { username: 'real-owner', email: 'owner@example.test' })
    createSession(app.db, owner.user.id)
    const ownerless = addCrate(app, 'Legacy', 7)
    const owned = addCrate(app, 'Mine', 40, owner.user.id)
    const album = app.db
      .insert(albums)
      .values({ crateId: ownerless.id, title: 'Real', artist: 'Real' })
      .returning()
      .get()
    app.db.insert(tracks).values({ albumId: album.id, position: 1, title: 'Real' }).run()
    app.db
      .insert(userLinks)
      .values({ userId: owner.user.id, platform: 'website', url: 'https://x.test', position: 0 })
      .run()
    const snapshot = () => ({
      users: app.db.select().from(users).where(eq(users.id, owner.user.id)).all(),
      links: app.db.select().from(userLinks).all(),
      sessions: app.db.select().from(sessions).all(),
      crates: app.db
        .select()
        .from(crates)
        .all()
        .filter((c) => c.demoSeedKey === null),
      albums: app.db
        .select()
        .from(albums)
        .all()
        .filter((a) => a.demoSeedKey === null),
      tracks: app.db.select().from(tracks).where(eq(tracks.albumId, album.id)).all(),
    })
    const before = snapshot()

    seedDemoContent(app.db)

    expect(snapshot()).toEqual(before)
    expect(ownerless.ownerId).toBeNull()
    expect(owned.sortOrder).toBe(40)
    const demoOrders = app.db
      .select()
      .from(crates)
      .where(isNotNull(crates.demoSeedKey))
      .all()
      .map((c) => c.sortOrder)
    expect(Math.min(...demoOrders)).toBe(41)
    expect(new Set(demoOrders).size).toBe(demoOrders.length)
    expect(await app.db.$count(follows)).toBe(0)
  })

  it.each([
    ['username', { username: DEMO_USERS[0]!.username, email: 'someone@example.test' }],
    ['email', { username: 'someone-else', email: DEMO_USERS[0]!.email }],
  ])('skips a demo user whose %s a real account holds (AC23)', async (_, identity) => {
    const app = await newApp()
    const real = await createUser(app.db, { ...identity, password: 'real-password-123' }, 'admin')
    const theirCrate = addCrate(app, 'Their crate', 3, real.id)
    const beforeUser = app.db.select().from(users).where(eq(users.id, real.id)).get()
    const { warnings, log } = quietLog()
    const victim = DEMO_USERS[0]!
    const victimCrates = DEMO_CRATES.filter((c) => c.ownerSeedKey === victim.seedKey)
    expect(victimCrates.length).toBeGreaterThan(0)

    const added = seedDemoContent(app.db, log)

    expect(added.users).toBe(DEMO_USERS.length - 1)
    expect(added.crates).toBe(DEMO_CRATES.length - victimCrates.length)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(victim.username)

    // The account and its crate are exactly as they were, role and password included.
    expect(app.db.select().from(users).where(eq(users.id, real.id)).get()).toEqual(beforeUser)
    expect(beforeUser?.role).toBe('admin')
    expect(beforeUser?.demoSeedKey).toBeNull()
    expect(app.db.select().from(crates).where(eq(crates.ownerId, real.id)).all()).toEqual([
      theirCrate,
    ])
    expect(await app.db.$count(follows)).toBe(0)
    // Nothing of the skipped user's was added under any other owner.
    for (const crate of victimCrates) {
      expect(
        app.db.select().from(crates).where(eq(crates.demoSeedKey, crate.seedKey)).all(),
      ).toEqual([])
      for (const album of crate.albums) {
        expect(
          app.db.select().from(albums).where(eq(albums.demoSeedKey, album.seedKey)).all(),
        ).toEqual([])
      }
    }

    // And a later start still leaves it all alone, adding nothing.
    expect(seedDemoContent(app.db, log)).toEqual({
      users: 0,
      crates: 0,
      albums: 0,
      tracks: 0,
      news: 0,
    })
    expect(app.db.select().from(users).where(eq(users.id, real.id)).get()).toEqual(beforeUser)
  })

  it('adds nothing at all when something fails part way through', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'frisson-demo-seed-'))
    const { db, close } = createDb(join(dir, 'crate.db'))
    cleanups.push(() => {
      close()
      rmSync(dir, { recursive: true, force: true })
    })
    // News goes last, so users, crates and albums have been written by the time this throws.
    db.$client.exec('DROP TABLE news_items')

    expect(() => seedDemoContent(db)).toThrow()

    expect(await db.$count(users)).toBe(0)
    expect(await db.$count(crates)).toBe(0)
    expect(await db.$count(albums)).toBe(0)
    expect(await db.$count(tracks)).toBe(0)
  })

  it('survives closing and reopening a real database file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'frisson-demo-seed-'))
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    const path = join(dir, 'crate.db')

    const results = []
    for (let start = 0; start < 3; start++) {
      const { db, close } = createDb(path)
      seedDemoContent(db)
      results.push(await counts(db))
      close()
    }

    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
  })
})

describe('demo user login', () => {
  it.each(['test-password-123', DEMO_PASSWORD_HASH, 'x'])(
    'rejects a demo email with password %j as 401',
    async (password) => {
      const app = await newApp()
      seedDemoContent(app.db)

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: DEMO_USERS[0]!.email, password },
      })

      expect(res.statusCode).toBe(401)
      expect(res.cookies).toEqual([])
    },
  )

  it('uses a hash verifyPassword rejects, even for its own text', async () => {
    expect(await verifyPassword(DEMO_PASSWORD_HASH, DEMO_PASSWORD_HASH)).toBe(false)
    expect(DEMO_PASSWORD_HASH.startsWith('scrypt')).toBe(false)
  })
})

describe('shouldSeedDemo', () => {
  it.each([
    [undefined, undefined, true],
    [undefined, 'development', true],
    [undefined, 'test', true],
    [undefined, 'production', false],
    ['', undefined, true],
    ['', 'production', false],
    ['true', undefined, true],
    ['true', 'production', true],
    ['false', undefined, false],
    ['false', 'development', false],
    ['false', 'production', false],
    ['yes', undefined, true],
    ['yes', 'production', false],
  ] as const)('SEED_DEMO_DATA=%j NODE_ENV=%j gives %j', (SEED_DEMO_DATA, NODE_ENV, expected) => {
    expect(shouldSeedDemo({ SEED_DEMO_DATA, NODE_ENV } as unknown as NodeJS.ProcessEnv)).toBe(
      expected,
    )
  })
})

describe('seedDemoFromEnv', () => {
  const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv

  it('adds no demo rows in production with the flag unset (AC24)', async () => {
    const app = await newApp()

    expect(seedDemoFromEnv(app.db, env({ NODE_ENV: 'production' }))).toBeNull()
    expect(seedDemoFromEnv(app.db, env({ NODE_ENV: 'production', SEED_DEMO_DATA: '' }))).toBeNull()

    expect(await counts(app.db)).toEqual({ users: 0, crates: 0, albums: 0, tracks: 0, news: 0 })
  })

  it('adds the content in production with SEED_DEMO_DATA=true (AC24)', async () => {
    const app = await newApp()

    const added = seedDemoFromEnv(app.db, env({ NODE_ENV: 'production', SEED_DEMO_DATA: 'true' }))

    expect(added?.crates).toBe(DEMO_CRATES.length)
    expect((await counts(app.db)).news).toBe(DEMO_NEWS.length)
  })
})

describe('buildTestApp', () => {
  it('still starts with no demo rows (AC24)', async () => {
    const app = await newApp()

    expect(await counts(app.db)).toEqual({ users: 0, crates: 0, albums: 0, tracks: 0, news: 0 })
  })
})
