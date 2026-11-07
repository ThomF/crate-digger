import { randomBytes } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { MAX_AVATAR_BYTES, type PublicProfile, type PublicUser } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { users } from '../db/schema.ts'
import { badRequest, notFound } from '../errors.ts'
import { requireUser } from './permissions.ts'
import { getPublicProfile } from './profiles.ts'
import { getUserById } from './users.ts'

// Avatars work exactly like covers: uploads are re-encoded as square JPEGs and stored as
// files in the avatars directory. users.avatar_path only stores the URL path, e.g.
// "/avatars/3-a1b2c3d4.jpg". Data classification: avatars are PUBLIC (shown on profiles);
// the users row they hang off is CONFIDENTIAL, and only the public profile is returned.

export const AVATAR_SIZE = 400 // px, square
export { MAX_AVATAR_BYTES }
export const AVATARS_URL_PREFIX = '/avatars/'

// Same decompression-bomb guard as covers: refuse anything over ~50 megapixels.
const MAX_INPUT_PIXELS = 50_000_000

/** Turns whatever was uploaded into a clean 400×400 JPEG; the uploaded bytes are never kept. */
export async function processAvatar(upload: Buffer): Promise<Buffer> {
  try {
    return await sharp(upload, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // apply the photo's EXIF orientation, so phone pictures aren't sideways
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' }) // crop to square from the center
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  } catch {
    throw badRequest("That file isn't an image we can read. Try a JPEG, PNG or WebP.")
  }
}

/**
 * Deletes an avatar file. `basename` keeps it inside the avatars directory even if the
 * stored path were tampered with. A file that is already gone is fine (force ignores ENOENT).
 */
export async function deleteAvatarFile(avatarsDir: string, avatarPath: string | null) {
  if (!avatarPath) return
  await rm(join(avatarsDir, basename(avatarPath)), { force: true })
}

function currentUser(db: Db, user: PublicUser | null) {
  const signedIn = requireUser(user) // 401 when signed out
  const row = getUserById(db, signedIn.id)
  if (!row) throw notFound('User')
  return row
}

/** The signed-in user sets their own avatar. Returns their public profile. */
export async function setAvatar(
  db: Db,
  avatarsDir: string,
  user: PublicUser | null,
  upload: Buffer,
): Promise<PublicProfile> {
  const me = currentUser(db, user) // before doing any image work
  const image = await processAvatar(upload)

  // A new random name each time, so browsers can cache avatars forever and still see a
  // replaced one immediately (it's a different URL). Never derived from user input.
  const fileName = `${me.id}-${randomBytes(4).toString('hex')}.jpg`
  await writeFile(join(avatarsDir, fileName), image)

  try {
    db.update(users)
      .set({ avatarPath: AVATARS_URL_PREFIX + fileName })
      .where(eq(users.id, me.id))
      .run()
  } catch (err) {
    await deleteAvatarFile(avatarsDir, fileName) // don't leave an orphaned file behind
    throw err
  }

  await deleteAvatarFile(avatarsDir, me.avatarPath)
  return getPublicProfile(db, me.username)
}

/** The signed-in user removes their avatar. A no-op (still 200) when they have none. */
export async function removeAvatar(
  db: Db,
  avatarsDir: string,
  user: PublicUser | null,
): Promise<PublicProfile> {
  const me = currentUser(db, user)
  if (me.avatarPath) {
    db.update(users).set({ avatarPath: null }).where(eq(users.id, me.id)).run()
    await deleteAvatarFile(avatarsDir, me.avatarPath)
  }
  return getPublicProfile(db, me.username)
}
