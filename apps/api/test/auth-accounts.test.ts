import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, PublicUser } from '@frisson/shared'
import { sessions, users } from '../src/db/schema.ts'
import { SESSION_COOKIE } from '../src/plugins/auth.ts'
import { SESSION_TTL_MS } from '../src/services/sessions.ts'
import { buildTestApp, signUp, type TestApp } from './helpers.ts'

const apps: TestApp[] = []
async function newApp(opts: Parameters<typeof buildTestApp>[0] = {}) {
  const app = await buildTestApp(opts)
  apps.push(app)
  return app
}
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

const PASSWORD = 'correct horse battery'

const signupReq = (app: TestApp, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/auth/signup', payload })
const loginReq = (app: TestApp, email: string, password: string) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
const meReq = (app: TestApp, cookie?: string) =>
  app.inject({ method: 'GET', url: '/api/auth/me', headers: cookie ? { cookie } : {} })

type Res = Awaited<ReturnType<typeof meReq>>
const sessionCookieOf = (res: Res) => res.cookies.find((c) => c.name === SESSION_COOKIE)
const cookieHeader = (res: Res) => `${SESSION_COOKIE}=${sessionCookieOf(res)?.value}`
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

describe('signup', () => {
  it('signup creates a user, sets a session cookie and returns no passwordHash', async () => {
    const app = await newApp()

    const res = await signupReq(app, {
      email: '  Ada@Example.COM ',
      username: ' Ada_L ',
      password: PASSWORD,
    })

    expect(res.statusCode).toBe(201)
    const body = res.json<PublicUser>()
    expect(body).toEqual({
      id: expect.any(Number),
      email: 'ada@example.com',
      username: 'ada_l',
      displayName: 'ada_l',
      role: 'user',
    })
    expect(res.body).not.toContain('passwordHash')
    expect(res.body).not.toContain('scrypt')
    expect(sessionCookieOf(res)?.value).toBeTruthy()

    const row = app.db.select().from(users).where(eq(users.id, body.id)).get()
    expect(row?.passwordHash.startsWith('scrypt$')).toBe(true)
    expect(row?.passwordHash).not.toContain(PASSWORD)

    // The cookie it set signs you in.
    expect((await meReq(app, cookieHeader(res))).json<PublicUser>().id).toBe(body.id)
  })

  it('signup rejects a password under 8 characters with 400', async () => {
    const app = await newApp()

    const res = await signupReq(app, { email: 'a@example.com', username: 'ada', password: 'short' })

    expect(res.statusCode).toBe(400)
    expect(app.db.select().from(users).all()).toHaveLength(0)
  })

  it('signup rejects duplicate email case-insensitively with 409', async () => {
    const app = await newApp()
    await signUp(app, { email: 'ada@example.com' })

    const res = await signupReq(app, {
      email: 'ADA@Example.com',
      username: 'someone-else',
      password: PASSWORD,
    })

    expect(res.statusCode).toBe(409)
    expect(res.json<ApiError>().message).toBe('Email already registered')
  })

  it('signup rejects duplicate username with 409', async () => {
    const app = await newApp()
    await signUp(app, { username: 'ada' })

    const res = await signupReq(app, {
      email: 'other@example.com',
      username: 'ADA',
      password: PASSWORD,
    })

    expect(res.statusCode).toBe(409)
    expect(res.json<ApiError>().message).toBe('Username taken')
  })

  it('signup rejects a non url-safe username with 400', async () => {
    const app = await newApp()

    for (const username of ['ada lovelace', 'ada/l', 'ädä', 'a?b=c']) {
      const res = await signupReq(app, { email: 'a@example.com', username, password: PASSWORD })
      expect(res.statusCode, username).toBe(400)
    }
    expect(app.db.select().from(users).all()).toHaveLength(0)
  })

  it('signup always creates role user even if role is supplied', async () => {
    const app = await newApp()

    const res = await signupReq(app, {
      email: 'sneaky@example.com',
      username: 'sneaky',
      password: PASSWORD,
      role: 'admin',
    })

    expect(res.statusCode).toBe(201)
    expect(res.json<PublicUser>().role).toBe('user')
    const row = app.db.select().from(users).where(eq(users.username, 'sneaky')).get()
    expect(row?.role).toBe('user')
  })
})

describe('login, me and logout', () => {
  it('login with correct credentials sets session cookie', async () => {
    const app = await newApp()
    const { user } = await signUp(app, { email: 'ada@example.com', password: PASSWORD })

    const res = await loginReq(app, 'ada@example.com', PASSWORD)

    expect(res.statusCode).toBe(200)
    expect(res.json<PublicUser>()).toEqual(user)
    expect(res.body).not.toContain('passwordHash')
    expect(sessionCookieOf(res)?.value).toBeTruthy()
    expect((await meReq(app, cookieHeader(res))).json<PublicUser>()).toEqual(user)
  })

  it('login email is case-insensitive', async () => {
    const app = await newApp()
    const { user } = await signUp(app, { email: 'ada@example.com', password: PASSWORD })

    const res = await loginReq(app, '  ADA@Example.Com', PASSWORD)

    expect(res.statusCode).toBe(200)
    expect(res.json<PublicUser>().id).toBe(user.id)
  })

  it('login failure for unknown email and wrong password return identical status and body (401)', async () => {
    const app = await newApp()
    await signUp(app, { email: 'ada@example.com', password: PASSWORD })

    const unknown = await loginReq(app, 'nobody@example.com', PASSWORD)
    const wrong = await loginReq(app, 'ada@example.com', 'not the password')

    expect(unknown.statusCode).toBe(401)
    expect(wrong.statusCode).toBe(401)
    expect(unknown.body).toBe(wrong.body)
    expect(unknown.json<ApiError>().message).toBe('Email or password is incorrect')
    expect(sessionCookieOf(unknown)).toBeUndefined()
    expect(sessionCookieOf(wrong)).toBeUndefined()
  })

  it('me returns the current user when signed in', async () => {
    const app = await newApp()
    const { user, headers } = await signUp(app, { displayName: 'Ada Lovelace' })

    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers })

    expect(res.statusCode).toBe(200)
    expect(res.json<PublicUser>()).toEqual(user)
    expect(user.displayName).toBe('Ada Lovelace')
  })

  it('me returns 401 without a session', async () => {
    const app = await newApp()

    const none = await meReq(app)
    const bogus = await meReq(app, `${SESSION_COOKIE}=not-a-real-token`)

    expect(none.statusCode).toBe(401)
    expect(none.json<ApiError>().statusCode).toBe(401)
    expect(bogus.statusCode).toBe(401)
  })

  it('logout deletes the session row and the old cookie no longer authenticates', async () => {
    const app = await newApp()
    const { headers, cookie } = await signUp(app)
    const token = cookie.slice(`${SESSION_COOKIE}=`.length)
    expect(
      app.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sha256(token)))
        .get(),
    ).toBeDefined()

    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers })

    expect(res.statusCode).toBe(204)
    const cleared = sessionCookieOf(res)
    expect(cleared?.value).toBe('')
    expect(
      app.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sha256(token)))
        .get(),
    ).toBe(undefined)
    expect((await meReq(app, cookie)).statusCode).toBe(401)

    // Logging out while signed out is fine too.
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout' })).statusCode).toBe(204)
  })

  it('expired session is rejected', async () => {
    const app = await newApp()
    const { cookie } = await signUp(app)
    const id = sha256(cookie.slice(`${SESSION_COOKIE}=`.length))
    app.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, id))
      .run()

    const res = await meReq(app, cookie)

    expect(res.statusCode).toBe(401)
    // The expired row is cleaned up on sight.
    expect(app.db.select().from(sessions).where(eq(sessions.id, id)).get()).toBeUndefined()
  })
})

describe('sessions and cookies', () => {
  it('session table stores a hash, not the cookie token', async () => {
    const app = await newApp()
    const { cookie } = await signUp(app)
    const token = cookie.slice(`${SESSION_COOKIE}=`.length)

    const rows = app.db.select().from(sessions).all()

    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).not.toBe(token)
    expect(rows[0]!.id).toBe(sha256(token))
    expect(rows[0]!.id).toMatch(/^[0-9a-f]{64}$/)
    // 32 random bytes, base64url.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('session expires 30 days after creation', async () => {
    const app = await newApp()
    const before = Date.now()
    const res = await signupReq(app, {
      email: 'a@example.com',
      username: 'ada',
      password: PASSWORD,
    })
    const after = Date.now()

    const row = app.db.select().from(sessions).get()!
    const expires = row.expiresAt.getTime()
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
    // The column has whole-second precision.
    expect(expires).toBeGreaterThanOrEqual(before + SESSION_TTL_MS - 1000)
    expect(expires).toBeLessThanOrEqual(after + SESSION_TTL_MS)

    const cookieExpires = sessionCookieOf(res)?.expires
    expect(cookieExpires?.getTime()).toBe(expires)
  })

  it('cookie is httpOnly with SameSite=Lax', async () => {
    const app = await newApp()

    const res = await signupReq(app, {
      email: 'a@example.com',
      username: 'ada',
      password: PASSWORD,
    })

    const cookie = sessionCookieOf(res)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    expect(cookie?.path).toBe('/')
    const raw = String(res.headers['set-cookie'])
    expect(raw).toMatch(/HttpOnly/i)
    expect(raw).toMatch(/SameSite=Lax/i)
  })

  it('cookie is Secure when NODE_ENV is production and not otherwise', async () => {
    const signupCookie = async (app: TestApp) =>
      sessionCookieOf(
        await signupReq(app, { email: 'a@example.com', username: 'ada', password: PASSWORD }),
      )

    // Not production: no Secure flag, so it works over plain http on localhost.
    vi.stubEnv('NODE_ENV', 'test')
    const dev = await newApp({ auth: { production: undefined } })
    expect((await signupCookie(dev))?.secure).toBeFalsy()

    // production comes from NODE_ENV when not overridden.
    vi.stubEnv('NODE_ENV', 'production')
    const prod = await newApp({ auth: { production: undefined } })
    expect((await signupCookie(prod))?.secure).toBe(true)
    expect(
      String(
        await prod
          .inject({ method: 'POST', url: '/api/auth/logout' })
          .then((r) => r.headers['set-cookie']),
      ),
    ).toMatch(/Secure/i)
  })
})

describe('rate limiting', () => {
  const tinyLimit = { auth: { rateLimit: { max: 3, timeWindow: 60_000 } } }

  it('login is rate limited per IP returning 429 after the limit', async () => {
    const app = await newApp(tinyLimit)
    await signUp(app, { email: 'ada@example.com', password: PASSWORD })

    for (let i = 0; i < 3; i++) {
      expect((await loginReq(app, 'ada@example.com', 'wrong password')).statusCode).toBe(401)
    }
    const limited = await loginReq(app, 'ada@example.com', PASSWORD)

    expect(limited.statusCode).toBe(429)
    expect(limited.json<ApiError>()).toMatchObject({ statusCode: 429, error: 'Too Many Requests' })

    // Another address still gets through.
    const elsewhere = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      remoteAddress: '10.0.0.99',
      payload: { email: 'ada@example.com', password: PASSWORD },
    })
    expect(elsewhere.statusCode).toBe(200)
  })

  it('signup is rate limited per IP returning 429 after the limit', async () => {
    const app = await newApp(tinyLimit)

    for (let i = 0; i < 3; i++) {
      const res = await signupReq(app, {
        email: `u${i}@example.com`,
        username: `user${i}`,
        password: PASSWORD,
      })
      expect(res.statusCode).toBe(201)
    }
    const limited = await signupReq(app, {
      email: 'u9@example.com',
      username: 'user9',
      password: PASSWORD,
    })

    expect(limited.statusCode).toBe(429)
    expect(limited.json<ApiError>()).toMatchObject({ statusCode: 429, error: 'Too Many Requests' })
    expect(app.db.select().from(users).all()).toHaveLength(3)

    const elsewhere = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      remoteAddress: '10.0.0.99',
      payload: { email: 'u9@example.com', username: 'user9', password: PASSWORD },
    })
    expect(elsewhere.statusCode).toBe(201)
  })
})
