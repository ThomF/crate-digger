import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PublicUser } from '@frisson/shared'
import * as api from './api/auth.ts'
import { router } from './router.ts'

vi.mock('./api/auth.ts', () => ({
  me: vi.fn(),
  logIn: vi.fn(),
  signUp: vi.fn(),
  logOut: vi.fn(),
}))

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
  avatarUrl: null,
  verified: false,
}

describe('router profile routes', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    // Start each test from a neutral page so navigations are real changes.
    vi.mocked(api.me).mockResolvedValue(null)
    await router.push('/list')
  })

  it('sends a signed-out visitor from /profile/edit to login with next', async () => {
    await router.push('/profile/edit')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.next).toBe('/profile/edit')
  })

  it('lets a signed-in visitor open /profile/edit', async () => {
    setActivePinia(createPinia())
    vi.mocked(api.me).mockResolvedValue(alice)
    await router.push('/profile/edit')
    expect(router.currentRoute.value.name).toBe('profile-edit')
  })

  it('opens /u/someone without signing in and passes the username prop', async () => {
    await router.push('/u/someone')
    const route = router.currentRoute.value
    expect(route.name).toBe('profile')
    expect(route.fullPath).toBe('/u/someone')
    expect(route.meta.requiresAuth).toBeUndefined()
    const props = route.matched[0]?.props.default
    expect(typeof props === 'function' ? props(route) : props).toEqual({ username: 'someone' })
  })

  it.each(['/following', '/profile', '/crates'])(
    'sends a signed-out visitor from %s to login with next',
    async (path) => {
      await router.push(path)
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.next).toBe(path)
    },
  )

  it.each([
    ['/following', 'following'],
    ['/profile', 'my-profile'],
    ['/crates', 'crates'],
  ])('lets a signed-in visitor open %s', async (path, name) => {
    setActivePinia(createPinia())
    vi.mocked(api.me).mockResolvedValue(alice)
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(name)
    expect(router.currentRoute.value.fullPath).toBe(path)
  })

  it.each([
    ['/', 'home'],
    ['/about', 'about'],
    ['/shelf', 'library'],
    ['/crates/5', 'crate'],
  ])('opens %s signed out', async (path, name) => {
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(name)
    expect(router.currentRoute.value.fullPath).toBe(path)
  })

  it('passes the crate id as a number', async () => {
    await router.push('/crates/5')
    const route = router.currentRoute.value
    const props = route.matched[0]?.props.default
    expect(typeof props === 'function' ? props(route) : props).toEqual({ crateId: 5 })
  })

  it('treats a non-numeric crate id as not found', async () => {
    await router.push('/crates/abc')
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('stays where it is between the crate browser URLs and scrolls up otherwise', () => {
    const scroll = router.options.scrollBehavior!
    const at = (path: string) => router.resolve(path)
    const run = (to: string, from: string) =>
      scroll.call(router, at(to) as never, at(from) as never, null)
    expect(run('/crates/5', '/shelf')).toBe(false)
    expect(run('/crates/6', '/crates/5')).toBe(false)
    expect(run('/shelf', '/crates/5')).toBe(false)
    expect(run('/crates/5', '/')).toEqual({ top: 0 })
    expect(run('/about', '/shelf')).toEqual({ top: 0 })
  })
})
