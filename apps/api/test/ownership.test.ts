import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AlbumDetail, AlbumSummary, ApiError, Crate } from '@frisson/shared'
import { albums } from '../src/db/schema.ts'
import {
  addCrate,
  buildTestApp,
  createAdmin,
  signUp,
  type SignedIn,
  type TestApp,
} from './helpers.ts'

// Who may change what. Reads are public; writes need a session (401), and only the
// crate's owner or an admin may change it (403). Ownerless crates are admin-only.
// Album and cover checks are added alongside the album routes (T4).

describe('ownership: crates', () => {
  let app: TestApp

  beforeEach(async () => {
    app = await buildTestApp()
  })
  afterEach(() => app.close())

  const patchCrate = (id: number, payload: object, who?: SignedIn) =>
    app.inject({ method: 'PATCH', url: `/api/crates/${id}`, payload, headers: who?.headers })
  const deleteCrate = (id: number, who?: SignedIn) =>
    app.inject({ method: 'DELETE', url: `/api/crates/${id}`, headers: who?.headers })
  const reorder = (ids: number[], who?: SignedIn) =>
    app.inject({ method: 'PUT', url: '/api/crates/order', payload: { ids }, headers: who?.headers })
  const nameOf = async (id: number) =>
    (await app.inject({ url: `/api/crates/${id}` })).json<Crate>().name

  it('anonymous can GET crates, crate, albums and album', async () => {
    const owner = await signUp(app)
    const crate = addCrate(app, 'Shared shelf', 0, owner.user.id)
    const album = app.db
      .insert(albums)
      .values({ crateId: crate.id, title: 'Dummy', artist: 'Portishead' })
      .returning()
      .get()

    const list = await app.inject({ url: '/api/crates' })
    const one = await app.inject({ url: `/api/crates/${crate.id}` })
    const records = await app.inject({ url: '/api/albums' })
    const record = await app.inject({ url: `/api/albums/${album.id}` })

    expect(list.statusCode).toBe(200)
    expect(list.json<Crate[]>().map((c) => c.name)).toEqual(['Shared shelf'])
    expect(one.statusCode).toBe(200)
    expect(one.json<Crate>()).toMatchObject({ name: 'Shared shelf', ownerId: owner.user.id })
    expect(records.statusCode).toBe(200)
    expect(records.json<AlbumSummary[]>().map((a) => a.title)).toEqual(['Dummy'])
    expect(record.statusCode).toBe(200)
    expect(record.json<AlbumDetail>().title).toBe('Dummy')
  })

  it('anonymous POST /api/crates returns 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/crates', payload: { name: 'Jazz' } })

    expect(res.statusCode).toBe(401)
    expect(res.json<ApiError>().message).toBe('Sign in to make changes')
    expect((await app.inject({ url: '/api/crates' })).json<Crate[]>()).toEqual([])
  })

  it('anonymous PATCH crate returns 401', async () => {
    const owner = await signUp(app)
    const crate = addCrate(app, 'Guitars', 0, owner.user.id)

    const res = await patchCrate(crate.id, { name: 'Hijacked' })

    expect(res.statusCode).toBe(401)
    expect(await nameOf(crate.id)).toBe('Guitars')
  })

  it('anonymous DELETE crate returns 401', async () => {
    const owner = await signUp(app)
    const crate = addCrate(app, 'Guitars', 0, owner.user.id)

    const res = await deleteCrate(crate.id)

    expect(res.statusCode).toBe(401)
    expect((await app.inject({ url: `/api/crates/${crate.id}` })).statusCode).toBe(200)
  })

  it('anonymous PUT /api/crates/order returns 401', async () => {
    const owner = await signUp(app)
    const a = addCrate(app, 'A', 0, owner.user.id)
    const b = addCrate(app, 'B', 1, owner.user.id)

    const res = await reorder([b.id, a.id])

    expect(res.statusCode).toBe(401)
    const names = (await app.inject({ url: '/api/crates' })).json<Crate[]>().map((c) => c.name)
    expect(names).toEqual(['A', 'B'])
  })

  it('creating a crate sets ownerId to the current user', async () => {
    const me = await signUp(app, { displayName: 'Thom' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/crates',
      payload: { name: 'Jazz' },
      headers: me.headers,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json<Crate>()).toMatchObject({
      name: 'Jazz',
      ownerId: me.user.id,
      ownerUsername: me.user.username,
      ownerDisplayName: 'Thom',
    })
  })

  it('owner can patch and delete own crate', async () => {
    const me = await signUp(app)
    const crate = addCrate(app, 'Guitars', 0, me.user.id)

    const patched = await patchCrate(crate.id, { name: 'Six strings' }, me)
    expect(patched.statusCode).toBe(200)
    expect(patched.json<Crate>().name).toBe('Six strings')

    const deleted = await deleteCrate(crate.id, me)
    expect(deleted.statusCode).toBe(204)
    expect((await app.inject({ url: `/api/crates/${crate.id}` })).statusCode).toBe(404)
  })

  it("non-owner gets 403 patching another user's crate", async () => {
    const owner = await signUp(app)
    const other = await signUp(app)
    const crate = addCrate(app, 'Guitars', 0, owner.user.id)

    const res = await patchCrate(crate.id, { name: 'Mine now' }, other)

    expect(res.statusCode).toBe(403)
    expect(res.json<ApiError>().message).toBe('You can only change crates you own')
    expect(await nameOf(crate.id)).toBe('Guitars')
  })

  it("non-owner gets 403 deleting another user's crate", async () => {
    const owner = await signUp(app)
    const other = await signUp(app)
    const crate = addCrate(app, 'Guitars', 0, owner.user.id)

    const res = await deleteCrate(crate.id, other)

    expect(res.statusCode).toBe(403)
    expect((await app.inject({ url: `/api/crates/${crate.id}` })).statusCode).toBe(200)
  })

  it('non-owner gets 403 reordering crates they do not own', async () => {
    const me = await signUp(app)
    const other = await signUp(app)
    const mine = addCrate(app, 'Mine', 0, me.user.id)
    const theirs = addCrate(app, 'Theirs', 1, other.user.id)

    const res = await reorder([theirs.id, mine.id], me)

    expect(res.statusCode).toBe(403)
    expect(res.json<ApiError>().message).toBe('You can only reorder crates you own')
    const names = (await app.inject({ url: '/api/crates' })).json<Crate[]>().map((c) => c.name)
    expect(names).toEqual(['Mine', 'Theirs'])

    // With only their own crates on the shelf, the same user may reorder.
    await app.inject({ method: 'DELETE', url: `/api/crates/${theirs.id}`, headers: other.headers })
    const second = addCrate(app, 'Also mine', 1, me.user.id)
    const ok = await reorder([second.id, mine.id], me)
    expect(ok.statusCode).toBe(200)
    expect(ok.json<Crate[]>().map((c) => c.name)).toEqual(['Also mine', 'Mine'])
  })

  it('ownerless crate is editable only by admin', async () => {
    const user = await signUp(app)
    const admin = await createAdmin(app)
    const legacy = addCrate(app, 'Legacy', 0, null)

    expect((await patchCrate(legacy.id, { name: 'Claimed' }, user)).statusCode).toBe(403)
    expect((await deleteCrate(legacy.id, user)).statusCode).toBe(403)
    expect((await reorder([legacy.id], user)).statusCode).toBe(403)
    expect(await nameOf(legacy.id)).toBe('Legacy')

    const patched = await patchCrate(legacy.id, { name: 'Restored' }, admin)
    expect(patched.statusCode).toBe(200)
    expect(patched.json<Crate>()).toMatchObject({ name: 'Restored', ownerId: null })
    expect((await reorder([legacy.id], admin)).statusCode).toBe(200)
    expect((await deleteCrate(legacy.id, admin)).statusCode).toBe(204)
  })

  // Crate half only; T4 writes the full test including albums.
  it("admin can edit and delete any user's crate (crate part)", async () => {
    const owner = await signUp(app)
    const admin = await createAdmin(app)
    const a = addCrate(app, 'A', 0, owner.user.id)
    const b = addCrate(app, 'B', 1, owner.user.id)

    const patched = await patchCrate(a.id, { label: 'ADMIN' }, admin)
    expect(patched.statusCode).toBe(200)
    expect(patched.json<Crate>()).toMatchObject({ label: 'ADMIN', ownerId: owner.user.id })

    const reordered = await reorder([b.id, a.id], admin)
    expect(reordered.statusCode).toBe(200)
    expect(reordered.json<Crate[]>().map((c) => c.name)).toEqual(['B', 'A'])

    expect((await deleteCrate(a.id, admin)).statusCode).toBe(204)
  })

  it('missing crate is 404 for a signed-in user, but 401 when signed out', async () => {
    const me = await signUp(app)

    expect((await patchCrate(999, { name: 'X' }, me)).statusCode).toBe(404)
    expect((await deleteCrate(999, me)).statusCode).toBe(404)
    expect((await patchCrate(999, { name: 'X' })).statusCode).toBe(401)
  })
})
