import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { SessionInfo } from '@crate-digger/shared'
import * as api from '../api/session.ts'

// Whether this visitor may change the collection. The API is the real gatekeeper (it
// checks every change); this store only decides which buttons to show.
export const useSessionStore = defineStore('session', () => {
  const info = ref<SessionInfo | null>(null)
  let loading: Promise<void> | null = null

  const canEdit = computed(() => info.value?.canEdit ?? false)
  const canLogIn = computed(() => info.value?.canLogIn ?? false)

  /** Asks the API once; later calls reuse the answer (or the request in flight). */
  function load() {
    loading ??= api
      .getSession()
      .then((result) => void (info.value = result))
      .catch(() => {
        info.value = { canEdit: false, canLogIn: false } // can't tell: show the safe view
        loading = null // try again next time
      })
    return loading
  }

  async function logIn(password: string) {
    info.value = await api.logIn(password)
  }

  async function logOut() {
    info.value = await api.logOut()
  }

  return { info, canEdit, canLogIn, load, logIn, logOut }
})
