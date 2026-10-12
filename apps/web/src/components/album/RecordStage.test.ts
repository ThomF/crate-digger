import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Track } from '@crate-digger/shared'
import RecordStage from './RecordStage.vue'
import SleeveBack from './SleeveBack.vue'
import VinylDisc from './VinylDisc.vue'

const album = {
  id: 7,
  title: 'Dummy',
  artist: 'Portishead',
  year: 1994,
  format: 'LP' as const,
  sleeveColor: '#5a2a6e',
  coverPath: null,
}

const tracks: Track[] = [
  { id: 1, side: 'A', position: 1, title: 'Mysterons', durationSec: 302 },
  { id: 2, side: 'B', position: 1, title: 'Glory Box', durationSec: null },
]

describe('RecordStage', () => {
  it('gives the sleeve the same transition name as in the crate', () => {
    const wrapper = mount(RecordStage, { props: { album, tracks } })

    expect(wrapper.get('.sleeve').attributes('style')).toContain('view-transition-name: sleeve-7')
  })

  it('turns the sleeve over and back', async () => {
    const wrapper = mount(RecordStage, { props: { album, tracks } })
    const button = wrapper.get('button.turn')

    await button.trigger('click')
    expect(wrapper.get('.flipper').classes()).toContain('turned')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.text()).toBe('Show the front')

    await button.trigger('click')
    expect(wrapper.get('.flipper').classes()).not.toContain('turned')
  })
})

describe('SleeveBack', () => {
  it('prints the tracklist by side, with a catalog number', () => {
    const wrapper = mount(SleeveBack, { props: { album, tracks } })

    expect(wrapper.findAll('h4').map((h) => h.text())).toEqual(['Side A', 'Side B'])
    expect(wrapper.text()).toContain('A1. Mysterons')
    expect(wrapper.text()).toContain('5:02')
    expect(wrapper.text()).toContain('CDR-0007')
  })

  it('distinguishes "still loading" from "no tracklist"', () => {
    expect(
      mount(SleeveBack, { props: { album, tracks: null } })
        .get('.no-tracks')
        .text(),
    ).toBe('…')
    expect(
      mount(SleeveBack, { props: { album, tracks: [] } })
        .get('.no-tracks')
        .text(),
    ).toBe('Tracklist not printed.')
  })
})

describe('VinylDisc', () => {
  it('spins until clicked, and says what clicking will do', async () => {
    const wrapper = mount(VinylDisc, { props: { album } })
    const button = wrapper.get('button')

    expect(wrapper.get('.disc').classes()).toContain('spinning')
    expect(button.attributes('aria-label')).toBe('Stop the record')

    await button.trigger('click')
    expect(wrapper.get('.disc').classes()).not.toContain('spinning')
    expect(button.attributes('aria-label')).toBe('Spin the record')
  })

  it('plays 7" singles at 45 rpm', () => {
    const lp = mount(VinylDisc, { props: { album } })
    const single = mount(VinylDisc, { props: { album: { ...album, format: '7"' as const } } })

    expect(lp.text()).toContain('33⅓ RPM')
    expect(lp.get('.disc').attributes('style')).toContain('--turn: 1.80s')
    expect(single.text()).toContain('45 RPM')
    expect(single.get('.disc').attributes('style')).toContain('--turn: 1.33s')
  })
})
