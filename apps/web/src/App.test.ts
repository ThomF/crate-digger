import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
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

interface StubOptions {
  /** Make POST /api/auth/logout answer with a 500. */
  logoutFails?: boolean
}

/** Stubs the API: GET /api/auth/me answers with `user` (or 401), logout answers 204. */
function stubApi(user: PublicUser | null, options: StubOptions = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/logout')) {
      if (options.logoutFails) {
        return Response.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Could not log out' },
          { status: 500 },
        )
      }
      return new Response(null, { status: 204 })
    }
    if (url.endsWith('/me') && user) return Response.json(user)
    return Response.json(
      { statusCode: 401, error: 'Unauthorized', message: 'Log in' },
      { status: 401 },
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

let wrapper: VueWrapper | null = null
let router: Router

async function mountApp(path = '/') {
  const pinia = createPinia()
  setActivePinia(pinia)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'library', component: Blank },
      { path: '/login', name: 'login', component: Blank },
      { path: '/signup', name: 'signup', component: Blank },
      { path: '/u/:username', name: 'profile', component: Blank },
      { path: '/profile/edit', name: 'profile-edit', component: Blank },
      { path: '/private', name: 'private', component: Blank, meta: { requiresAuth: true } },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const trigger = (w: VueWrapper) => w.get('nav.user-menu button.avatar-btn')
const menu = (w: VueWrapper) => w.find('[role="menu"]')

async function openMenu(w: VueWrapper) {
  await trigger(w).trigger('click')
  return w.get('[role="menu"]')
}

describe('App header account menu', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.unstubAllGlobals()
  })

  it('renders an avatar trigger with menu semantics', async () => {
    stubApi(alice)
    const w = await mountApp()
    const button = trigger(w)
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-haspopup')).toBe('menu')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.attributes('aria-label')).toContain('Alice Cooper')
    expect(menu(w).exists()).toBe(false)
  })

  it('shows initials when there is no avatar', async () => {
    stubApi(alice)
    const w = await mountApp()
    expect(trigger(w).find('img').exists()).toBe(false)
    expect(trigger(w).text()).toBe('AC')
    w.unmount()

    stubApi({ ...alice, displayName: '' })
    const w2 = await mountApp()
    expect(trigger(w2).text()).toBe('AL')
    expect(trigger(w2).attributes('aria-label')).toContain('alice')
  })

  it('shows the avatar image when avatarUrl is set', async () => {
    stubApi({ ...alice, avatarUrl: '/uploads/avatars/alice.png' })
    const w = await mountApp()
    const img = trigger(w).get('img')
    expect(img.attributes('src')).toBe('/uploads/avatars/alice.png')
    expect(trigger(w).text()).toBe('')
  })

  it('opens a menu with header and three items', async () => {
    stubApi(alice)
    const w = await mountApp()
    const panel = await openMenu(w)
    expect(trigger(w).attributes('aria-expanded')).toBe('true')
    expect(trigger(w).attributes('aria-controls')).toBe(panel.attributes('id'))

    const head = panel.get('.menu-head')
    expect(head.text()).toContain('Alice Cooper')
    expect(head.text()).toContain('@alice')
    expect(head.find('[aria-label="Verified"]').exists()).toBe(false)

    const items = panel.findAll('[role="menuitem"]')
    expect(items.map((i) => i.text())).toEqual(['View profile', 'Edit profile', 'Log out'])
    expect(items[0]!.attributes('href')).toBe('/u/alice')
    expect(items[1]!.attributes('href')).toBe('/profile/edit')
    expect(items[2]!.element.tagName).toBe('BUTTON')
    w.unmount()

    stubApi({ ...alice, verified: true })
    const w2 = await mountApp()
    const panel2 = await openMenu(w2)
    expect(panel2.get('.menu-head').find('[aria-label="Verified"]').exists()).toBe(true)
  })

  it('toggles the menu from the trigger', async () => {
    stubApi(alice)
    const w = await mountApp()
    expect(menu(w).exists()).toBe(false)
    await trigger(w).trigger('click')
    expect(menu(w).exists()).toBe(true)
    await trigger(w).trigger('click')
    expect(menu(w).exists()).toBe(false)
    expect(trigger(w).attributes('aria-expanded')).toBe('false')
  })

  it('closes on Escape and refocuses the trigger', async () => {
    stubApi(alice)
    const w = await mountApp()
    const panel = await openMenu(w)
    const item = panel.get('[role="menuitem"]').element as HTMLElement
    item.focus()
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(menu(w).exists()).toBe(false)
    expect(document.activeElement).toBe(trigger(w).element)
  })

  it('closes on outside click', async () => {
    stubApi(alice)
    const w = await mountApp()
    const panel = await openMenu(w)
    await panel.get('.menu-head').trigger('click')
    expect(menu(w).exists()).toBe(true)

    await w.get('.tagline').trigger('click')
    expect(menu(w).exists()).toBe(false)

    await openMenu(w)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(menu(w).exists()).toBe(false)
  })

  it('closes after choosing a link', async () => {
    stubApi(alice)
    const w = await mountApp()
    let panel = await openMenu(w)
    await panel.findAll('[role="menuitem"]')[0]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/u/alice')
    expect(menu(w).exists()).toBe(false)

    panel = await openMenu(w)
    await panel.findAll('[role="menuitem"]')[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('profile-edit')
    expect(menu(w).exists()).toBe(false)
  })

  it('closes on route change', async () => {
    stubApi(alice)
    const w = await mountApp()
    await openMenu(w)
    await router.push('/signup')
    await flushPromises()
    expect(menu(w).exists()).toBe(false)
  })

  it('log out signs out and closes the menu', async () => {
    const fetchMock = stubApi(alice)
    const w = await mountApp()
    const panel = await openMenu(w)
    await panel.findAll('[role="menuitem"]')[2]!.trigger('click')
    await flushPromises()

    const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/logout'))
    expect(call).toBeDefined()
    expect((call as unknown as [string, RequestInit])[1].method).toBe('POST')
    expect(menu(w).exists()).toBe(false)
    expect(w.find('.avatar-btn').exists()).toBe(false)
    const account = w.get('.account')
    expect(account.text()).toContain('Log in')
    expect(account.text()).toContain('Sign up')
    expect(router.currentRoute.value.name).toBe('library')
  })

  it('log out on an auth-required page redirects to the library', async () => {
    stubApi(alice)
    const w = await mountApp('/private')
    expect(router.currentRoute.value.name).toBe('private')
    const panel = await openMenu(w)
    await panel.findAll('[role="menuitem"]')[2]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('library')
  })

  it('log out failure shows an alert', async () => {
    stubApi(alice, { logoutFails: true })
    const w = await mountApp('/private')
    const panel = await openMenu(w)
    await panel.findAll('[role="menuitem"]')[2]!.trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe('Could not log out')
    expect(w.find('.avatar-btn').exists()).toBe(true)
    expect(router.currentRoute.value.name).toBe('private')
  })

  it('shows log in and sign up when signed out', async () => {
    stubApi(null)
    const w = await mountApp()
    const account = w.get('.account')
    const links = account.findAll('a')
    expect(links.map((a) => a.text())).toEqual(['Log in', 'Sign up'])
    expect(links[0]!.attributes('href')).toBe('/login')
    expect(links[1]!.attributes('href')).toBe('/signup')
    expect(w.find('.avatar-btn').exists()).toBe(false)
    expect(menu(w).exists()).toBe(false)
  })

  it('hides the link for the current auth page', async () => {
    stubApi(null)
    const w = await mountApp('/login')
    expect(
      w
        .get('.account')
        .findAll('a')
        .map((a) => a.text()),
    ).toEqual(['Sign up'])
    await router.push('/signup')
    await flushPromises()
    expect(
      w
        .get('.account')
        .findAll('a')
        .map((a) => a.text()),
    ).toEqual(['Log in'])
  })
})
