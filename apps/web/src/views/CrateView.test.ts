import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type { AlbumSummary, Crate } from '@frisson/shared'
import { useLibraryStore } from '../stores/library.ts'
import CrateView from './CrateView.vue'

const crate = (id: number, name: string): Crate => ({
  id,
  name,
  color: '#c8a374',
  label: null,
  sortBy: 'manual',
  sortOrder: id,
  albumCount: 1,
  ownerId: null,
  ownerUsername: null,
  ownerDisplayName: null,
})
const crates = [crate(1, 'Guitars'), crate(2, 'Beats & Bass'), crate(3, 'Dub')]

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
const albums = [album(10, 1, 'Riffs'), album(20, 2, 'Breaks'), album(30, 3, 'Echoes')]

const Blank = defineComponent({ render: () => null })

async function visit(
  path: string,
  options: { crateList?: Crate[]; albumList?: AlbumSummary[] } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/crates') return Response.json(options.crateList ?? crates)
      if (url === '/api/albums') return Response.json(options.albumList ?? albums)
      return new Response('{}', { status: 500 })
    }),
  )
  const pinia = createPinia()
  setActivePinia(pinia)
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
      { path: '/list', name: 'list', component: Blank },
      { path: '/crates', name: 'crates', component: Blank },
      { path: '/albums/new', name: 'album-new', component: Blank },
      { path: '/albums/:id(\\d+)', name: 'album', component: Blank },
      { path: '/u/:username', name: 'profile', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return { wrapper, router, library: useLibraryStore() }
}

type Wrapper = Awaited<ReturnType<typeof visit>>['wrapper']
const pressedTab = (w: Wrapper) => w.get('button.tab[aria-pressed="true"]').text()
const tab = (w: Wrapper, label: string) => w.findAll('button.tab').find((b) => b.text() === label)!
const heading = (w: Wrapper) => w.get('h1').text()
const control = (w: Wrapper, label: string) =>
  w.findAll('.controls button').find((b) => b.text() === label)!

describe('crate browser', () => {
  beforeEach(() => {
    document.title = 'something else'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sets the page title', async () => {
    await visit('/shelf')
    expect(document.title).toBe('Crates · Frisson')
  })

  it('a deep link selects that crate and shows its albums', async () => {
    const { wrapper, library } = await visit('/crates/2')
    expect(heading(wrapper)).toBe('Beats & Bass')
    expect(wrapper.get('.now h2').text()).toBe('Breaks')
    expect(library.selectedCrate?.id).toBe(2)
  })

  it('a missing id shows Crate not found, not a different crate', async () => {
    const { wrapper } = await visit('/crates/999999')
    expect(wrapper.get('.status-note').text()).toContain('Crate not found')
    expect(wrapper.find('button.tab').exists()).toBe(false)
    expect(wrapper.find('.now').exists()).toBe(false)
    expect(wrapper.get('.status-note a').attributes('href')).toBe('/shelf')
  })

  it('a deep link into an empty library shows Crate not found too', async () => {
    const { wrapper } = await visit('/crates/1', { crateList: [] })
    expect(wrapper.get('.status-note').text()).toContain('Crate not found')
  })

  describe('a crate the loaded store does not know', () => {
    const crateFetches = () =>
      vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/crates').length

    it('reloads once and then shows the crate', async () => {
      const options = { crateList: crates }
      const { wrapper, router } = await visit('/crates/1', options)
      expect(crateFetches()).toBe(1)

      options.crateList = [...crates, crate(9, 'Brand New')]
      await router.push('/crates/9')
      await flushPromises()

      expect(crateFetches()).toBe(2)
      expect(wrapper.text()).not.toContain('Crate not found')
      expect(heading(wrapper)).toBe('Brand New')
    })

    it('shows the loading note, not Crate not found, during the reload', async () => {
      const { wrapper, router } = await visit('/crates/1')
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => {})),
      )
      await router.push('/crates/9')
      await nextTick()
      expect(wrapper.text()).not.toContain('Crate not found')
      expect(wrapper.get('.status-note').text()).toContain('Flipping through the crates')
    })

    it('ends at Crate not found after exactly one reload, with no loop', async () => {
      const { wrapper, router } = await visit('/crates/1')
      await router.push('/crates/999999')
      await flushPromises()
      await flushPromises()
      expect(crateFetches()).toBe(2)
      expect(wrapper.get('.status-note').text()).toContain('Crate not found')
    })

    it('does not reload on a first load, which is already fresh', async () => {
      const { wrapper } = await visit('/crates/999999')
      await flushPromises()
      expect(crateFetches()).toBe(1)
      expect(wrapper.get('.status-note').text()).toContain('Crate not found')
    })

    it('gives a missing crate another reload on each new visit', async () => {
      const { router } = await visit('/crates/1')
      await router.push('/crates/999999')
      await flushPromises()
      await router.push('/crates/1')
      await flushPromises()
      expect(crateFetches()).toBe(2)
      await router.push('/crates/999999')
      await flushPromises()
      expect(crateFetches()).toBe(3)
    })

    it('does not reload for a crate it already knows', async () => {
      const { router } = await visit('/crates/1')
      await router.push('/crates/2')
      await router.push('/shelf')
      await flushPromises()
      expect(crateFetches()).toBe(1)
    })

    it('shows the error with Try again when the reload fails, without looping', async () => {
      const { wrapper, router } = await visit('/crates/1')
      const failing = vi.fn(async () => new Response('{}', { status: 500 }))
      vi.stubGlobal('fetch', failing)
      await router.push('/crates/9')
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text()).toContain('Try again')
      expect(wrapper.text()).not.toContain('Crate not found')
      expect(failing).toHaveBeenCalledTimes(2) // one reload: crates and albums
    })
  })

  it('/shelf shows the first crate and every tab', async () => {
    const { wrapper, router } = await visit('/shelf')
    expect(wrapper.findAll('button.tab').map((b) => b.text())).toEqual([
      'Guitars',
      'Beats & Bass',
      'Dub',
    ])
    expect(pressedTab(wrapper)).toBe('Guitars')
    expect(router.currentRoute.value.fullPath).toBe('/shelf')
  })

  it('a tab click on /shelf switches crate and stays on /shelf', async () => {
    const { wrapper, router } = await visit('/shelf')
    const replace = vi.spyOn(router, 'replace')
    const push = vi.spyOn(router, 'push')
    await tab(wrapper, 'Dub').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/shelf')
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(tab(wrapper, 'Dub').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.now h2').text()).toBe('Echoes')
    expect(wrapper.findAll('button.tab')).toHaveLength(3)
  })

  it('/crates/:id shows no picker and no other crate', async () => {
    const { wrapper } = await visit('/crates/2')
    expect(wrapper.findAll('button.tab')).toHaveLength(0)
    expect(wrapper.find('[role="group"][aria-label="Crates"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Guitars')
    expect(wrapper.text()).not.toContain('Dub')
  })

  it('follows the URL when it changes under the view', async () => {
    const { wrapper, router, library } = await visit('/crates/2')
    expect(wrapper.findAll('button.tab')).toHaveLength(0)
    expect(heading(wrapper)).toBe('Beats & Bass')
    await router.push('/crates/3')
    await flushPromises()
    expect(heading(wrapper)).toBe('Dub')
    expect(wrapper.get('.now h2').text()).toBe('Echoes')
    expect(library.selectedCrate?.id).toBe(3)
    expect(wrapper.findAll('button.tab')).toHaveLength(0)
  })

  it('going back to /shelf stays in the crate you were looking at', async () => {
    const { wrapper, router } = await visit('/crates/3')
    await router.push('/shelf')
    await flushPromises()
    expect(pressedTab(wrapper)).toBe('Dub')
  })

  it('/shelf recovers after a missing crate id', async () => {
    const { wrapper, router } = await visit('/crates/999999')
    await wrapper.get('.status-note a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/shelf')
    expect(pressedTab(wrapper)).toBe('Guitars')
  })

  it.each(['/shelf', '/crates/2'])('marks the toolbar Crates link active on %s', async (path) => {
    const { wrapper } = await visit(path)
    const links = wrapper.findAll('nav.views a')
    expect(links.map((a) => [a.text(), a.classes('active')])).toEqual([
      ['Crates', true],
      ['List', false],
    ])
    expect(links[0]!.attributes('href')).toBe('/shelf')
  })

  describe('the heading on /crates/:id', () => {
    it('is the label when the crate has one', async () => {
      const { wrapper } = await visit('/crates/2', {
        crateList: [crate(1, 'Guitars'), { ...crate(2, 'Beats & Bass'), label: 'BEATS' }],
      })
      expect(wrapper.findAll('h1')).toHaveLength(1)
      expect(heading(wrapper)).toBe('BEATS')
    })

    it('is the name when the label is null', async () => {
      const { wrapper } = await visit('/crates/2')
      expect(wrapper.findAll('h1')).toHaveLength(1)
      expect(heading(wrapper)).toBe('Beats & Bass')
    })

    it('is not added to /shelf', async () => {
      const { wrapper } = await visit('/shelf')
      expect(wrapper.find('h1').exists()).toBe(false)
    })
  })

  describe('the crate controls on /crates/:id', () => {
    const albumList = [
      { ...album(21, 2, 'Side A'), position: 0 },
      { ...album(22, 2, 'Side B'), position: 1 },
      { ...album(23, 2, 'Side C'), position: 2 },
    ]
    const count = (w: Wrapper) => w.get('.count').text()

    it('Flip and Back move through the records', async () => {
      const { wrapper } = await visit('/crates/2', { albumList })
      expect(count(wrapper)).toBe('1 / 3')
      await control(wrapper, 'Flip ▶').trigger('click')
      expect(count(wrapper)).toBe('2 / 3')
      await control(wrapper, '◀ Back').trigger('click')
      expect(count(wrapper)).toBe('1 / 3')
    })

    it('Pull it out opens the current record', async () => {
      const { wrapper, router } = await visit('/crates/2', { albumList })
      await control(wrapper, 'Flip ▶').trigger('click')
      await wrapper.get('button.pull').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/albums/22')
    })

    it('ArrowDown on the scene flips forward', async () => {
      const { wrapper } = await visit('/crates/2', { albumList })
      await wrapper.get('.scene').trigger('keydown', { key: 'ArrowDown' })
      expect(count(wrapper)).toBe('2 / 3')
    })

    it('links to the owner', async () => {
      const { wrapper } = await visit('/crates/2', {
        crateList: [{ ...crate(2, 'Beats & Bass'), ownerUsername: 'alice' }],
      })
      expect(wrapper.get('p.owner a').attributes('href')).toBe('/u/alice')
    })

    it('says so when the crate has no albums', async () => {
      const { wrapper } = await visit('/crates/2', { albumList: [] })
      expect(wrapper.text()).toContain('Nothing in here yet.')
    })
  })
})
