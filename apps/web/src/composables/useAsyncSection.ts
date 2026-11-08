import { ref, shallowRef } from 'vue'
import { errorMessage } from '../api/client.ts'

export type AsyncSectionStatus = 'loading' | 'ready' | 'error'

/**
 * The state of one independently loaded part of a page. Use one instance per section, so a
 * failure in one never affects another.
 *
 * - load() shows the loading status: first load, and "Try again".
 * - refresh() re-requests silently: the old data stays until new data arrives. If it fails the
 *   status moves to 'error' with the old data still in `data`.
 *
 * Neither ever rejects, and only the newest request counts, so a slow old response can't
 * overwrite a newer one. Nothing runs until the caller calls load().
 */
export function useAsyncSection<T>(loader: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const status = ref<AsyncSectionStatus>('loading')
  const error = ref<string | null>(null)

  let latest = 0

  async function run() {
    const request = ++latest
    try {
      const result = await loader()
      if (request !== latest) return // overtaken by a newer request
      data.value = result
      error.value = null
      status.value = 'ready'
    } catch (err) {
      if (request !== latest) return // overtaken; only the newest request may report
      error.value = errorMessage(err)
      status.value = 'error'
    }
  }

  function load() {
    status.value = 'loading'
    error.value = null
    return run()
  }

  function refresh() {
    return run()
  }

  return { data, status, error, load, refresh }
}
