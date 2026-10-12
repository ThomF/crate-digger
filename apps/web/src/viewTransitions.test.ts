import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { installViewTransitions } from './viewTransitions.ts'

const Page = { template: '<div />' }

function setup({ reducedMotion = false } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Page },
      { path: '/albums/:id', component: Page },
    ],
  })

  // A stand-in for the browser API: records each transition and when its update finished.
  const transitions: { updateDone: boolean }[] = []
  const doc = {
    startViewTransition: vi.fn((update: () => Promise<void>) => {
      const record = { updateDone: false }
      transitions.push(record)
      // The real browser calls `update` after capturing the old page.
      queueMicrotask(() => update().then(() => (record.updateDone = true)))
      return {} as ViewTransition
    }),
  }

  installViewTransitions(router, doc as unknown as Document, () => reducedMotion)
  return { router, doc, transitions }
}

describe('installViewTransitions', () => {
  it('skips the first page load', async () => {
    const { router, doc } = setup()

    await router.push('/')

    expect(doc.startViewTransition).not.toHaveBeenCalled()
  })

  it('wraps later navigations and finishes once the new page is in', async () => {
    const { router, doc, transitions } = setup()
    await router.push('/')

    await router.push('/albums/1')
    await new Promise((r) => setTimeout(r)) // let the afterEach + nextTick settle

    expect(doc.startViewTransition).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/albums/1')
    expect(transitions[0]?.updateDone).toBe(true)
  })

  it('does nothing for people who prefer reduced motion', async () => {
    const { router, doc } = setup({ reducedMotion: true })
    await router.push('/')

    await router.push('/albums/1')

    expect(doc.startViewTransition).not.toHaveBeenCalled()
  })

  it('does nothing in browsers without the API', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:any(.*)', component: Page }],
    })
    installViewTransitions(router, {} as Document)

    await router.push('/')
    await router.push('/elsewhere')

    expect(router.currentRoute.value.path).toBe('/elsewhere')
  })
})
