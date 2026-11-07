import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import type { PublicUser, SignupInput } from '@frisson/shared'
import { buildApp, type AppOptions } from '../src/app.ts'
import { crates } from '../src/db/schema.ts'
import { SESSION_COOKIE } from '../src/plugins/auth.ts'
import { createSession } from '../src/services/sessions.ts'
import { createUser } from '../src/services/users.ts'

/** Plenty of signups/logins per test file; rate-limit tests pass their own small limit. */
const GENEROUS_RATE_LIMIT = { max: 10_000, timeWindow: 60_000 }

/**
 * A fresh app on an empty in-memory database, with its own temporary covers and avatars
 * folders (deleted on close unless you passed your own). Call `app.close()` when done.
 * Pass overrides for anything else, e.g. `{ auth: { production: true } }` or a tiny rate limit.
 */
export async function buildTestApp(opts: AppOptions = {}) {
  const coversDir = opts.coversDir ?? (await mkdtemp(join(tmpdir(), 'frisson-covers-')))
  const avatarsDir = opts.avatarsDir ?? (await mkdtemp(join(tmpdir(), 'frisson-avatars-')))
  const app = await buildApp({
    dbPath: ':memory:',
    ...opts,
    coversDir,
    avatarsDir,
    auth: { production: false, rateLimit: GENEROUS_RATE_LIMIT, ...opts.auth },
  })
  if (!opts.coversDir) {
    app.addHook('onClose', async () => rm(coversDir, { recursive: true, force: true }))
  }
  if (!opts.avatarsDir) {
    app.addHook('onClose', async () => rm(avatarsDir, { recursive: true, force: true }))
  }
  return app
}

/** A real image generated on the fly (a solid PNG), for upload tests. */
export function pngBuffer(width = 1200, height = 900, background = '#c0392b') {
  return sharp({ create: { width, height, channels: 3, background } })
    .png()
    .toBuffer()
}

export type TestApp = Awaited<ReturnType<typeof buildTestApp>>

/** A signed-in user: send `headers` (or `cookie`) with app.inject to act as them. */
export type SignedIn = { user: PublicUser; cookie: string; headers: { cookie: string } }

let counter = 0
/** Unique per call, so tests can sign up as many people as they like. */
function uniqueSignup(overrides: Partial<SignupInput> = {}): SignupInput {
  counter += 1
  const tag = `${process.pid}-${counter}`
  return {
    email: `user-${tag}@example.test`,
    username: `user-${tag}`,
    password: 'test-password-123',
    ...overrides,
  }
}

function signedIn(user: PublicUser, token: string): SignedIn {
  const cookie = `${SESSION_COOKIE}=${token}`
  return { user, cookie, headers: { cookie } }
}

/** Signs up through POST /api/auth/signup and returns the new user with their cookie. */
export async function signUp(
  app: TestApp,
  overrides: Partial<SignupInput> = {},
): Promise<SignedIn> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: uniqueSignup(overrides),
  })
  if (res.statusCode !== 201) {
    throw new Error(`signUp failed with ${res.statusCode}: ${res.body}`)
  }
  const token = res.cookies.find((c) => c.name === SESSION_COOKIE)?.value
  if (!token) throw new Error('signUp response did not set a session cookie')
  return signedIn(res.json<PublicUser>(), token)
}

/** An admin, inserted directly (signup can never make one), already signed in. */
export async function createAdmin(
  app: TestApp,
  overrides: Partial<SignupInput> = {},
): Promise<SignedIn> {
  const user = await createUser(
    app.db,
    uniqueSignup({ displayName: 'Admin', ...overrides }),
    'admin',
  )
  const { token } = createSession(app.db, user.id)
  return signedIn(user, token)
}

/** Inserts a crate straight into the db. ownerId null = legacy crate (admin-only). */
export function addCrate(
  app: TestApp,
  name = 'Test crate',
  sortOrder = 0,
  ownerId: number | null = null,
) {
  return app.db.insert(crates).values({ name, sortOrder, ownerId }).returning().get()
}

/**
 * Builds a multipart/form-data body by hand, the same bytes a browser sends for
 * <input type="file">. Each part is separated by a boundary line.
 */
export function multipart(fieldName: string, fileName: string, contentType: string, data: Buffer) {
  const boundary = '----frisson-test-boundary'
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}
