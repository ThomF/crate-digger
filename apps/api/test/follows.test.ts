import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CollectorSummary, PublicProfile } from '@frisson/shared'
import { and, eq, or } from 'drizzle-orm'
import { follows, users } from '../src/db/schema.ts'
import { buildTestApp, signUp, type SignedIn, type TestApp } from './helpers.ts'

// Follow and unfollow (PUT/DELETE /api/users/:username/follow), the viewer's following list
// (GET /api/me/following) and the follow fields on a profile (GET /api/users/:username).

let app: TestApp
beforeEach(async () => {
  app = await buildTestApp()
})
afterEach(() => app.close())

const follow = (username: string, who?: SignedIn) =>
  app.inject({ method: 'PUT', url: `/api/users/${username}/follow`, headers: who?.headers })
const unfollow = (username: string, who?: SignedIn) =>
  app.inject({ method: 'DELETE', url: `/api/users/${username}/follow`, headers: who?.headers })
const following = (who?: SignedIn) =>
  app.inject({ url: '/api/me/following', headers: who?.headers })

async function profile(username: string, who?: SignedIn) {
  const res = await app.inject({ url: `/api/users/${username}`, headers: who?.headers })
  expect(res.statusCode).toBe(200)
  return res.json<PublicProfile>()
}

const followRows = (follower: SignedIn, followee: SignedIn) =>
  app.db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, follower.user.id), eq(follows.followeeId, followee.user.id)))
    .all()

/** Every key at every nesting level of a JSON value. */
function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys)
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)])
  }
  return []
}

describe('PUT /api/users/:username/follow', () => {
  it('returns 204 with an empty body and writes one row', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const res = await follow(bob.user.username, alice)
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
    expect(followRows(alice, bob)).toHaveLength(1)
  })

  it('returns 204 on a repeat with no second row', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    await follow(bob.user.username, alice)
    const res = await follow(bob.user.username, alice)
    expect(res.statusCode).toBe(204)
    expect(followRows(alice, bob)).toHaveLength(1)
  })

  it('is one-way: following someone does not make them follow you', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    await follow(bob.user.username, alice)
    expect(followRows(bob, alice)).toHaveLength(0)
  })

  it('returns 401 signed out and writes nothing', async () => {
    const bob = await signUp(app)
    const res = await follow(bob.user.username)
    expect(res.statusCode).toBe(401)
    expect(app.db.select().from(follows).all()).toHaveLength(0)
  })

  it('returns 401, not 400, signed out with a malformed username', async () => {
    expect((await follow('x')).statusCode).toBe(401)
  })

  it('returns 404 for an unknown username', async () => {
    const alice = await signUp(app)
    expect((await follow('nobody-here', alice)).statusCode).toBe(404)
  })

  it('returns 400 for a malformed username when signed in', async () => {
    const alice = await signUp(app)
    expect((await follow('x', alice)).statusCode).toBe(400)
  })

  it('returns 400 for following yourself, whatever the case, and writes nothing', async () => {
    const alice = await signUp(app)
    expect((await follow(alice.user.username, alice)).statusCode).toBe(400)
    expect((await follow(alice.user.username.toUpperCase(), alice)).statusCode).toBe(400)
    expect(app.db.select().from(follows).all()).toHaveLength(0)
  })

  it('matches the username case-insensitively', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    expect((await follow(bob.user.username.toUpperCase(), alice)).statusCode).toBe(204)
    expect(followRows(alice, bob)).toHaveLength(1)
  })
})

describe('DELETE /api/users/:username/follow', () => {
  it('returns 204 and removes the row', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    await follow(bob.user.username, alice)
    const res = await unfollow(bob.user.username, alice)
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
    expect(followRows(alice, bob)).toHaveLength(0)
  })

  it('returns 204 on a repeat, and when never followed', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    expect((await unfollow(bob.user.username, alice)).statusCode).toBe(204)
    await follow(bob.user.username, alice)
    await unfollow(bob.user.username, alice)
    expect((await unfollow(bob.user.username, alice)).statusCode).toBe(204)
  })

  it('only removes the viewer’s own follow', async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    await follow(carol.user.username, alice)
    await follow(carol.user.username, bob)
    await unfollow(carol.user.username, alice)
    expect(followRows(alice, carol)).toHaveLength(0)
    expect(followRows(bob, carol)).toHaveLength(1)
  })

  it('returns 401 signed out and leaves the row alone', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    await follow(bob.user.username, alice)
    expect((await unfollow(bob.user.username)).statusCode).toBe(401)
    expect(followRows(alice, bob)).toHaveLength(1)
  })

  it('returns 404 for an unknown username', async () => {
    const alice = await signUp(app)
    expect((await unfollow('nobody-here', alice)).statusCode).toBe(404)
  })

  it('is a no-op 204 on yourself', async () => {
    const alice = await signUp(app)
    expect((await unfollow(alice.user.username, alice)).statusCode).toBe(204)
  })
})

describe('the follows table', () => {
  it('has a unique constraint on (follower, followee)', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const row = { followerId: alice.user.id, followeeId: bob.user.id }
    app.db.insert(follows).values(row).run()
    expect(() => app.db.insert(follows).values(row).run()).toThrow(/UNIQUE/)
  })

  it('loses a user’s rows in both directions when the user is deleted', async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    await follow(bob.user.username, alice)
    await follow(alice.user.username, bob)
    await follow(carol.user.username, bob)

    app.db.delete(users).where(eq(users.id, alice.user.id)).run()

    const aliceRows = app.db
      .select()
      .from(follows)
      .where(or(eq(follows.followerId, alice.user.id), eq(follows.followeeId, alice.user.id)))
      .all()
    expect(aliceRows).toHaveLength(0)
    // Other people's follows survive.
    expect(followRows(bob, carol)).toHaveLength(1)
  })
})

describe('GET /api/me/following', () => {
  it('returns 401 signed out', async () => {
    expect((await following()).statusCode).toBe(401)
  })

  it('is empty when following nobody', async () => {
    const alice = await signUp(app)
    const res = await following(alice)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns public summaries with exactly the public keys', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app, { displayName: 'Bob B.' })]
    await follow(bob.user.username, alice)

    const res = await following(alice)
    expect(res.json()).toEqual([
      {
        username: bob.user.username,
        displayName: 'Bob B.',
        avatarUrl: null,
        verified: false,
        isDemo: false,
      },
    ])
    expect(res.body).not.toContain(bob.user.email)
    const keys = allKeys(res.json())
    for (const forbidden of ['email', 'role', 'id', 'passwordHash', 'demoSeedKey']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('marks a demo user as isDemo without exposing the key', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    app.db
      .update(users)
      .set({ demoSeedKey: 'secret-seed-key' })
      .where(eq(users.id, bob.user.id))
      .run()
    await follow(bob.user.username, alice)

    const res = await following(alice)
    expect(res.json<CollectorSummary[]>()[0]?.isDemo).toBe(true)
    expect(res.body).not.toContain('secret-seed-key')
  })

  it('lists the most recently followed first, by created_at and then id', async () => {
    const [alice, bob, carol, dave] = [
      await signUp(app),
      await signUp(app),
      await signUp(app),
      await signUp(app),
    ]
    await follow(bob.user.username, alice)
    await follow(carol.user.username, alice)
    await follow(dave.user.username, alice)

    // Same second: the later row wins.
    const sameSecond = new Date('2026-01-01T00:00:00Z')
    app.db.update(follows).set({ createdAt: sameSecond }).run()
    let names = (await following(alice)).json<CollectorSummary[]>().map((u) => u.username)
    expect(names).toEqual([dave.user.username, carol.user.username, bob.user.username])

    // created_at outranks id: bob's row is the oldest id but now the newest follow.
    app.db
      .update(follows)
      .set({ createdAt: new Date('2026-02-01T00:00:00Z') })
      .where(eq(follows.followeeId, bob.user.id))
      .run()
    names = (await following(alice)).json<CollectorSummary[]>().map((u) => u.username)
    expect(names).toEqual([bob.user.username, dave.user.username, carol.user.username])
  })

  it('only lists the viewer’s own follows', async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    await follow(carol.user.username, bob)
    expect((await following(alice)).json()).toEqual([])
  })
})

describe('follow fields on GET /api/users/:username', () => {
  it('moves both counts by exactly 1 on follow and back on unfollow', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const counts = async () => ({
      bobFollowers: (await profile(bob.user.username)).followerCount,
      bobFollowing: (await profile(bob.user.username)).followingCount,
      aliceFollowers: (await profile(alice.user.username)).followerCount,
      aliceFollowing: (await profile(alice.user.username)).followingCount,
    })
    const before = await counts()
    expect(before).toEqual({
      bobFollowers: 0,
      bobFollowing: 0,
      aliceFollowers: 0,
      aliceFollowing: 0,
    })

    await follow(bob.user.username, alice)
    expect(await counts()).toEqual({ ...before, bobFollowers: 1, aliceFollowing: 1 })

    // A repeat follow changes nothing.
    await follow(bob.user.username, alice)
    expect(await counts()).toEqual({ ...before, bobFollowers: 1, aliceFollowing: 1 })

    await unfollow(bob.user.username, alice)
    expect(await counts()).toEqual(before)

    // A repeat unfollow changes nothing.
    await unfollow(bob.user.username, alice)
    expect(await counts()).toEqual(before)
  })

  it('reports viewerFollows true, false and signed-out false', async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    expect((await profile(bob.user.username, alice)).viewerFollows).toBe(false)

    await follow(bob.user.username, alice)
    expect((await profile(bob.user.username, alice)).viewerFollows).toBe(true)
    // Someone else looking, and nobody signed in, see false.
    expect((await profile(bob.user.username, carol)).viewerFollows).toBe(false)
    expect((await profile(bob.user.username)).viewerFollows).toBe(false)
    // It is about the viewer following them, not them following the viewer.
    expect((await profile(alice.user.username, bob)).viewerFollows).toBe(false)

    await unfollow(bob.user.username, alice)
    expect((await profile(bob.user.username, alice)).viewerFollows).toBe(false)
  })

  it('keeps email, role and numeric user id out at every level', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    await follow(bob.user.username, alice)

    const res = await app.inject({
      url: `/api/users/${bob.user.username}`,
      headers: alice.headers,
    })
    const body = res.json<PublicProfile>()
    expect(res.body).not.toContain(bob.user.email)
    const keys = allKeys(body)
    for (const forbidden of ['email', 'role', 'userId', 'ownerId', 'passwordHash', 'demoSeedKey']) {
      expect(keys).not.toContain(forbidden)
    }
    // The user object itself has no id. crates[].id is a crate's id, part of the public contract.
    expect(Object.keys(body)).not.toContain('id')
  })
})
