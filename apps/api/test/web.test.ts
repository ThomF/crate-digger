import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'

// A stand-in for apps/web/dist: an index.html and one hashed asset.
let webDir: string
let coversDir: string
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  webDir = await mkdtemp(join(tmpdir(), 'crate-digger-web-'))
  coversDir = await mkdtemp(join(tmpdir(), 'crate-digger-covers-'))
  await mkdir(join(webDir, 'assets'))
  await writeFile(join(webDir, 'index.html'), '<!doctype html><div id="app"></div>')
  await writeFile(join(webDir, 'assets', 'index-a1b2c3.js'), 'console.log("crate")')
  app = await buildApp({ dbPath: ':memory:', coversDir, webDir })
})

afterAll(async () => {
  await app.close()
  await Promise.all([webDir, coversDir].map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('serving the web app (production)', () => {
  it('serves index.html at / and never lets browsers cache it', async () => {
    const res = await app.inject({ url: '/' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<div id="app">')
    expect(res.headers['cache-control']).toBe('no-cache')
  })

  it.each(['/albums/7', '/list?q=nirvana', '/crates'])(
    'answers the app URL %s with index.html, for Vue Router',
    async (url) => {
      const res = await app.inject({ url })

      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('<div id="app">')
    },
  )

  it('caches hashed assets for a year', async () => {
    const res = await app.inject({ url: '/assets/index-a1b2c3.js' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('still gives the API and covers real 404s, not the web page', async () => {
    for (const url of ['/api/nope', '/covers/missing.jpg']) {
      const res = await app.inject({ url })
      expect(res.statusCode).toBe(404)
      expect(res.headers['content-type']).toContain('application/json')
    }
  })

  it('only falls back for GET requests', async () => {
    const res = await app.inject({ method: 'POST', url: '/albums/7' })

    expect(res.statusCode).toBe(404)
  })

  it('still serves the API', async () => {
    expect((await app.inject({ url: '/api/health' })).statusCode).toBe(200)
  })
})
