import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { PublicProfile, PublicUser } from '@frisson/shared'
import { getProfile } from '../api/profiles.ts'
import { useSessionStore } from '../stores/session.ts'
import MyProfileView from './MyProfileView.vue'

vi.mock('../api/profiles.ts', () => ({ getProfile: vi.fn() }))
const getProfileMock = vi.mocked(getProfile)

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice Cooper',
  role: 'user',
  avatarUrl: null,
  verified: false,
}

const profile: PublicProfile = {
  username: 'alice',
  displayName: 'Alice Cooper',
  bio: '',
  location: null,
  avatarUrl: null,
  verified: false,
  links: [],
  crates: [{ id: 1, name: 'Shoegaze', color: '#2f6fa3', label: null, albumCount: 2 }],
  followerCount: 3,
  followingCount: 4,
  viewerFollows: false,
  isDemo: false,
}

const Blank = defineComponent({ render: () => null })

async function mountView(user: PublicUser | null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.user = user
  session.loaded = true
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile', name: 'my-profile', component: Blank },
      { path: '/profile/edit', name: 'profile-edit', component: Blank },
      { path: '/login', name: 'login', component: Blank },
    ],
  })
  await router.push('/profile')
  await router.isReady()
  const wrapper = mount(MyProfileView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, session, router }
}

describe('MyProfileView', () => {
  beforeEach(() => {
    getProfileMock.mockReset()
    getProfileMock.mockResolvedValue(profile)
  })

  it('shows the signed-in user profile with an edit link, and the URL stays /profile', async () => {
    const { wrapper, router } = await mountView(alice)

    expect(getProfileMock).toHaveBeenCalledWith('alice')
    expect(wrapper.get('h1').text()).toContain('Alice Cooper')
    expect(wrapper.get('.handle').text()).toBe('@alice')
    expect(wrapper.get('li.crate .name').text()).toBe('Shoegaze')
    expect(wrapper.get('.follower-count').text()).toBe('3')
    expect(wrapper.get('.following-count').text()).toBe('4')
    const edit = wrapper.findAll('a').find((a) => a.text() === 'Edit profile')
    expect(edit?.attributes('href')).toBe('/profile/edit')
    expect(router.currentRoute.value.fullPath).toBe('/profile')
  })

  it('offers no follow control on your own profile', async () => {
    const { wrapper } = await mountView(alice)
    expect(wrapper.text()).not.toContain('Log in to follow')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('renders nothing and requests nothing when signed out', async () => {
    const { wrapper } = await mountView(null)
    expect(getProfileMock).not.toHaveBeenCalled()
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders nothing, without crashing, after a logout during the visit', async () => {
    const { wrapper, session } = await mountView(alice)
    expect(wrapper.find('article').exists()).toBe(true)
    session.user = null
    await nextTick()
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})
