import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type { AlbumSummary, Crate, PublicUser } from '@frisson/shared'
import { useSessionStore } from '../stores/session.ts'
import CrateView from './CrateView.vue'
import LibraryView from './LibraryView.vue'

// Who sees 'Edit crates' and '+ Add a record' on a crate's page, and when.
// Data classification: PUBLIC. Fictional fixtures only, no real user data.

const user: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
  avatarUrl: null,
  verified: false,
}
const admin: PublicUser = { ...user, id: 9, username: 'boss', role: 'admin' }

const crate = (
  id: number,
  name: string,
  ownerId: number | null,
  ownerUsername: string | null,
  albumCount = 1,
): Crate => ({
  id,
  name,
  color: '#c8a374',
  label: null,
  sortBy: 'manual',
  sortOrder: id,
  albumCount,
  ownerId,
  ownerUsername,
  ownerDisplayName: null,
})

const OWN = 1
const OTHERS = 2
const ADMINS = 3
const OWNERLESS = 4
const OTHERS_EMPTY = 5
const OWN_EMPTY = 6

const crates = [
  crate(OWN, 'Alice A', 1, 'alice'),
  crate(OTHERS, 'Bob B', 2, 'bob'),
  crate(ADMINS, 'Boss C', 9, 'boss'),
  crate(OWNERLESS, 'Legacy', null, null),
  crate(OTHERS_EMPTY, 'Bob Empty', 2, 'bob', 0),
  crate(OWN_EMPTY, 'Alice Empty', 1, 'alice', 0),
]

const album = (id: number, crateId: number, title: string): AlbumSummary => ({
  id,
  crateId,
  title,
  artist: 'Someone',
  year: 1991,
  genre: null,
  format: 'LP',
  coverPath: null,
  sleeveColor: '#2f6fa3',
  rating: 0,
  position: 0,
})
const albums = [
  album(10, OWN, 'Mine'),
  album(20, OTHERS, 'Bobs'),
  album(30, ADMINS, 'Boss'),
  album(40, OWNERLESS, 'Old'),
]

const ok = (body: unknown) => Promise.resolve(Response.json(body))
const failure = () => Promise.resolve(new Response('{}', { status: 500 }))
const neverResolves = () => new Promise<Response>(() => {})

let fetchMock: ReturnType<typeof vi.fn>
/** How GET /api/crates and GET /api/albums answer. Tests swap it to stall or fail the load. */
let library: (body: unknown) => Promise<Response>

function stubApi() {
  library = ok
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url === '/api/crates') return library(crates)
    if (method === 'GET' && url === '/api/albums') return library(albums)
    if (method === 'POST' && /^\/api\/albums\/\d+\/spins$/.test(url)) {
      return ok({ spinCount: 1 })
    }
    return failure()
  })
  vi.stubGlobal('fetch', fetchMock)
}

const postedUrls = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([url]) => url)

const Blank = defineComponent({ render: () => null })

/** Mounts the views behind a router at `path`, signed in as `viewer`. */
async function visit(path: string, viewer: PublicUser | null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.user = viewer
  session.loaded = true

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/shelf', name: 'library', component: CrateView },
      {
        path: '/crates/:id(\\d+)',
        name: 'crate',
        component: CrateView,
        props: (route) => ({ crateId: Number(route.params.id) }),
      },
      { path: '/list', name: 'list', component: LibraryView },
      { path: '/crates', name: 'crates', component: Blank },
      { path: '/albums/new', name: 'album-new', component: Blank },
      { path: '/albums/:id(\\d+)', name: 'album', component: Blank },
      { path: '/albums/:id(\\d+)/edit', name: 'album-edit', component: Blank },
      { path: '/u/:username', name: 'profile', component: Blank },
      { path: '/login', name: 'login', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof visit>>['wrapper']

const editCrates = (wrapper: Wrapper) =>
  wrapper.findAll('a').find((a) => a.text() === 'Edit crates')
const addRecord = (wrapper: Wrapper) =>
  wrapper.findAll('a').find((a) => a.text() === '+ Add a record')
const emptyCrateLink = (wrapper: Wrapper) =>
  wrapper
    .get('section.now')
    .findAll('a')
    .find((a) => a.text() === 'Add a record')

function expectNoActions(wrapper: Wrapper) {
  expect(wrapper.text()).not.toContain('Edit crates')
  expect(wrapper.text()).not.toContain('+ Add a record')
  const hrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '')
  expect(hrefs.filter((href) => href.startsWith('/albums/new') || href === '/crates')).toEqual([])
}

function expectActions(wrapper: Wrapper, addHref: string) {
  expect(editCrates(wrapper)?.attributes('href')).toBe('/crates')
  expect(addRecord(wrapper)?.attributes('href')).toBe(addHref)
}

function expectNav(wrapper: Wrapper) {
  const nav = wrapper.get('nav.views')
  expect(nav.findAll('a').map((a) => a.text())).toEqual(['Crates', 'List'])
}

const selectTab = async (wrapper: Wrapper, name: string) => {
  await wrapper
    .findAll('button.tab')
    .find((b) => b.text() === name)!
    .trigger('click')
  await flushPromises()
}

enableAutoUnmount(afterEach)

describe('crate page actions', () => {
  beforeEach(stubApi)
  afterEach(() => vi.unstubAllGlobals())

  it("AC1: a non-admin on another user's crate gets no actions", async () => {
    const { wrapper } = await visit(`/crates/${OTHERS}`, user)
    expect(wrapper.get('h1.crate-name').text()).toBe('Bob B')
    expectNoActions(wrapper)
  })

  it('AC2: a non-admin on their own crate gets both actions, preselecting it', async () => {
    const { wrapper } = await visit(`/crates/${OWN}`, user)
    expectActions(wrapper, `/albums/new?crateId=${OWN}`)
  })

  describe('AC3: an admin on a crate owned by another user', () => {
    it('sees neither action', async () => {
      const { wrapper } = await visit(`/crates/${OTHERS}`, admin)
      expect(wrapper.get('h1.crate-name').text()).toBe('Bob B')
      expectNoActions(wrapper)
    })

    it('gets no Add a record link on an empty crate', async () => {
      const { wrapper } = await visit(`/crates/${OTHERS_EMPTY}`, admin)
      const empty = wrapper.get('section.now')
      expect(empty.text()).toContain('Nothing in here yet.')
      expect(empty.find('a').exists()).toBe(false)
      expectNoActions(wrapper)
    })

    it('still counts a spin when pulling out a record', async () => {
      const { wrapper, router } = await visit(`/crates/${OTHERS}`, admin)
      await wrapper.get('button.pull').trigger('click')
      await flushPromises()
      expect(postedUrls()).toEqual(['/api/albums/20/spins'])
      expect(router.currentRoute.value.fullPath).toBe('/albums/20')
    })
  })

  describe('AC4: admins on their own or ownerless crates', () => {
    it('an admin on their own crate sees both', async () => {
      const { wrapper } = await visit(`/crates/${ADMINS}`, admin)
      expectActions(wrapper, `/albums/new?crateId=${ADMINS}`)
    })

    it('an admin on an ownerless crate sees both', async () => {
      const { wrapper } = await visit(`/crates/${OWNERLESS}`, admin)
      expectActions(wrapper, `/albums/new?crateId=${OWNERLESS}`)
    })

    it('a non-admin on an ownerless crate sees neither', async () => {
      const { wrapper } = await visit(`/crates/${OWNERLESS}`, user)
      expect(wrapper.get('h1.crate-name').text()).toBe('Legacy')
      expectNoActions(wrapper)
    })
  })

  it('AC5: a signed-out visitor sees neither on any crate, and the nav remains', async () => {
    for (const { id } of crates) {
      const { wrapper } = await visit(`/crates/${id}`, null)
      expect(wrapper.find('h1.crate-name').exists()).toBe(true)
      expectNoActions(wrapper)
      expectNav(wrapper)
    }
  })

  describe('AC6: a signed-in non-admin while no crate is confirmed', () => {
    it('sees neither while the crate fetch is pending', async () => {
      library = neverResolves
      const { wrapper } = await visit(`/crates/${OWN}`, user)
      expect(wrapper.text()).toContain('Flipping through the crates')
      expectNoActions(wrapper)
    })

    it('sees neither on the error state after a failed load', async () => {
      library = failure
      const { wrapper } = await visit(`/crates/${OWN}`, user)
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
      expectNoActions(wrapper)
    })

    it("sees neither on 'Crate not found'", async () => {
      const { wrapper } = await visit('/crates/999', user)
      expect(wrapper.text()).toContain('Crate not found')
      expectNoActions(wrapper)
    })

    it('sees neither on their own crate when a failed reload left the store populated', async () => {
      const { wrapper, router } = await visit(`/crates/${OWN}`, user)
      expectActions(wrapper, `/albums/new?crateId=${OWN}`)

      library = failure
      await router.push('/crates/999')
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)

      await router.push(`/crates/${OWN}`)
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
      expectNoActions(wrapper)
    })

    it('sees neither on their own crate during a pending forced reload', async () => {
      const { wrapper, router } = await visit(`/crates/${OWN}`, user)

      library = neverResolves
      await router.push('/crates/999')
      await flushPromises()
      await router.push(`/crates/${OWN}`)
      await flushPromises()
      expect(wrapper.text()).toContain('Flipping through the crates')
      expectNoActions(wrapper)
    })
  })

  it("AC7: moving from one's own crate to another user's and back follows the rule", async () => {
    const { wrapper, router } = await visit(`/crates/${OWN}`, user)
    expectActions(wrapper, `/albums/new?crateId=${OWN}`)

    await router.push(`/crates/${OTHERS}`)
    await flushPromises()
    expect(wrapper.get('h1.crate-name').text()).toBe('Bob B')
    expectNoActions(wrapper)

    await router.push(`/crates/${OWN}`)
    await flushPromises()
    expect(wrapper.get('h1.crate-name').text()).toBe('Alice A')
    expectActions(wrapper, `/albums/new?crateId=${OWN}`)
  })

  describe('AC8: /shelf and /list keep their toolbars', () => {
    it("a non-admin at /shelf with another user's crate selected sees both", async () => {
      const { wrapper } = await visit('/shelf', user)
      await selectTab(wrapper, 'Bob B')
      expect(wrapper.get('button.tab[aria-pressed="true"]').text()).toBe('Bob B')
      expectActions(wrapper, '/albums/new')
    })

    it('a non-admin at /list sees both', async () => {
      const { wrapper } = await visit('/list', user)
      expectActions(wrapper, '/albums/new')
    })

    it("an admin at /shelf on another user's empty crate keeps the empty-crate link", async () => {
      const { wrapper } = await visit('/shelf', admin)
      await selectTab(wrapper, 'Bob Empty')
      expect(wrapper.get('section.now').text()).toContain('Nothing in here yet.')
      expect(emptyCrateLink(wrapper)?.attributes('href')).toBe(
        `/albums/new?crateId=${OTHERS_EMPTY}`,
      )
    })
  })

  it("the empty-crate link stays on the viewer's own empty /crates/:id", async () => {
    const { wrapper } = await visit(`/crates/${OWN_EMPTY}`, user)
    expect(emptyCrateLink(wrapper)?.attributes('href')).toBe(`/albums/new?crateId=${OWN_EMPTY}`)
  })

  it("AC9: browsing controls stay on another user's crate and a pull counts no spin", async () => {
    const { wrapper, router } = await visit(`/crates/${OTHERS}`, user)

    const buttons = wrapper.findAll('.controls button').map((b) => b.text())
    expect(buttons).toEqual(['◀ Back', 'Pull it out', 'Flip ▶'])
    expect(wrapper.get('.owner a').attributes('href')).toBe('/u/bob')
    expectNav(wrapper)

    await wrapper.get('button.pull').trigger('click')
    await flushPromises()
    expect(postedUrls()).toEqual([])
    expect(router.currentRoute.value.fullPath).toBe('/albums/20')
  })
})
