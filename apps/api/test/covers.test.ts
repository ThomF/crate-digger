import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import type { AlbumDetail, ApiError } from '@crate-digger/shared'
import { COVER_SIZE, MAX_COVER_BYTES } from '../src/services/covers.ts'
import { addCrate, buildTestApp, multipart, type TestApp } from './helpers.ts'

/** A real image, generated on the fly: 1200×900 red PNG. */
const pngImage = () =>
  sharp({ create: { width: 1200, height: 900, channels: 3, background: '#c0392b' } })
    .png()
    .toBuffer()

describe('album covers', () => {
  let app: TestApp
  let albumId: number

  beforeEach(async () => {
    app = await buildTestApp()
    const crate = addCrate(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/albums',
      payload: { crateId: crate.id, title: 'Dummy', artist: 'Portishead' },
    })
    albumId = res.json<AlbumDetail>().id
  })
  afterEach(() => app.close())

  async function upload(data: Buffer, { field = 'cover', type = 'image/png', id = albumId } = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/albums/${id}/cover`,
      ...multipart(field, 'cover.png', type, data),
    })
  }

  const coverFiles = () => readdir(app.coversDir)
  const fileFor = (album: AlbumDetail) => join(app.coversDir, basename(album.coverPath!))

  it('stores an uploaded image as an 800×800 JPEG and records its path', async () => {
    const res = await upload(await pngImage())
    const album = res.json<AlbumDetail>()

    expect(res.statusCode).toBe(200)
    expect(album.coverPath).toMatch(new RegExp(`^/covers/${albumId}-[0-9a-f]{8}\\.jpg$`))

    const meta = await sharp(fileFor(album)).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', COVER_SIZE, COVER_SIZE])
  })

  it('serves the stored cover with long-lived caching', async () => {
    const album = (await upload(await pngImage())).json<AlbumDetail>()

    const res = await app.inject({ url: album.coverPath! })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['cache-control']).toContain('immutable')
  })

  it('replaces the old file when a new cover is uploaded', async () => {
    const first = (await upload(await pngImage())).json<AlbumDetail>()
    const second = (await upload(await pngImage())).json<AlbumDetail>()

    expect(second.coverPath).not.toBe(first.coverPath)
    expect(await coverFiles()).toEqual([basename(second.coverPath!)])
  })

  it('removes the cover', async () => {
    const album = (await upload(await pngImage())).json<AlbumDetail>()

    const res = await app.inject({ method: 'DELETE', url: `/api/albums/${albumId}/cover` })

    expect(res.json<AlbumDetail>().coverPath).toBeNull()
    expect(existsSync(fileFor(album))).toBe(false)
  })

  it('deletes the cover file along with the album', async () => {
    await upload(await pngImage())

    await app.inject({ method: 'DELETE', url: `/api/albums/${albumId}` })

    expect(await coverFiles()).toEqual([])
  })

  it('rejects files that are not images, whatever they claim to be', async () => {
    const res = await upload(Buffer.from('definitely not a picture'), { type: 'image/png' })

    expect(res.statusCode).toBe(400)
    expect(res.json<ApiError>().message).toMatch(/isn't an image/)
    expect(await coverFiles()).toEqual([])
  })

  it('rejects uploads over the size limit', async () => {
    const res = await upload(Buffer.alloc(MAX_COVER_BYTES + 1))

    expect(res.statusCode).toBe(413)
  })

  it('needs the file in a field called "cover"', async () => {
    const res = await upload(await pngImage(), { field: 'image' })

    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for an unknown album and keeps no file', async () => {
    const res = await upload(await pngImage(), { id: 999 })

    expect(res.statusCode).toBe(404)
    expect(await coverFiles()).toEqual([])
  })

  it('does not serve files outside the covers folder', async () => {
    const res = await app.inject({ url: '/covers/..%2F..%2Fpackage.json' })

    expect(res.statusCode).toBe(404)
  })
})
