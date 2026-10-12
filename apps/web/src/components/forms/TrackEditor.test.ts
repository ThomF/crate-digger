import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import TrackEditor from './TrackEditor.vue'
import { newTrackRow, trackErrorKey, type TrackRow } from '../../forms/albumForm.ts'

// Mounts the editor with a real v-model, like a parent component would.
function mountEditor(initial: TrackRow[], errors = {}) {
  const rows = ref(initial)
  const wrapper = mount(TrackEditor, {
    props: {
      modelValue: rows.value,
      'onUpdate:modelValue': (value: TrackRow[]) => {
        rows.value = value
        wrapper.setProps({ modelValue: value })
      },
      errors,
    },
    attachTo: document.body, // so focus() works
  })
  const titles = () => rows.value.map((r) => r.title)
  return { wrapper, rows, titles }
}

const button = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.get(`button[aria-label="${label}"]`)

describe('TrackEditor', () => {
  it('labels rows by side and position', () => {
    const { wrapper } = mountEditor([
      newTrackRow('A', 'One'),
      newTrackRow('B', 'Two'),
      newTrackRow('A', 'Three'),
    ])

    expect(wrapper.findAll('.label').map((l) => l.text())).toEqual(['A1', 'B1', 'A2'])
  })

  it('adds a row on the same side as the last one and focuses it', async () => {
    const { wrapper, rows } = mountEditor([newTrackRow('B', 'Two')])

    await wrapper.get('button.add').trigger('click')

    expect(rows.value.map((r) => r.side)).toEqual(['B', 'B'])
    expect(document.activeElement).toBe(wrapper.findAll('input.title').at(-1)?.element)
    wrapper.unmount()
  })

  it('moves and removes rows', async () => {
    const { wrapper, titles } = mountEditor([
      newTrackRow('A', 'One'),
      newTrackRow('A', 'Two'),
      newTrackRow('A', 'Three'),
    ])

    await button(wrapper, 'Move Three up').trigger('click')
    expect(titles()).toEqual(['One', 'Three', 'Two'])

    await button(wrapper, 'Remove One').trigger('click')
    expect(titles()).toEqual(['Three', 'Two'])

    expect(button(wrapper, 'Move Three up').attributes()).toHaveProperty('disabled')
    wrapper.unmount()
  })

  it('shows a row error and marks the input invalid', () => {
    const row = newTrackRow('A', 'Roads', 'soon')
    const { wrapper } = mountEditor([row], {
      [trackErrorKey(row, 'duration')]: 'Use m:ss, like 4:14',
    })

    expect(wrapper.get('.error').text()).toBe('Use m:ss, like 4:14')
    expect(wrapper.get('input.duration').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })
})
