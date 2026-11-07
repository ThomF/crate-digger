import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { MAX_PROFILE_LINKS, SOCIAL_PLATFORMS, type ProfileLinkInput } from '@frisson/shared'
import LinksEditor from './LinksEditor.vue'

function mountLinks(links: ProfileLinkInput[], errors: Record<string, string> = {}) {
  const wrapper = mount(LinksEditor, {
    props: {
      modelValue: links,
      errors,
      'onUpdate:modelValue': (modelValue: ProfileLinkInput[]) => wrapper.setProps({ modelValue }),
    },
    attachTo: document.body,
  })
  return wrapper
}

const link = (n: number): ProfileLinkInput => ({
  platform: 'website',
  url: `https://example.com/${n}`,
})
const current = (wrapper: ReturnType<typeof mountLinks>) =>
  wrapper.props('modelValue') as ProfileLinkInput[]
const addButton = (wrapper: ReturnType<typeof mountLinks>) => wrapper.get('button.add')

describe('LinksEditor', () => {
  it('offers every social platform, and a url input per link', () => {
    const wrapper = mountLinks([link(1)])

    const options = wrapper.findAll('select option').map((o) => o.attributes('value'))
    expect(options).toEqual([...SOCIAL_PLATFORMS])
    expect(wrapper.get('input').attributes('type')).toBe('url')
  })

  it('adds a blank link at the end', async () => {
    const wrapper = mountLinks([link(1)])

    await addButton(wrapper).trigger('click')

    expect(current(wrapper)).toEqual([link(1), { platform: 'website', url: '' }])
    expect(wrapper.findAll('li')).toHaveLength(2)
    wrapper.unmount()
  })

  it('removes the chosen link', async () => {
    const wrapper = mountLinks([link(1), link(2), link(3)])

    await wrapper.get('button[aria-label="Remove Website link 2"]').trigger('click')

    expect(current(wrapper)).toEqual([link(1), link(3)])
  })

  it('moves links up and down, and not past either end', async () => {
    const wrapper = mountLinks([link(1), link(2), link(3)])

    await wrapper.get('button[aria-label="Move Website link 3 up"]').trigger('click')
    expect(current(wrapper)).toEqual([link(1), link(3), link(2)])

    await wrapper.get('button[aria-label="Move Website link 1 down"]').trigger('click')
    expect(current(wrapper)).toEqual([link(3), link(1), link(2)])

    expect(
      wrapper.get('button[aria-label="Move Website link 1 up"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('button[aria-label="Move Website link 3 down"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('edits the platform and url in place', async () => {
    const wrapper = mountLinks([link(1)])

    await wrapper.get('select').setValue('bandcamp')
    await wrapper.get('input').setValue('https://someone.bandcamp.com')

    expect(current(wrapper)).toEqual([
      { platform: 'bandcamp', url: 'https://someone.bandcamp.com' },
    ])
  })

  it(`stops at ${MAX_PROFILE_LINKS} links: the button is disabled and add() refuses a 7th`, async () => {
    const six = Array.from({ length: MAX_PROFILE_LINKS }, (_, i) => link(i + 1))
    const wrapper = mountLinks(six)

    expect(addButton(wrapper).attributes('disabled')).toBeDefined()
    // Even if the disabled button is forced, no 7th link appears.
    ;(addButton(wrapper).element as HTMLButtonElement).disabled = false
    await addButton(wrapper).trigger('click')

    expect(current(wrapper)).toHaveLength(MAX_PROFILE_LINKS)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('shows a per-link error from the API', () => {
    const wrapper = mountLinks([link(1), link(2)], { 'links.1.url': 'Use a full https:// link' })

    const rows = wrapper.findAll('li')
    expect(rows[1]!.text()).toContain('Use a full https:// link')
    expect(rows[1]!.get('input').attributes('aria-invalid')).toBe('true')
    expect(rows[0]!.get('input').attributes('aria-invalid')).toBe('false')
  })
})
