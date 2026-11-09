import { describe, expect, it } from 'vitest'
import type { PublicUser } from '@frisson/shared'
import { canEditCrate, showsCrateActions } from './permissions.ts'

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
  avatarUrl: null,
  verified: false,
}
const bob: PublicUser = { ...alice, id: 2, email: 'bob@example.com', username: 'bob' }
const admin: PublicUser = { ...alice, id: 3, email: 'boss@example.com', role: 'admin' }

describe('canEditCrate', () => {
  it('canEditCrate is false when signed out', () => {
    expect(canEditCrate(null, { ownerId: 1 })).toBe(false)
    expect(canEditCrate(null, { ownerId: null })).toBe(false)
  })

  it('canEditCrate is true for the owner', () => {
    expect(canEditCrate(alice, { ownerId: 1 })).toBe(true)
  })

  it('canEditCrate is false for another user', () => {
    expect(canEditCrate(bob, { ownerId: 1 })).toBe(false)
  })

  it('canEditCrate is true for admin on any crate', () => {
    expect(canEditCrate(admin, { ownerId: 1 })).toBe(true)
    expect(canEditCrate(admin, { ownerId: 2 })).toBe(true)
  })

  it('canEditCrate is true for admin on ownerless crate and false for a user', () => {
    expect(canEditCrate(admin, { ownerId: null })).toBe(true)
    expect(canEditCrate(alice, { ownerId: null })).toBe(false)
    expect(canEditCrate(alice, null)).toBe(false)
  })
})

describe('showsCrateActions', () => {
  it('is false with no user', () => {
    expect(showsCrateActions(null, { ownerId: 1 })).toBe(false)
    expect(showsCrateActions(null, { ownerId: null })).toBe(false)
  })

  it('is false with no crate', () => {
    expect(showsCrateActions(alice, null)).toBe(false)
    expect(showsCrateActions(alice, undefined)).toBe(false)
    expect(showsCrateActions(admin, null)).toBe(false)
    expect(showsCrateActions(admin, undefined)).toBe(false)
  })

  it('is true for the owner', () => {
    expect(showsCrateActions(alice, { ownerId: 1 })).toBe(true)
  })

  it('is false for a non-owner', () => {
    expect(showsCrateActions(bob, { ownerId: 1 })).toBe(false)
  })

  it("is false for an admin on another user's crate, who can still edit it", () => {
    expect(showsCrateActions(admin, { ownerId: 1 })).toBe(false)
    expect(canEditCrate(admin, { ownerId: 1 })).toBe(true)
  })

  it('is true for an admin on their own crate', () => {
    expect(showsCrateActions(admin, { ownerId: admin.id })).toBe(true)
  })

  it('is true for an admin on an ownerless crate', () => {
    expect(showsCrateActions(admin, { ownerId: null })).toBe(true)
  })

  it('is false for a non-admin on an ownerless crate', () => {
    expect(showsCrateActions(alice, { ownerId: null })).toBe(false)
  })
})
