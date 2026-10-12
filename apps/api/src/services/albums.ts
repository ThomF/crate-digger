import { and, asc, eq, max, ne, or, sql, type SQL } from 'drizzle-orm'
import type {
  AlbumDetail,
  AlbumSummary,
  CreateAlbumInput,
  ListSort,
  MoveAlbumInput,
  TrackInput,
  UpdateAlbumInput,
} from '@crate-digger/shared'
import type { Db } from '../db/client.ts'
import { albums, crates, tracks } from '../db/schema.ts'
import { compareAlbums } from '@crate-digger/shared/sorting'
import { notFound } from '../errors.ts'
import { assertCrateExists } from './crates.ts'

// Business logic for albums. Plain functions that take the db and validated input,
// so they can be tested without HTTP and reused by any route.

const summaryColumns = {
  id: albums.id,
  crateId: albums.crateId,
  title: albums.title,
  artist: albums.artist,
  year: albums.year,
  genre: albums.genre,
  format: albums.format,
  coverPath: albums.coverPath,
  sleeveColor: albums.sleeveColor,
  rating: albums.rating,
  position: albums.position,
}

export type AlbumFilter = { crateId?: number; q?: string; genre?: string; sort?: ListSort }

/** In LIKE patterns % and _ are wildcards; escape them so a search for "100%" means 100%. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

export function listAlbums(db: Db, filter: AlbumFilter = {}): AlbumSummary[] {
  const conditions: SQL[] = []
  if (filter.crateId) conditions.push(eq(albums.crateId, filter.crateId))
  if (filter.q) {
    // SQLite's LIKE ignores case for A–Z, so "nirv" finds "Nirvana".
    const pattern = `%${escapeLike(filter.q)}%`
    conditions.push(
      or(
        sql`${albums.title} LIKE ${pattern} ESCAPE '\\'`,
        sql`${albums.artist} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    )
  }
  if (filter.genre) conditions.push(sql`${albums.genre} = ${filter.genre} COLLATE NOCASE`)

  const rows = db
    .select(summaryColumns)
    .from(albums)
    .where(and(...conditions))
    .all()

  // Sorting happens here rather than in SQL so it uses exactly the same rules as the web
  // app (shared/sorting.ts): "The Notorious B.I.G." files under N, Björk under B, etc.
  const sort = filter.sort ?? 'crate'
  if (sort !== 'crate') return rows.sort((a, b) => compareAlbums(sort, a, b))

  // 'crate': crates in shelf order, each sorted the way that crate is set to sort.
  const crateInfo = new Map(
    db
      .select({ id: crates.id, sortOrder: crates.sortOrder, sortBy: crates.sortBy })
      .from(crates)
      .all()
      .map((c) => [c.id, c]),
  )
  const crateOf = (a: AlbumSummary) => crateInfo.get(a.crateId)!
  return rows.sort(
    (a, b) =>
      crateOf(a).sortOrder - crateOf(b).sortOrder ||
      a.crateId - b.crateId ||
      compareAlbums(crateOf(a).sortBy, a, b),
  )
}

export function getAlbum(db: Db, id: number): AlbumDetail {
  const row = db.query.albums
    .findFirst({
      where: eq(albums.id, id),
      with: { tracks: { orderBy: [asc(tracks.side), asc(tracks.position)] } },
    })
    .sync()
  if (!row) throw notFound(`Album ${id}`)

  // JSON has no Date type, so timestamps go out as ISO strings.
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** New albums go to the back of their crate. */
function nextPosition(db: Pick<Db, 'select'>, crateId: number) {
  const row = db
    .select({ last: max(albums.position) })
    .from(albums)
    .where(eq(albums.crateId, crateId))
    .get()
  return (row?.last ?? -1) + 1
}

export function createAlbum(db: Db, input: CreateAlbumInput): AlbumDetail {
  const { tracks: tracklist, ...fields } = input
  assertCrateExists(db, fields.crateId)

  // A transaction: if inserting the tracks fails, the album isn't saved either.
  const id = db.transaction((tx) => {
    const album = tx
      .insert(albums)
      .values({ ...fields, position: nextPosition(tx, fields.crateId) })
      .returning({ id: albums.id })
      .get()
    if (tracklist?.length) {
      tx.insert(tracks)
        .values(tracklist.map((t) => ({ ...t, albumId: album.id })))
        .run()
    }
    return album.id
  })

  return getAlbum(db, id)
}

export function updateAlbum(db: Db, id: number, input: UpdateAlbumInput): AlbumDetail {
  const existing = db
    .select({ crateId: albums.crateId })
    .from(albums)
    .where(eq(albums.id, id))
    .get()
  if (!existing) throw notFound(`Album ${id}`)

  const changes: UpdateAlbumInput & { position?: number } = { ...input }
  if (input.crateId !== undefined && input.crateId !== existing.crateId) {
    assertCrateExists(db, input.crateId)
    changes.position = nextPosition(db, input.crateId) // moved crates → back of the new one
  }

  db.update(albums).set(changes).where(eq(albums.id, id)).run()
  return getAlbum(db, id)
}

/**
 * Puts an album at `position` (0 = front) in `crateId`, shifting the others along.
 * Positions only matter in crates sorted 'manual'; sorted crates order themselves.
 */
export function moveAlbum(db: Db, id: number, { crateId, position }: MoveAlbumInput): AlbumDetail {
  const album = db.select({ crateId: albums.crateId }).from(albums).where(eq(albums.id, id)).get()
  if (!album) throw notFound(`Album ${id}`)
  assertCrateExists(db, crateId)

  db.transaction((tx) => {
    const renumber = (inCrate: number, order: number[]) =>
      order.forEach((albumId, index) => {
        tx.update(albums)
          .set({
            crateId: inCrate,
            position: index,
            // Shuffling neighbours along isn't an edit to them, so keep their updatedAt.
            ...(albumId === id ? {} : { updatedAt: sql`${albums.updatedAt}` }),
          })
          .where(eq(albums.id, albumId))
          .run()
      })

    const idsIn = (crate: number) =>
      tx
        .select({ id: albums.id })
        .from(albums)
        .where(and(eq(albums.crateId, crate), ne(albums.id, id)))
        .orderBy(asc(albums.position), asc(albums.id))
        .all()
        .map((row) => row.id)

    const target = idsIn(crateId)
    target.splice(Math.min(position, target.length), 0, id)
    renumber(crateId, target)

    // Close the gap it left behind.
    if (album.crateId !== crateId) renumber(album.crateId, idsIn(album.crateId))
  })

  return getAlbum(db, id)
}

/** Counts one spin (the record was pulled out of the crate) and returns the new total. */
export function addSpin(db: Db, id: number): { spinCount: number } {
  // spin_count + 1 is worked out by SQLite itself, so two spins at the same moment
  // both count (reading the number, adding one in JS and saving it back could lose one).
  const row = db
    .update(albums)
    // updatedAt stays as it was: listening to a record is not editing it.
    .set({ spinCount: sql`${albums.spinCount} + 1`, updatedAt: sql`${albums.updatedAt}` })
    .where(eq(albums.id, id))
    .returning({ spinCount: albums.spinCount })
    .get()
  if (!row) throw notFound(`Album ${id}`)
  return row
}

/** Deletes the album (its tracks cascade) and returns its cover path so the caller can remove the file. */
export function deleteAlbum(db: Db, id: number): { coverPath: string | null } {
  const deleted = db
    .delete(albums)
    .where(eq(albums.id, id))
    .returning({ coverPath: albums.coverPath })
    .get()
  if (!deleted) throw notFound(`Album ${id}`)
  return deleted
}

/** Replaces the whole tracklist. Simpler than syncing individual track edits. */
export function replaceTracks(db: Db, albumId: number, tracklist: TrackInput[]): AlbumDetail {
  db.transaction((tx) => {
    const touched = tx
      .update(albums)
      .set({ updatedAt: new Date() })
      .where(eq(albums.id, albumId))
      .run()
    if (touched.changes === 0) throw notFound(`Album ${albumId}`)

    tx.delete(tracks).where(eq(tracks.albumId, albumId)).run()
    if (tracklist.length) {
      tx.insert(tracks)
        .values(tracklist.map((t) => ({ ...t, albumId })))
        .run()
    }
  })

  return getAlbum(db, albumId)
}
