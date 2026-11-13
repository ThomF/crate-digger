import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import FavoriteButton from './FavoriteButton.vue'

// Data classification: PUBLIC. Fictional crate ids only.

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

function mountButton(favorited: boolean, crateId = 7) {
  return mount(FavoriteButton, { props: { crateId, favorited } })
}

/** The accessible name: the button's text without its aria-hidden glyph. */
function accessibleName(wrapper: ReturnType<typeof mountButton>) {
  const button = wrapper.get('button').element.cloneNode(true) as HTMLElement
  button.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
  return button.textContent?.trim()
}

describe('FavoriteButton', () => {
  it("is a toggle named 'Favorite' in both states, with aria-pressed as the state", () => {
    const off = mountButton(false)
    expect(off.get('button').attributes('type')).toBe('button')
    expect(accessibleName(off)).toBe('Favorite')
    expect(off.get('button').attributes('aria-pressed')).toBe('false')

    const on = mountButton(true)
    expect(accessibleName(on)).toBe('Favorite')
    expect(on.get('button').attributes('aria-pressed')).toBe('true')
  })

  it('favorites with a PUT and emits true only after the request succeeds', async () => {
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')

    expect(pending[0]?.url).toBe('/api/crates/7/favorite')
    expect(pending[0]?.method).toBe('PUT')
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false') // not optimistic

    pending[0]!.respond(noContent())
    await flushPromises()
    expect(wrapper.emitted('changed')).toEqual([[true]])
  })

  it('unfavorites with a DELETE and emits false', async () => {
    const wrapper = mountButton(true)
    await wrapper.get('button').trigger('click')

    expect(pending[0]?.url).toBe('/api/crates/7/favorite')
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

  it('shows the error in an alert and emits nothing when the request fails', async () => {
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')
    pending[0]!.respond(failure('Database is down'))
    await flushPromises()

    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Database is down')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it('clears an old error when it is shown a new crate', async () => {
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')
    pending[0]!.respond(failure('Nope'))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await wrapper.setProps({ crateId: 8 })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('does not emit for a crate it has since moved away from', async () => {
    const wrapper = mountButton(false)
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ crateId: 8 })

    pending[0]!.respond(noContent())
    await flushPromises()
    expect(wrapper.emitted('changed')).toBeUndefined()
  })
})
