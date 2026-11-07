import { describe, expect, it } from 'vitest'
import type { PublicUser } from '@frisson/shared'
import { canEditCrate } from './permissions.ts'

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
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
