import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AlbumSummary, Crate } from '@crate-digger/shared'
import CrateBox from './CrateBox.vue'

const crate: Crate = {
  id: 1,
  name: 'Guitars',
  color: '#c8a374',
  label: 'ROCK / ALT',
  sortBy: 'manual',
  sortOrder: 0,
  albumCount: 3,
}

const albums = ['Nevermind', 'OK Computer', 'Odelay'].map((title, i): AlbumSummary => ({
  id: i + 1,
  crateId: 1,
  title,
  artist: 'Someone',
  year: 1990 + i,
  genre: null,
  format: 'LP',
  coverPath: null,
  sleeveColor: '#2f6fa3',
  rating: 0,
  position: i,
}))

// Mounts with a working v-model:index, like a parent component would.
function mountCrate(index = 0) {
  const wrapper = mount(CrateBox, {
    props: {
      crate,
      albums,
      index,
      // Only called after mount() returns, so `wrapper` exists by then.
      'onUpdate:index': (value: number) => wrapper.setProps({ index: value }),
    },
  })
  return wrapper
}

describe('CrateBox', () => {
  it('marks the sleeve at `index` as current', () => {
    const wrapper = mountCrate(1)

    expect(wrapper.get('.sleeve.current').text()).toContain('OK Computer')
  })

  it('flips with the keyboard via v-model:index', async () => {
    const wrapper = mountCrate(0)

    await wrapper.get('.scene').trigger('keydown', { key: 'ArrowDown' })

    expect(wrapper.emitted('update:index')).toEqual([[1]])
  })

  it('opens the current record on Enter or click', async () => {
    const wrapper = mountCrate(0)

    await wrapper.get('.scene').trigger('keydown', { key: 'Enter' })
    await wrapper.get('.sleeve.current').trigger('click')

    expect(wrapper.emitted('open')?.map(([album]) => (album as AlbumSummary).title)).toEqual([
      'Nevermind',
      'Nevermind',
    ])
  })

  it('flips to a record further back when you click its edge', async () => {
    const wrapper = mountCrate(0)

    const behind = wrapper.findAll('.sleeve').find((s) => s.text().includes('Odelay'))!
    await behind.trigger('click')

    expect(wrapper.emitted('update:index')).toEqual([[2]])
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('names the crate and explains the controls for screen readers', () => {
    const wrapper = mountCrate()

    expect(wrapper.get('.scene').attributes('aria-label')).toBe(
      'ROCK / ALT crate. Arrow keys flip, Enter pulls out the record.',
    )
  })

  describe('in a crate sorted by artist', () => {
    const sorted = { ...crate, sortBy: 'artist' as const }
    const byArtist = ['Beck', 'Björk', 'Massive Attack', 'The Notorious B.I.G.'].map(
      (artist, i): AlbumSummary => ({ ...albums[0]!, id: i + 1, artist, title: artist }),
    )

    function mountSorted(index = 0) {
      const wrapper = mount(CrateBox, {
        props: {
          crate: sorted,
          albums: byArtist,
          index,
          'onUpdate:index': (value: number) => wrapper.setProps({ index: value }),
        },
      })
      return wrapper
    }

    it('puts a divider in front of the first record of each letter', () => {
      const wrapper = mountSorted()

      expect(wrapper.findAll('.divider-tab').map((t) => t.text())).toEqual(['B', 'M', 'N'])
    })

    it('jumps to a divider when you type its letter', async () => {
      const wrapper = mountSorted()

      await wrapper.get('.scene').trigger('keydown', { key: 'n' })
      await wrapper.get('.scene').trigger('keydown', { key: 'M' })
      await wrapper.get('.scene').trigger('keydown', { key: 'z' }) // no Z section: ignored

      expect(wrapper.emitted('update:index')).toEqual([[3], [2]])
    })

    it('leaves browser shortcuts alone', async () => {
      const wrapper = mountSorted()

      await wrapper.get('.scene').trigger('keydown', { key: 'n', metaKey: true })

      expect(wrapper.emitted('update:index')).toBeUndefined()
    })
  })

  it('has no dividers in a manual crate', () => {
    expect(mountCrate().findAll('.divider-tab')).toHaveLength(0)
  })
})
