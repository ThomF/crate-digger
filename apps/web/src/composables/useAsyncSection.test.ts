import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '../api/client.ts'
import { useAsyncSection } from './useAsyncSection.ts'

// A fake loader: each call waits until the test settles it, so we control the timing.
function controlledLoader<T>() {
  const calls: { resolve: (value: T) => void; reject: (err: unknown) => void }[] = []
  const loader = () =>
    new Promise<T>((resolve, reject) => {
      calls.push({ resolve, reject })
    })
  return { calls, loader }
}

const apiFailure = (message: string) =>
  new ApiRequestError(500, { statusCode: 500, error: 'Internal Server Error', message })

describe('useAsyncSection', () => {
  it('starts in the loading state without requesting anything', () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)

    expect(section.status.value).toBe('loading')
    expect(section.data.value).toBeNull()
    expect(section.error.value).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('load() moves to ready with the data', async () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)

    const done = section.load()
    expect(section.status.value).toBe('loading')

    calls[0]!.resolve(['a'])
    await done
    expect(section.status.value).toBe('ready')
    expect(section.data.value).toEqual(['a'])
    expect(section.error.value).toBeNull()
  })

  it('load() moves to error with a message and does not reject', async () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)

    const done = section.load()
    calls[0]!.reject(apiFailure('No news today'))
    await expect(done).resolves.toBeUndefined()

    expect(section.status.value).toBe('error')
    expect(section.error.value).toBe('No news today')
    expect(section.data.value).toBeNull()
  })

  it('catches a loader that throws before returning a promise', async () => {
    const section = useAsyncSection<string[]>(() => {
      throw new Error('boom')
    })

    await expect(section.load()).resolves.toBeUndefined()
    expect(section.status.value).toBe('error')
    expect(section.error.value).toBe('Something went wrong')
  })

  it('load() after a failure shows loading again and can recover', async () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)

    const first = section.load()
    calls[0]!.reject(apiFailure('Nope'))
    await first

    const second = section.load()
    expect(section.status.value).toBe('loading')
    expect(section.error.value).toBeNull()

    calls[1]!.resolve(['a'])
    await second
    expect(section.status.value).toBe('ready')
    expect(section.data.value).toEqual(['a'])
  })

  it('refresh() keeps the status and old data until new data arrives', async () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)
    const first = section.load()
    calls[0]!.resolve(['old'])
    await first

    const refreshing = section.refresh()
    expect(calls).toHaveLength(2)
    expect(section.status.value).toBe('ready')
    expect(section.data.value).toEqual(['old'])

    calls[1]!.resolve(['new'])
    await refreshing
    expect(section.status.value).toBe('ready')
    expect(section.data.value).toEqual(['new'])
  })

  it('refresh() moves to error if it fails, then a later refresh recovers', async () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)
    const first = section.load()
    calls[0]!.resolve(['old'])
    await first

    const failing = section.refresh()
    calls[1]!.reject(apiFailure('Nope'))
    await expect(failing).resolves.toBeUndefined()
    expect(section.status.value).toBe('error')
    expect(section.error.value).toBe('Nope')
    expect(section.data.value).toEqual(['old'])

    const recovering = section.refresh()
    calls[2]!.resolve(['new'])
    await recovering
    expect(section.status.value).toBe('ready')
    expect(section.error.value).toBeNull()
    expect(section.data.value).toEqual(['new'])
  })

  it('ignores a slow older response that arrives after a newer one', async () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)

    const older = section.refresh()
    const newer = section.refresh()
    calls[1]!.resolve(['newer'])
    await newer
    calls[0]!.resolve(['older'])
    await older

    expect(section.data.value).toEqual(['newer'])
  })

  it('ignores an older failure once a newer request has been made', async () => {
    const { calls, loader } = controlledLoader<string[]>()
    const section = useAsyncSection(loader)

    const older = section.refresh()
    const newer = section.refresh()
    calls[0]!.reject(apiFailure('Old failure'))
    await older
    expect(section.error.value).toBeNull()

    calls[1]!.resolve(['newer'])
    await newer
    expect(section.status.value).toBe('ready')
    expect(section.data.value).toEqual(['newer'])
  })

  it('keeps instances independent, so one failure does not touch another', async () => {
    const news = controlledLoader<string[]>()
    const crates = controlledLoader<string[]>()
    const newsSection = useAsyncSection(news.loader)
    const cratesSection = useAsyncSection(crates.loader)

    const loads = [newsSection.load(), cratesSection.load()]
    news.calls[0]!.reject(apiFailure('Nope'))
    crates.calls[0]!.resolve(['a'])
    await Promise.all(loads)

    expect(newsSection.status.value).toBe('error')
    expect(cratesSection.status.value).toBe('ready')
    expect(cratesSection.error.value).toBeNull()
    expect(cratesSection.data.value).toEqual(['a'])
  })
})
