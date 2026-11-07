import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb, type Db } from '../src/db/client.ts'
import { albums, crates, tracks, userLinks, users } from '../src/db/schema.ts'

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

  function addUser(username = 'ada') {
    return db
      .insert(users)
      .values({
        email: `${username}@example.com`,
        username,
        displayName: username,
        passwordHash: 'scrypt$placeholder',
      })
      .returning()
      .get()
  }

  it('gives new users an empty, unverified profile', () => {
    const user = addUser()

    expect(user.bio).toBe('')
    expect(user.location).toBeNull()
    expect(user.avatarPath).toBeNull()
    expect(user.verified).toBe(false)
  })

  it('stores verified as a boolean', () => {
    const user = addUser()
    db.update(users).set({ verified: true }).where(eq(users.id, user.id)).run()

    expect(db.select().from(users).where(eq(users.id, user.id)).get()?.verified).toBe(true)
  })

  it('loads a user with their links in position order through relations', () => {
    const user = addUser()
    db.insert(userLinks)
      .values([
        { userId: user.id, platform: 'bandcamp', url: 'https://ada.bandcamp.com', position: 1 },
        { userId: user.id, platform: 'instagram', url: 'https://instagram.com/ada', position: 0 },
      ])
      .run()

    const loaded = db.query.users
      .findFirst({
        where: eq(users.id, user.id),
        with: { links: { orderBy: (l, { asc }) => [asc(l.position)] } },
      })
      .sync()

    expect(loaded?.links.map((l) => l.platform)).toEqual(['instagram', 'bandcamp'])
  })

  it("deletes a user's links when the user is deleted (cascade)", () => {
    const ada = addUser('ada')
    const bob = addUser('bob')
    db.insert(userLinks)
      .values([
        { userId: ada.id, platform: 'website', url: 'https://ada.example', position: 0 },
        { userId: bob.id, platform: 'website', url: 'https://bob.example', position: 0 },
      ])
      .run()

    db.delete(users).where(eq(users.id, ada.id)).run()

    expect(
      db
        .select()
        .from(userLinks)
        .all()
        .map((l) => l.userId),
    ).toEqual([bob.id])
  })

  it('rejects a link for a user that does not exist', () => {
    expect(() =>
      db
        .insert(userLinks)
        .values({ userId: 999, platform: 'x', url: 'https://x.com/nobody', position: 0 })
        .run(),
    ).toThrow(/FOREIGN KEY/)
  })
})
