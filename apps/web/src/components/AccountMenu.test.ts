import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { PublicUser } from '@frisson/shared'
import { useSessionStore } from '../stores/session.ts'
import AccountMenu from './AccountMenu.vue'

vi.mock('../api/auth.ts', () => ({
  me: vi.fn(),
  logIn: vi.fn(),
  signUp: vi.fn(),
  logOut: vi.fn().mockResolvedValue(undefined),
}))

const Blank = defineComponent({ render: () => null })

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
  avatarUrl: null,
  verified: false,
}

async function openMenu(user: PublicUser) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Blank },
      { path: '/admin', name: 'admin', component: Blank, meta: { requiresAuth: true } },
      { path: '/profile/edit', name: 'profile-edit', component: Blank },
      { path: '/u/:username', name: 'profile', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  const pinia = createPinia()
  setActivePinia(pinia)
  useSessionStore().user = user
  const wrapper = mount(AccountMenu, {
    props: { user },
    global: { plugins: [router, pinia] },
  })
  await wrapper.get('button.avatar-btn').trigger('click')
  return { wrapper, router }
}

const items = (wrapper: Awaited<ReturnType<typeof openMenu>>['wrapper']) =>
  wrapper.findAll('[role="menuitem"]')

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an admin the Admin link, before Log out, and it opens /admin and closes', async () => {
    const { wrapper, router } = await openMenu({ ...alice, role: 'admin' })
    const texts = items(wrapper).map((i) => i.text())
    expect(texts).toEqual(['View profile', 'Edit profile', 'Admin', 'Log out'])

    const link = items(wrapper)[2]!
    expect(link.attributes('href')).toBe('/admin')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('admin')
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('shows a role=user no Admin link', async () => {
    const { wrapper } = await openMenu(alice)
    expect(items(wrapper).map((i) => i.text())).toEqual(['View profile', 'Edit profile', 'Log out'])
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(false)
  })

  it('leaves /admin on log out', async () => {
    const { wrapper, router } = await openMenu({ ...alice, role: 'admin' })
    await router.push('/admin')
    await flushPromises()
    await wrapper.get('button.avatar-btn').trigger('click')
    const logOut = items(wrapper).find((i) => i.text() === 'Log out')!
    await logOut.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')
  })
})
