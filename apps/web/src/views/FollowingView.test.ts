import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { CollectorSummary, CrateCard } from '@frisson/shared'
import { ApiRequestError } from '../api/client.ts'
import {
  follow,
  getFeed,
  listFollowing,
  listSuggestedCollectors,
  unfollow,
} from '../api/follows.ts'
import FollowingView from './FollowingView.vue'
import source from './FollowingView.vue?raw'

vi.mock('../api/follows.ts', () => ({
  follow: vi.fn(),
  unfollow: vi.fn(),
  listFollowing: vi.fn(),
  getFeed: vi.fn(),
  listSuggestedCollectors: vi.fn(),
}))

const followMock = vi.mocked(follow)
const unfollowMock = vi.mocked(unfollow)
const listFollowingMock = vi.mocked(listFollowing)
const getFeedMock = vi.mocked(getFeed)
const suggestedMock = vi.mocked(listSuggestedCollectors)

function collector(username: string, isDemo = true): CollectorSummary {
  return { username, displayName: `${username} name`, avatarUrl: null, verified: false, isDemo }
}

function card(id: number, owner: string, albumCount = 2): CrateCard {
  return {
    id,
    name: `Crate ${id}`,
    color: '#2f6fa3',
    label: null,
    albumCount,
    createdAt: '2026-11-01T00:00:00.000Z',
    ownerUsername: owner,
    ownerDisplayName: `${owner} name`,
  }
}

const failure = (message: string) =>
  new ApiRequestError(500, { statusCode: 500, error: 'Server Error', message })

/** A small stand-in for the server: who is followed decides all three lists. */
function fakeServer(demos: CollectorSummary[], crates: CrateCard[], initial: string[] = []) {
  const followed = new Set(initial)
  followMock.mockImplementation(async (username) => {
    followed.add(username)
  })
  unfollowMock.mockImplementation(async (username) => {
    followed.delete(username)
  })
  listFollowingMock.mockImplementation(async () => demos.filter((d) => followed.has(d.username)))
  getFeedMock.mockImplementation(async () => crates.filter((c) => followed.has(c.ownerUsername)))
  suggestedMock.mockImplementation(async () => demos.filter((d) => !followed.has(d.username)))
}

const Blank = defineComponent({ render: () => null })

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Blank },
      { path: '/u/:username', name: 'profile', component: Blank },
      { path: '/crates/:id', name: 'crate', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(FollowingView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return wrapper
}

function section(wrapper: VueWrapper, name: 'following' | 'feed' | 'suggested') {
  return wrapper.get(`section.${name}`)
}

describe('FollowingView', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sets the title and the three headings', async () => {
    fakeServer([collector('demo-a')], [])
    const wrapper = await mountView()
    expect(document.title).toBe('Following · Frisson')
    expect(wrapper.findAll('h2').map((h) => h.text())).toEqual([
      'Following',
      'Crates from people you follow',
      'Suggested collectors',
    ])
  })

  it('shows a status message in each section while loading', async () => {
    const never = new Promise<never>(() => {})
    listFollowingMock.mockReturnValue(never)
    getFeedMock.mockReturnValue(never)
    suggestedMock.mockReturnValue(never)
    const wrapper = await mountView()
    for (const name of ['following', 'feed', 'suggested'] as const) {
      expect(section(wrapper, name).find('.status-note').exists()).toBe(true)
      expect(section(wrapper, name).find('[role="alert"]').exists()).toBe(false)
    }
    expect(wrapper.findAll('[role="status"]')).toHaveLength(3)
  })

  it('following nobody: empty states plus every demo user with a Follow button', async () => {
    fakeServer([collector('demo-a'), collector('demo-b')], [card(1, 'demo-a')])
    const wrapper = await mountView()

    expect(section(wrapper, 'following').text()).toContain("You aren't following anyone yet.")
    expect(section(wrapper, 'feed').text()).toContain('No crates here yet')

    const rows = section(wrapper, 'suggested').findAll('li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('demo-a name')
    expect(rows[0]!.text()).toContain('Demo')
    expect(rows.map((r) => r.get('button').text())).toEqual(['Follow', 'Follow'])
  })

  it('renders followed collectors with profile links, Demo labels and Unfollow', async () => {
    fakeServer([collector('demo-a'), collector('real-b', false)], [], ['demo-a', 'real-b'])
    const wrapper = await mountView()

    const rows = section(wrapper, 'following').findAll('li')
    expect(rows[0]!.get('a').attributes('href')).toBe('/u/demo-a')
    expect(rows[0]!.text()).toContain('Demo')
    expect(rows[1]!.get('a').attributes('href')).toBe('/u/real-b')
    expect(rows[1]!.text()).not.toContain('Demo')
    expect(rows.map((r) => r.get('button').text())).toEqual(['Unfollow', 'Unfollow'])
  })

  it('renders feed cards with a crate link, owner and record count', async () => {
    fakeServer([collector('demo-a')], [card(7, 'demo-a', 1), card(8, 'demo-a', 5)], ['demo-a'])
    const wrapper = await mountView()

    const rows = section(wrapper, 'feed').findAll('li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('a').attributes('href')).toBe('/crates/7')
    expect(rows[0]!.get('a').text()).toBe('Crate 7')
    expect(rows[0]!.text()).toContain('demo-a name')
    expect(rows[0]!.text()).toContain('@demo-a')
    expect(rows[0]!.text()).toContain('1 record')
    expect(rows[1]!.text()).toContain('5 records')
  })

  it('feed cards show the label and the crate name, both inside the one link', async () => {
    const labelled = { ...card(7, 'demo-a'), name: 'Overpass Breakbeats', label: 'BREAKS' }
    fakeServer([collector('demo-a')], [labelled, card(8, 'demo-a')], ['demo-a'])
    const wrapper = await mountView()

    const [first, second] = section(wrapper, 'feed').findAll('li')
    expect(first!.findAll('a')).toHaveLength(1)
    expect(first!.findAll('button')).toHaveLength(0)
    expect(first!.get('a .crate-label').text()).toBe('BREAKS')
    expect(first!.get('a .crate-name').text()).toBe('Overpass Breakbeats')
    expect(first!.get('a').attributes('aria-label')).toBe('BREAKS: Overpass Breakbeats')
    expect(second!.get('a').attributes('aria-label')).toBe('Crate 8')
    expect(second!.find('.crate-label').exists()).toBe(false)
    expect(second!.get('a .crate-name').text()).toBe('Crate 8')
  })

  it('a click on the crate name in a feed card opens the crate', async () => {
    fakeServer([collector('demo-a')], [card(7, 'demo-a')], ['demo-a'])
    const wrapper = await mountView()
    const router = wrapper.vm.$router

    await section(wrapper, 'feed').get('.crate-name').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/crates/7')
  })

  it('stretches the feed link over the card, with a pointer cursor and a focus ring', () => {
    expect(source).toMatch(/\.crate-card \{\s*position: relative;\s*cursor: pointer;/)
    expect(source).toMatch(
      /\.crate-link::after \{\s*content: '';\s*position: absolute;\s*inset: 0;/,
    )
    expect(source).toMatch(/\.crate-link:focus-visible::after \{\s*outline: 3px solid/)
  })

  it('collector rows are not stretched, so their Follow buttons stay reachable', async () => {
    fakeServer([collector('demo-a')], [], [])
    const wrapper = await mountView()
    expect(section(wrapper, 'suggested').get('li').classes()).not.toContain('crate-card')
  })

  it('hides Suggested collectors once its list is empty', async () => {
    fakeServer([collector('demo-a')], [], ['demo-a'])
    const wrapper = await mountView()
    expect(wrapper.find('section.suggested').exists()).toBe(false)
  })

  it('follow moves the user into Following and their crates into the feed', async () => {
    fakeServer([collector('demo-a'), collector('demo-b')], [card(1, 'demo-a')])
    const wrapper = await mountView()

    await section(wrapper, 'suggested').findAll('li')[0]!.get('button').trigger('click')
    await flushPromises()

    expect(followMock).toHaveBeenCalledWith('demo-a')
    expect(section(wrapper, 'following').text()).toContain('demo-a name')
    expect(section(wrapper, 'following').get('li button').text()).toBe('Unfollow')
    expect(section(wrapper, 'feed').text()).toContain('Crate 1')
    const remaining = section(wrapper, 'suggested').findAll('li')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.text()).toContain('demo-b name')
  })

  it('unfollow removes the user and their crates and suggests them again', async () => {
    fakeServer([collector('demo-a')], [card(1, 'demo-a')], ['demo-a'])
    const wrapper = await mountView()

    await section(wrapper, 'following').get('li button').trigger('click')
    await flushPromises()

    expect(unfollowMock).toHaveBeenCalledWith('demo-a')
    expect(section(wrapper, 'following').find('li').exists()).toBe(false)
    expect(section(wrapper, 'following').text()).toContain("You aren't following anyone yet.")
    expect(section(wrapper, 'feed').find('li').exists()).toBe(false)
    expect(section(wrapper, 'suggested').get('li button').text()).toBe('Follow')
  })

  it('a rejected follow shows an alert and keeps every list and label as they were', async () => {
    fakeServer([collector('demo-a')], [card(1, 'demo-a')])
    const wrapper = await mountView()
    followMock.mockRejectedValueOnce(failure('Could not follow'))
    const requestsBefore = listFollowingMock.mock.calls.length

    await section(wrapper, 'suggested').get('li button').trigger('click')
    await flushPromises()

    const row = section(wrapper, 'suggested').get('li')
    expect(row.get('[role="alert"]').text()).toBe('Could not follow')
    expect(row.get('button').text()).toBe('Follow')
    expect(section(wrapper, 'following').find('li').exists()).toBe(false)
    expect(section(wrapper, 'feed').find('li').exists()).toBe(false)
    expect(listFollowingMock.mock.calls.length).toBe(requestsBefore)
  })

  it('a rejected unfollow keeps the user followed and labelled Unfollow', async () => {
    fakeServer([collector('demo-a')], [card(1, 'demo-a')], ['demo-a'])
    const wrapper = await mountView()
    unfollowMock.mockRejectedValueOnce(failure('Could not unfollow'))

    await section(wrapper, 'following').get('li button').trigger('click')
    await flushPromises()

    const row = section(wrapper, 'following').get('li')
    expect(row.get('[role="alert"]').text()).toBe('Could not unfollow')
    expect(row.get('button').text()).toBe('Unfollow')
    expect(section(wrapper, 'feed').text()).toContain('Crate 1')
  })

  it.each([
    ['following', listFollowingMock],
    ['feed', getFeedMock],
    ['suggested', suggestedMock],
  ] as const)('a %s failure stays in that section and Try again recovers', async (name, mock) => {
    fakeServer([collector('demo-a'), collector('demo-b')], [card(1, 'demo-a')], ['demo-a'])
    mock.mockRejectedValueOnce(failure('That went badly'))
    const wrapper = await mountView()

    const alerts = wrapper.findAll('[role="alert"]')
    expect(alerts).toHaveLength(1)
    const broken = section(wrapper, name)
    expect(broken.get('[role="alert"]').text()).toContain('That went badly')

    if (name !== 'following') expect(section(wrapper, 'following').text()).toContain('demo-a name')
    if (name !== 'feed') expect(section(wrapper, 'feed').text()).toContain('Crate 1')
    if (name !== 'suggested') expect(section(wrapper, 'suggested').text()).toContain('demo-b name')

    const calls = mock.mock.calls.length
    await broken.get('[role="alert"] button').trigger('click')
    await flushPromises()

    expect(mock.mock.calls.length).toBe(calls + 1)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(section(wrapper, name).find('li').exists()).toBe(true)
  })

  it('a failed refresh after a follow shows the alert instead of the stale list', async () => {
    fakeServer([collector('demo-a')], [card(1, 'demo-a')])
    const wrapper = await mountView()
    getFeedMock.mockRejectedValueOnce(failure('Feed is down'))

    await section(wrapper, 'suggested').get('li button').trigger('click')
    await flushPromises()

    expect(section(wrapper, 'feed').get('[role="alert"]').text()).toContain('Feed is down')
    expect(section(wrapper, 'feed').find('li').exists()).toBe(false)
    expect(section(wrapper, 'following').text()).toContain('demo-a name')
  })

  it('renders collector and crate text as plain text, never HTML', async () => {
    const evil = '<img src=x onerror=alert(1)>'
    listFollowingMock.mockResolvedValue([{ ...collector('demo-a'), displayName: evil }])
    getFeedMock.mockResolvedValue([{ ...card(1, 'demo-a'), name: evil, ownerDisplayName: evil }])
    suggestedMock.mockResolvedValue([])
    const wrapper = await mountView()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain(evil)
  })
})
