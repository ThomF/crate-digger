import { describe, expect, it } from 'vitest'
import { safeRedirect } from './redirect.ts'

describe('safeRedirect', () => {
  it.each(['/crates', '/albums/7/edit', '/list?q=nirvana'])('keeps in-app path %s', (path) => {
    expect(safeRedirect(path)).toBe(path)
  })

  it.each([
    undefined,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('sends %j home instead', (next) => {
    expect(safeRedirect(next)).toBe('/')
  })
})
