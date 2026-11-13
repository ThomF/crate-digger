import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CrateDetail, PublicProfile } from '@frisson/shared'
import { and, eq } from 'drizzle-orm'
import { albums, crateFavorites, users } from '../src/db/schema.ts'
import {
  addCrate,
  buildTestApp,
  createAdmin,
  signUp,
  type SignedIn,
  type TestApp,
} from './helpers.ts'

// Favorite and unfavorite (PUT/DELETE /api/crates/:id/favorite), viewerFavorited on
// GET /api/crates/:id and the favorites list on a public profile (GET /api/users/:username).

let app: TestApp
beforeEach(async () => {
  app = await buildTestApp()
})
afterEach(() => app.close())

const favorite = (crateId: number | string, who?: SignedIn) =>
  app.inject({ method: 'PUT', url: `/api/crates/${crateId}/favorite`, headers: who?.headers })
const unfavorite = (crateId: number | string, who?: SignedIn) =>
  app.inject({ method: 'DELETE', url: `/api/crates/${crateId}/favorite`, headers: who?.headers })

async function profile(username: string, who?: SignedIn) {
  const res = await app.inject({ url: `/api/users/${username}`, headers: who?.headers })
  expect(res.statusCode).toBe(200)
  return res.json<PublicProfile>()
}

async function crateDetail(crateId: number, who?: SignedIn) {
  const res = await app.inject({ url: `/api/crates/${crateId}`, headers: who?.headers })
  expect(res.statusCode).toBe(200)
  return res.json<CrateDetail>()
}

const favoriteRows = (who: SignedIn, crateId: number) =>
  app.db
    .select()
    .from(crateFavorites)
    .where(and(eq(crateFavorites.userId, who.user.id), eq(crateFavorites.crateId, crateId)))
    .all()

const allFavoriteRows = () => app.db.select().from(crateFavorites).all()

/** Every key at every nesting level of a JSON value. */
function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys)
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)])
  }
  return []
}

describe('PUT and DELETE /api/crates/:id/favorite (AC2)', () => {
  it('PUT returns 204 and writes one row; a repeat returns 204 and keeps one row', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)

    const first = await favorite(crate.id, alice)
    expect(first.statusCode).toBe(204)
    expect(first.body).toBe('')
    expect(favoriteRows(alice, crate.id)).toHaveLength(1)

    const again = await favorite(crate.id, alice)
    expect(again.statusCode).toBe(204)
    expect(favoriteRows(alice, crate.id)).toHaveLength(1)
    expect(allFavoriteRows()).toHaveLength(1)
  })

  it('DELETE returns 204 and removes the row; a repeat returns 204', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)

    const first = await unfavorite(crate.id, alice)
    expect(first.statusCode).toBe(204)
    expect(first.body).toBe('')
    expect(favoriteRows(alice, crate.id)).toHaveLength(0)

    const again = await unfavorite(crate.id, alice)
    expect(again.statusCode).toBe(204)
    expect(allFavoriteRows()).toHaveLength(0)
  })

  it("DELETE only removes the caller's own favorite", async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)
    await favorite(crate.id, carol)
    expect((await unfavorite(crate.id, alice)).statusCode).toBe(204)
    expect(favoriteRows(alice, crate.id)).toHaveLength(0)
    expect(favoriteRows(carol, crate.id)).toHaveLength(1)
  })

  it("admins can favorite another user's crate", async () => {
    const [admin, bob] = [await createAdmin(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    expect((await favorite(crate.id, admin)).statusCode).toBe(204)
    expect(favoriteRows(admin, crate.id)).toHaveLength(1)
  })

  it('ownerless (legacy) crates can be favorited, by users and admins', async () => {
    const [alice, admin] = [await signUp(app), await createAdmin(app)]
    const legacy = addCrate(app, 'Legacy', 0, null)
    expect((await favorite(legacy.id, alice)).statusCode).toBe(204)
    expect((await favorite(legacy.id, admin)).statusCode).toBe(204)
    expect(allFavoriteRows()).toHaveLength(2)
  })
})

describe('favorite errors (AC3)', () => {
  it('PUT on your own crate returns 400 and writes no row', async () => {
    const alice = await signUp(app)
    const crate = addCrate(app, 'Mine', 0, alice.user.id)
    const res = await favorite(crate.id, alice)
    expect(res.statusCode).toBe(400)
    expect(allFavoriteRows()).toHaveLength(0)
  })

  it('an admin also gets 400 on their own crate', async () => {
    const admin = await createAdmin(app)
    const crate = addCrate(app, 'Mine', 0, admin.user.id)
    expect((await favorite(crate.id, admin)).statusCode).toBe(400)
    expect(allFavoriteRows()).toHaveLength(0)
  })

  it('PUT signed out returns 401 and writes nothing', async () => {
    const bob = await signUp(app)
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    expect((await favorite(crate.id)).statusCode).toBe(401)
    expect(allFavoriteRows()).toHaveLength(0)
  })

  it('PUT and DELETE signed out return 401, not 400, with a non-numeric id', async () => {
    expect((await favorite('abc')).statusCode).toBe(401)
    expect((await unfavorite('abc')).statusCode).toBe(401)
  })

  it('a signed-in caller with a non-numeric id gets 400', async () => {
    const alice = await signUp(app)
    expect((await favorite('abc', alice)).statusCode).toBe(400)
  })

  it('PUT and DELETE return 404 for an unknown crate id', async () => {
    const alice = await signUp(app)
    expect((await favorite(9999, alice)).statusCode).toBe(404)
    expect((await unfavorite(9999, alice)).statusCode).toBe(404)
    expect(allFavoriteRows()).toHaveLength(0)
  })

  it('DELETE signed out returns 401 and removes nothing', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)
    expect((await unfavorite(crate.id)).statusCode).toBe(401)
    expect(favoriteRows(alice, crate.id)).toHaveLength(1)
  })

  it('the /crates/:id/favorite routes do not shadow PUT /crates/order', async () => {
    const alice = await signUp(app)
    const crate = addCrate(app, 'Mine', 0, alice.user.id)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/crates/order',
      headers: alice.headers,
      payload: { ids: [crate.id] },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /api/crates/:id viewerFavorited (AC4)', () => {
  it('is true for the favoriter, false for another user and false signed out', async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)

    expect((await crateDetail(crate.id, alice)).viewerFavorited).toBe(true)
    expect((await crateDetail(crate.id, carol)).viewerFavorited).toBe(false)
    expect((await crateDetail(crate.id, bob)).viewerFavorited).toBe(false)
    expect((await crateDetail(crate.id)).viewerFavorited).toBe(false)
  })

  it('goes back to false after unfavoriting', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)
    await unfavorite(crate.id, alice)
    expect((await crateDetail(crate.id, alice)).viewerFavorited).toBe(false)
  })

  it('keeps every existing crate field', async () => {
    const bob = await signUp(app)
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    const detail = await crateDetail(crate.id)
    expect(detail).toMatchObject({
      id: crate.id,
      name: 'Bob crate',
      ownerId: bob.user.id,
      ownerUsername: bob.user.username,
      albumCount: 0,
      viewerFavorited: false,
    })
  })

  it('GET /api/crates (the list) has no viewerFavorited', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)
    const res = await app.inject({ url: '/api/crates', headers: alice.headers })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('viewerFavorited')
  })
})

describe('favorites on a public profile (AC5)', () => {
  it('lists favorites newest first, with only the public card fields', async () => {
    const [alice, bob] = [
      await signUp(app, { displayName: 'Alice' }),
      await signUp(app, { displayName: 'Bob' }),
    ]
    const first = addCrate(app, 'First', 0, bob.user.id)
    const second = addCrate(app, 'Second', 1, null)
    const third = addCrate(app, 'Third', 2, bob.user.id)
    app.db
      .insert(albums)
      .values({ crateId: third.id, title: 'Kind of Blue', artist: 'Miles Davis' })
      .run()
    await favorite(first.id, alice)
    await favorite(second.id, alice)
    await favorite(third.id, alice)
    // Favorites made in the same second: push the first one back so createdAt orders them,
    // with the id tiebreak ordering the other two.
    app.db
      .update(crateFavorites)
      .set({ createdAt: new Date('2020-01-01T00:00:00Z') })
      .where(eq(crateFavorites.crateId, first.id))
      .run()

    const { favorites } = await profile(alice.user.username)
    expect(favorites.map((f) => f.name)).toEqual(['Third', 'Second', 'First'])
    for (const entry of favorites) {
      expect(Object.keys(entry).sort()).toEqual(
        ['id', 'name', 'label', 'color', 'albumCount', 'ownerUsername', 'ownerDisplayName'].sort(),
      )
    }
    expect(favorites[0]).toEqual({
      id: third.id,
      name: 'Third',
      label: third.label,
      color: third.color,
      albumCount: 1,
      ownerUsername: bob.user.username,
      ownerDisplayName: 'Bob',
    })
    expect(favorites[1]).toMatchObject({
      id: second.id,
      albumCount: 0,
      ownerUsername: null,
      ownerDisplayName: null,
    })
  })

  it('is public: signed out and other viewers see the same favorites', async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)
    const signedOut = await profile(alice.user.username)
    const asCarol = await profile(alice.user.username, carol)
    const asAlice = await profile(alice.user.username, alice)
    expect(signedOut.favorites.map((f) => f.id)).toEqual([crate.id])
    expect(asCarol.favorites).toEqual(signedOut.favorites)
    expect(asAlice.favorites).toEqual(signedOut.favorites)
  })

  it('crates lists only owned crates; a favorited crate is not in it', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    const owned = addCrate(app, 'Alice crate', 0, alice.user.id)
    const theirs = addCrate(app, 'Bob crate', 1, bob.user.id)
    await favorite(theirs.id, alice)

    const aliceProfile = await profile(alice.user.username)
    expect(aliceProfile.crates.map((c) => c.id)).toEqual([owned.id])
    expect(aliceProfile.favorites.map((f) => f.id)).toEqual([theirs.id])

    const bobProfile = await profile(bob.user.username)
    expect(bobProfile.crates.map((c) => c.id)).toEqual([theirs.id])
    expect(bobProfile.favorites).toEqual([])
  })

  it('carries no email, role, demo key or numeric user id anywhere', async () => {
    const [alice, bob] = [await signUp(app), await signUp(app)]
    app.db.update(users).set({ demoSeedKey: 'demo:bob' }).where(eq(users.id, bob.user.id)).run()
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)

    for (const viewer of [undefined, alice, bob]) {
      const res = await app.inject({
        url: `/api/users/${alice.user.username}`,
        headers: viewer?.headers,
      })
      expect(res.statusCode).toBe(200)
      const keys = allKeys(res.json())
      for (const forbidden of [
        'email',
        'role',
        'demoSeedKey',
        'userId',
        'ownerId',
        'followerId',
        'followeeId',
        'crateId',
      ]) {
        expect(keys, forbidden).not.toContain(forbidden)
      }
      expect(res.body).not.toContain(alice.user.email)
      expect(res.body).not.toContain(bob.user.email)
      expect(res.body).not.toContain('demo:bob')
    }
  })
})

describe('cascades (AC6)', () => {
  it('deleting a favorited empty crate returns 204 and removes its favorite rows', async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    const kept = addCrate(app, 'Kept', 1, bob.user.id)
    await favorite(crate.id, alice)
    await favorite(crate.id, carol)
    await favorite(kept.id, alice)
    expect((await profile(alice.user.username)).favorites).toHaveLength(2)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/crates/${crate.id}`,
      headers: bob.headers,
    })
    expect(res.statusCode).toBe(204)

    expect(
      app.db.select().from(crateFavorites).where(eq(crateFavorites.crateId, crate.id)).all(),
    ).toHaveLength(0)
    expect(favoriteRows(alice, kept.id)).toHaveLength(1)
    expect((await profile(alice.user.username)).favorites.map((f) => f.id)).toEqual([kept.id])
    expect((await profile(carol.user.username)).favorites).toEqual([])
  })

  it("deleting the favoriting user removes their rows and nobody else's", async () => {
    const [alice, bob, carol] = [await signUp(app), await signUp(app), await signUp(app)]
    const crate = addCrate(app, 'Bob crate', 0, bob.user.id)
    await favorite(crate.id, alice)
    await favorite(crate.id, carol)

    app.db.delete(users).where(eq(users.id, alice.user.id)).run()

    expect(
      app.db.select().from(crateFavorites).where(eq(crateFavorites.userId, alice.user.id)).all(),
    ).toHaveLength(0)
    expect(favoriteRows(carol, crate.id)).toHaveLength(1)
    expect((await crateDetail(crate.id, carol)).viewerFavorited).toBe(true)
  })
})
