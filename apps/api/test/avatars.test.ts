import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import type { ApiError, PublicProfile } from '@frisson/shared'
import { AVATAR_SIZE, MAX_AVATAR_BYTES } from '../src/services/avatars.ts'
import {
  buildTestApp,
  multipart,
  pngBuffer,
  signUp,
  type SignedIn,
  type TestApp,
} from './helpers.ts'

/**
 * A 600×300 JPEG, red on top and blue below, tagged with EXIF orientation 6 ("rotate 90°
 * clockwise to view"). Viewed upright it is 300×600 with blue on the left, red on the right.
 */
async function sidewaysJpeg() {
  const half = (background: string) =>
    sharp({ create: { width: 600, height: 150, channels: 3, background } })
      .png()
      .toBuffer()
  return sharp({ create: { width: 600, height: 300, channels: 3, background: '#000000' } })
    .composite([
      { input: await half('#ff0000'), top: 0, left: 0 },
      { input: await half('#0000ff'), top: 150, left: 0 },
    ])
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer()
}

describe('avatars', () => {
  let app: TestApp
  let me: SignedIn

  beforeEach(async () => {
    app = await buildTestApp()
    me = await signUp(app)
  })
  afterEach(() => app.close())

  async function upload(
    data: Buffer,
    { field = 'avatar', type = 'image/png', headers = me.headers as Record<string, string> } = {},
  ) {
    const body = multipart(field, 'avatar.png', type, data)
    return app.inject({
      method: 'POST',
      url: '/api/me/avatar',
      payload: body.payload,
      headers: { ...body.headers, ...headers },
    })
  }

  const remove = (headers: Record<string, string> = me.headers) =>
    app.inject({ method: 'DELETE', url: '/api/me/avatar', headers })

  const avatarFiles = () => readdir(app.avatarsDir)
  const fileFor = (profile: PublicProfile) => join(app.avatarsDir, basename(profile.avatarUrl!))

  it('stores an uploaded image as a 400×400 JPEG and returns the public profile', async () => {
    const res = await upload(await pngBuffer())
    const profile = res.json<PublicProfile>()

    expect(res.statusCode).toBe(200)
    expect(profile.username).toBe(me.user.username)
    expect(profile).not.toHaveProperty('email')
    expect(profile.avatarUrl).toMatch(new RegExp(`^/avatars/${me.user.id}-[0-9a-f]{8}\\.jpg$`))
    expect(await avatarFiles()).toEqual([basename(profile.avatarUrl!)])

    const meta = await sharp(fileFor(profile)).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', AVATAR_SIZE, AVATAR_SIZE])
  })

  it.each([
    ['PNG', 'image/png', () => pngBuffer()],
    ['JPEG', 'image/jpeg', () => pngBuffer().then((b) => sharp(b).jpeg().toBuffer())],
    ['WebP', 'image/webp', () => pngBuffer().then((b) => sharp(b).webp().toBuffer())],
  ])('accepts %s uploads', async (_name, type, make) => {
    const res = await upload(await make(), { type })

    expect(res.statusCode).toBe(200)
    expect(res.json<PublicProfile>().avatarUrl).toMatch(/^\/avatars\//)
  })

  it('serves the stored avatar as image/jpeg with long-lived caching', async () => {
    const profile = (await upload(await pngBuffer())).json<PublicProfile>()

    const res = await app.inject({ url: profile.avatarUrl! })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['cache-control']).toContain('immutable')
  })

  it('shows the avatar on the public profile', async () => {
    const profile = (await upload(await pngBuffer())).json<PublicProfile>()

    const res = await app.inject({ url: `/api/users/${me.user.username}` })

    expect(res.json<PublicProfile>().avatarUrl).toBe(profile.avatarUrl)
  })

  it('deletes the old file when a new avatar replaces it', async () => {
    const first = (await upload(await pngBuffer())).json<PublicProfile>()
    const second = (await upload(await pngBuffer())).json<PublicProfile>()

    expect(second.avatarUrl).not.toBe(first.avatarUrl)
    expect(await avatarFiles()).toEqual([basename(second.avatarUrl!)])
  })

  it('DELETE clears the avatar and deletes the file', async () => {
    const profile = (await upload(await pngBuffer())).json<PublicProfile>()

    const res = await remove()

    expect(res.statusCode).toBe(200)
    expect(res.json<PublicProfile>().avatarUrl).toBeNull()
    expect(existsSync(fileFor(profile))).toBe(false)
    expect(await avatarFiles()).toEqual([])
  })

  it('DELETE with no avatar is a 200 no-op', async () => {
    const res = await remove()

    expect(res.statusCode).toBe(200)
    expect(res.json<PublicProfile>().avatarUrl).toBeNull()
  })

  it('needs a signed-in user for upload and delete', async () => {
    expect((await upload(await pngBuffer(), { headers: {} })).statusCode).toBe(401)
    expect((await remove({})).statusCode).toBe(401)
    expect(await avatarFiles()).toEqual([])
  })

  it('rejects files that are not images, whatever they claim to be', async () => {
    const res = await upload(Buffer.from('definitely not a picture'), { type: 'image/png' })

    expect(res.statusCode).toBe(400)
    expect(res.json<ApiError>().message).toMatch(/isn't an image/)
    expect(await avatarFiles()).toEqual([])
  })

  it('rejects uploads over MAX_AVATAR_BYTES with 413', async () => {
    const res = await upload(Buffer.alloc(MAX_AVATAR_BYTES + 1))

    expect(res.statusCode).toBe(413)
    expect(await avatarFiles()).toEqual([])
  })

  it('needs the file in a field called "avatar"', async () => {
    const res = await upload(await pngBuffer(), { field: 'cover' })

    expect(res.statusCode).toBe(400)
    expect(await avatarFiles()).toEqual([])
  })

  it('applies EXIF orientation, so sideways phone photos come out upright', async () => {
    const profile = (
      await upload(await sidewaysJpeg(), { type: 'image/jpeg' })
    ).json<PublicProfile>()

    const { data, info } = await sharp(fileFor(profile)).raw().toBuffer({ resolveWithObject: true })
    const pixel = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels
      return { r: data[i]!, b: data[i + 2]! }
    }
    // Upright: blue on the left, red on the right. Ignoring the EXIF tag would give red on top.
    const left = pixel(50, 50)
    const right = pixel(AVATAR_SIZE - 50, 50)
    expect(left.b).toBeGreaterThan(200)
    expect(left.r).toBeLessThan(60)
    expect(right.r).toBeGreaterThan(200)
    expect(right.b).toBeLessThan(60)
    const meta = await sharp(fileFor(profile)).metadata()
    expect(meta.orientation ?? 1).toBe(1)
  })

  it('does not serve files outside the avatars folder', async () => {
    const res = await app.inject({ url: '/avatars/..%2F..%2Fpackage.json' })

    expect(res.statusCode).toBe(404)
  })
})
