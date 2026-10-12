import { asc, eq, max } from 'drizzle-orm'
import type {
  AlbumDetail,
  AlbumSummary,
  CreateAlbumInput,
  TrackInput,
  UpdateAlbumInput,
} from '@crate-digger/shared'
import type { Db } from '../db/client.ts'
import { albums, tracks } from '../db/schema.ts'
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

export function listAlbums(db: Db, filter: { crateId?: number } = {}): AlbumSummary[] {
  return db
    .select(summaryColumns)
    .from(albums)
    .where(filter.crateId ? eq(albums.crateId, filter.crateId) : undefined)
    .orderBy(asc(albums.crateId), asc(albums.position), asc(albums.id))
    .all()
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
