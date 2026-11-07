import { describe, expect, it } from 'vitest'
import { HttpError } from '../src/errors.ts'
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../src/services/passwords.ts'

describe('password hashing', () => {
  it('hashes with a random salt (same password gives different hashes)', async () => {
    const a = await hashPassword('correct horse battery')
    const b = await hashPassword('correct horse battery')

    expect(a).not.toBe(b)
    expect(a.startsWith('scrypt$')).toBe(true)
    expect(a).not.toContain('correct horse battery')
  })

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery')

    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
    expect(await verifyPassword('correct horse batterz', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('rejects passwords shorter than 8 characters', async () => {
    const attempt = hashPassword('short12')

    await expect(attempt).rejects.toBeInstanceOf(HttpError)
    await expect(attempt).rejects.toMatchObject({ statusCode: 400 })
    await expect(hashPassword('exactly8')).resolves.toMatch(/^scrypt\$/)
  })

  it('returns false for malformed stored hashes', async () => {
    const stored = await hashPassword('correct horse battery')
    const parts = stored.split('$')

    for (const bad of [
      '',
      'not-a-hash',
      'bcrypt$1$2$3$4$5',
      [parts[0], '1000', ...parts.slice(2)].join('$'), // N not a power of two
      [...parts.slice(0, 5), ''].join('$'), // empty key
    ]) {
      expect(await verifyPassword('correct horse battery', bad)).toBe(false)
    }
  })

  it('runs a dummy verify that always fails', async () => {
    expect(await verifyAgainstDummy('anything at all')).toBe(false)
  })
})
