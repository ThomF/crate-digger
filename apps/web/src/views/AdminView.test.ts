import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type {
  AdminCrate,
  AdminNewsItem,
  AdminOverview,
  AdminUser,
  PublicProfile,
  PublicUser,
} from '@frisson/shared'
import * as admin from '../api/admin.ts'
import * as auth from '../api/auth.ts'
import { ApiRequestError } from '../api/client.ts'
import { setVerified } from '../api/profiles.ts'
import { useLibraryStore } from '../stores/library.ts'
import { useSessionStore } from '../stores/session.ts'
import AdminView from './AdminView.vue'

// Data classification: test fixtures only; the emails are fictional.

vi.mock('../api/admin.ts', () => ({
  getAdminOverview: vi.fn(),
  listAdminUsers: vi.fn(),
  listAdminCrates: vi.fn(),
  createAdminCrate: vi.fn(),
  setCrateSuggested: vi.fn(),
  listAdminNews: vi.fn(),
  createAdminNews: vi.fn(),
  updateAdminNews: vi.fn(),
  deleteAdminNews: vi.fn(),
  runAdminImport: vi.fn(),
}))
vi.mock('../api/profiles.ts', () => ({ setVerified: vi.fn() }))
vi.mock('../api/auth.ts', () => ({ me: vi.fn() }))
vi.mock('../api/crates.ts', () => ({ listCrates: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/albums.ts', () => ({ listAlbums: vi.fn().mockResolvedValue([]) }))

const overview: AdminOverview = { users: 2, crates: 3, suggestedCrates: 1, albums: 12, news: 2 }

const users: AdminUser[] = [
  {
    id: 1,
    email: 'admin@frisson.com',
    username: 'admin',
    displayName: 'Head Admin',
    role: 'admin',
    verified: false,
    isDemo: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    crateCount: 2,
  },
  {
    id: 2,
    email: 'odessa@example.com',
    username: 'demo-odessa',
    displayName: 'Odessa Quillfern',
    role: 'user',
    verified: false,
    isDemo: true,
    createdAt: '2026-01-02T00:00:00.000Z',
    crateCount: 7,
  },
]

const crate = (over: Partial<AdminCrate>): AdminCrate => ({
  id: 1,
  name: 'Crate',
  label: null,
  color: '#c8a374',
  albumCount: 0,
  ownerUsername: 'demo-odessa',
  ownerDisplayName: 'Odessa Quillfern',
  recommendedRank: null,
  isDemo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const crates: AdminCrate[] = [
  crate({ id: 7, name: 'Lamplit Dub Hours', recommendedRank: 1, albumCount: 5, isDemo: true }),
  crate({
    id: 8,
    name: 'Porch Folk',
    albumCount: 1,
    ownerUsername: 'tomasz',
    ownerDisplayName: 'Tomasz Brindlewick',
  }),
  crate({ id: 9, name: 'Old Boxes', ownerUsername: null, ownerDisplayName: null }),
]

const news: AdminNewsItem[] = [
  {
    id: 1,
    title: 'Pressing plant reopens',
    summary: 'A long shuttered plant is running again.',
    source: 'The Wax Gazette',
    publishedAt: '2026-10-27T09:00:00.000Z',
    isDemo: true,
  },
  {
    id: 2,
    title: 'Fair moves indoors',
    summary: 'The fair has a new home.',
    source: 'Dollar Bin Weekly',
    publishedAt: '2026-10-20T09:00:00.000Z',
    isDemo: false,
  },
]

const signedIn: PublicUser = {
  id: 1,
  email: 'admin@frisson.com',
  username: 'admin',
  displayName: 'Head Admin',
  role: 'admin',
  avatarUrl: null,
  verified: false,
}

const profile = (verified: boolean) => ({ verified }) as PublicProfile
const failure = (status: number, message: string, issues?: { path: string; message: string }[]) =>
  new ApiRequestError(status, { statusCode: status, error: 'Error', message, issues })

/** A promise settled by hand, to look at the page while a request is in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const Blank = defineComponent({ render: () => null })

async function mountAdmin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Blank },
      { path: '/crates', name: 'crates', component: Blank },
      { path: '/crates/:id(\\d+)', name: 'crate', component: Blank },
      { path: '/albums/new', name: 'album-new', component: Blank },
      { path: '/u/:username', name: 'profile', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  const pinia = createPinia()
  setActivePinia(pinia)
  useSessionStore().user = { ...signedIn }
  const wrapper = mount(AdminView, { global: { plugins: [router, pinia] } })
  await flushPromises()
  return wrapper
}

const section = (w: VueWrapper, heading: string) => {
  const found = w.findAll('section').find((s) => s.find('h2').text() === heading)
  if (!found) throw new Error(`No section headed ${heading}`)
  return found
}

const buttonNamed = (within: VueWrapper | DOMWrapper<Element>, name: string) => {
  const found = within.findAll('button').find((b) => b.text() === name)
  if (!found) throw new Error(`No button named ${name}`)
  return found
}

const rowWith = (within: DOMWrapper<Element>, text: string) => {
  const found = within.findAll('li.admin-card').find((li) => li.text().includes(text))
  if (!found) throw new Error(`No row with ${text}`)
  return found
}

const jsonBox = (w: VueWrapper) => section(w, 'Bulk import').get('textarea')
const importForm = (w: VueWrapper) => section(w, 'Bulk import').get('form')

beforeEach(() => {
  vi.mocked(admin.getAdminOverview).mockReset().mockResolvedValue(overview)
  vi.mocked(admin.listAdminUsers).mockReset().mockResolvedValue(users)
  vi.mocked(admin.listAdminCrates).mockReset().mockResolvedValue(crates)
  vi.mocked(admin.listAdminNews).mockReset().mockResolvedValue(news)
  vi.mocked(admin.createAdminCrate).mockReset()
  vi.mocked(admin.setCrateSuggested).mockReset()
  vi.mocked(admin.createAdminNews).mockReset()
  vi.mocked(admin.updateAdminNews).mockReset()
  vi.mocked(admin.deleteAdminNews).mockReset()
  vi.mocked(admin.runAdminImport).mockReset()
  vi.mocked(setVerified).mockReset()
  vi.mocked(auth.me).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminView sections', () => {
  it('labels every section and sets the title', async () => {
    document.title = 'something else'
    const wrapper = await mountAdmin()
    const headings = wrapper.findAll('h2').map((h) => h.text())
    for (const heading of [
      'Overview',
      'News',
      'Suggested crates',
      'User created crates',
      'Users',
      'Bulk import',
    ]) {
      expect(headings).toContain(heading)
    }
    expect(document.title).toBe('Admin · Frisson')
  })

  it('shows the overview counts', async () => {
    const text = section(await mountAdmin(), 'Overview').text()
    expect(text).toContain('Users2')
    expect(text).toContain('Albums12')
  })

  it('shows news items, with the restart note only on demo ones', async () => {
    const news = section(await mountAdmin(), 'News')
    const demoRow = rowWith(news, 'Pressing plant reopens')
    expect(demoRow.text()).toContain('The Wax Gazette')
    expect(demoRow.text()).toContain('Demo news returns on the next restart')
    expect(rowWith(news, 'Fair moves indoors').text()).not.toContain('next restart')
  })

  it('splits crates by rank, with owners, No owner, and the links out', async () => {
    const wrapper = await mountAdmin()
    const suggested = section(wrapper, 'Suggested crates')
    const others = section(wrapper, 'User created crates')

    expect(suggested.text()).toContain('Lamplit Dub Hours')
    expect(suggested.text()).toContain('Odessa Quillfern')
    expect(suggested.text()).not.toContain('Porch Folk')

    const porch = rowWith(others, 'Porch Folk')
    expect(porch.text()).toContain('Tomasz Brindlewick')
    expect(porch.find('a[href="/crates/8"]').exists()).toBe(true)
    expect(porch.find('a[href="/albums/new?crateId=8"]').exists()).toBe(true)
    expect(porch.find('a[href="/crates"]').exists()).toBe(true)

    expect(rowWith(others, 'Old Boxes').text()).toContain('No owner')
    expect(others.text()).not.toContain('Lamplit Dub Hours')
  })

  it('shows every user field, and offers nothing beyond verification', async () => {
    const users = section(await mountAdmin(), 'Users')
    const row = rowWith(users, 'demo-odessa')
    const text = row.text()
    for (const part of ['odessa@example.com', 'Odessa Quillfern', 'user', 'Demo', '7']) {
      expect(text).toContain(part)
    }
    expect(row.get('a').attributes('href')).toBe('/u/demo-odessa')
    expect(row.findAll('button').map((b) => b.text())).toEqual(['Verify'])
  })
})

describe('AdminView failures', () => {
  it.each([
    ['News', 'listAdminNews'],
    ['Users', 'listAdminUsers'],
    ['Suggested crates', 'listAdminCrates'],
    ['User created crates', 'listAdminCrates'],
    ['Overview', 'getAdminOverview'],
  ] as const)('shows an error in %s, not an empty list', async (heading, loader) => {
    vi.mocked(admin[loader]).mockRejectedValue(failure(500, 'The shop is shut'))
    const wrapper = await mountAdmin()
    const failed = section(wrapper, heading)
    expect(failed.get('[role="alert"]').text()).toContain('The shop is shut')
    expect(failed.find('li').exists()).toBe(false)
    expect(failed.text()).not.toMatch(/\bNo \w/)
    // The others carry on.
    if (heading !== 'Users') expect(section(wrapper, 'Users').text()).toContain('demo-odessa')
  })

  it('Try again reloads just that section', async () => {
    vi.mocked(admin.listAdminUsers).mockRejectedValueOnce(failure(500, 'The shop is shut'))
    const wrapper = await mountAdmin()
    await buttonNamed(section(wrapper, 'Users'), 'Try again').trigger('click')
    await flushPromises()
    expect(section(wrapper, 'Users').find('[role="alert"]').exists()).toBe(false)
    expect(section(wrapper, 'Users').text()).toContain('demo-odessa')
    expect(admin.listAdminNews).toHaveBeenCalledTimes(1)
  })

  it('shows the error when a refresh fails, though old data is held', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.createAdminNews).mockResolvedValue(news[0]!)
    vi.mocked(admin.listAdminNews).mockRejectedValue(failure(500, 'Refresh broke'))
    const form = section(wrapper, 'News').get('form')
    await form.trigger('submit')
    await flushPromises()
    expect(section(wrapper, 'News').get('[role="alert"]').text()).toContain('Refresh broke')
  })
})

describe('AdminView news', () => {
  it('creates an item and refreshes the list and the counts', async () => {
    const wrapper = await mountAdmin()
    const created: AdminNewsItem = { ...news[1]!, id: 3, title: 'Fresh wax' }
    vi.mocked(admin.createAdminNews).mockResolvedValue(created)
    vi.mocked(admin.listAdminNews).mockResolvedValue([created, ...news])

    const form = section(wrapper, 'News').get('form')
    const [title, source] = form.findAll('input')
    await title!.setValue('Fresh wax')
    await form.get('textarea').setValue('Just in.')
    await source!.setValue('The Gazette')
    await form.trigger('submit')
    await flushPromises()

    expect(admin.createAdminNews).toHaveBeenCalledWith({
      title: 'Fresh wax',
      summary: 'Just in.',
      source: 'The Gazette',
    })
    expect(section(wrapper, 'News').find('ul').text()).toContain('Fresh wax')
    expect(admin.getAdminOverview).toHaveBeenCalledTimes(2)
    expect((title!.element as HTMLInputElement).value).toBe('')
  })

  it('disables submit in flight and does not post twice', async () => {
    const wrapper = await mountAdmin()
    const pending = deferred<AdminNewsItem>()
    vi.mocked(admin.createAdminNews).mockReturnValue(pending.promise)

    const form = section(wrapper, 'News').get('form')
    await form.trigger('submit')
    expect(form.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    expect(admin.createAdminNews).toHaveBeenCalledTimes(1)

    pending.resolve(news[0]!)
    await flushPromises()
    expect(form.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('edits inline', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.updateAdminNews).mockResolvedValue(news[1]!)
    const row = rowWith(section(wrapper, 'News'), 'Fair moves indoors')
    await buttonNamed(row, 'Edit').trigger('click')
    const title = row.get('input')
    expect((title.element as HTMLInputElement).value).toBe('Fair moves indoors')
    await title.setValue('Fair moves outdoors')
    await row.get('form').trigger('submit')
    await flushPromises()
    expect(admin.updateAdminNews).toHaveBeenCalledWith(2, {
      title: 'Fair moves outdoors',
      summary: 'The fair has a new home.',
      source: 'Dollar Bin Weekly',
    })
    expect(row.find('form').exists()).toBe(false)
  })

  it('deletes only after confirming', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.deleteAdminNews).mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const row = rowWith(section(wrapper, 'News'), 'Fair moves indoors')

    await buttonNamed(row, 'Delete').trigger('click')
    expect(admin.deleteAdminNews).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await buttonNamed(row, 'Delete').trigger('click')
    await flushPromises()
    expect(admin.deleteAdminNews).toHaveBeenCalledWith(2)
    expect(admin.listAdminNews).toHaveBeenCalledTimes(2)
  })
})

describe('AdminView crates', () => {
  it('creates a suggested crate and refreshes the list', async () => {
    const wrapper = await mountAdmin()
    const made = crate({ id: 10, name: 'New Picks', recommendedRank: 2 })
    vi.mocked(admin.createAdminCrate).mockResolvedValue(made)
    vi.mocked(admin.listAdminCrates).mockResolvedValue([...crates, made])

    const form = section(wrapper, 'New crate').get('form')
    await form.get('input:not([type="checkbox"])').setValue('New Picks')
    await form.get('input[type="checkbox"]').setValue(true)
    await form.trigger('submit')
    await flushPromises()

    expect(admin.createAdminCrate).toHaveBeenCalledWith({ name: 'New Picks', suggested: true })
    expect(section(wrapper, 'Suggested crates').text()).toContain('New Picks')
  })

  it('disables suggesting an ownerless crate and says why', async () => {
    const wrapper = await mountAdmin()
    const row = rowWith(section(wrapper, 'User created crates'), 'Old Boxes')
    expect(buttonNamed(row, 'Suggest').attributes('disabled')).toBeDefined()
    expect(row.text()).toContain("can't be suggested")
  })

  it('still lets an ownerless suggested crate be turned off', async () => {
    vi.mocked(admin.listAdminCrates).mockResolvedValue([
      crate({ id: 9, name: 'Old Boxes', ownerUsername: null, recommendedRank: 1 }),
    ])
    const wrapper = await mountAdmin()
    const row = rowWith(section(wrapper, 'Suggested crates'), 'Old Boxes')
    expect(buttonNamed(row, 'Stop suggesting').attributes('disabled')).toBeUndefined()
  })

  it('moves a crate between the lists when toggled', async () => {
    const wrapper = await mountAdmin()
    const updated = { ...crates[1]!, recommendedRank: 2 }
    vi.mocked(admin.setCrateSuggested).mockResolvedValue(updated)
    vi.mocked(admin.listAdminCrates).mockResolvedValue([crates[0]!, updated, crates[2]!])

    const row = rowWith(section(wrapper, 'User created crates'), 'Porch Folk')
    await buttonNamed(row, 'Suggest').trigger('click')
    await flushPromises()

    expect(admin.setCrateSuggested).toHaveBeenCalledWith(8, true)
    expect(section(wrapper, 'Suggested crates').text()).toContain('Porch Folk')
    expect(section(wrapper, 'User created crates').text()).not.toContain('Porch Folk')
  })

  it('shows a refused toggle on the row and keeps the crate where it was', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.setCrateSuggested).mockRejectedValue(failure(409, 'Refused'))
    const row = rowWith(section(wrapper, 'User created crates'), 'Porch Folk')
    await buttonNamed(row, 'Suggest').trigger('click')
    await flushPromises()
    expect(row.get('[role="alert"]').text()).toContain('Refused')
    expect(section(wrapper, 'User created crates').text()).toContain('Porch Folk')
  })
})

describe('AdminView library cache', () => {
  async function createCrate(wrapper: VueWrapper) {
    vi.mocked(admin.createAdminCrate).mockResolvedValue(crates[0]!)
    await section(wrapper, 'New crate').get('form').trigger('submit')
    await flushPromises()
  }

  it('leaves an idle library alone', async () => {
    const wrapper = await mountAdmin()
    const { listCrates } = await import('../api/crates.ts')
    vi.mocked(listCrates).mockClear()
    await createCrate(wrapper)
    expect(useLibraryStore().status).toBe('idle')
    expect(listCrates).not.toHaveBeenCalled()
  })

  it('refetches crates for a loaded library after a create, a toggle and an import', async () => {
    const wrapper = await mountAdmin()
    const { listCrates } = await import('../api/crates.ts')
    await useLibraryStore().load()

    vi.mocked(listCrates).mockClear()
    await createCrate(wrapper)
    expect(listCrates).toHaveBeenCalledTimes(1)

    vi.mocked(listCrates).mockClear()
    vi.mocked(admin.setCrateSuggested).mockResolvedValue(crates[1]!)
    const row = rowWith(section(wrapper, 'User created crates'), 'Porch Folk')
    await buttonNamed(row, 'Suggest').trigger('click')
    await flushPromises()
    expect(listCrates).toHaveBeenCalledTimes(1)

    vi.mocked(listCrates).mockClear()
    vi.mocked(admin.runAdminImport).mockResolvedValue({ crates: 1, albums: 0, tracks: 0, news: 0 })
    await jsonBox(wrapper).setValue('{"crates":[{"name":"X"}]}')
    await importForm(wrapper).trigger('submit')
    await flushPromises()
    expect(listCrates).toHaveBeenCalledTimes(1)
  })
})

describe('AdminView verification', () => {
  it('toggles a row without reloading the list, and leaves the session alone', async () => {
    const wrapper = await mountAdmin()
    const list = section(wrapper, 'Users')
    const row = () => rowWith(list, 'demo-odessa')
    expect(row().find('.verified-badge').exists()).toBe(false)

    vi.mocked(setVerified).mockResolvedValue(profile(true))
    await buttonNamed(row(), 'Verify').trigger('click')
    await flushPromises()
    expect(setVerified).toHaveBeenLastCalledWith('demo-odessa', true)
    expect(row().find('.verified-badge').exists()).toBe(true)
    expect(row().text()).toContain('Verified')

    vi.mocked(setVerified).mockResolvedValue(profile(false))
    await buttonNamed(row(), 'Unverify').trigger('click')
    await flushPromises()
    expect(setVerified).toHaveBeenLastCalledWith('demo-odessa', false)
    expect(row().find('.verified-badge').exists()).toBe(false)

    expect(admin.listAdminUsers).toHaveBeenCalledTimes(1)
    expect(auth.me).not.toHaveBeenCalled()
  })

  it('refreshes the session when the target is the signed-in admin', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(setVerified).mockResolvedValue(profile(true))
    vi.mocked(auth.me).mockResolvedValue({ ...signedIn, verified: true })
    await buttonNamed(rowWith(section(wrapper, 'Users'), 'Head Admin'), 'Verify').trigger('click')
    await flushPromises()
    expect(auth.me).toHaveBeenCalledTimes(1)
    expect(useSessionStore().user?.verified).toBe(true)
  })

  it('keeps the saved state and says so if the session refresh fails', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(setVerified).mockResolvedValue(profile(true))
    vi.mocked(auth.me).mockRejectedValue(new TypeError('offline'))
    const row = rowWith(section(wrapper, 'Users'), 'Head Admin')
    await buttonNamed(row, 'Verify').trigger('click')
    await flushPromises()
    expect(row.find('.verified-badge').exists()).toBe(true)
    expect(row.get('[role="alert"]').text()).toContain('Saved, but')
  })

  it('shows a failed toggle on the row and leaves it unverified', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(setVerified).mockRejectedValue(failure(403, 'Not allowed'))
    const row = rowWith(section(wrapper, 'Users'), 'demo-odessa')
    await buttonNamed(row, 'Verify').trigger('click')
    await flushPromises()
    expect(row.get('[role="alert"]').text()).toContain('Not allowed')
    expect(row.find('.verified-badge').exists()).toBe(false)
  })
})

describe('AdminView bulk import', () => {
  const box = (w: VueWrapper) => jsonBox(w).element as HTMLTextAreaElement

  it.each(['{ not json', '', '[1, 2]', 'null'])('sends nothing for %j', async (text) => {
    const wrapper = await mountAdmin()
    await jsonBox(wrapper).setValue(text)
    await importForm(wrapper).trigger('submit')
    await flushPromises()
    expect(admin.runAdminImport).not.toHaveBeenCalled()
    expect(importForm(wrapper).get('[role="alert"]').text().length).toBeGreaterThan(0)
    expect(box(wrapper).value).toBe(text)
  })

  it('shows the failing entry from server issues and keeps the text', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.runAdminImport).mockRejectedValue(
      failure(400, 'Request is invalid', [
        { path: 'body/crates/0/albums/1/artist', message: 'Required' },
      ]),
    )
    const text = '{"crates":[{"name":"X","albums":[{},{}]}]}'
    await jsonBox(wrapper).setValue(text)
    await importForm(wrapper).trigger('submit')
    await flushPromises()
    expect(importForm(wrapper).get('[role="alert"]').text()).toContain(
      'crates/0/albums/1/artist: Required',
    )
    expect(box(wrapper).value).toBe(text)
  })

  it('shows a root issue without a stray path', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.runAdminImport).mockRejectedValue(
      failure(400, 'Request is invalid', [
        { path: 'body', message: 'Send at least one crate or news item' },
      ]),
    )
    await jsonBox(wrapper).setValue('{}')
    await importForm(wrapper).trigger('submit')
    await flushPromises()
    const items = importForm(wrapper).findAll('[role="alert"] li')
    expect(items.map((li) => li.text())).toEqual(['Send at least one crate or news item'])
  })

  it('keeps the text on a 413', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.runAdminImport).mockRejectedValue(failure(413, 'Request body is too large'))
    await jsonBox(wrapper).setValue('{"crates":[]}')
    await importForm(wrapper).trigger('submit')
    await flushPromises()
    expect(importForm(wrapper).get('[role="alert"]').text()).toContain('too large')
    expect(box(wrapper).value).toBe('{"crates":[]}')
  })

  it('on success shows counts, clears the text and refreshes every section', async () => {
    const wrapper = await mountAdmin()
    vi.mocked(admin.runAdminImport).mockResolvedValue({ crates: 1, albums: 2, tracks: 0, news: 1 })
    await jsonBox(wrapper).setValue('{"crates":[{"name":"X"}]}')
    await importForm(wrapper).trigger('submit')
    await flushPromises()

    expect(admin.runAdminImport).toHaveBeenCalledWith({ crates: [{ name: 'X' }] })
    const status = importForm(wrapper).get('[role="status"]').text()
    expect(status).toBe('Imported 1 crate, 2 albums, 0 tracks, 1 news item.')
    expect(box(wrapper).value).toBe('')
    for (const loader of [
      admin.getAdminOverview,
      admin.listAdminNews,
      admin.listAdminCrates,
      admin.listAdminUsers,
    ]) {
      expect(loader).toHaveBeenCalledTimes(2)
    }
  })

  it('disables Import in flight and does not post twice', async () => {
    const wrapper = await mountAdmin()
    const pending = deferred<{ crates: number; albums: number; tracks: number; news: number }>()
    vi.mocked(admin.runAdminImport).mockReturnValue(pending.promise)
    await jsonBox(wrapper).setValue('{"crates":[{"name":"X"}]}')
    await importForm(wrapper).trigger('submit')
    expect(importForm(wrapper).get('button').attributes('disabled')).toBeDefined()
    await importForm(wrapper).trigger('submit')
    expect(admin.runAdminImport).toHaveBeenCalledTimes(1)
    pending.resolve({ crates: 1, albums: 0, tracks: 0, news: 0 })
    await flushPromises()
    expect(importForm(wrapper).get('button').attributes('disabled')).toBeUndefined()
  })

  it('warns about duplicates and suggests a backup', async () => {
    const text = section(await mountAdmin(), 'Bulk import').text()
    expect(text).toContain('not de-duplicated')
    expect(text).toContain('db:backup')
  })
})
