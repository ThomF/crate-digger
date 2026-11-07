import { readdir } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import type { AlbumDetail, AlbumSummary, ApiError, Crate } from '@frisson/shared'
import { albums } from '../src/db/schema.ts'
import {
  addCrate,
  buildTestApp,
  createAdmin,
  multipart,
  signUp,
  type SignedIn,
  type TestApp,
} from './helpers.ts'

// Who may change what. Reads are public; writes need a session (401), and only the
// crate's owner or an admin may change it (403). Ownerless crates are admin-only.
// Albums and covers follow the crate they're in.

const ALBUM_403 = 'You can only change records in crates you own'
const CRATE_403 = 'You can only change crates you own'

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
    const record = app.db
      .insert(albums)
      .values({ crateId: legacy.id, title: 'Old', artist: 'Someone' })
      .returning()
      .get()

    // Its records are locked too.
    const albumPatch = await app.inject({
      method: 'PATCH',
      url: `/api/albums/${record.id}`,
      payload: { title: 'Mine' },
      headers: user.headers,
    })
    expect(albumPatch.statusCode).toBe(403)
    const albumAdd = await app.inject({
      method: 'POST',
      url: '/api/albums',
      payload: { crateId: legacy.id, title: 'New', artist: 'Me' },
      headers: user.headers,
    })
    expect(albumAdd.statusCode).toBe(403)
    const adminAlbumPatch = await app.inject({
      method: 'PATCH',
      url: `/api/albums/${record.id}`,
      payload: { title: 'Kept' },
      headers: admin.headers,
    })
    expect(adminAlbumPatch.statusCode).toBe(200)
    expect(adminAlbumPatch.json<AlbumDetail>().title).toBe('Kept')
    app.db.delete(albums).run() // so the crate can be deleted below

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

  it("admin can edit and delete any user's crate and album", async () => {
    const owner = await signUp(app)
    const admin = await createAdmin(app)
    const a = addCrate(app, 'A', 0, owner.user.id)
    const b = addCrate(app, 'B', 1, owner.user.id)
    const elsewhere = await signUp(app)
    const theirs = addCrate(app, 'Theirs', 2, elsewhere.user.id)

    const patched = await patchCrate(a.id, { label: 'ADMIN' }, admin)
    expect(patched.statusCode).toBe(200)
    expect(patched.json<Crate>()).toMatchObject({ label: 'ADMIN', ownerId: owner.user.id })

    const reordered = await reorder([b.id, a.id, theirs.id], admin)
    expect(reordered.statusCode).toBe(200)
    expect(reordered.json<Crate[]>().map((c) => c.name)).toEqual(['B', 'A', 'Theirs'])

    // Albums: add, edit, retracklist, move between two other users' crates, spin, delete.
    const added = await app.inject({
      method: 'POST',
      url: '/api/albums',
      payload: { crateId: b.id, title: 'Dummy', artist: 'Portishead' },
      headers: admin.headers,
    })
    expect(added.statusCode).toBe(201)
    const id = added.json<AlbumDetail>().id
    const edit = await app.inject({
      method: 'PATCH',
      url: `/api/albums/${id}`,
      payload: { rating: 5 },
      headers: admin.headers,
    })
    expect(edit.statusCode).toBe(200)
    const tracks = await app.inject({
      method: 'PUT',
      url: `/api/albums/${id}/tracks`,
      payload: [{ side: 'A', position: 1, title: 'Mysterons' }],
      headers: admin.headers,
    })
    expect(tracks.statusCode).toBe(200)
    const moved = await app.inject({
      method: 'PATCH',
      url: `/api/albums/${id}/position`,
      payload: { crateId: theirs.id, position: 0 },
      headers: admin.headers,
    })
    expect(moved.statusCode).toBe(200)
    expect(moved.json<AlbumDetail>().crateId).toBe(theirs.id)
    const spun = await app.inject({
      method: 'POST',
      url: `/api/albums/${id}/spins`,
      headers: admin.headers,
    })
    expect(spun.statusCode).toBe(200)
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/albums/${id}`,
      headers: admin.headers,
    })
    expect(removed.statusCode).toBe(204)

    expect((await deleteCrate(a.id, admin)).statusCode).toBe(204)
  })

  it('missing crate is 404 for a signed-in user, but 401 when signed out', async () => {
    const me = await signUp(app)

    expect((await patchCrate(999, { name: 'X' }, me)).statusCode).toBe(404)
    expect((await deleteCrate(999, me)).statusCode).toBe(404)
    expect((await patchCrate(999, { name: 'X' })).statusCode).toBe(401)
  })
})

describe('ownership: albums and covers', () => {
  let app: TestApp
  let owner: SignedIn
  let other: SignedIn
  let crateId: number
  let albumId: number

  beforeEach(async () => {
    app = await buildTestApp()
    owner = await signUp(app)
    other = await signUp(app)
    crateId = addCrate(app, "Owner's crate", 0, owner.user.id).id
    albumId = app.db
      .insert(albums)
      .values({ crateId, title: 'Dummy', artist: 'Portishead' })
      .returning()
      .get().id
  })
  afterEach(() => app.close())

  const send = (
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    payload?: unknown,
    who?: SignedIn,
  ) => app.inject({ method, url, payload: payload as object, headers: who?.headers })
  const getAlbum = async (id = albumId) => app.inject({ url: `/api/albums/${id}` })
  const titleOf = async (id = albumId) => (await getAlbum(id)).json<AlbumDetail>().title

  const pngImage = () =>
    sharp({ create: { width: 64, height: 64, channels: 3, background: '#c0392b' } })
      .png()
      .toBuffer()
  const uploadCover = async (who?: SignedIn, id = albumId) => {
    const body = multipart('cover', 'cover.png', 'image/png', await pngImage())
    return app.inject({
      method: 'POST',
      url: `/api/albums/${id}/cover`,
      payload: body.payload,
      headers: { ...body.headers, ...who?.headers },
    })
  }

  it('anonymous POST/PATCH/DELETE album returns 401', async () => {
    const created = await send('POST', '/api/albums', { crateId, title: 'Sneaky', artist: 'X' })
    const patched = await send('PATCH', `/api/albums/${albumId}`, { title: 'Hijacked' })
    const moved = await send('PATCH', `/api/albums/${albumId}/position`, { crateId, position: 0 })
    const retracked = await send('PUT', `/api/albums/${albumId}/tracks`, [])
    const spun = await send('POST', `/api/albums/${albumId}/spins`)
    const deleted = await send('DELETE', `/api/albums/${albumId}`)

    for (const res of [created, patched, moved, retracked, spun, deleted]) {
      expect(res.statusCode).toBe(401)
      expect(res.json<ApiError>().message).toBe('Sign in to make changes')
    }
    const list = (await app.inject({ url: '/api/albums' })).json<AlbumSummary[]>()
    expect(list.map((a) => a.title)).toEqual(['Dummy'])
    expect((await getAlbum()).json<AlbumDetail>().spinCount).toBe(0)
  })

  it('anonymous cover upload and delete return 401', async () => {
    const uploaded = await uploadCover()
    const removed = await send('DELETE', `/api/albums/${albumId}/cover`)

    expect(uploaded.statusCode).toBe(401)
    expect(removed.statusCode).toBe(401)
    expect(await readdir(app.coversDir)).toEqual([])
    expect((await getAlbum()).json<AlbumDetail>().coverPath).toBeNull()
  })

  it("non-owner gets 403 adding an album to another user's crate", async () => {
    const res = await send(
      'POST',
      '/api/albums',
      { crateId, title: 'Intruder', artist: 'X' },
      other,
    )

    expect(res.statusCode).toBe(403)
    expect(res.json<ApiError>().message).toBe(CRATE_403)
    const list = (await app.inject({ url: '/api/albums' })).json<AlbumSummary[]>()
    expect(list.map((a) => a.title)).toEqual(['Dummy'])
  })

  it("non-owner gets 403 patching and deleting an album in another user's crate", async () => {
    const patched = await send('PATCH', `/api/albums/${albumId}`, { title: 'Mine' }, other)
    const retracked = await send(
      'PUT',
      `/api/albums/${albumId}/tracks`,
      [{ side: 'A', position: 1, title: 'X' }],
      other,
    )
    const spun = await send('POST', `/api/albums/${albumId}/spins`, undefined, other)
    const deleted = await send('DELETE', `/api/albums/${albumId}`, undefined, other)

    for (const res of [patched, retracked, spun, deleted]) {
      expect(res.statusCode).toBe(403)
      expect(res.json<ApiError>().message).toBe(ALBUM_403)
    }
    const album = (await getAlbum()).json<AlbumDetail>()
    expect(album).toMatchObject({ title: 'Dummy', spinCount: 0, tracks: [] })
  })

  it("non-owner gets 403 moving an album into someone else's crate", async () => {
    // `other` owns this album; `owner` owns the target crate.
    const mine = addCrate(app, 'Mine', 1, other.user.id).id
    const myAlbum = app.db
      .insert(albums)
      .values({ crateId: mine, title: 'Mine', artist: 'Me' })
      .returning()
      .get().id

    const viaPatch = await send('PATCH', `/api/albums/${myAlbum}`, { crateId }, other)
    const viaPosition = await send(
      'PATCH',
      `/api/albums/${myAlbum}/position`,
      { crateId, position: 0 },
      other,
    )
    // ...and pulling the owner's album out into their own crate is just as forbidden.
    const pullOut = await send(
      'PATCH',
      `/api/albums/${albumId}/position`,
      { crateId: mine, position: 0 },
      other,
    )

    for (const res of [viaPatch, viaPosition]) {
      expect(res.statusCode).toBe(403)
      expect(res.json<ApiError>().message).toBe(CRATE_403)
    }
    expect(pullOut.statusCode).toBe(403)
    expect(pullOut.json<ApiError>().message).toBe(ALBUM_403)
    expect((await getAlbum(myAlbum)).json<AlbumDetail>().crateId).toBe(mine)
    expect((await getAlbum()).json<AlbumDetail>().crateId).toBe(crateId)
  })

  it("non-owner gets 403 on cover upload for another user's album", async () => {
    const uploaded = await uploadCover(other)
    const removed = await send('DELETE', `/api/albums/${albumId}/cover`, undefined, other)

    expect(uploaded.statusCode).toBe(403)
    expect(uploaded.json<ApiError>().message).toBe(ALBUM_403)
    expect(removed.statusCode).toBe(403)
    expect(await readdir(app.coversDir)).toEqual([])

    // The owner can, and a stranger still can't take it away.
    expect((await uploadCover(owner)).statusCode).toBe(200)
    const again = await send('DELETE', `/api/albums/${albumId}/cover`, undefined, other)
    expect(again.statusCode).toBe(403)
    expect((await getAlbum()).json<AlbumDetail>().coverPath).not.toBeNull()
  })

  it('owner can add, edit and delete albums and tracks in own crate', async () => {
    const second = addCrate(app, 'Second', 1, owner.user.id).id

    const added = await send(
      'POST',
      '/api/albums',
      {
        crateId,
        title: 'Third',
        artist: 'Portishead',
        tracks: [{ side: 'A', position: 1, title: 'Silence' }],
      },
      owner,
    )
    expect(added.statusCode).toBe(201)
    const id = added.json<AlbumDetail>().id

    const edited = await send('PATCH', `/api/albums/${id}`, { rating: 4 }, owner)
    expect(edited.statusCode).toBe(200)
    expect(edited.json<AlbumDetail>().rating).toBe(4)

    const retracked = await send(
      'PUT',
      `/api/albums/${id}/tracks`,
      [
        { side: 'A', position: 1, title: 'Silence' },
        { side: 'A', position: 2, title: 'Hunter' },
      ],
      owner,
    )
    expect(retracked.statusCode).toBe(200)
    expect(retracked.json<AlbumDetail>().tracks.map((t) => t.title)).toEqual(['Silence', 'Hunter'])

    const moved = await send('PATCH', `/api/albums/${id}`, { crateId: second }, owner)
    expect(moved.statusCode).toBe(200)
    expect(moved.json<AlbumDetail>().crateId).toBe(second)
    const repositioned = await send(
      'PATCH',
      `/api/albums/${id}/position`,
      { crateId, position: 0 },
      owner,
    )
    expect(repositioned.statusCode).toBe(200)
    expect(repositioned.json<AlbumDetail>()).toMatchObject({ crateId, position: 0 })

    const spun = await send('POST', `/api/albums/${id}/spins`, undefined, owner)
    expect(spun.json()).toEqual({ spinCount: 1 })

    expect((await uploadCover(owner, id)).statusCode).toBe(200)
    expect((await send('DELETE', `/api/albums/${id}/cover`, undefined, owner)).statusCode).toBe(200)

    const deleted = await send('DELETE', `/api/albums/${id}`, undefined, owner)
    expect(deleted.statusCode).toBe(204)
    expect((await getAlbum(id)).statusCode).toBe(404)
    expect(await titleOf()).toBe('Dummy')
  })

  it('missing album is 404 for a signed-in user, but 401 when signed out', async () => {
    expect((await send('PATCH', '/api/albums/999', { title: 'X' }, owner)).statusCode).toBe(404)
    expect((await send('DELETE', '/api/albums/999', undefined, owner)).statusCode).toBe(404)
    expect((await uploadCover(owner, 999)).statusCode).toBe(404)
    expect((await send('PATCH', '/api/albums/999', { title: 'X' })).statusCode).toBe(401)
  })
})
