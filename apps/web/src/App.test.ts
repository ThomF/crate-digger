import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { PublicUser } from '@frisson/shared'
import App from './App.vue'

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice Cooper',
  role: 'user',
  avatarUrl: null,
  verified: false,
}

const Blank = defineComponent({ render: () => null })

/** Stubs the API so GET /api/auth/me answers with `user` (or 401 when signed out). */
function stubMe(user: PublicUser | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/me') && user) return Response.json(user)
      return Response.json(
        { statusCode: 401, error: 'Unauthorized', message: 'Log in' },
        { status: 401 },
      )
    }),
  )
}

async function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'library', component: Blank },
      { path: '/login', name: 'login', component: Blank },
      { path: '/signup', name: 'signup', component: Blank },
      { path: '/u/:username', name: 'profile', component: Blank },
      { path: '/profile/edit', name: 'profile-edit', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

const menu = (wrapper: Awaited<ReturnType<typeof mountApp>>) => wrapper.get('nav.user-menu')

describe('App header user menu', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("links the signed-in user's name to their profile and offers Edit profile", async () => {
    stubMe(alice)
    const wrapper = await mountApp()
    const links = menu(wrapper).findAll('a')
    const profile = links.find((a) => a.attributes('href') === '/u/alice')
    expect(profile?.text()).toContain('Alice Cooper')
    const edit = links.find((a) => a.text() === 'Edit profile')
    expect(edit?.attributes('href')).toBe('/profile/edit')
    expect(menu(wrapper).find('button').text()).toBe('Log out')
  })

  it('shows no badge for an unverified user', async () => {
    stubMe(alice)
    const wrapper = await mountApp()
    expect(menu(wrapper).find('[aria-label="Verified"]').exists()).toBe(false)
  })

  it('shows the verified badge next to a verified user', async () => {
    stubMe({ ...alice, verified: true })
    const wrapper = await mountApp()
    const profile = menu(wrapper).get('a.who')
    expect(profile.find('[aria-label="Verified"]').exists()).toBe(true)
  })

  it('falls back to the username when there is no display name', async () => {
    stubMe({ ...alice, displayName: '' })
    const wrapper = await mountApp()
    expect(menu(wrapper).get('a.who').text()).toBe('alice')
  })

  it('shows log in and sign up, and no profile links, when signed out', async () => {
    stubMe(null)
    const wrapper = await mountApp()
    const text = menu(wrapper).text()
    expect(text).toContain('Log in')
    expect(text).toContain('Sign up')
    expect(text).not.toContain('Edit profile')
    expect(menu(wrapper).find('a.who').exists()).toBe(false)
  })
})
