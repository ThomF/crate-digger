import { randomBytes } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { MAX_COVER_BYTES, type AlbumDetail } from '@crate-digger/shared'
import type { Db } from '../db/client.ts'
import { albums } from '../db/schema.ts'
import { badRequest, notFound } from '../errors.ts'
import { getAlbum } from './albums.ts'

// Cover art: uploaded images are re-encoded as square JPEGs and stored as files in the
// covers directory. The database only stores the URL path, e.g. "/covers/12-a1b2c3d4.jpg".

export const COVER_SIZE = 800 // px, square
export { MAX_COVER_BYTES }
export const COVERS_URL_PREFIX = '/covers/'

// A small file can claim to be an enormous image and eat all memory when decoded
// (a "decompression bomb"). Refuse anything over ~50 megapixels before decoding it.
const MAX_INPUT_PIXELS = 50_000_000

/**
 * Turns whatever was uploaded into a clean 800×800 JPEG. Because we re-encode
 * everything, we never store or serve the uploaded bytes themselves.
 */
export async function processCover(upload: Buffer): Promise<Buffer> {
  try {
    return await sharp(upload, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // apply the photo's EXIF orientation, so phone pictures aren't sideways
      .resize(COVER_SIZE, COVER_SIZE, { fit: 'cover' }) // crop to square from the center
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  } catch {
    throw badRequest("That file isn't an image we can read. Try a JPEG, PNG or WebP.")
  }
}

function currentCoverPath(db: Db, albumId: number) {
  const row = db
    .select({ coverPath: albums.coverPath })
    .from(albums)
    .where(eq(albums.id, albumId))
    .get()
  if (!row) throw notFound(`Album ${albumId}`)
  return row.coverPath
}

/**
 * Deletes a cover file. `basename` keeps it inside the covers directory even if the
 * stored path were tampered with ("/covers/../../crate.db" → "crate.db" in coversDir).
 */
export async function deleteCoverFile(coversDir: string, coverPath: string | null) {
  if (!coverPath) return
  await rm(join(coversDir, basename(coverPath)), { force: true })
}

export async function setCover(
  db: Db,
  coversDir: string,
  albumId: number,
  upload: Buffer,
): Promise<AlbumDetail> {
  const previous = currentCoverPath(db, albumId) // 404 before doing any image work
  const image = await processCover(upload)

  // A new random name each time, so browsers can cache covers forever and still
  // see a replaced cover immediately (it's a different URL).
  const fileName = `${albumId}-${randomBytes(4).toString('hex')}.jpg`
  await writeFile(join(coversDir, fileName), image)

  try {
    db.update(albums)
      .set({ coverPath: COVERS_URL_PREFIX + fileName })
      .where(eq(albums.id, albumId))
      .run()
  } catch (err) {
    await deleteCoverFile(coversDir, fileName) // don't leave an orphaned file behind
    throw err
  }

  await deleteCoverFile(coversDir, previous)
  return getAlbum(db, albumId)
}

export async function removeCover(
  db: Db,
  coversDir: string,
  albumId: number,
): Promise<AlbumDetail> {
  const previous = currentCoverPath(db, albumId)
  db.update(albums).set({ coverPath: null }).where(eq(albums.id, albumId)).run()
  await deleteCoverFile(coversDir, previous)
  return getAlbum(db, albumId)
}
