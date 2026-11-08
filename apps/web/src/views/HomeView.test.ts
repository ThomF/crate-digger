import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { CrateCard, NewsItem } from '@frisson/shared'
import { ApiRequestError } from '../api/client.ts'
import { listRecommendedCrates } from '../api/crates.ts'
import { listNews } from '../api/news.ts'
import HomeView from './HomeView.vue'
import source from './HomeView.vue?raw'

vi.mock('../api/news.ts', () => ({ listNews: vi.fn() }))
vi.mock('../api/crates.ts', () => ({ listRecommendedCrates: vi.fn() }))
const listNewsMock = vi.mocked(listNews)
const listRecommendedMock = vi.mocked(listRecommendedCrates)

const NOTE = 'Curated demo picks. No AI model is involved yet.'

const news: NewsItem[] = [
  {
    id: 1,
    title: 'Pressing plant reopens',
    summary: 'A long shuttered plant is running again.',
    source: 'The Wax Gazette',
    publishedAt: '2026-10-27T09:00:00.000Z',
  },
  {
    id: 2,
    title: 'Record fair moves indoors',
    summary: 'The fair has a new home this winter.',
    source: 'Dollar Bin Weekly',
    publishedAt: '2026-10-20T09:00:00.000Z',
  },
]

const crates: CrateCard[] = [
  {
    id: 7,
    name: 'Lamplit Dub Hours',
    color: '#2f6fa3',
    label: 'DUB / AFTER DARK',
    albumCount: 5,
    createdAt: '2026-05-01T10:00:00.000Z',
    ownerUsername: 'demo-odessa',
    ownerDisplayName: 'Odessa Quillfern',
  },
  {
    id: 8,
    name: 'Porch Folk',
    color: '#c8a374',
    label: null,
    albumCount: 1,
    createdAt: '2026-05-02T10:00:00.000Z',
    ownerUsername: 'demo-tomasz',
    ownerDisplayName: 'Tomasz Brindlewick',
  },
]

const apiFailure = (message: string) =>
  new ApiRequestError(500, { statusCode: 500, error: 'Internal Server Error', message })

const Blank = defineComponent({ render: () => null })

async function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Blank },
      { path: '/crates/:id(\\d+)', name: 'crate', component: Blank },
      { path: '/shelf', name: 'library', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mount(HomeView, { global: { plugins: [router] } })
}

const newsSection = (w: VueWrapper) => w.get('section.news')
const recommendedSection = (w: VueWrapper) => w.get('section.recommended')
const button = (section: ReturnType<typeof newsSection>) => section.get('[role="alert"] button')

beforeEach(() => {
  listNewsMock.mockReset().mockResolvedValue(news)
  listRecommendedMock.mockReset().mockResolvedValue(crates)
})

describe('HomeView', () => {
  it('has both headings and sets the title', async () => {
    document.title = 'something else'
    const wrapper = await mountHome()
    await flushPromises()
    const headings = wrapper.findAll('h2').map((h) => h.text())
    expect(headings).toEqual(['Music news', 'Recommended crates'])
    expect(document.title).toBe('Home · Frisson')
  })

  it('shows every news field in place, with the Demo label and no links', async () => {
    const wrapper = await mountHome()
    await flushPromises()
    const articles = newsSection(wrapper).findAll('article')
    expect(articles).toHaveLength(2)
    const first = articles[0]!
    expect(first.text()).toContain('Pressing plant reopens')
    expect(first.text()).toContain('A long shuttered plant is running again.')
    expect(first.text()).toContain('The Wax Gazette')
    expect(first.text()).toContain('Demo')
    expect(first.get('time').attributes('datetime')).toBe('2026-10-27T09:00:00.000Z')
    expect(first.get('time').text()).toBe('Oct 27, 2026')
    expect(newsSection(wrapper).find('a').exists()).toBe(false)
  })

  it('shows one card per crate, linked, with name, count and owner', async () => {
    const wrapper = await mountHome()
    await flushPromises()
    const cards = recommendedSection(wrapper).findAll('.crate-card')
    expect(cards).toHaveLength(2)

    const [labelled, unlabelled] = [cards[0]!, cards[1]!]
    expect(labelled.get('a').attributes('href')).toBe('/crates/7')
    expect(labelled.get('a').text()).toBe('DUB / AFTER DARK')
    expect(labelled.text()).toContain('Lamplit Dub Hours')
    expect(labelled.text()).toContain('5 records')
    expect(labelled.text()).toContain('Odessa Quillfern')
    expect(labelled.text()).toContain('@demo-odessa')

    expect(unlabelled.get('a').attributes('href')).toBe('/crates/8')
    expect(unlabelled.get('a').text()).toBe('Porch Folk')
    expect(unlabelled.text()).toContain('1 record')
    expect(unlabelled.text()).not.toContain('1 records')
  })

  it('has the exact note, the only AI in the section', async () => {
    const wrapper = await mountHome()
    await flushPromises()
    const text = recommendedSection(wrapper).text()
    expect(text).toContain(NOTE)
    expect(text.match(/AI/g)).toHaveLength(1)
  })

  it.each([
    ['loading', () => new Promise<CrateCard[]>(() => {})],
    ['error', () => Promise.reject(new Error('boom'))],
    ['empty', () => Promise.resolve([])],
  ])('keeps the note and a single AI while %s', async (_state, impl) => {
    listRecommendedMock.mockImplementation(impl)
    const wrapper = await mountHome()
    await flushPromises()
    const text = recommendedSection(wrapper).text()
    expect(text).toContain(NOTE)
    expect(text.match(/AI/g)).toHaveLength(1)
  })

  it('never upper-cases its copy, which would turn Try again into another AI', () => {
    expect(source).not.toContain('text-transform')
  })

  it('renders no HTML from strings and stays off the library store and the crate box', () => {
    expect(source).not.toContain('v-html')
    expect(source).not.toContain('CrateBox')
    expect(source).not.toContain('stores/library')
  })

  it('escapes markup in API text', async () => {
    listNewsMock.mockResolvedValue([{ ...news[0]!, title: '<img src=x onerror=alert(1)>' }])
    const wrapper = await mountHome()
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(newsSection(wrapper).get('h3').text()).toBe('<img src=x onerror=alert(1)>')
  })

  it('links to the full crate list from outside the news section', async () => {
    const wrapper = await mountHome()
    await flushPromises()
    const link = wrapper.findAll('a').find((a) => a.text() === 'Browse all crates')
    expect(link?.attributes('href')).toBe('/shelf')
    expect(newsSection(wrapper).text()).not.toContain('Browse all crates')
  })

  it('shows a status message in each section while loading', async () => {
    listNewsMock.mockReturnValue(new Promise(() => {}))
    listRecommendedMock.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountHome()
    await flushPromises()
    expect(newsSection(wrapper).get('.status-note').attributes('role')).toBe('status')
    expect(recommendedSection(wrapper).get('.status-note').attributes('role')).toBe('status')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.find('.crate-card').exists()).toBe(false)
  })

  it('shows the news failure and still renders the crates', async () => {
    listNewsMock.mockRejectedValue(apiFailure('The news is down'))
    const wrapper = await mountHome()
    await flushPromises()
    const alert = newsSection(wrapper).get('[role="alert"]')
    expect(alert.text()).toContain('The news is down')
    expect(button(newsSection(wrapper)).text()).toBe('Try again')
    expect(recommendedSection(wrapper).find('[role="alert"]').exists()).toBe(false)
    expect(recommendedSection(wrapper).findAll('.crate-card')).toHaveLength(2)
  })

  it('shows the crates failure and still renders the news', async () => {
    listRecommendedMock.mockRejectedValue(apiFailure('No crates today'))
    const wrapper = await mountHome()
    await flushPromises()
    const alert = recommendedSection(wrapper).get('[role="alert"]')
    expect(alert.text()).toContain('No crates today')
    expect(button(recommendedSection(wrapper)).text()).toBe('Try again')
    expect(newsSection(wrapper).find('[role="alert"]').exists()).toBe(false)
    expect(newsSection(wrapper).findAll('article')).toHaveLength(2)
  })

  it('Try again re-requests only the failed section, showing loading then the data', async () => {
    listNewsMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountHome()
    await flushPromises()
    expect(listNewsMock).toHaveBeenCalledTimes(1)

    let finish: (items: NewsItem[]) => void = () => {}
    listNewsMock.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    await button(newsSection(wrapper)).trigger('click')

    expect(listNewsMock).toHaveBeenCalledTimes(2)
    expect(listRecommendedMock).toHaveBeenCalledTimes(1)
    expect(newsSection(wrapper).find('[role="alert"]').exists()).toBe(false)
    expect(newsSection(wrapper).get('.status-note').attributes('role')).toBe('status')

    finish(news)
    await flushPromises()
    expect(newsSection(wrapper).findAll('article')).toHaveLength(2)
  })

  it('stays in the alert when Try again fails too', async () => {
    listRecommendedMock.mockRejectedValue(new Error('boom'))
    const wrapper = await mountHome()
    await flushPromises()
    await button(recommendedSection(wrapper)).trigger('click')
    await flushPromises()
    expect(listRecommendedMock).toHaveBeenCalledTimes(2)
    expect(recommendedSection(wrapper).find('[role="alert"]').exists()).toBe(true)
    expect(recommendedSection(wrapper).text()).toContain(NOTE)
  })

  it('shows an empty state with no error in both sections, as in production', async () => {
    listNewsMock.mockResolvedValue([])
    listRecommendedMock.mockResolvedValue([])
    const wrapper = await mountHome()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(newsSection(wrapper).get('.status-note').text()).not.toBe('')
    const empty = recommendedSection(wrapper).get('.status-note').text()
    expect(empty).not.toBe('')
    expect(empty).not.toMatch(/ai/i)
    expect(wrapper.text()).toContain('Browse all crates')
  })

  it('words the loading message without the letters ai', async () => {
    listRecommendedMock.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountHome()
    expect(recommendedSection(wrapper).get('.status-note').text()).not.toMatch(/ai/i)
  })
})
