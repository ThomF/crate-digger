import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PublicProfile, UpdateProfileRequest } from '@frisson/shared'
import { albums } from '../src/db/schema.ts'
import {
  addCrate,
  buildTestApp,
  createAdmin,
  signUp,
  type SignedIn,
  type TestApp,
} from './helpers.ts'

// Public profiles (GET /api/users/:username), self-edit (PATCH /api/me/profile) and the
// admin-only verified flag (PATCH /api/users/:username/verified).

const PUBLIC_KEYS = [
  'avatarUrl',
  'bio',
  'crates',
  'displayName',
  'links',
  'location',
  'username',
  'verified',
]

const FULL: UpdateProfileRequest = {
  displayName: 'Alice A.',
  bio: 'Digging since 1999.',
  location: 'Boise, ID',
  links: [
    { platform: 'instagram', url: 'https://instagram.com/alice' },
    { platform: 'bandcamp', url: 'https://alice.bandcamp.com' },
    { platform: 'website', url: 'https://alice.example' },
  ],
}

let app: TestApp
beforeEach(async () => {
  app = await buildTestApp()
})
afterEach(() => app.close())

const getProfile = (username: string, who?: SignedIn) =>
  app.inject({ url: `/api/users/${username}`, headers: who?.headers })
const patchProfile = (payload: object, who?: SignedIn) =>
  app.inject({ method: 'PATCH', url: '/api/me/profile', payload, headers: who?.headers })
const patchVerified = (username: string, payload: object, who?: SignedIn) =>
  app.inject({
    method: 'PATCH',
    url: `/api/users/${username}/verified`,
    payload,
    headers: who?.headers,
  })
const profileOf = async (username: string) => (await getProfile(username)).json<PublicProfile>()

describe('public profile', () => {
  it('anonymous gets 200 with exactly the public keys, no email and no role', async () => {
    const alice = await signUp(app, { username: 'alice', email: 'alice@example.test' })
    const res = await getProfile('alice')
    expect(res.statusCode).toBe(200)
    const body = res.json<Record<string, unknown>>()
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(res.body).not.toContain(alice.user.email)
    expect(res.body).not.toContain('passwordHash')
    expect(body.role).toBeUndefined()
    expect(body.email).toBeUndefined()
    expect(body.id).toBeUndefined()
  })

  it('lookup is case-insensitive', async () => {
    await signUp(app, { username: 'alice' })
    const res = await getProfile('ALICE')
    expect(res.statusCode).toBe(200)
    expect(res.json<PublicProfile>().username).toBe('alice')
  })

  it('unknown username gives 404', async () => {
    expect((await getProfile('nobody-here')).statusCode).toBe(404)
  })

  it('a user with no profile data has bio "" and links []', async () => {
    await signUp(app, { username: 'alice' })
    const body = await profileOf('alice')
    expect(body.bio).toBe('')
    expect(body.links).toEqual([])
    expect(body.location).toBeNull()
    expect(body.avatarUrl).toBeNull()
    expect(body.verified).toBe(false)
    expect(body.crates).toEqual([])
  })

  it('lists the user’s own crates in shelf order with album counts', async () => {
    const alice = await signUp(app, { username: 'alice' })
    const bob = await signUp(app, { username: 'bob' })
    const second = addCrate(app, 'Second', 2, alice.user.id)
    const first = addCrate(app, 'First', 1, alice.user.id)
    addCrate(app, 'Bob crate', 0, bob.user.id)
    addCrate(app, 'Legacy', 0, null)
    app.db
      .insert(albums)
      .values([
        { crateId: first.id, title: 'A', artist: 'X' },
        { crateId: first.id, title: 'B', artist: 'Y' },
      ])
      .run()
    const { crates } = await profileOf('alice')
    expect(crates.map((c) => [c.name, c.albumCount])).toEqual([
      ['First', 2],
      ['Second', 0],
    ])
    expect(crates[1]?.id).toBe(second.id)
  })
})

describe('update profile', () => {
  it('signed out gives 401 (even with a bad body)', async () => {
    expect((await patchProfile(FULL)).statusCode).toBe(401)
    expect((await patchProfile({ bio: 42 })).statusCode).toBe(401)
  })

  it('round-trips every field and keeps link order', async () => {
    const alice = await signUp(app, { username: 'alice' })
    const res = await patchProfile(FULL, alice)
    expect(res.statusCode).toBe(200)
    const body = res.json<PublicProfile>()
    expect(body.displayName).toBe('Alice A.')
    expect(body.bio).toBe('Digging since 1999.')
    expect(body.location).toBe('Boise, ID')
    expect(body.links).toEqual(FULL.links)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(await profileOf('alice')).toEqual(body)

    const reversed = [...(FULL.links ?? [])].reverse()
    await patchProfile({ ...FULL, links: reversed }, alice)
    expect((await profileOf('alice')).links).toEqual(reversed)
  })

  it('an empty links array clears them', async () => {
    const alice = await signUp(app, { username: 'alice' })
    await patchProfile(FULL, alice)
    const res = await patchProfile({ ...FULL, links: [] }, alice)
    expect(res.statusCode).toBe(200)
    expect((await profileOf('alice')).links).toEqual([])
  })

  const link = (url: string) => ({ platform: 'website', url })
  const bad: [string, object][] = [
    ['7 links', { ...FULL, links: Array.from({ length: 7 }, (_, i) => link(`https://e.x/${i}`)) }],
    ['an http url', { ...FULL, links: [link('http://alice.example')] }],
    ['a javascript: url', { ...FULL, links: [link('javascript:alert(1)')] }],
    ['a bad platform', { ...FULL, links: [{ platform: 'myspace', url: 'https://m.example' }] }],
    ['a 501 character bio', { ...FULL, bio: 'a'.repeat(501) }],
    ['an 81 character location', { ...FULL, location: 'a'.repeat(81) }],
  ]
  for (const [name, payload] of bad) {
    it(`${name} gives 400 and changes nothing`, async () => {
      const alice = await signUp(app, { username: 'alice' })
      await patchProfile(FULL, alice)
      const before = await profileOf('alice')
      const res = await patchProfile({ ...payload, displayName: 'Changed' }, alice)
      expect(res.statusCode).toBe(400)
      expect(await profileOf('alice')).toEqual(before)
    })
  }
})

describe('cannot self', () => {
  const sneaky: [string, object][] = [
    ['verified: true', { verified: true }],
    ["role: 'admin'", { role: 'admin' }],
    ['email', { email: 'new@example.test' }],
    ['username', { username: 'mallory' }],
  ]
  for (const [name, extra] of sneaky) {
    it(`sending ${name} gives 400 and changes nothing`, async () => {
      const alice = await signUp(app, { username: 'alice', email: 'alice@example.test' })
      const before = await profileOf('alice')
      const res = await patchProfile({ ...FULL, ...extra }, alice)
      expect(res.statusCode).toBe(400)
      expect(await profileOf('alice')).toEqual(before)
      expect((await getProfile('mallory')).statusCode).toBe(404)
      const me = await app.inject({ url: '/api/auth/me', headers: alice.headers })
      expect(me.json()).toMatchObject({
        email: 'alice@example.test',
        role: 'user',
        username: 'alice',
        verified: false,
      })
    })
  }

  it('there is no route to edit someone else’s profile by username', async () => {
    await signUp(app, { username: 'alice' })
    const mallory = await signUp(app, { username: 'mallory' })
    const before = await profileOf('alice')
    for (const method of ['PATCH', 'PUT'] as const) {
      const res = await app.inject({
        method,
        url: '/api/users/alice/profile',
        payload: FULL,
        headers: mallory.headers,
      })
      expect(res.statusCode).toBe(404)
      const direct = await app.inject({
        method,
        url: '/api/users/alice',
        payload: FULL,
        headers: mallory.headers,
      })
      expect(direct.statusCode).toBe(404)
    }
    expect(await profileOf('alice')).toEqual(before)
  })
})

describe('verified', () => {
  it('an admin can set and unset it, reflected in GET', async () => {
    const admin = await createAdmin(app)
    await signUp(app, { username: 'alice' })
    const on = await patchVerified('alice', { verified: true }, admin)
    expect(on.statusCode).toBe(200)
    expect(on.json<PublicProfile>().verified).toBe(true)
    expect((await profileOf('alice')).verified).toBe(true)
    const off = await patchVerified('ALICE', { verified: false }, admin)
    expect(off.statusCode).toBe(200)
    expect((await profileOf('alice')).verified).toBe(false)
  })

  it('an admin can verify themselves', async () => {
    const admin = await createAdmin(app, { username: 'boss' })
    expect((await patchVerified('boss', { verified: true }, admin)).statusCode).toBe(200)
    expect((await profileOf('boss')).verified).toBe(true)
  })

  it('signed out gives 401', async () => {
    await signUp(app, { username: 'alice' })
    expect((await patchVerified('alice', { verified: true })).statusCode).toBe(401)
    expect((await profileOf('alice')).verified).toBe(false)
  })

  it('a regular user gets 403, including on their own username', async () => {
    const alice = await signUp(app, { username: 'alice' })
    await signUp(app, { username: 'bob' })
    expect((await patchVerified('alice', { verified: true }, alice)).statusCode).toBe(403)
    expect((await patchVerified('bob', { verified: true }, alice)).statusCode).toBe(403)
    expect((await profileOf('alice')).verified).toBe(false)
    expect((await profileOf('bob')).verified).toBe(false)
  })

  it('unknown user gives 404', async () => {
    const admin = await createAdmin(app)
    expect((await patchVerified('nobody-here', { verified: true }, admin)).statusCode).toBe(404)
  })

  it('a bad body gives 400', async () => {
    const admin = await createAdmin(app)
    await signUp(app, { username: 'alice' })
    for (const payload of [{}, { verified: 'yes' }, { verified: true, role: 'admin' }]) {
      expect((await patchVerified('alice', payload, admin)).statusCode).toBe(400)
    }
    expect((await profileOf('alice')).verified).toBe(false)
  })
})

describe('crate responses: no email', () => {
  it('crate list and crate detail for an owned crate carry no owner email or role', async () => {
    const alice = await signUp(app, { username: 'alice', email: 'alice@example.test' })
    const crate = addCrate(app, 'Owned', 0, alice.user.id)
    const hasKey = (value: unknown, key: string): boolean =>
      Array.isArray(value)
        ? value.some((v) => hasKey(v, key))
        : typeof value === 'object' && value !== null
          ? Object.entries(value).some(([k, v]) => k === key || hasKey(v, key))
          : false

    for (const url of ['/api/crates', `/api/crates/${crate.id}`, '/api/users/alice']) {
      const res = await app.inject({ url })
      expect(res.statusCode).toBe(200)
      const json: unknown = res.json()
      expect(hasKey(json, 'email')).toBe(false)
      expect(hasKey(json, 'role')).toBe(false)
      expect(res.body).not.toContain('alice@example.test')
    }
  })
})
