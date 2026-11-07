import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PublicUser, SignupInput } from '@frisson/shared'
import * as api from '../api/auth.ts'

// Data classification: CONFIDENTIAL (PII). Holds the signed-in user's email and name.
// Who is signed in. The API is the real gatekeeper (it checks every change); this store
// only decides which buttons and pages to show.
export const useSessionStore = defineStore('session', () => {
  const user = ref<PublicUser | null>(null)
  const loaded = ref(false)
  let loading: Promise<void> | null = null

  const signedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  // TEMPORARY: keeps the views typechecking until T6 switches them to canEditCrate.
  const canEdit = computed(() => signedIn.value)

  /** Asks the API once; later calls reuse the answer (or the request in flight). */
  function load() {
    loading ??= api
      .me()
      .then((result) => {
        user.value = result
        loaded.value = true
      })
      .catch(() => {
        user.value = null // can't tell: show the signed-out view
        loaded.value = true
        loading = null // try again next time
      })
    return loading
  }

  function signedInAs(result: PublicUser) {
    user.value = result
    loaded.value = true
    loading = Promise.resolve()
  }

  async function logIn(email: string, password: string) {
    signedInAs(await api.logIn({ email, password }))
  }

  async function signUp(input: SignupInput) {
    signedInAs(await api.signUp(input))
  }

  async function logOut() {
    await api.logOut()
    user.value = null
    loaded.value = true
    loading = Promise.resolve()
  }

  return { user, loaded, signedIn, isAdmin, canEdit, load, logIn, signUp, logOut }
})
