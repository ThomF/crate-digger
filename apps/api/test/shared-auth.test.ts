import { describe, expect, it } from 'vitest'
import { credentialsInput, publicUser, signupInput } from '@frisson/shared'

const valid = {
  email: 'dj@example.com',
  username: 'crate_digger',
  password: 'long enough',
}

describe('shared auth schemas', () => {
  it('signupInput rejects short passwords', () => {
    const result = signupInput.safeParse({ ...valid, password: 'short12' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('At least 8 characters')
    expect(signupInput.safeParse({ ...valid, password: 'exactly8' }).success).toBe(true)
  })

  it('signupInput trims and lower-cases email and username', () => {
    const parsed = signupInput.parse({
      ...valid,
      email: '  DJ@Example.COM ',
      username: ' Crate_Digger ',
    })

    expect(parsed.email).toBe('dj@example.com')
    expect(parsed.username).toBe('crate_digger')
    expect(parsed.displayName).toBeUndefined()
  })

  it('signupInput strips unknown keys such as role', () => {
    const parsed = signupInput.parse({ ...valid, role: 'admin', id: 1 })

    expect(parsed).not.toHaveProperty('role')
    expect(parsed).not.toHaveProperty('id')
  })

  it('signupInput validates username and display name', () => {
    for (const username of ['ab', 'a'.repeat(33), 'has space', 'bad!chars']) {
      expect(signupInput.safeParse({ ...valid, username }).success).toBe(false)
    }
    expect(signupInput.safeParse({ ...valid, displayName: '   ' }).success).toBe(false)
    expect(signupInput.safeParse({ ...valid, displayName: 'x'.repeat(61) }).success).toBe(false)
    expect(signupInput.parse({ ...valid, displayName: ' DJ Shadow ' }).displayName).toBe(
      'DJ Shadow',
    )
    expect(signupInput.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
    expect(signupInput.safeParse({ ...valid, password: 'x'.repeat(201) }).success).toBe(false)
  })

  it('credentialsInput normalises email and requires a password', () => {
    expect(credentialsInput.parse({ email: ' DJ@Example.com', password: 'x' }).email).toBe(
      'dj@example.com',
    )
    expect(credentialsInput.safeParse({ email: 'dj@example.com', password: '' }).success).toBe(
      false,
    )
  })

  it('publicUser carries no password field', () => {
    const parsed = publicUser.parse({
      id: 1,
      email: 'dj@example.com',
      username: 'dj',
      displayName: 'DJ',
      role: 'user',
      passwordHash: 'scrypt$secret',
      password: 'secret',
    })

    expect(Object.keys(parsed).sort()).toEqual(['displayName', 'email', 'id', 'role', 'username'])
  })
})
