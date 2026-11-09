import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type { AlbumDetail, AlbumSummary, Crate, PublicUser } from '@frisson/shared'
import { useSessionStore } from '../stores/session.ts'
import AlbumEditorView from './AlbumEditorView.vue'
import AlbumView from './AlbumView.vue'
import CratesView from './CratesView.vue'
import CrateView from './CrateView.vue'
import LibraryView from './LibraryView.vue'

// Which edit controls each view offers, per crate, for the signed-in user.
// Alice owns crates 1 and 3, Bob owns crate 2, crate 4 has no owner (legacy, admin-only).

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
  avatarUrl: null,
  verified: false,
}
const admin: PublicUser = { ...alice, id: 9, username: 'boss', role: 'admin' }

const crate = (id: number, name: string, ownerId: number | null): Crate => ({
  id,
  name,
  color: '#c8a374',
  label: null,
  sortBy: 'manual',
  sortOrder: id,
  albumCount: 1,
  ownerId,
  ownerUsername: null,
  ownerDisplayName: null,
})
const crates = [
  crate(1, 'Alice A', 1),
  crate(2, 'Bob B', 2),
  crate(3, 'Alice C', 1),
  crate(4, 'Legacy', null),
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
  album(10, 1, 'Mine'),
  album(20, 2, 'Bobs'),
  album(30, 3, 'Also mine'),
  album(40, 4, 'Old'),
]
const detail = (summary: AlbumSummary): AlbumDetail => ({
  ...summary,
  notes: null,
  spinCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tracks: [],
})

let fetchMock: ReturnType<typeof vi.fn>

/** Stand-in for the API: answers by method and URL. */
function stubApi() {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url === '/api/crates') return Response.json(crates)
    if (method === 'GET' && url === '/api/albums') return Response.json(albums)
    const one = /^\/api\/albums\/(\d+)$/.exec(url)
    const found = one && albums.find((a) => a.id === Number(one[1]))
    if (method === 'GET' && found) return Response.json(detail(found))
    if (method === 'POST' && /\/spins$/.test(url)) return Response.json({ spinCount: 1 })
    return new Response('{}', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
}

const Blank = defineComponent({ render: () => null })

/** Mounts the app's views behind a router at `path`, signed in as `user`. */
async function visit(path: string, user: PublicUser | null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.user = user
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
      { path: '/crates', name: 'crates', component: CratesView },
      { path: '/login', name: 'login', component: Blank },
      {
        path: '/albums/:id(\\d+)',
        name: 'album',
        component: AlbumView,
        props: (route) => ({ id: Number(route.params.id) }),
      },
      {
        path: '/albums/new',
        name: 'album-new',
        component: AlbumEditorView,
        props: (route) => ({ crateId: Number(route.query.crateId) || null }),
      },
      {
        path: '/albums/:id(\\d+)/edit',
        name: 'album-edit',
        component: AlbumEditorView,
        props: (route) => ({ id: Number(route.params.id) }),
      },
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

/** The list view's section for one crate. */
const section = (wrapper: Awaited<ReturnType<typeof visit>>['wrapper'], name: string) =>
  wrapper.findAll('section.crate').find((s) => s.find('h2').text().startsWith(name))!

describe('per-crate edit controls', () => {
  beforeEach(stubApi)
  afterEach(() => vi.unstubAllGlobals())

  it('list view offers move tools and add links only on crates the user owns', async () => {
    const { wrapper } = await visit('/list', alice)

    for (const name of ['Alice A', 'Alice C']) {
      const s = section(wrapper, name)
      expect(s.find('.tools').exists()).toBe(true)
      expect(s.find('h2 a').text()).toBe('add')
      expect(s.find('li').attributes('draggable')).toBe('true')
    }
    for (const name of ['Bob B', 'Legacy']) {
      const s = section(wrapper, name)
      expect(s.find('.tools').exists()).toBe(false)
      expect(s.find('h2 a').exists()).toBe(false)
      expect(s.find('li').attributes('draggable')).toBe('false')
    }

    // "Move to…" lists only the user's other crates.
    const options = section(wrapper, 'Alice A')
      .findAll('select option')
      .map((o) => o.text())
    expect(options).toEqual(['Move to…', 'Alice C'])

    // Global actions stay available to any signed-in user.
    expect(wrapper.text()).toContain('Edit crates')
    expect(wrapper.text()).toContain('+ Add a record')
  })

  it('list view gives an admin tools on every crate, ownerless ones included', async () => {
    const { wrapper } = await visit('/list', admin)
    expect(wrapper.findAll('section.crate .tools')).toHaveLength(4)
  })

  it('list view shows no edit controls when signed out', async () => {
    const { wrapper } = await visit('/list', null)
    expect(wrapper.find('.tools').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Edit crates')
    expect(wrapper.text()).not.toContain('+ Add a record')
  })

  it('crate view counts a spin only for records in a crate the user can edit', async () => {
    const { wrapper } = await visit('/shelf', alice)
    const spins = () =>
      fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )

    // Crate 1 (Alice's) is selected first; pulling its record out counts a spin.
    await wrapper.find('button.pull').trigger('click')
    await flushPromises()
    expect(spins().map(([url]) => url)).toEqual(['/api/albums/10/spins'])
  })

  it("crate view doesn't count spins for records in someone else's crate", async () => {
    const { wrapper } = await visit('/shelf', alice)
    await wrapper
      .findAll('button.tab')
      .find((b) => b.text() === 'Bob B')!
      .trigger('click')
    await flushPromises()
    await wrapper.find('button.pull').trigger('click')
    await flushPromises()
    const posts = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(posts).toHaveLength(0)
  })

  const addRecord = (wrapper: Awaited<ReturnType<typeof visit>>['wrapper']) =>
    wrapper.findAll('a.btn').find((a) => a.text().includes('+ Add a record'))!
  const postedUrls = () =>
    fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
      .map(([url]) => url)

  it('a crate page counts spins and preselects the crate for the owner', async () => {
    const { wrapper, router } = await visit('/crates/1', alice)
    expect(addRecord(wrapper).attributes('href')).toBe('/albums/new?crateId=1')

    await wrapper.get('button.pull').trigger('click')
    await flushPromises()
    expect(postedUrls()).toEqual(['/api/albums/10/spins'])
    expect(router.currentRoute.value.fullPath).toBe('/albums/10')
  })

  it("a crate page on someone else's crate counts no spin and preselects nothing", async () => {
    const { wrapper, router } = await visit('/crates/2', alice)
    expect(wrapper.find('a[href^="/albums/new"]').exists()).toBe(false)

    await wrapper.get('button.pull').trigger('click')
    await flushPromises()
    expect(postedUrls()).toEqual([])
    expect(router.currentRoute.value.fullPath).toBe('/albums/20') // the pull itself still opened it
  })

  it('album view shows Edit only on records in a crate the user can edit', async () => {
    expect((await visit('/albums/10', alice)).wrapper.find('a.btn').text()).toBe('Edit')
    expect((await visit('/albums/20', alice)).wrapper.find('a.btn').exists()).toBe(false)
    expect((await visit('/albums/40', alice)).wrapper.find('a.btn').exists()).toBe(false)
    expect((await visit('/albums/40', admin)).wrapper.find('a.btn').text()).toBe('Edit')
    expect((await visit('/albums/10', null)).wrapper.find('a.btn').exists()).toBe(false)
  })

  it("crates page lists only the user's own crates, with reordering for admins only", async () => {
    const mine = (await visit('/crates', alice)).wrapper
    expect(mine.findAll('ol.shelf > li').map((li) => li.find('input').element.value)).toEqual([
      'Alice A',
      'Alice C',
    ])
    expect(mine.find('button.order').exists()).toBe(false)

    const boss = (await visit('/crates', admin)).wrapper
    expect(boss.findAll('ol.shelf > li')).toHaveLength(4)
    expect(boss.findAll('button.order')).toHaveLength(8)
  })

  it("album editor offers only the user's crates and redirects away from others' records", async () => {
    const created = await visit('/albums/new?crateId=2', alice)
    const picker = created.wrapper.find('select#crate')
    expect(picker.findAll('option').map((o) => o.text())).toEqual([
      'Pick a crate…',
      'Alice A',
      'Alice C',
    ])
    // Asked for Bob's crate: falls back to the user's first crate.
    expect((picker.element as HTMLSelectElement).value).toBe('1')

    const other = await visit('/albums/20/edit', alice)
    expect(other.router.currentRoute.value.name).toBe('album')
    expect(other.router.currentRoute.value.params.id).toBe('20')

    const own = await visit('/albums/10/edit', alice)
    expect(own.router.currentRoute.value.name).toBe('album-edit')
  })
})
