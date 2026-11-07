import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import type { PublicUser } from '@frisson/shared'
import { crates, users } from '../src/db/schema.ts'
import { SESSION_COOKIE } from '../src/plugins/auth.ts'
import { bootstrapAdmin, bootstrapFromEnv } from '../src/services/bootstrap.ts'
import { verifyPassword } from '../src/services/passwords.ts'
import { addCrate, buildTestApp, createAdmin, signUp, type TestApp } from './helpers.ts'

const apps: TestApp[] = []
async function newApp() {
  const app = await buildTestApp()
  apps.push(app)
  return app
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

const EMAIL = 'Owner@Example.com'
const PASSWORD = 'bootstrap-password-1'
const env = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: PASSWORD }

function quietLog() {
  const warnings: string[] = []
  return { warnings, log: { info: () => {}, warn: (msg: string) => void warnings.push(msg) } }
}

const admins = (app: TestApp) => app.db.select().from(users).where(eq(users.role, 'admin')).all()

describe('bootstrapAdmin', () => {
  it('creates an admin when ADMIN_EMAIL and ADMIN_PASSWORD are set and none exists', async () => {
    const app = await newApp()

    const result = await bootstrapFromEnv(app.db, env)

    expect(result.created).toBe(true)
    const [admin] = admins(app)
    expect(admins(app)).toHaveLength(1)
    expect(admin).toMatchObject({
      email: 'owner@example.com',
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
    })
    expect(result.adminId).toBe(admin!.id)
    expect(await verifyPassword(PASSWORD, admin!.passwordHash)).toBe(true)
  })

  it('uses a free username when admin is taken', async () => {
    const app = await newApp()
    await signUp(app, { username: 'admin' })
    await signUp(app, { username: 'admin-2' })

    await bootstrapFromEnv(app.db, env)

    expect(admins(app)[0]?.username).toBe('admin-3')
  })

  it('does nothing when an admin already exists', async () => {
    const app = await newApp()
    const existing = await createAdmin(app, { password: 'the-original-password' })

    const result = await bootstrapAdmin(app.db, { email: 'new@example.com', password: PASSWORD })

    expect(result.created).toBe(false)
    expect(result.adminId).toBe(existing.user.id)
    expect(admins(app)).toHaveLength(1)
    // Never resets the existing admin's password.
    const row = admins(app)[0]!
    expect(await verifyPassword('the-original-password', row.passwordHash)).toBe(true)
    expect(await verifyPassword(PASSWORD, row.passwordHash)).toBe(false)
    expect(app.db.select().from(users).where(eq(users.email, 'new@example.com')).get()).toBe(
      undefined,
    )
  })

  it('does not create an admin when ADMIN_EMAIL is missing', async () => {
    const app = await newApp()
    const { warnings, log } = quietLog()

    const missing = await bootstrapFromEnv(app.db, { ADMIN_PASSWORD: PASSWORD }, log)
    const empty = await bootstrapFromEnv(app.db, { ADMIN_EMAIL: '', ADMIN_PASSWORD: PASSWORD }, log)
    const noPassword = await bootstrapFromEnv(app.db, { ADMIN_EMAIL: EMAIL }, log)

    for (const result of [missing, empty, noPassword]) {
      expect(result).toEqual({ created: false, adminId: null, assignedCrates: 0 })
    }
    expect(app.db.select().from(users).all()).toHaveLength(0)
    expect(warnings).toHaveLength(3)
    // A crate stays ownerless (admin-only) when there's no admin to give it to.
    const crate = addCrate(app, 'Legacy')
    await bootstrapFromEnv(app.db, {}, log)
    expect(app.db.select().from(crates).where(eq(crates.id, crate.id)).get()?.ownerId).toBeNull()
  })

  it('is idempotent across restarts', async () => {
    const app = await newApp()
    addCrate(app, 'Legacy')

    const first = await bootstrapFromEnv(app.db, env)
    const second = await bootstrapFromEnv(app.db, env)
    const third = await bootstrapFromEnv(app.db, { ...env, ADMIN_PASSWORD: 'a-different-one' })

    expect(first).toMatchObject({ created: true, assignedCrates: 1 })
    expect(second).toEqual({ created: false, adminId: first.adminId, assignedCrates: 0 })
    expect(third).toEqual(second)
    expect(app.db.select().from(users).all()).toHaveLength(1)
    expect(await verifyPassword(PASSWORD, admins(app)[0]!.passwordHash)).toBe(true)
  })

  it('assigns ownerless crates to the bootstrap admin', async () => {
    const app = await newApp()
    const someone = await signUp(app)
    const legacyA = addCrate(app, 'Legacy A', 0)
    const legacyB = addCrate(app, 'Legacy B', 1)
    const owned = addCrate(app, 'Owned', 2, someone.user.id)

    const result = await bootstrapFromEnv(app.db, env)

    expect(result.assignedCrates).toBe(2)
    const owners = new Map(
      app.db
        .select({ id: crates.id, ownerId: crates.ownerId })
        .from(crates)
        .all()
        .map((c) => [c.id, c.ownerId]),
    )
    expect(owners.get(legacyA.id)).toBe(result.adminId)
    expect(owners.get(legacyB.id)).toBe(result.adminId)
    expect(owners.get(owned.id)).toBe(someone.user.id)

    // Crates that lose their owner later are picked up on the next start.
    const later = addCrate(app, 'Later')
    expect((await bootstrapFromEnv(app.db, env)).assignedCrates).toBe(1)
    expect(app.db.select().from(crates).where(eq(crates.id, later.id)).get()?.ownerId).toBe(
      result.adminId,
    )
  })

  it('bootstrap admin can log in with ADMIN_PASSWORD', async () => {
    const app = await newApp()
    await bootstrapAdmin(app.db, { email: EMAIL, password: PASSWORD })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: EMAIL, password: PASSWORD },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json<PublicUser>()).toMatchObject({ role: 'admin', username: 'admin' })
    expect(res.cookies.find((c) => c.name === SESSION_COOKIE)?.value).toBeTruthy()
  })
})
