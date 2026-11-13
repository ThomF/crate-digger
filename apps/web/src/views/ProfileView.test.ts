import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { PublicProfile, PublicUser } from '@frisson/shared'
import { ApiRequestError } from '../api/client.ts'
import { follow, unfollow } from '../api/follows.ts'
import { getProfile } from '../api/profiles.ts'
import { useSessionStore } from '../stores/session.ts'
import ProfileView from './ProfileView.vue'
import source from './ProfileView.vue?raw'

vi.mock('../api/profiles.ts', () => ({ getProfile: vi.fn() }))
vi.mock('../api/follows.ts', () => ({ follow: vi.fn(), unfollow: vi.fn() }))
const getProfileMock = vi.mocked(getProfile)
const followMock = vi.mocked(follow)
const unfollowMock = vi.mocked(unfollow)

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
  favorites: [],
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
      { path: '/login', name: 'login', component: Blank },
      { path: '/crates/:id(\\d+)', name: 'crate', component: Blank },
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
  beforeEach(() => {
    getProfileMock.mockReset()
    followMock.mockReset()
    unfollowMock.mockReset()
  })

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

  it('links each crate to its page, naming the crate, with nothing nested in the link', async () => {
    getProfileMock.mockResolvedValue(base)
    const wrapper = await mountProfile()
    const crates = wrapper.findAll('li.crate')
    expect(crates.map((c) => c.findAll('a').length)).toEqual([1, 1])
    expect(crates[0]!.get('a').attributes('href')).toBe('/crates/1')
    expect(crates[0]!.get('a').text()).toContain('Shoegaze')
    expect(crates[0]!.get('a').attributes('aria-label')).toBe('SHOE: Shoegaze')
    expect(crates[1]!.get('a').attributes('aria-label')).toBe('Jazz')
    expect(crates[1]!.get('a').attributes('href')).toBe('/crates/2')
    expect(crates[1]!.get('a').text()).toContain('Jazz')
    expect(wrapper.find('li.crate button').exists()).toBe(false)
  })

  it('a click on a crate name opens that crate', async () => {
    getProfileMock.mockResolvedValue(base)
    const wrapper = await mountProfile()
    const router = wrapper.vm.$router
    await wrapper.findAll('li.crate')[1]!.get('.name').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/crates/2')
  })

  it('stretches the crate link over the row, with a pointer cursor and a focus ring', () => {
    expect(source).toMatch(/\.crate \{\s*position: relative;\s*cursor: pointer;/)
    expect(source).toMatch(
      /\.crate-link::after \{\s*content: '';\s*position: absolute;\s*inset: 0;/,
    )
    expect(source).toMatch(/\.crate-link:focus-visible::after \{\s*outline: 3px solid/)
  })

  describe('favorites', () => {
    const fav = {
      id: 9,
      name: 'Dub',
      color: '#112233',
      label: 'DUBS',
      albumCount: 3,
      ownerUsername: 'bob',
      ownerDisplayName: 'Bob Marley',
    }

    it('puts a Favorites heading in its own section after Crates', async () => {
      getProfileMock.mockResolvedValue({ ...base, favorites: [fav] })
      const wrapper = await mountProfile()
      const headings = wrapper.findAll('h2').map((h) => h.text())
      expect(headings.indexOf('Favorites')).toBeGreaterThan(headings.indexOf('Crates'))
      const crates = wrapper.get('section.crates')
      const favorites = wrapper.get('section.favorites')
      expect(favorites.get('h2').text()).toBe('Favorites')
      expect(crates.element.contains(favorites.element)).toBe(false)
      expect(favorites.element.contains(crates.element)).toBe(false)
      expect(
        crates.element.compareDocumentPosition(favorites.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('links each favorite to its crate and shows the owner as plain text', async () => {
      getProfileMock.mockResolvedValue({ ...base, favorites: [fav] })
      const wrapper = await mountProfile()
      const card = wrapper.get('section.favorites li.crate')
      expect(card.findAll('a')).toHaveLength(1)
      expect(card.get('a').attributes('href')).toBe('/crates/9')
      expect(card.get('a').attributes('aria-label')).toBe('DUBS: Dub')
      expect(card.get('.owner').text()).toBe('by Bob Marley')
      expect(card.get('.owner').element.closest('a')).toBeNull()
      expect(card.get('.count').text()).toBe('3 records')
    })

    it('lists a favorite only under Favorites, not under Crates', async () => {
      getProfileMock.mockResolvedValue({ ...base, favorites: [fav] })
      const wrapper = await mountProfile()
      expect(wrapper.findAll('section.crates li.crate')).toHaveLength(2)
      expect(wrapper.get('section.crates').text()).not.toContain('Dub')
      expect(wrapper.findAll('section.favorites li.crate')).toHaveLength(1)
      expect(wrapper.get('section.favorites').text()).toContain('Dub')
    })

    it('says "No favorites yet." when there are none', async () => {
      getProfileMock.mockResolvedValue(base)
      const wrapper = await mountProfile()
      expect(wrapper.get('section.favorites .status-note').text()).toBe('No favorites yet.')
      expect(wrapper.find('section.favorites li').exists()).toBe(false)
    })

    it('renders an ownerless favorite without an owner line', async () => {
      getProfileMock.mockResolvedValue({
        ...base,
        favorites: [{ ...fav, label: null, ownerUsername: null, ownerDisplayName: null }],
      })
      const wrapper = await mountProfile()
      const card = wrapper.get('section.favorites li.crate')
      expect(card.find('.owner').exists()).toBe(false)
      expect(card.text()).not.toContain('by ')
      expect(card.get('a').attributes('href')).toBe('/crates/9')
    })
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

  describe('follow control and counts', () => {
    const bob: PublicUser = { ...alice, id: 2, username: 'bob', displayName: 'Bob' }

    it('shows both counts with their labels to everyone', async () => {
      getProfileMock.mockResolvedValue({ ...base, followerCount: 5, followingCount: 2 })
      for (const viewer of [null, bob, alice]) {
        const wrapper = await mountProfile('alice', viewer)
        expect(wrapper.get('.counts').text()).toMatch(/^5 followers\s+2 following$/)
      }
    })

    it.each([
      [0, '0 followers'],
      [1, '1 follower'],
      [2, '2 followers'],
    ])('a count of %i reads "%s"', async (followerCount, text) => {
      getProfileMock.mockResolvedValue({ ...base, followerCount, followingCount: 1 })
      const wrapper = await mountProfile()
      expect(wrapper.findAll('.count-item')[0]!.text().replace(/\s+/g, ' ')).toBe(text)
      expect(wrapper.get('.follower-count').text()).toBe(String(followerCount))
      expect(wrapper.findAll('.count-item')[1]!.text().replace(/\s+/g, ' ')).toBe('1 following')
    })

    it('the wording follows the count when a follow takes it from 0 to 1 and back', async () => {
      getProfileMock.mockResolvedValue({ ...base, followerCount: 0 })
      followMock.mockResolvedValue(undefined)
      unfollowMock.mockResolvedValue(undefined)
      const wrapper = await mountProfile('alice', bob)
      const label = () => wrapper.findAll('.count-item')[0]!.text().replace(/\s+/g, ' ')

      await wrapper.get('.follow-control button').trigger('click')
      await flushPromises()
      expect(label()).toBe('1 follower')

      await wrapper.get('.follow-control button').trigger('click')
      await flushPromises()
      expect(label()).toBe('0 followers')
    })

    it('signed-in visitor: the button matches viewerFollows', async () => {
      getProfileMock.mockResolvedValue({ ...base, viewerFollows: false })
      const notFollowing = await mountProfile('alice', bob)
      expect(notFollowing.get('.follow-control button').text()).toBe('Follow')
      expect(notFollowing.text()).not.toContain('Log in to follow')

      getProfileMock.mockResolvedValue({ ...base, viewerFollows: true })
      const isFollowing = await mountProfile('alice', bob)
      expect(isFollowing.get('.follow-control button').text()).toBe('Unfollow')
    })

    it('following adds exactly 1 to the follower count and flips the button', async () => {
      getProfileMock.mockResolvedValue({ ...base, followerCount: 5, followingCount: 2 })
      followMock.mockResolvedValue(undefined)
      const wrapper = await mountProfile('alice', bob)

      await wrapper.get('.follow-control button').trigger('click')
      await flushPromises()

      expect(followMock).toHaveBeenCalledWith('alice')
      expect(wrapper.get('.follower-count').text()).toBe('6')
      expect(wrapper.get('.following-count').text()).toBe('2')
      expect(wrapper.get('.follow-control button').text()).toBe('Unfollow')
      expect(getProfileMock).toHaveBeenCalledTimes(1)
    })

    it('unfollowing takes exactly 1 off the follower count and flips the button', async () => {
      getProfileMock.mockResolvedValue({ ...base, followerCount: 5, viewerFollows: true })
      unfollowMock.mockResolvedValue(undefined)
      const wrapper = await mountProfile('alice', bob)

      await wrapper.get('.follow-control button').trigger('click')
      await flushPromises()

      expect(unfollowMock).toHaveBeenCalledWith('alice')
      expect(wrapper.get('.follower-count').text()).toBe('4')
      expect(wrapper.get('.follow-control button').text()).toBe('Follow')
    })

    it('a rejected follow leaves the count and label alone and shows an alert', async () => {
      getProfileMock.mockResolvedValue({ ...base, followerCount: 5 })
      followMock.mockRejectedValueOnce(
        new ApiRequestError(500, { statusCode: 500, error: 'Server Error', message: 'Nope' }),
      )
      const wrapper = await mountProfile('alice', bob)

      await wrapper.get('.follow-control button').trigger('click')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('Nope')
      expect(wrapper.get('.follower-count').text()).toBe('5')
      expect(wrapper.get('.follow-control button').text()).toBe('Follow')
    })

    it('signed-out visitor: a Log in to follow link back to this profile, no button', async () => {
      getProfileMock.mockResolvedValue(base)
      const wrapper = await mountProfile('alice', null)
      const link = wrapper.get('.login-to-follow')
      expect(link.text()).toBe('Log in to follow')
      expect(decodeURIComponent(link.attributes('href')!)).toBe('/login?next=/u/alice')
      expect(wrapper.find('.follow-control button').exists()).toBe(false)
    })

    it('own profile: no follow control, and the edit link stays', async () => {
      getProfileMock.mockResolvedValue(base)
      const wrapper = await mountProfile('alice', alice)
      expect(wrapper.find('.follow-control').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Log in to follow')
      expect(wrapper.text()).not.toContain('Unfollow')
      expect(wrapper.text()).toContain('Edit profile')
    })

    it('a logout during the visit swaps the button for the login link', async () => {
      getProfileMock.mockResolvedValue({ ...base, viewerFollows: true })
      const wrapper = await mountProfile('alice', bob)
      expect(wrapper.get('.follow-control button').text()).toBe('Unfollow')

      useSessionStore().user = null
      await nextTick()

      expect(wrapper.find('.follow-control button').exists()).toBe(false)
      expect(wrapper.get('.login-to-follow').text()).toBe('Log in to follow')
    })

    it('shows the Demo label beside the name only for demo profiles', async () => {
      getProfileMock.mockResolvedValue({ ...base, isDemo: true })
      const demo = await mountProfile()
      expect(demo.get('h1').get('.demo-tag').text()).toBe('Demo')

      getProfileMock.mockResolvedValue({ ...base, isDemo: false })
      const real = await mountProfile()
      expect(real.find('.demo-tag').exists()).toBe(false)
    })
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
