import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CoverUpload from './CoverUpload.vue'

function mountCover(props: { coverPath?: string | null; file?: File | null; remove?: boolean }) {
  const wrapper = mount(CoverUpload, {
    props: {
      coverPath: props.coverPath ?? null,
      sleeveColor: '#2b2118',
      file: props.file ?? null,
      remove: props.remove ?? false,
      'onUpdate:file': (file: File | null) => wrapper.setProps({ file }),
      'onUpdate:remove': (remove: boolean) => wrapper.setProps({ remove }),
    },
  })
  return wrapper
}

const image = () => new File(['x'], 'dummy.png', { type: 'image/png' })

describe('CoverUpload', () => {
  it('shows the saved cover', () => {
    const wrapper = mountCover({ coverPath: '/covers/1-abc.jpg' })

    expect(wrapper.get('img').attributes('src')).toBe('/covers/1-abc.jpg')
  })

  it('marks the saved cover for removal, which hides it', async () => {
    const wrapper = mountCover({ coverPath: '/covers/1-abc.jpg' })

    await wrapper.get('button.link').trigger('click')

    expect(wrapper.emitted('update:remove')).toEqual([[true]])
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('removed when you save')
  })

  it('takes a dropped file and cancels any pending removal', async () => {
    const wrapper = mountCover({ coverPath: '/covers/1-abc.jpg', remove: true })
    const dropped = image()

    await wrapper.get('.preview').trigger('drop', { dataTransfer: { files: [dropped] } })

    expect(wrapper.emitted('update:file')).toEqual([[dropped]])
    expect(wrapper.emitted('update:remove')).toEqual([[false]])
    expect(wrapper.text()).toContain('dummy.png uploads when you save')
  })

  it('"Undo" drops a picked file without touching the saved cover', async () => {
    const wrapper = mountCover({ coverPath: '/covers/1-abc.jpg', file: image() })

    await wrapper.get('button.link').trigger('click')

    expect(wrapper.emitted('update:file')).toEqual([[null]])
    expect(wrapper.emitted('update:remove')).toBeUndefined()
  })
})
