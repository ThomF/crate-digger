import { describe, expect, it } from 'vitest'
import { initials } from './initials.ts'

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Alice Cooper', 'alice')).toBe('AC')
    expect(initials('mary jane watson', 'mj')).toBe('MJ')
  })

  it('falls back to the username when the display name is empty', () => {
    expect(initials('', 'alice')).toBe('AL')
    expect(initials('   ', 'bob')).toBe('BO')
  })

  it('uses the first two characters of a single word', () => {
    expect(initials('Prince', 'prince')).toBe('PR')
    expect(initials('Q', 'q')).toBe('Q')
  })

  it('ignores extra whitespace between and around words', () => {
    expect(initials('  Alice   Cooper  ', 'alice')).toBe('AC')
  })
})
