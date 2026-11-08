import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Crate, CrateCard } from '@frisson/shared'
import { crate as crateSchema, crateCard } from '@frisson/shared'
import { eq } from 'drizzle-orm'
import { crates, users } from '../src/db/schema.ts'
import { seedDemoContent } from '../src/services/demo-seed.ts'
import { addCrate, buildTestApp, signUp, type TestApp } from './helpers.ts'

// GET /api/crates/recommended: public crate cards, by rank, with no private owner fields.

let app: TestApp
beforeEach(async () => {
  app = await buildTestApp()
})
afterEach(() => app.close())

const getRecommended = () => app.inject({ url: '/api/crates/recommended' })

const setRank = (id: number, recommendedRank: number | null) =>
  app.db.update(crates).set({ recommendedRank }).where(eq(crates.id, id)).run()

/** Every key anywhere in a JSON value. */
function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, inner]) => [key, ...allKeys(inner)])
}

describe('GET /api/crates/recommended', () => {
  it('is an empty array before any seeding, not a 400 from /crates/:id', async () => {
    const res = await getRecommended()

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  describe('with demo content', () => {
    let cards: CrateCard[]
    beforeEach(async () => {
      // The owner's real shelf exists alongside the demo crates.
      addCrate(app, 'Guitars', 0)
      addCrate(app, 'Beats & Bass', 1)
      seedDemoContent(app.db)
      const res = await getRecommended()
      // No cookie was sent: public.
      expect(res.statusCode).toBe(200)
      cards = res.json<CrateCard[]>()
    })

    it('returns at least 6 crates matching the card contract', () => {
      expect(cards.length).toBeGreaterThanOrEqual(6)
      for (const card of cards) expect(crateCard.safeParse(card).success).toBe(true)
    })

    it('gives every crate at least 4 albums and its owner by username and display name', () => {
      for (const card of cards) {
        expect(card.albumCount).toBeGreaterThanOrEqual(4)
        expect(card.ownerUsername.length).toBeGreaterThan(0)
        expect(card.ownerDisplayName.length).toBeGreaterThan(0)
      }
    })

    it("leaves out the owner's existing Guitars and Beats & Bass", () => {
      const names = cards.map((card) => card.name)
      expect(names).not.toContain('Guitars')
      expect(names).not.toContain('Beats & Bass')
    })

    it('exposes no private or internal key at any level', () => {
      const keys = allKeys(cards)
      for (const forbidden of [
        'ownerId',
        'email',
        'role',
        'passwordHash',
        'demoSeedKey',
        'recommendedRank',
      ]) {
        expect(keys).not.toContain(forbidden)
      }
    })

    it('gives createdAt as a full ISO string', () => {
      for (const card of cards) {
        expect(new Date(card.createdAt).toISOString()).toBe(card.createdAt)
      }
    })

    it('keeps the /crates shapes as they were', async () => {
      const listed = (await app.inject({ url: '/api/crates' })).json<Crate[]>()
      expect(listed.length).toBeGreaterThan(cards.length)
      for (const row of listed) expect(crateSchema.safeParse(row).success).toBe(true)
      expect(listed[0]).toHaveProperty('ownerId')
      expect(listed[0]).not.toHaveProperty('createdAt')

      const first = cards[0] as CrateCard
      const one = await app.inject({ url: `/api/crates/${first.id}` })
      expect(one.statusCode).toBe(200)
      expect(one.json<Crate>()).toHaveProperty('ownerId')
      expect(one.json<Crate>()).not.toHaveProperty('createdAt')
    })
  })

  it('orders by rank, then id, and skips unranked crates', async () => {
    const owner = await signUp(app, { username: 'ranker' })
    const third = addCrate(app, 'Third', 0, owner.user.id).id
    const firstOfTie = addCrate(app, 'First of tie', 1, owner.user.id).id
    const unranked = addCrate(app, 'Unranked', 2, owner.user.id).id
    const secondOfTie = addCrate(app, 'Second of tie', 3, owner.user.id).id
    setRank(third, 9)
    setRank(firstOfTie, 2)
    setRank(secondOfTie, 2)

    const cards = (await getRecommended()).json<CrateCard[]>()

    expect(cards.map((card) => card.id)).toEqual([firstOfTie, secondOfTie, third])
    expect(cards.map((card) => card.id)).not.toContain(unranked)
  })

  it('leaves out an ownerless ranked crate, and shows an empty one with albumCount 0', async () => {
    const owner = await signUp(app, { username: 'emptyowner', displayName: 'Empty Owner' })
    const ownerless = addCrate(app, 'Ownerless', 0).id
    const empty = addCrate(app, 'Empty', 1, owner.user.id).id
    setRank(ownerless, 1)
    setRank(empty, 2)

    const cards = (await getRecommended()).json<CrateCard[]>()

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      id: empty,
      albumCount: 0,
      ownerUsername: 'emptyowner',
      ownerDisplayName: 'Empty Owner',
    })
  })

  it('still answers /crates/:id for a numeric id, and 400 for other words', async () => {
    seedDemoContent(app.db)
    const first = app.db.select({ id: crates.id }).from(crates).limit(1).get()

    expect((await app.inject({ url: `/api/crates/${first?.id}` })).statusCode).toBe(200)
    expect((await app.inject({ url: '/api/crates/recommendations' })).statusCode).toBe(400)
  })

  it('reads the owner from the users table, so a renamed owner shows the new name', async () => {
    const owner = await signUp(app, { username: 'renamed', displayName: 'Old Name' })
    const id = addCrate(app, 'Named', 0, owner.user.id).id
    setRank(id, 1)
    app.db.update(users).set({ displayName: 'New Name' }).where(eq(users.id, owner.user.id)).run()

    const cards = (await getRecommended()).json<CrateCard[]>()

    expect(cards[0]?.ownerDisplayName).toBe('New Name')
  })
})
