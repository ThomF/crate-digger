import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PublicUser, SignupInput, UpdateProfileRequest } from '@frisson/shared'
import * as api from '../api/auth.ts'
import * as profiles from '../api/profiles.ts'

// Data classification: CONFIDENTIAL (PII). Holds the signed-in user's email and name.
// Who is signed in. The API is the real gatekeeper (it checks every change); this store
// only decides which buttons and pages to show.
export const useSessionStore = defineStore('session', () => {
  const user = ref<PublicUser | null>(null)
  const loaded = ref(false)
  let loading: Promise<void> | null = null

  const signedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')

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

  /** Asks the API again (after a change) and replaces the user, e.g. a new avatar. */
  async function refresh() {
    const result = await api.me()
    user.value = result
    loaded.value = true
    loading = Promise.resolve()
  }

  // Profile changes go through here so the header (avatar, display name) stays current.
  async function saveProfile(input: UpdateProfileRequest) {
    const profile = await profiles.updateProfile(input)
    await refresh()
    return profile
  }

  async function saveAvatar(file: File) {
    const profile = await profiles.uploadAvatar(file)
    await refresh()
    return profile
  }

  async function deleteAvatar() {
    const profile = await profiles.removeAvatar()
    await refresh()
    return profile
  }

  return {
    user,
    loaded,
    signedIn,
    isAdmin,
    load,
    refresh,
    logIn,
    signUp,
    logOut,
    saveProfile,
    saveAvatar,
    deleteAvatar,
  }
})
