import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import OwnerLink from '../components/crate/OwnerLink.vue'

const Blank = defineComponent({ render: () => null })

async function mountOwner(props: { username: string | null; displayName?: string | null }) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Blank },
      { path: '/u/:username', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mount(OwnerLink, { props, global: { plugins: [router] } })
}

describe('crate owner link', () => {
  it("links to the owner's profile using their display name", async () => {
    const wrapper = await mountOwner({ username: 'alice', displayName: 'Alice Cooper' })
    expect(wrapper.text()).toMatch(/^by\s+Alice Cooper$/)
    const a = wrapper.get('a')
    expect(a.attributes('href')).toBe('/u/alice')
    expect(a.text()).toBe('Alice Cooper')
  })

  it('falls back to the username when there is no display name', async () => {
    const wrapper = await mountOwner({ username: 'alice', displayName: null })
    expect(wrapper.get('a').text()).toBe('alice')
    expect(wrapper.get('a').attributes('href')).toBe('/u/alice')
  })

  it('renders nothing for a crate with no owner', async () => {
    const wrapper = await mountOwner({ username: null, displayName: null })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders the owner name as plain text', async () => {
    const evil = '<img src=x onerror=alert(1)>'
    const wrapper = await mountOwner({ username: 'alice', displayName: evil })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('a').text()).toBe(evil)
  })
})
