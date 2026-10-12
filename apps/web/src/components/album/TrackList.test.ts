import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackList from './TrackList.vue'

describe('TrackList', () => {
  it('renders a section per side with numbered tracks and durations', () => {
    const wrapper = mount(TrackList, {
      props: {
        tracks: [
          { id: 2, side: 'B', position: 1, title: 'Glory Box', durationSec: 301 },
          { id: 1, side: 'A', position: 1, title: 'Mysterons', durationSec: null },
        ],
      },
    })

    expect(wrapper.findAll('h3').map((h) => h.text())).toEqual(['Side A', 'Side B'])
    expect(wrapper.findAll('li').map((li) => li.text())).toEqual(['A1Mysterons', 'B1Glory Box5:01'])
  })

  it('says so when there is no tracklist', () => {
    const wrapper = mount(TrackList, { props: { tracks: [] } })

    expect(wrapper.text()).toBe('No tracklist yet.')
  })
})
