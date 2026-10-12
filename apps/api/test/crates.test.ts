import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AlbumDetail, AlbumSummary, ApiError, Crate } from '@crate-digger/shared'
import { albums } from '../src/db/schema.ts'
import { addCrate, buildTestApp, type TestApp } from './helpers.ts'

describe('crates API', () => {
  let app: TestApp

  beforeEach(async () => {
    app = await buildTestApp()
  })
  afterEach(() => app.close())

  const createCrate = (payload: object) =>
    app.inject({ method: 'POST', url: '/api/crates', payload })

  it('lists crates in shelf order with album counts, including empty crates', async () => {
    const second = addCrate(app, 'Second', 1)
    const first = addCrate(app, 'First', 0)
    app.db
      .insert(albums)
      .values([
        { crateId: second.id, title: 'A', artist: 'X' },
        { crateId: second.id, title: 'B', artist: 'Y' },
      ])
      .run()

    const res = await app.inject({ url: '/api/crates' })

    expect(res.statusCode).toBe(200)
    expect(res.json<Crate[]>().map((c) => [c.id, c.name, c.albumCount])).toEqual([
      [first.id, 'First', 0],
      [second.id, 'Second', 2],
    ])
  })

  it('creates a crate at the end of the shelf with defaults', async () => {
    addCrate(app, 'Existing', 4)

    const res = await createCrate({ name: '  Jazz  ' })

    expect(res.statusCode).toBe(201)
    expect(res.json<Crate>()).toMatchObject({
      name: 'Jazz',
      label: null,
      color: '#c8a374',
      sortBy: 'manual',
      sortOrder: 5,
      albumCount: 0,
    })
  })

  it('validates new crates', async () => {
    const res = await createCrate({ name: '', color: 'brown', sortBy: 'vibes' })

    expect(res.statusCode).toBe(400)
    expect(
      res
        .json<ApiError>()
        .issues?.map((i) => i.path)
        .sort(),
    ).toEqual(['body/color', 'body/name', 'body/sortBy'])
  })

  it('updates only the fields sent', async () => {
    const crate = addCrate(app, 'Guitars')

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/crates/${crate.id}`,
      payload: { sortBy: 'artist', label: 'ROCK' },
    })

    expect(res.json<Crate>()).toMatchObject({ name: 'Guitars', sortBy: 'artist', label: 'ROCK' })
  })

  it('refuses to delete a crate that still holds records, and explains why', async () => {
    const crate = addCrate(app)
    app.db.insert(albums).values({ crateId: crate.id, title: 'A', artist: 'X' }).run()

    const res = await app.inject({ method: 'DELETE', url: `/api/crates/${crate.id}` })

    expect(res.statusCode).toBe(409)
    expect(res.json<ApiError>().message).toBe(
      'This crate still holds 1 record. Move or remove them first.',
    )
  })

  it('deletes an empty crate', async () => {
    const crate = addCrate(app)

    const res = await app.inject({ method: 'DELETE', url: `/api/crates/${crate.id}` })
    const after = await app.inject({ url: `/api/crates/${crate.id}` })

    expect(res.statusCode).toBe(204)
    expect(after.statusCode).toBe(404)
  })

  it('reorders the shelf, but only with every crate listed once', async () => {
    const a = addCrate(app, 'A', 0)
    const b = addCrate(app, 'B', 1)
    const c = addCrate(app, 'C', 2)
    const order = (ids: number[]) =>
      app.inject({ method: 'PUT', url: '/api/crates/order', payload: { ids } })

    const res = await order([c.id, a.id, b.id])
    expect(res.json<Crate[]>().map((x) => x.name)).toEqual(['C', 'A', 'B'])

    expect((await order([a.id, b.id])).statusCode).toBe(400) // missing one
    expect((await order([a.id, a.id, b.id])).statusCode).toBe(400) // duplicate
  })
})

describe('moving and finding albums', () => {
  let app: TestApp
  let guitars: number
  let beats: number

  beforeEach(async () => {
    app = await buildTestApp()
    guitars = addCrate(app, 'Guitars', 0).id
    beats = addCrate(app, 'Beats', 1).id
  })
  afterEach(() => app.close())

  function seed(crateId: number, ...rows: [title: string, artist: string, year?: number][]) {
    return rows.map(
      ([title, artist, year], position) =>
        app.db
          .insert(albums)
          .values({ crateId, title, artist, year, position, genre: 'Rock' })
          .returning()
          .get().id,
    )
  }

  const titlesIn = async (crateId: number) =>
    (await app.inject({ url: `/api/albums?crateId=${crateId}` }))
      .json<AlbumSummary[]>()
      .map((a) => `${a.position}:${a.title}`)

  const move = (id: number, crateId: number, position: number) =>
    app.inject({
      method: 'PATCH',
      url: `/api/albums/${id}/position`,
      payload: { crateId, position },
    })

  it('moves a record within a crate', async () => {
    const [, , third] = seed(guitars, ['One', 'A'], ['Two', 'B'], ['Three', 'C'])

    const res = await move(third!, guitars, 0)

    expect(res.statusCode).toBe(200)
    expect(await titlesIn(guitars)).toEqual(['0:Three', '1:One', '2:Two'])
  })

  it('moves a record to another crate and closes the gap it left', async () => {
    const [, second] = seed(guitars, ['One', 'A'], ['Two', 'B'], ['Three', 'C'])
    seed(beats, ['Dummy', 'Portishead'])

    const res = await move(second!, beats, 1)

    expect(res.json<AlbumDetail>().crateId).toBe(beats)
    expect(await titlesIn(guitars)).toEqual(['0:One', '1:Three'])
    expect(await titlesIn(beats)).toEqual(['0:Dummy', '1:Two'])
  })

  it('puts a record at the end when the position is past the end', async () => {
    const [first] = seed(guitars, ['One', 'A'], ['Two', 'B'])

    await move(first!, guitars, 99)

    expect(await titlesIn(guitars)).toEqual(['0:Two', '1:One'])
  })

  it('rejects moves to crates that do not exist, and unknown albums', async () => {
    const [first] = seed(guitars, ['One', 'A'])

    expect((await move(first!, 999, 0)).statusCode).toBe(400)
    expect((await move(999, guitars, 0)).statusCode).toBe(404)
  })

  it('searches title and artist, ignoring case, with % and _ taken literally', async () => {
    seed(guitars, ['Nevermind', 'Nirvana'], ['100% Pure', 'Someone'], ['1000 Pure', 'Other'])
    seed(beats, ['Dummy', 'Portishead'])
    const search = async (q: string) =>
      (await app.inject({ url: `/api/albums?q=${encodeURIComponent(q)}` }))
        .json<AlbumSummary[]>()
        .map((a) => a.title)

    expect(await search('NIRV')).toEqual(['Nevermind'])
    expect(await search('head')).toEqual(['Dummy'])
    expect(await search('100%')).toEqual(['100% Pure'])
  })

  it('filters by genre, ignoring case', async () => {
    seed(guitars, ['Nevermind', 'Nirvana'])
    app.db
      .insert(albums)
      .values({ crateId: beats, title: 'Dummy', artist: 'P', genre: 'Trip-Hop' })
      .run()

    const res = await app.inject({ url: '/api/albums?genre=trip-hop' })

    expect(res.json<AlbumSummary[]>().map((a) => a.title)).toEqual(['Dummy'])
  })

  it('sorts by artist the way record shops file them', async () => {
    seed(
      guitars,
      ['Ready to Die', 'The Notorious B.I.G.'],
      ['Debut', 'Björk'],
      ['Odelay', 'Beck'],
      ['Mezzanine', 'Massive Attack'],
    )

    const res = await app.inject({ url: '/api/albums?sort=artist' })

    expect(res.json<AlbumSummary[]>().map((a) => a.artist)).toEqual([
      'Beck',
      'Björk',
      'Massive Attack',
      'The Notorious B.I.G.',
    ])
  })

  it('lists in crate order, each crate sorted its own way', async () => {
    seed(guitars, ['Zebra', 'Z'], ['Apple', 'A']) // manual: Zebra first
    seed(beats, ['Zulu', 'Z'], ['Alpha', 'A'])
    await app.inject({ method: 'PATCH', url: `/api/crates/${beats}`, payload: { sortBy: 'title' } })

    const res = await app.inject({ url: '/api/albums' })

    expect(res.json<AlbumSummary[]>().map((a) => a.title)).toEqual([
      'Zebra',
      'Apple',
      'Alpha',
      'Zulu',
    ])
  })
})
