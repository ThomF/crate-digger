import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { PublicProfile, PublicUser } from '@frisson/shared'
import { ApiRequestError } from '../api/client.ts'
import { getProfile } from '../api/profiles.ts'
import { useSessionStore } from '../stores/session.ts'
import ProfileView from './ProfileView.vue'

vi.mock('../api/profiles.ts', () => ({ getProfile: vi.fn() }))
const getProfileMock = vi.mocked(getProfile)

const base: PublicProfile = {
  username: 'alice',
  displayName: 'Alice Cooper',
  bio: 'Digging since 1994.\nMostly shoegaze.',
  location: 'Boise, ID',
  avatarUrl: '/api/avatars/alice.webp',
  verified: false,
  links: [
    { platform: 'bandcamp', url: 'https://alice.bandcamp.com' },
    { platform: 'discogs', url: 'https://www.discogs.com/user/alice' },
    { platform: 'website', url: 'https://alice.example.com' },
  ],
  crates: [
    { id: 1, name: 'Shoegaze', color: '#2f6fa3', label: 'SHOE', albumCount: 12 },
    { id: 2, name: 'Jazz', color: '#c8a374', label: null, albumCount: 1 },
  ],
  followerCount: 0,
  followingCount: 0,
  viewerFollows: false,
  isDemo: false,
}

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

async function mountProfile(username = 'alice', user: PublicUser | null = null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.user = user
  session.loaded = true
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Blank },
      { path: '/profile/edit', name: 'profile-edit', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(ProfileView, {
    props: { username },
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return wrapper
}

describe('ProfileView', () => {
  beforeEach(() => getProfileMock.mockReset())

  it('loads the profile for the username prop', async () => {
    getProfileMock.mockResolvedValue(base)
    await mountProfile('alice')
    expect(getProfileMock).toHaveBeenCalledWith('alice')
  })

  it('renders the avatar with the display name as alt text', async () => {
    getProfileMock.mockResolvedValue(base)
    const wrapper = await mountProfile()
    const img = wrapper.get('img.avatar')
    expect(img.attributes('src')).toBe('/api/avatars/alice.webp')
    expect(img.attributes('alt')).toBe('Alice Cooper')
    expect(wrapper.find('.placeholder').exists()).toBe(false)
  })

  it('renders an initials placeholder when there is no avatar', async () => {
    getProfileMock.mockResolvedValue({ ...base, avatarUrl: null })
    const wrapper = await mountProfile()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.placeholder').text()).toBe('AC')
  })

  it('renders display name, handle, bio and location', async () => {
    getProfileMock.mockResolvedValue(base)
    const wrapper = await mountProfile()
    expect(wrapper.get('h1').text()).toContain('Alice Cooper')
    expect(wrapper.get('.handle').text()).toBe('@alice')
    expect(wrapper.get('.bio').text()).toContain('Digging since 1994.')
    expect(wrapper.get('.bio').text()).toContain('Mostly shoegaze.')
    expect(wrapper.get('.location').text()).toBe('Boise, ID')
  })

  it('leaves out location and bio when empty', async () => {
    getProfileMock.mockResolvedValue({ ...base, location: null, bio: '' })
    const wrapper = await mountProfile()
    expect(wrapper.find('.location').exists()).toBe(false)
    expect(wrapper.find('.bio').exists()).toBe(false)
  })

  it('opens every link in a new tab with rel="noopener noreferrer"', async () => {
    getProfileMock.mockResolvedValue(base)
    const wrapper = await mountProfile()
    const links = wrapper.findAll('.links a')
    expect(links).toHaveLength(3)
    for (const a of links) {
      expect(a.attributes('target')).toBe('_blank')
      expect(a.attributes('rel')).toBe('noopener noreferrer')
    }
    // And no link anywhere on the page opens a new tab without them.
    const external = wrapper.findAll('a[target="_blank"]')
    expect(external).toHaveLength(3)
    expect(wrapper.findAll('a[target="_blank"][rel="noopener noreferrer"]')).toHaveLength(3)
    expect(links.map((a) => a.attributes('href'))).toEqual(base.links.map((l) => l.url))
    expect(links.map((a) => a.text())).toEqual(base.links.map((l) => l.url))
    expect(wrapper.findAll('.links .platform').map((p) => p.text())).toEqual([
      'Bandcamp',
      'Discogs',
      'Website',
    ])
  })

  it("renders the user's crates with name, label, swatch and album count", async () => {
    getProfileMock.mockResolvedValue(base)
    const wrapper = await mountProfile()
    const crates = wrapper.findAll('li.crate')
    expect(crates).toHaveLength(2)
    expect(crates[0]!.get('.name').text()).toBe('SHOE')
    expect(crates[0]!.get('.sub').text()).toBe('Shoegaze')
    expect(crates[0]!.get('.count').text()).toBe('12 records')
    expect(crates[0]!.get('.swatch').attributes('style')).toContain('background')
    expect(crates[1]!.get('.name').text()).toBe('Jazz')
    expect(crates[1]!.find('.sub').exists()).toBe(false)
    expect(crates[1]!.get('.count').text()).toBe('1 record')
  })

  it('has no verified badge when verified is false', async () => {
    getProfileMock.mockResolvedValue({ ...base, verified: false })
    const wrapper = await mountProfile()
    expect(wrapper.find('.verified-badge').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Verified"]').exists()).toBe(false)
  })

  it('shows the verified badge when verified is true', async () => {
    getProfileMock.mockResolvedValue({ ...base, verified: true })
    const wrapper = await mountProfile()
    expect(wrapper.get('h1').find('[aria-label="Verified"]').exists()).toBe(true)
  })

  it('shows "Profile not found" for a 404', async () => {
    getProfileMock.mockRejectedValueOnce(
      new ApiRequestError(404, { statusCode: 404, error: 'Not Found', message: 'No such user' }),
    )
    const wrapper = await mountProfile('nobody')
    expect(wrapper.text()).toContain('Profile not found')
    expect(wrapper.find('article').exists()).toBe(false)
  })

  it('shows the error with a retry for other failures', async () => {
    getProfileMock.mockRejectedValueOnce(
      new ApiRequestError(500, { statusCode: 500, error: 'Server Error', message: 'Boom' }),
    )
    const wrapper = await mountProfile()
    expect(wrapper.get('[role="alert"]').text()).toContain('Boom')
    getProfileMock.mockResolvedValue(base)
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.get('h1').text()).toContain('Alice Cooper')
  })

  it('reloads when the username prop changes', async () => {
    getProfileMock.mockResolvedValue(base)
    const wrapper = await mountProfile('alice')
    getProfileMock.mockResolvedValue({ ...base, username: 'bob', displayName: 'Bob' })
    await wrapper.setProps({ username: 'bob' })
    await flushPromises()
    expect(getProfileMock).toHaveBeenLastCalledWith('bob')
    expect(wrapper.get('h1').text()).toContain('Bob')
  })

  it('offers Edit profile only to the owner', async () => {
    getProfileMock.mockResolvedValue(base)
    const visitor = await mountProfile('alice', null)
    expect(visitor.text()).not.toContain('Edit profile')
    const other = await mountProfile('alice', { ...alice, id: 2, username: 'bob' })
    expect(other.text()).not.toContain('Edit profile')
    const owner = await mountProfile('alice', alice)
    const edit = owner.findAll('a').find((a) => a.text() === 'Edit profile')
    expect(edit?.attributes('href')).toBe('/profile/edit')
  })

  it('renders bio and display name as plain text, never HTML', async () => {
    const evil = '<img src=x onerror=alert(1)>'
    getProfileMock.mockResolvedValue({
      ...base,
      displayName: evil,
      bio: evil,
      location: evil,
      avatarUrl: null,
      links: [],
    })
    const wrapper = await mountProfile()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toContain(evil)
    expect(wrapper.get('.bio').text()).toBe(evil)
    expect(wrapper.get('.location').text()).toBe(evil)
  })
})
