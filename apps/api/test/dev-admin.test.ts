import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { albums, crateFavorites, follows, newsItems, tracks, users } from '../src/db/schema.ts'
import { bootstrapFromEnv } from '../src/services/bootstrap.ts'
import { DEV_ADMIN_EMAIL, ensureDevAdmin, shouldSeedDevAdmin } from '../src/services/dev-admin.ts'
import * as passwords from '../src/services/passwords.ts'
import { hashDevAdminPassword, hashPassword, verifyPassword } from '../src/services/passwords.ts'
import { addCrate, buildTestApp, signUp, type TestApp } from './helpers.ts'

// Data classification: CONFIDENTIAL (credentials). The accounts here are throwaway test rows in
// an in-memory database; the dev admin password is the documented local-only one.

const DEV_ADMIN_PASSWORD = 'admin'
const CREATED_ADMIN = 'Created dev admin account admin'
const REFUSED_PROMOTION = `Dev admin not added: ${DEV_ADMIN_EMAIL} is a non-admin account; not promoting it`
const LOST_RACE = 'Dev admin not added: the email or username was taken at the same moment'

const apps: TestApp[] = []
async function newApp() {
  const app = await buildTestApp()
  apps.push(app)
  return app
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

/** Every row of every table, read with raw SQL so nothing is hidden by the ORM's mapping. */
function snapshot(app: TestApp) {
  const sqlite = app.db.$client
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ESCAPE '\\'`)
    .all('table', 'sqlite\\_%') as { name: string }[]
  const dump: Record<string, unknown[]> = {}
  for (const { name } of tables) {
    // Identifiers can't be bound as parameters; the name comes from sqlite_master, not input.
    dump[name] = sqlite
      .prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`)
      .all()
  }
  return dump
}

/** Captures every argument of every log call, so a test can check exactly what was logged. */
function capturingLog() {
  const calls: { level: 'info' | 'warn'; args: unknown[] }[] = []
  return {
    calls,
    log: {
      info: (...args: unknown[]) => void calls.push({ level: 'info', args }),
      warn: (...args: unknown[]) => void calls.push({ level: 'warn', args }),
    },
  }
}

const devAdminRows = (app: TestApp) =>
  app.db.select().from(users).where(eq(users.email, DEV_ADMIN_EMAIL)).all()

const login = (app: TestApp, email: string, password: string) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })

/** Users, crates, albums, tracks, follows, crate favorites and news, plus the sessions signup creates. */
async function populate(app: TestApp) {
  const ada = await signUp(app, { username: 'ada', email: 'ada@example.test' })
  const bob = await signUp(app, { username: 'bob', email: 'bob@example.test' })
  const crate = addCrate(app, 'Owned crate', 0, ada.user.id)
  const legacy = addCrate(app, 'Legacy crate', 1)
  const album = app.db
    .insert(albums)
    .values({ crateId: crate.id, title: 'Album', artist: 'Artist', position: 0 })
    .returning()
    .get()
  app.db.insert(albums).values({ crateId: legacy.id, title: 'Old', artist: 'Someone' }).run()
  app.db.insert(tracks).values({ albumId: album.id, side: 'A', position: 0, title: 'Track' }).run()
  app.db.insert(follows).values({ followerId: bob.user.id, followeeId: ada.user.id }).run()
  app.db.insert(crateFavorites).values({ userId: bob.user.id, crateId: crate.id }).run()
  app.db
    .insert(newsItems)
    .values({
      seedKey: 'news:test',
      title: 'Title',
      summary: 'Summary',
      source: 'Source',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .run()
}

describe('shouldSeedDevAdmin', () => {
  it.each([
    [{}, true],
    [{ NODE_ENV: 'development' }, true],
    [{ NODE_ENV: 'test' }, true],
    [{ NODE_ENV: '' }, true],
    [{ SEED_DEV_ADMIN: 'true' }, true],
    [{ SEED_DEV_ADMIN: '' }, true],
    [{ SEED_DEV_ADMIN: 'false' }, false],
    [{ NODE_ENV: 'production' }, false],
    [{ NODE_ENV: ' Production\n' }, false],
    [{ NODE_ENV: 'PRODUCTION', SEED_DEV_ADMIN: 'true' }, false],
    [{ NODE_ENV: 'production', SEED_DEV_ADMIN: 'true' }, false],
  ])('%j gives %s', (env, expected) => {
    expect(shouldSeedDevAdmin(env)).toBe(expected)
  })
})

describe('ensureDevAdmin on a populated database (AC1)', () => {
  it('inserts one admin row, leaves every other row alone and is idempotent', async () => {
    const app = await newApp()
    await populate(app)
    const before = snapshot(app)
    for (const table of [
      'users',
      'sessions',
      'crates',
      'albums',
      'tracks',
      'follows',
      'crate_favorites',
    ]) {
      expect(before[table], table).not.toHaveLength(0)
    }
    expect(before.news_items).not.toHaveLength(0)

    expect(await ensureDevAdmin(app.db, {})).toEqual({ created: true })

    const after = snapshot(app)
    const { users: usersBefore, ...otherBefore } = before
    const { users: usersAfter, ...otherAfter } = after
    expect(otherAfter).toEqual(otherBefore)
    expect(usersAfter).toHaveLength(usersBefore!.length + 1)
    expect(usersAfter!.slice(0, usersBefore!.length)).toEqual(usersBefore)
    const [row] = devAdminRows(app)
    expect(row).toMatchObject({
      email: DEV_ADMIN_EMAIL,
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
      verified: false,
      demoSeedKey: null,
    })

    // The second run changes nothing at all, including the salted hash.
    expect(await ensureDevAdmin(app.db, {})).toEqual({ created: false })
    expect(snapshot(app)).toEqual(after)
    expect(devAdminRows(app)[0]!.passwordHash).toBe(row!.passwordHash)

    const res = await login(app, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ email: DEV_ADMIN_EMAIL, role: 'admin' })
    expect(res.body).not.toContain('passwordHash')
    expect(res.body).not.toContain('scrypt$')
  })

  it('adds the account even when a different admin already exists', async () => {
    const app = await newApp()
    await bootstrapFromEnv(app.db, {
      ADMIN_EMAIL: 'owner@example.test',
      ADMIN_PASSWORD: 'bootstrap-password-1',
    })

    expect(await ensureDevAdmin(app.db, {})).toEqual({ created: true })

    expect(devAdminRows(app)[0]).toMatchObject({ username: 'admin-2', role: 'admin' })
  })

  it('does nothing when ADMIN_EMAIL already created admin@frisson.com as an admin', async () => {
    const app = await newApp()
    const ownPassword = 'bootstrap-password-1'
    await bootstrapFromEnv(app.db, { ADMIN_EMAIL: DEV_ADMIN_EMAIL, ADMIN_PASSWORD: ownPassword })
    const before = snapshot(app)
    const { calls, log } = capturingLog()

    expect(await ensureDevAdmin(app.db, {}, log)).toEqual({ created: false })

    expect(snapshot(app)).toEqual(before)
    expect(calls).toEqual([])
    expect((await login(app, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD)).statusCode).toBe(401)
    expect((await login(app, DEV_ADMIN_EMAIL, ownPassword)).statusCode).toBe(200)
  })
})

describe('ensureDevAdmin guards and collisions (AC2)', () => {
  it('(a) creates nothing in production, even with SEED_DEV_ADMIN=true', async () => {
    const app = await newApp()

    for (const env of [
      { NODE_ENV: 'production' },
      { NODE_ENV: 'production', SEED_DEV_ADMIN: 'true' },
      { NODE_ENV: ' PRODUCTION ', SEED_DEV_ADMIN: 'true' },
    ]) {
      expect(await ensureDevAdmin(app.db, env)).toEqual({ created: false })
    }

    expect(app.db.select().from(users).all()).toEqual([])
    expect((await login(app, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD)).statusCode).toBe(401)
  })

  it('(b) creates nothing with SEED_DEV_ADMIN=false', async () => {
    const app = await newApp()

    expect(await ensureDevAdmin(app.db, { SEED_DEV_ADMIN: 'false' })).toEqual({ created: false })

    expect(app.db.select().from(users).all()).toEqual([])
  })

  it('(c) warns and refuses to promote a role=user account with that email', async () => {
    const app = await newApp()
    const password = 'their-own-password-1'
    await signUp(app, { email: DEV_ADMIN_EMAIL, username: 'someone', password })
    const before = snapshot(app)
    const { calls, log } = capturingLog()

    await expect(ensureDevAdmin(app.db, {}, log)).resolves.toEqual({ created: false })

    expect(snapshot(app)).toEqual(before)
    expect(calls).toEqual([{ level: 'warn', args: [REFUSED_PROMOTION] }])
    const [row] = devAdminRows(app)
    expect(row!.role).toBe('user')
    expect(await verifyPassword(password, row!.passwordHash)).toBe(true)
    expect(await verifyPassword(DEV_ADMIN_PASSWORD, row!.passwordHash)).toBe(false)
  })

  it("(d) takes admin-2 when another account holds the username 'admin'", async () => {
    const app = await newApp()
    await signUp(app, { username: 'admin', email: 'not-the-admin@example.test' })
    const before = snapshot(app)
    const { calls, log } = capturingLog()

    expect(await ensureDevAdmin(app.db, {}, log)).toEqual({ created: true })

    expect(devAdminRows(app)[0]).toMatchObject({ username: 'admin-2', role: 'admin' })
    const after = snapshot(app)
    expect(after.users!.slice(0, before.users!.length)).toEqual(before.users)
    expect(app.db.select().from(users).where(eq(users.username, 'admin')).get()).toMatchObject({
      email: 'not-the-admin@example.test',
      role: 'user',
    })
    expect(calls).toEqual([{ level: 'info', args: ['Created dev admin account admin-2'] }])
    expect((await login(app, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD)).statusCode).toBe(200)
  })

  it('(e) only ever logs exact fixed strings, across every path', async () => {
    // 'admin' is a substring of the email and of ordinary messages, so looking for the plaintext
    // can't work. Pinning each whole message to a known string can.
    const { calls, log } = capturingLog()

    const creating = await newApp()
    await ensureDevAdmin(creating.db, {}, log) // created
    await ensureDevAdmin(creating.db, {}, log) // already there, silent
    await ensureDevAdmin(creating.db, { NODE_ENV: 'production' }, log) // guarded, silent

    const refusing = await newApp()
    await signUp(refusing, { email: DEV_ADMIN_EMAIL, username: 'someone' })
    await ensureDevAdmin(refusing.db, {}, log) // refused

    const racing = await newApp()
    await Promise.all([ensureDevAdmin(racing.db, {}, log), ensureDevAdmin(racing.db, {}, log)])

    expect(calls).toEqual([
      { level: 'info', args: [CREATED_ADMIN] },
      { level: 'warn', args: [REFUSED_PROMOTION] },
      { level: 'info', args: [CREATED_ADMIN] },
      { level: 'warn', args: [LOST_RACE] },
    ])

    const hashes = [creating, refusing, racing].flatMap((app) =>
      devAdminRows(app).map((row) => row.passwordHash),
    )
    expect(hashes).toHaveLength(3)
    for (const { args } of calls) {
      expect(args.every((arg) => typeof arg === 'string')).toBe(true)
      const message = args.join(' ')
      expect(message).not.toMatch(/password/i)
      expect(message).not.toContain('scrypt$')
      for (const hash of hashes) expect(message).not.toContain(hash)
    }
  })

  it('(f) keeps the 8 character minimum everywhere else', async () => {
    const app = await newApp()

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: { email: 'short@example.test', username: 'shorty', password: DEV_ADMIN_PASSWORD },
    })
    expect(signup.statusCode).toBe(400)

    await expect(hashPassword(DEV_ADMIN_PASSWORD)).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      bootstrapFromEnv(app.db, {
        ADMIN_EMAIL: 'short@example.test',
        ADMIN_PASSWORD: DEV_ADMIN_PASSWORD,
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(app.db.select().from(users).all()).toEqual([])
  })

  it('survives losing a race for the email, leaving the winning row alone', async () => {
    const app = await newApp()
    const { calls, log } = capturingLog()

    // The step is suspended in its async hash here, past its "does it exist?" check.
    const pending = ensureDevAdmin(app.db, {}, log)
    const winner = app.db
      .insert(users)
      .values({
        email: DEV_ADMIN_EMAIL,
        username: 'winner',
        displayName: 'Winner',
        passwordHash: 'not-a-real-hash',
      })
      .returning()
      .get()

    await expect(pending).resolves.toEqual({ created: false })

    expect(devAdminRows(app)).toEqual([winner])
    expect(calls).toEqual([{ level: 'warn', args: [LOST_RACE] }])
  })
})

describe('hashDevAdminPassword', () => {
  it('hashes only the fixed password, salted, and verifies against it alone', async () => {
    const a = await hashDevAdminPassword()
    const b = await hashDevAdminPassword()

    expect(a).toMatch(/^scrypt\$/)
    expect(a).not.toBe(b)
    expect(await verifyPassword(DEV_ADMIN_PASSWORD, a)).toBe(true)
    expect(await verifyPassword('something-else', a)).toBe(false)
    expect(hashDevAdminPassword).toHaveLength(0)
  })

  it('does not export an unchecked hash function', () => {
    expect(Object.keys(passwords).sort()).toEqual([
      'MIN_PASSWORD_LENGTH',
      'hashDevAdminPassword',
      'hashPassword',
      'verifyAgainstDummy',
      'verifyPassword',
    ])
  })
})
