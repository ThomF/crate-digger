import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb, type Db } from '../src/db/client.js'
import { albums, crates, tracks } from '../src/db/schema.js'

// These tests pin down the rules the database itself enforces,
// so later milestones can rely on them.
describe('database schema', () => {
  let db: Db
  let close: () => void

  beforeEach(() => {
    ;({ db, close } = createDb(':memory:'))
  })
  afterEach(() => close())

  function addCrate() {
    return db.insert(crates).values({ name: 'Test crate' }).returning().get()
  }

  function addAlbum(crateId: number, rating = 0) {
    return db
      .insert(albums)
      .values({ crateId, title: 'Nevermind', artist: 'Nirvana', rating })
      .returning()
      .get()
  }

  it('fills in defaults', () => {
    const album = addAlbum(addCrate().id)

    expect(album.format).toBe('LP')
    expect(album.rating).toBe(0)
    expect(album.createdAt).toBeInstanceOf(Date)
  })

  it('loads an album with its tracks through relations', () => {
    const album = addAlbum(addCrate().id)
    db.insert(tracks)
      .values([
        { albumId: album.id, side: 'A', position: 1, title: 'Smells Like Teen Spirit' },
        { albumId: album.id, side: 'A', position: 2, title: 'In Bloom' },
      ])
      .run()

    const loaded = db.query.albums
      .findFirst({
        where: eq(albums.id, album.id),
        with: { tracks: true },
      })
      .sync()

    expect(loaded?.tracks.map((t) => t.title)).toEqual(['Smells Like Teen Spirit', 'In Bloom'])
  })

  it('deletes tracks when their album is deleted (cascade)', () => {
    const album = addAlbum(addCrate().id)
    db.insert(tracks).values({ albumId: album.id, position: 1, title: 'Polly' }).run()

    db.delete(albums).where(eq(albums.id, album.id)).run()

    expect(db.select().from(tracks).all()).toHaveLength(0)
  })

  it('refuses to delete a crate that still has albums (restrict)', () => {
    const crate = addCrate()
    addAlbum(crate.id)

    expect(() => db.delete(crates).where(eq(crates.id, crate.id)).run()).toThrow(/FOREIGN KEY/)
  })

  it('rejects an album in a crate that does not exist', () => {
    expect(() => addAlbum(999)).toThrow(/FOREIGN KEY/)
  })

  it('keeps rating between 0 and 5', () => {
    const crate = addCrate()

    expect(() => addAlbum(crate.id, 6)).toThrow(/CHECK/)
    expect(() => addAlbum(crate.id, -1)).toThrow(/CHECK/)
  })
})
