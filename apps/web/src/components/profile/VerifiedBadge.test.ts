import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VerifiedBadge from './VerifiedBadge.vue'

describe('VerifiedBadge', () => {
  it('is an accessible image labelled Verified', () => {
    const wrapper = mount(VerifiedBadge)
    const badge = wrapper.get('[role="img"]')
    expect(badge.attributes('aria-label')).toBe('Verified')
    expect(badge.attributes('title')).toBe('Verified')
    // The drawing itself is decorative; the label carries the meaning.
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
  })
})
