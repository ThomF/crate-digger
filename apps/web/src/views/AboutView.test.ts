import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AboutView from './AboutView.vue'
import source from './AboutView.vue?raw'

describe('AboutView', () => {
  it('has the heading and sets the title', () => {
    document.title = 'something else'
    const wrapper = mount(AboutView)
    expect(wrapper.get('h1').text()).toBe('About Frisson')
    expect(document.title).toBe('About · Frisson')
  })

  it.each(['crates', 'following', 'self-hosted', 'demo'])('uses the word %s', (word) => {
    expect(mount(AboutView).text()).toContain(word)
  })

  it('states that anything marked Demo is demo data', () => {
    expect(mount(AboutView).text()).toContain(
      'Anything marked Demo, including the demo collectors, is demo data.',
    )
  })

  it('renders no HTML from strings', () => {
    expect(source).not.toContain('v-html')
  })
})
