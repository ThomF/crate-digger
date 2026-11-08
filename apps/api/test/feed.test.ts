import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CollectorSummary, CrateCard } from '@frisson/shared'
import { crateCard } from '@frisson/shared'
import { eq } from 'drizzle-orm'
import { albums, crates, users } from '../src/db/schema.ts'
import { SESSION_COOKIE } from '../src/plugins/auth.ts'
import { createSession } from '../src/services/sessions.ts'
import { buildTestApp, signUp, type SignedIn, type TestApp } from './helpers.ts'

// The signed-in Following page's data: GET /api/me/feed and GET /api/me/suggested-collectors.

let app: TestApp
beforeEach(async () => {
  app = await buildTestApp()
})
afterEach(() => app.close())

const follow = (username: string, who: SignedIn) =>
  app.inject({ method: 'PUT', url: `/api/users/${username}/follow`, headers: who.headers })
const unfollow = (username: string, who: SignedIn) =>
  app.inject({ method: 'DELETE', url: `/api/users/${username}/follow`, headers: who.headers })

const feed = (who?: SignedIn) => app.inject({ url: '/api/me/feed', headers: who?.headers })
const feedNames = async (who: SignedIn) =>
  (await feed(who)).json<CrateCard[]>().map((card) => card.name)

const suggestions = (who?: SignedIn) =>
  app.inject({ url: '/api/me/suggested-collectors', headers: who?.headers })
const suggestedNames = async (who: SignedIn) =>
  (await suggestions(who)).json<CollectorSummary[]>().map((user) => user.username)

/** A crate owned by `ownerId`, created at a set moment. */
function crateAt(name: string, ownerId: number | null, createdAt: string) {
  return app.db
    .insert(crates)
    .values({ name, ownerId, createdAt: new Date(createdAt) })
    .returning()
    .get()
}

function addAlbums(crateId: number, howMany: number) {
  for (let i = 0; i < howMany; i += 1) {
    app.db
      .insert(albums)
      .values({ crateId, title: `Album ${i}`, artist: 'Test Artist' })
      .run()
  }
}

/** A demo user inserted directly, the way demo seeding marks them. */
function demoUser(username: string) {
  return app.db
    .insert(users)
    .values({
      email: `${username}@demo.invalid`,
      username,
      displayName: `Display ${username}`,
      passwordHash: 'not-a-scrypt-hash',
      demoSeedKey: `key-${username}`,
    })
    .returning()
    .get()
}

/** Every key at every nesting level of a JSON value. */
function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys)
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)])
  }
  return []
}

describe('GET /api/me/feed', () => {
  let viewer: SignedIn
  let followed: SignedIn
  let stranger: SignedIn

  beforeEach(async () => {
    viewer = await signUp(app)
    followed = await signUp(app, { displayName: 'Followed Person' })
    stranger = await signUp(app)
  })

  it('returns 401 signed out', async () => {
    expect((await feed()).statusCode).toBe(401)
  })

  it('is empty when following nobody, even with crates around', async () => {
    crateAt('Theirs', followed.user.id, '2026-01-01T00:00:00Z')
    const res = await feed(viewer)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('includes followed users’ crates and excludes everyone else’s', async () => {
    crateAt('Followed crate', followed.user.id, '2026-01-01T00:00:00Z')
    crateAt('Stranger crate', stranger.user.id, '2026-01-02T00:00:00Z')
    crateAt('My own crate', viewer.user.id, '2026-01-03T00:00:00Z')
    crateAt('Ownerless crate', null, '2026-01-04T00:00:00Z')
    await follow(followed.user.username, viewer)

    expect(await feedNames(viewer)).toEqual(['Followed crate'])
  })

  it('is per viewer: someone following a stranger does not change it', async () => {
    crateAt('Stranger crate', stranger.user.id, '2026-01-02T00:00:00Z')
    await follow(stranger.user.username, followed)
    expect(await feedNames(viewer)).toEqual([])
    expect(await feedNames(followed)).toEqual(['Stranger crate'])
  })

  it('orders across owners by created_at newest first, then id', async () => {
    await follow(followed.user.username, viewer)
    await follow(stranger.user.username, viewer)
    // Inserted out of date order, so id order is not date order.
    crateAt('Middle', stranger.user.id, '2026-02-01T00:00:00Z')
    crateAt('Oldest', followed.user.id, '2026-01-01T00:00:00Z')
    crateAt('Newest', followed.user.id, '2026-03-01T00:00:00Z')
    crateAt('Tie low id', followed.user.id, '2025-12-01T00:00:00Z')
    crateAt('Tie high id', stranger.user.id, '2025-12-01T00:00:00Z')

    expect(await feedNames(viewer)).toEqual([
      'Newest',
      'Middle',
      'Oldest',
      'Tie high id',
      'Tie low id',
    ])
  })

  it('returns the full card: owner fields, ISO createdAt and album count', async () => {
    await follow(followed.user.username, viewer)
    const crate = crateAt('Full', followed.user.id, '2026-01-02T03:04:05Z')
    addAlbums(crate.id, 3)

    const [card] = (await feed(viewer)).json<CrateCard[]>()
    expect(card).toEqual({
      id: crate.id,
      name: 'Full',
      color: crate.color,
      label: null,
      albumCount: 3,
      createdAt: '2026-01-02T03:04:05.000Z',
      ownerUsername: followed.user.username,
      ownerDisplayName: 'Followed Person',
    })
    expect(crateCard.safeParse(card).success).toBe(true)
  })

  it('counts each crate’s albums separately and keeps empty crates at 0', async () => {
    await follow(followed.user.username, viewer)
    const two = crateAt('Two', followed.user.id, '2026-01-02T00:00:00Z')
    const five = crateAt('Five', followed.user.id, '2026-01-03T00:00:00Z')
    crateAt('Empty', followed.user.id, '2026-01-01T00:00:00Z')
    addAlbums(two.id, 2)
    addAlbums(five.id, 5)

    const cards = (await feed(viewer)).json<CrateCard[]>()
    expect(cards.map((card) => [card.name, card.albumCount])).toEqual([
      ['Five', 5],
      ['Two', 2],
      ['Empty', 0],
    ])
  })

  it('returns only the 50 newest crates', async () => {
    await follow(followed.user.username, viewer)
    const base = Date.UTC(2026, 0, 1)
    for (let i = 0; i < 55; i += 1) {
      const createdAt = new Date(base + i * 60_000).toISOString()
      crateAt(`Crate ${i}`, followed.user.id, createdAt)
    }

    const names = await feedNames(viewer)
    expect(names).toHaveLength(50)
    expect(names[0]).toBe('Crate 54')
    expect(names[49]).toBe('Crate 5')
  })

  it('drops a user’s crates after unfollowing them', async () => {
    crateAt('Theirs', followed.user.id, '2026-01-01T00:00:00Z')
    await follow(followed.user.username, viewer)
    expect(await feedNames(viewer)).toEqual(['Theirs'])
    await unfollow(followed.user.username, viewer)
    expect(await feedNames(viewer)).toEqual([])
  })

  it('has no email, role or user id at any level', async () => {
    await follow(followed.user.username, viewer)
    addAlbums(crateAt('Full', followed.user.id, '2026-01-01T00:00:00Z').id, 1)

    const res = await feed(viewer)
    expect(res.body).not.toContain(followed.user.email)
    const keys = allKeys(res.json())
    for (const forbidden of [
      'email',
      'role',
      'ownerId',
      'userId',
      'followerId',
      'followeeId',
      'passwordHash',
      'demoSeedKey',
    ]) {
      expect(keys).not.toContain(forbidden)
    }
    // `id` is only ever the crate's own id, on the card itself: nothing nested carries one.
    const [card] = res.json<CrateCard[]>()
    expect(Object.keys(card ?? {}).sort()).toEqual([
      'albumCount',
      'color',
      'createdAt',
      'id',
      'label',
      'name',
      'ownerDisplayName',
      'ownerUsername',
    ])
  })
})

describe('GET /api/me/suggested-collectors', () => {
  it('returns 401 signed out', async () => {
    expect((await suggestions()).statusCode).toBe(401)
  })

  it('is an empty list when no demo data exists', async () => {
    const viewer = await signUp(app)
    await signUp(app)
    const res = await suggestions(viewer)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('lists every demo user by username and leaves out real users', async () => {
    const viewer = await signUp(app)
    await signUp(app)
    demoUser('demo-zed')
    demoUser('demo-amy')
    demoUser('demo-kit')

    expect(await suggestedNames(viewer)).toEqual(['demo-amy', 'demo-kit', 'demo-zed'])
  })

  it('drops a demo user once followed and brings them back after unfollowing', async () => {
    const viewer = await signUp(app)
    demoUser('demo-amy')
    demoUser('demo-kit')

    await follow('demo-amy', viewer)
    expect(await suggestedNames(viewer)).toEqual(['demo-kit'])

    await unfollow('demo-amy', viewer)
    expect(await suggestedNames(viewer)).toEqual(['demo-amy', 'demo-kit'])
  })

  it('is per viewer: someone else’s follow does not remove a suggestion', async () => {
    const [viewer, other] = [await signUp(app), await signUp(app)]
    demoUser('demo-amy')
    await follow('demo-amy', other)
    expect(await suggestedNames(viewer)).toEqual(['demo-amy'])
    expect(await suggestedNames(other)).toEqual([])
  })

  it('never suggests the viewer to themselves', async () => {
    const amy = demoUser('demo-amy')
    demoUser('demo-kit')
    const { token } = createSession(app.db, amy.id)
    const cookie = `${SESSION_COOKIE}=${token}`
    const res = await app.inject({ url: '/api/me/suggested-collectors', headers: { cookie } })
    expect(res.json<CollectorSummary[]>().map((user) => user.username)).toEqual(['demo-kit'])
  })

  it('returns exactly the public summary keys, flagged isDemo, with no private data', async () => {
    const viewer = await signUp(app)
    const amy = demoUser('demo-amy')

    const res = await suggestions(viewer)
    expect(res.json()).toEqual([
      {
        username: 'demo-amy',
        displayName: 'Display demo-amy',
        avatarUrl: null,
        verified: false,
        isDemo: true,
      },
    ])
    expect(res.body).not.toContain(amy.email)
    expect(res.body).not.toContain('key-demo-amy')
    const keys = allKeys(res.json())
    for (const forbidden of ['email', 'role', 'id', 'passwordHash', 'demoSeedKey']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('ignores a demo marker cleared from a user', async () => {
    const viewer = await signUp(app)
    const amy = demoUser('demo-amy')
    app.db.update(users).set({ demoSeedKey: null }).where(eq(users.id, amy.id)).run()
    expect(await suggestedNames(viewer)).toEqual([])
  })
})
