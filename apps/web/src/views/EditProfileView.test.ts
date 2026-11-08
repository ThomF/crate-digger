import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import {
  MAX_AVATAR_BYTES,
  MAX_PROFILE_LINKS,
  type PublicProfile,
  type PublicUser,
} from '@frisson/shared'
import { useSessionStore } from '../stores/session.ts'
import EditProfileView from './EditProfileView.vue'

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
  avatarUrl: null,
  verified: false,
}

const profile = (overrides: Partial<PublicProfile> = {}): PublicProfile => ({
  username: 'alice',
  displayName: 'Alice',
  bio: 'Digs for 80s synth pop.',
  location: 'Boise',
  avatarUrl: '/avatars/1-old.webp',
  verified: false,
  links: [
    { platform: 'bandcamp', url: 'https://alice.bandcamp.com' },
    { platform: 'discogs', url: 'https://www.discogs.com/user/alice' },
  ],
  crates: [],
  followerCount: 0,
  followingCount: 0,
  viewerFollows: false,
  isDemo: false,
  ...overrides,
})

let fetchMock: ReturnType<typeof vi.fn>
/** Lets a test answer PATCH /api/me/profile its own way. */
let patchResponse: () => Response

function stubApi() {
  patchResponse = () => Response.json(profile())
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url === '/api/users/alice') return Response.json(profile())
    if (method === 'GET' && url === '/api/auth/me') return Response.json(alice)
    if (method === 'PATCH' && url === '/api/me/profile') return patchResponse()
    if (method === 'POST' && url === '/api/me/avatar') {
      return Response.json(profile({ avatarUrl: '/avatars/1-new.webp' }))
    }
    if (method === 'DELETE' && url === '/api/me/avatar') {
      return Response.json(profile({ avatarUrl: null }))
    }
    return new Response('{}', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
}

const Blank = defineComponent({ render: () => null })

async function visit() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.user = alice
  session.loaded = true

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile/edit', name: 'profile-edit', component: EditProfileView },
      { path: '/u/:username', name: 'profile', component: Blank },
    ],
  })
  await router.push('/profile/edit')
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof visit>>

const calls = (method: string, url: string) =>
  fetchMock.mock.calls.filter(
    ([u, init]) => u === url && ((init as RequestInit | undefined)?.method ?? 'GET') === method,
  )

async function submit(wrapper: Wrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

function lastPatchBody() {
  const sent = calls('PATCH', '/api/me/profile').at(-1)
  return JSON.parse((sent![1] as RequestInit).body as string) as Record<string, unknown>
}

async function pick(wrapper: Wrapper, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('EditProfileView', () => {
  beforeEach(() => {
    stubApi()
    // happy-dom may not implement object URLs; the preview only needs a string.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the current values of the signed-in user', async () => {
    const wrapper = await visit()

    expect(calls('GET', '/api/users/alice')).toHaveLength(1)
    expect((wrapper.get('#displayName').element as HTMLInputElement).value).toBe('Alice')
    expect((wrapper.get('#bio').element as HTMLTextAreaElement).value).toBe(
      'Digs for 80s synth pop.',
    )
    expect((wrapper.get('#location').element as HTMLInputElement).value).toBe('Boise')
    const urls = wrapper
      .findAll('input[type="url"]')
      .map((i) => (i.element as HTMLInputElement).value)
    expect(urls).toEqual(['https://alice.bandcamp.com', 'https://www.discogs.com/user/alice'])
    expect(wrapper.get('img').attributes('src')).toBe('/avatars/1-old.webp')
  })

  it('enforces max lengths and counts bio characters live', async () => {
    const wrapper = await visit()

    expect(wrapper.get('#displayName').attributes('maxlength')).toBe('60')
    expect(wrapper.get('#bio').attributes('maxlength')).toBe('500')
    expect(wrapper.get('#location').attributes('maxlength')).toBe('80')
    expect(wrapper.get('#bio-count').text()).toBe('23/500')

    await wrapper.get('#bio').setValue('abc')
    expect(wrapper.get('#bio-count').text()).toBe('3/500')
  })

  it('saves exactly displayName, bio, location and links, in display order', async () => {
    const wrapper = await visit()

    await wrapper.get('#displayName').setValue('Alice B')
    await wrapper.get('#bio').setValue('New bio')
    await wrapper.get('#location').setValue('   ')
    // Move the Discogs link above Bandcamp.
    await wrapper.get('button[aria-label="Move Discogs link 2 up"]').trigger('click')
    await submit(wrapper)

    const body = lastPatchBody()
    expect(Object.keys(body)).toEqual(['displayName', 'bio', 'location', 'links'])
    expect(body).toEqual({
      displayName: 'Alice B',
      bio: 'New bio',
      location: null, // blank is sent as null
      links: [
        { platform: 'discogs', url: 'https://www.discogs.com/user/alice' },
        { platform: 'bandcamp', url: 'https://alice.bandcamp.com' },
      ],
    })
    // The header refreshes from /auth/me after a save.
    expect(calls('GET', '/api/auth/me')).toHaveLength(1)
    expect(wrapper.get('.saved').text()).toContain('Saved.')
    expect(wrapper.get('.saved a').attributes('href')).toBe('/u/alice')
  })

  it('blocks a 7th link', async () => {
    const wrapper = await visit()
    const add = () => wrapper.get('button.add')

    while (wrapper.findAll('input[type="url"]').length < MAX_PROFILE_LINKS) {
      await add().trigger('click')
    }
    expect(add().attributes('disabled')).toBeDefined()
    ;(add().element as HTMLButtonElement).disabled = false
    await add().trigger('click')
    expect(wrapper.findAll('input[type="url"]')).toHaveLength(MAX_PROFILE_LINKS)

    await submit(wrapper)
    expect((lastPatchBody().links as unknown[]).length).toBe(MAX_PROFILE_LINKS)
  })

  it('shows the API validation message and per-field issues', async () => {
    patchResponse = () =>
      Response.json(
        {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Request is invalid',
          issues: [
            { path: 'body/displayName', message: 'Required' },
            { path: 'body/links/1/url', message: 'Use a full https:// link' },
          ],
        },
        { status: 400 },
      )
    const wrapper = await visit()

    await submit(wrapper)

    expect(wrapper.get('.form-error').text()).toContain('Request is invalid')
    expect(wrapper.get('#displayName-error').text()).toBe('Required')
    expect(wrapper.get('#displayName').attributes('aria-invalid')).toBe('true')
    expect(wrapper.findAll('li')[1]!.text()).toContain('Use a full https:// link')
    expect(wrapper.find('.saved').exists()).toBe(false)
  })

  it('uploads a picked avatar right away', async () => {
    const wrapper = await visit()
    const file = new File(['x'], 'me.png', { type: 'image/png' })

    await pick(wrapper, file)

    const sent = calls('POST', '/api/me/avatar')
    expect(sent).toHaveLength(1)
    expect(((sent[0]![1] as RequestInit).body as FormData).get('avatar')).toBeInstanceOf(File)
    expect(wrapper.get('img').attributes('src')).toBe('blob:preview')
    expect(wrapper.text()).toContain('5 MB')
  })

  it('refuses an avatar over the size limit without calling the API', async () => {
    const wrapper = await visit()
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: MAX_AVATAR_BYTES + 1 })

    await pick(wrapper, big)

    expect(calls('POST', '/api/me/avatar')).toHaveLength(0)
    expect(wrapper.get('#avatar-error').text()).toContain('5 MB')
  })

  it('removes the avatar right away', async () => {
    const wrapper = await visit()

    await wrapper.get('button.link').trigger('click')
    await flushPromises()

    expect(calls('DELETE', '/api/me/avatar')).toHaveLength(1)
    expect(wrapper.find('.preview img').exists()).toBe(false)
  })

  it('shows saved text as plain text, never as markup', async () => {
    const evil = '<img src=x onerror=alert(1)>'
    fetchMock.mockImplementationOnce(async () =>
      Response.json(profile({ displayName: evil, bio: evil, avatarUrl: null })),
    )
    const wrapper = await visit()

    expect(wrapper.findAll('img')).toHaveLength(0)
    expect((wrapper.get('#bio').element as HTMLTextAreaElement).value).toBe(evil)
    expect((wrapper.get('#displayName').element as HTMLInputElement).value).toBe(evil)
  })

  it('offers no control beyond the editable fields', async () => {
    const wrapper = await visit()

    const ids = wrapper
      .findAll('form input, form textarea')
      .map((el) => el.attributes('id'))
      .filter(Boolean)
    expect(ids).toEqual(['displayName', 'bio', 'location', 'link-url-0', 'link-url-1'])
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })
})
