import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ApiError, SessionInfo } from '@crate-digger/shared'
import { buildApp } from '../src/app.ts'
import type { AuthOptions } from '../src/plugins/auth.ts'
import { SESSION_COOKIE } from '../src/plugins/auth.ts'

const apps: Awaited<ReturnType<typeof buildApp>>[] = []

async function appWith(auth: AuthOptions) {
  const coversDir = await mkdtemp(join(tmpdir(), 'crate-digger-auth-'))
  const app = await buildApp({ dbPath: ':memory:', coversDir, auth })
  app.addHook('onClose', () => rm(coversDir, { recursive: true, force: true }))
  apps.push(app)
  return app
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

type App = Awaited<ReturnType<typeof appWith>>
const newCrate = (app: App, cookies?: Record<string, string>) =>
  app.inject({ method: 'POST', url: '/api/crates', payload: { name: 'Jazz' }, cookies })
const logIn = (app: App, password: string) =>
  app.inject({ method: 'POST', url: '/api/session', payload: { password } })

/** The session cookie a login response set, ready to send back. */
function sessionCookie(res: Awaited<ReturnType<typeof logIn>>) {
  const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE)
  return cookie ? { [SESSION_COOKIE]: cookie.value } : undefined
}

describe('open mode (development, no password)', () => {
  it('lets anyone edit, and there is nothing to log in to', async () => {
    const app = await appWith({})

    expect((await newCrate(app)).statusCode).toBe(201)
    expect((await app.inject({ url: '/api/session' })).json<SessionInfo>()).toEqual({
      canEdit: true,
      canLogIn: false,
    })
  })
})

describe('read-only mode (production without a password)', () => {
  it('refuses every change, but still shows the collection', async () => {
    const app = await appWith({ production: true })

    const res = await newCrate(app)

    expect(res.statusCode).toBe(403)
    expect(res.json<ApiError>().message).toBe('This collection is read-only')
    expect((await app.inject({ url: '/api/crates' })).statusCode).toBe(200)
  })
})

describe('admin password', () => {
  it('lets visitors browse but not change anything', async () => {
    const app = await appWith({ adminPassword: 'crate-digger' })

    expect((await app.inject({ url: '/api/albums' })).statusCode).toBe(200)
    expect((await newCrate(app)).statusCode).toBe(401)
    expect((await app.inject({ method: 'DELETE', url: '/api/albums/1/cover' })).statusCode).toBe(
      401,
    )
    expect((await app.inject({ url: '/api/session' })).json<SessionInfo>()).toEqual({
      canEdit: false,
      canLogIn: true,
    })
  })

  it('rejects a wrong password without setting a cookie', async () => {
    const app = await appWith({ adminPassword: 'crate-digger' })

    const res = await logIn(app, 'guess')

    expect(res.statusCode).toBe(401)
    expect(sessionCookie(res)).toBeUndefined()
  })

  it('lets you edit after logging in, with a locked-down cookie', async () => {
    const app = await appWith({ adminPassword: 'crate-digger', production: true })

    const res = await logIn(app, 'crate-digger')
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE)!

    expect(res.json<SessionInfo>()).toEqual({ canEdit: true, canLogIn: true })
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', secure: true, path: '/' })
    expect((await newCrate(app, sessionCookie(res))).statusCode).toBe(201)
  })

  it('does not accept a cookie the visitor wrote themselves', async () => {
    const app = await appWith({ adminPassword: 'crate-digger' })

    const res = await newCrate(app, { [SESSION_COOKIE]: `admin:${Date.now()}` })

    expect(res.statusCode).toBe(401)
  })

  it('treats an empty SESSION_SECRET as unset (Compose passes "" for missing values)', async () => {
    const app = await appWith({ adminPassword: 'crate-digger', sessionSecret: '' })

    const cookie = sessionCookie(await logIn(app, 'crate-digger'))

    expect((await newCrate(app, cookie)).statusCode).toBe(201)
    expect((await app.inject({ url: '/api/session', cookies: cookie })).statusCode).toBe(200)
  })

  it('logs everyone out when the password changes', async () => {
    const before = await appWith({ adminPassword: 'old-password' })
    const cookie = sessionCookie(await logIn(before, 'old-password'))

    const after = await appWith({ adminPassword: 'new-password' })

    expect((await newCrate(after, cookie)).statusCode).toBe(401)
  })

  it('logging out clears the cookie', async () => {
    const app = await appWith({ adminPassword: 'crate-digger' })

    const res = await app.inject({ method: 'DELETE', url: '/api/session' })
    const cleared = res.cookies.find((c) => c.name === SESSION_COOKIE)

    expect(res.json<SessionInfo>()).toEqual({ canEdit: false, canLogIn: true })
    expect(cleared?.value).toBe('')
  })

  it('slows down password guessing', async () => {
    const app = await appWith({ adminPassword: 'crate-digger' })

    const statuses = []
    for (let i = 0; i < 11; i++) statuses.push((await logIn(app, `guess-${i}`)).statusCode)

    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true)
    expect(statuses[10]).toBe(429)
  })
})
