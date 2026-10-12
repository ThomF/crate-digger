import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AlbumDetail, AlbumSummary, ApiError, CreateAlbumRequest } from '@crate-digger/shared'
import { addCrate, buildTestApp } from './helpers.ts'

describe('albums API', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let crateId: number

  beforeEach(async () => {
    app = await buildTestApp()
    crateId = addCrate(app).id
  })
  afterEach(() => app.close())

  async function create(overrides: Partial<CreateAlbumRequest> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/albums',
      payload: { crateId, title: 'Dummy', artist: 'Portishead', ...overrides },
    })
    return { res, album: res.json<AlbumDetail>() }
  }

  describe('POST /api/albums', () => {
    it('creates an album with defaults and tracks, sorted by side then position', async () => {
      const { res, album } = await create({
        year: 1994,
        tracks: [
          { side: 'B', position: 1, title: "It's a Fire" },
          { side: 'A', position: 2, title: 'Sour Times' },
          { side: 'A', position: 1, title: 'Mysterons' },
        ],
      })

      expect(res.statusCode).toBe(201)
      expect(album).toMatchObject({ title: 'Dummy', format: 'LP', rating: 0, position: 0 })
      expect(album.tracks.map((t) => `${t.side}${t.position} ${t.title}`)).toEqual([
        'A1 Mysterons',
        'A2 Sour Times',
        "B1 It's a Fire",
      ])
      expect(new Date(album.createdAt).toString()).not.toBe('Invalid Date')
    })

    it('puts each new album at the back of its crate', async () => {
      await create()
      const { album } = await create({ title: 'Third Eye' })

      expect(album.position).toBe(1)
    })

    it('trims text input', async () => {
      const { album } = await create({ title: '  Dummy  ' })

      expect(album.title).toBe('Dummy')
    })

    it('returns 400 with one issue per invalid field', async () => {
      const { res } = await create({ title: '', rating: 7, sleeveColor: 'blue' })
      const body = res.json<ApiError>()

      expect(res.statusCode).toBe(400)
      expect(body.issues?.map((i) => i.path).sort()).toEqual([
        'body/rating',
        'body/sleeveColor',
        'body/title',
      ])
    })

    it('rejects duplicate side + position in a tracklist', async () => {
      const { res } = await create({
        tracks: [
          { side: 'A', position: 1, title: 'One' },
          { side: 'A', position: 1, title: 'Also one' },
        ],
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when the crate does not exist', async () => {
      const { res } = await create({ crateId: 999 })

      expect(res.statusCode).toBe(400)
      expect(res.json<ApiError>().message).toBe('Crate 999 does not exist')
    })
  })

  describe('GET /api/albums', () => {
    it('lists albums in crate order and can filter by crate', async () => {
      const otherCrate = addCrate(app, 'Other', 1).id
      await create({ title: 'First' })
      await create({ title: 'Elsewhere', crateId: otherCrate })
      await create({ title: 'Second' })

      const all = await app.inject({ url: '/api/albums' })
      const filtered = await app.inject({ url: `/api/albums?crateId=${crateId}` })

      expect(all.json<AlbumSummary[]>().map((a) => a.title)).toEqual([
        'First',
        'Second',
        'Elsewhere',
      ])
      expect(filtered.json<AlbumSummary[]>().map((a) => a.title)).toEqual(['First', 'Second'])
    })

    it('leaves notes and tracks out of the summary', async () => {
      await create({ notes: 'secret' })

      const [summary] = (await app.inject({ url: '/api/albums' })).json<AlbumSummary[]>()

      expect(summary).not.toHaveProperty('notes')
      expect(summary).not.toHaveProperty('tracks')
    })
  })

  describe('GET /api/albums/:id', () => {
    it('returns 404 for an unknown album', async () => {
      const res = await app.inject({ url: '/api/albums/999' })

      expect(res.statusCode).toBe(404)
      expect(res.json<ApiError>().message).toBe('Album 999 not found')
    })

    it('returns 400 for a non-numeric id', async () => {
      const res = await app.inject({ url: '/api/albums/abc' })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('PATCH /api/albums/:id', () => {
    it('changes only the fields sent', async () => {
      const { album } = await create({ format: 'EP', rating: 3 })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/albums/${album.id}`,
        payload: { rating: 5 },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json<AlbumDetail>()).toMatchObject({ rating: 5, format: 'EP', title: 'Dummy' })
    })

    it('moves an album to the back of another crate', async () => {
      const otherCrate = addCrate(app, 'Other', 1).id
      await create({ crateId: otherCrate, title: 'Already there' })
      const { album } = await create()

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/albums/${album.id}`,
        payload: { crateId: otherCrate },
      })

      expect(res.json<AlbumDetail>()).toMatchObject({ crateId: otherCrate, position: 1 })
    })

    it('rejects an empty update', async () => {
      const { album } = await create()

      const res = await app.inject({ method: 'PATCH', url: `/api/albums/${album.id}`, payload: {} })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('PUT /api/albums/:id/tracks', () => {
    it('replaces the whole tracklist', async () => {
      const { album } = await create({ tracks: [{ side: 'A', position: 1, title: 'Old' }] })

      const res = await app.inject({
        method: 'PUT',
        url: `/api/albums/${album.id}/tracks`,
        payload: [
          { side: 'A', position: 1, title: 'Mysterons' },
          { side: 'A', position: 2, title: 'Sour Times', durationSec: 254 },
        ],
      })

      expect(res.statusCode).toBe(200)
      expect(res.json<AlbumDetail>().tracks.map((t) => t.title)).toEqual([
        'Mysterons',
        'Sour Times',
      ])
    })

    it('can clear the tracklist', async () => {
      const { album } = await create({ tracks: [{ side: 'A', position: 1, title: 'Old' }] })

      const res = await app.inject({
        method: 'PUT',
        url: `/api/albums/${album.id}/tracks`,
        payload: [],
      })

      expect(res.json<AlbumDetail>().tracks).toEqual([])
    })

    it('returns 404 for an unknown album', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/albums/999/tracks', payload: [] })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/albums/:id', () => {
    it('deletes the album, then 404s', async () => {
      const { album } = await create()

      const first = await app.inject({ method: 'DELETE', url: `/api/albums/${album.id}` })
      const second = await app.inject({ method: 'DELETE', url: `/api/albums/${album.id}` })

      expect(first.statusCode).toBe(204)
      expect(second.statusCode).toBe(404)
    })
  })

  describe('POST /api/albums/:id/spins', () => {
    it('counts each spin and includes the total in the album', async () => {
      const { album } = await create()
      expect(album.spinCount).toBe(0)

      await app.inject({ method: 'POST', url: `/api/albums/${album.id}/spins` })
      const res = await app.inject({ method: 'POST', url: `/api/albums/${album.id}/spins` })
      const detail = await app.inject({ url: `/api/albums/${album.id}` })

      expect(res.json()).toEqual({ spinCount: 2 })
      expect(detail.json<AlbumDetail>().spinCount).toBe(2)
      expect(detail.json<AlbumDetail>().updatedAt).toBe(album.updatedAt) // not an edit
    })

    it('returns 404 for an unknown album', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/albums/999/spins' })

      expect(res.statusCode).toBe(404)
    })
  })
})
