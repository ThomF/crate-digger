import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { getFeed, listFollowing, listSuggestedCollectors } from '../../api/follows.ts'
import FollowButton from './FollowButton.vue'

// A fake API: each request waits until the test answers it, so we can look at the in-flight state.
type Pending = { url: string; method?: string; respond: (res: Response) => void }
let pending: Pending[] = []

beforeEach(() => {
  pending = []
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string, init: RequestInit) =>
        new Promise<Response>((resolve) =>
          pending.push({ url, method: init.method, respond: resolve }),
        ),
    ),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const noContent = () => new Response(null, { status: 204 })
const failure = (message: string) =>
  Response.json({ statusCode: 500, error: 'Internal Server Error', message }, { status: 500 })

function mountButton(following: boolean, username = 'demo-rita') {
  return mount(FollowButton, { props: { username, following } })
}

describe('FollowButton', () => {
  it('is labelled Follow when not following and Unfollow when following', () => {
    expect(mountButton(false).get('button.btn').text()).toBe('Follow')
    expect(mountButton(true).get('button.btn').text()).toBe('Unfollow')
  })

  it('follows with a PUT and emits true only after the request succeeds', async () => {
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')

    expect(pending[0]?.url).toBe('/api/users/demo-rita/follow')
    expect(pending[0]?.method).toBe('PUT')
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(wrapper.get('button').text()).toBe('Follow') // not optimistic

    pending[0]!.respond(noContent())
    await flushPromises()
    expect(wrapper.emitted('changed')).toEqual([[true]])
  })

  it('unfollows with a DELETE and emits false', async () => {
    const wrapper = mountButton(true)
    await wrapper.get('button').trigger('click')

    expect(pending[0]?.url).toBe('/api/users/demo-rita/follow')
    expect(pending[0]?.method).toBe('DELETE')

    pending[0]!.respond(noContent())
    await flushPromises()
    expect(wrapper.emitted('changed')).toEqual([[false]])
  })

  it('is busy and disabled while the request is in flight, then released', async () => {
    const wrapper = mountButton(false)
    const button = wrapper.get('button')
    expect(button.attributes('aria-busy')).toBe('false')
    expect(button.attributes('disabled')).toBeUndefined()

    await button.trigger('click')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click') // ignored while disabled
    expect(pending).toHaveLength(1)

    pending[0]!.respond(noContent())
    await flushPromises()
    expect(button.attributes('aria-busy')).toBe('false')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it.each([
    [false, 'Follow'],
    [true, 'Unfollow'],
  ])('on failure shows an alert and keeps the label (following=%s)', async (following, label) => {
    const wrapper = mountButton(following)
    await wrapper.get('button').trigger('click')

    pending[0]!.respond(failure('The record shop is closed'))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('The record shop is closed')
    expect(wrapper.get('button').text()).toBe(label)
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('shows the friendly message when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe("Can't reach the API. Is it running?")
  })

  it('clears the alert when retrying, and has none before a failure', async () => {
    const wrapper = mountButton(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    await wrapper.get('button').trigger('click')
    pending[0]!.respond(failure('Nope'))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await wrapper.get('button').trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    pending[1]!.respond(noContent())
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('changed')).toEqual([[true]])
  })

  it('follows the prop once the parent updates it', async () => {
    const wrapper = mountButton(false)
    await wrapper.setProps({ following: true })
    expect(wrapper.get('button').text()).toBe('Unfollow')
  })

  it('drops an old failure when it starts showing someone else', async () => {
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')
    pending[0]!.respond(failure('Nope'))
    await flushPromises()

    await wrapper.setProps({ username: 'demo-otis' })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('does not report a late answer about the previous username', async () => {
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ username: 'demo-otis' })

    pending[0]!.respond(noContent())
    await flushPromises()
    expect(wrapper.emitted('changed')).toBeUndefined()

    await wrapper.get('button').trigger('click')
    pending[1]!.respond(failure('Nope'))
    await wrapper.setProps({ username: 'demo-rita' })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})

describe('follows API client', () => {
  it.each([
    ['listFollowing', listFollowing, '/api/me/following'],
    ['getFeed', getFeed, '/api/me/feed'],
    ['listSuggestedCollectors', listSuggestedCollectors, '/api/me/suggested-collectors'],
  ])('%s reads the right path', async (_name, call, url) => {
    const result = call()
    expect(pending[0]?.url).toBe(url)
    pending[0]!.respond(Response.json([]))
    await expect(result).resolves.toEqual([])
  })
})
