<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ProfileLinkInput, PublicProfile, UpdateProfileRequest } from '@frisson/shared'
import { getProfile } from '../api/profiles.ts'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { useSessionStore } from '../stores/session.ts'
import AvatarUpload from '../components/profile/AvatarUpload.vue'
import LinksEditor from '../components/profile/LinksEditor.vue'

// Data classification: PUBLIC. Everything edited here is shown on the public profile page.
// The API decides what may change (it refuses unknown keys); this form only offers the
// fields a person may edit about themselves.

const DISPLAY_NAME_MAX = 60
const BIO_MAX = 500
const LOCATION_MAX = 80

interface ProfileForm {
  displayName: string
  bio: string
  location: string
  links: ProfileLinkInput[]
}

const session = useSessionStore()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref<string | null>(null)
const form = ref<ProfileForm | null>(null)
const avatarUrl = ref<string | null>(null)
const username = ref('')
const saving = ref(false)
const saved = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

function formFrom(profile: PublicProfile): ProfileForm {
  return {
    displayName: profile.displayName,
    bio: profile.bio,
    location: profile.location ?? '',
    // Copies, so editing the form never changes the loaded profile.
    links: profile.links.map((link) => ({ platform: link.platform, url: link.url })),
  }
}

async function load() {
  status.value = 'loading'
  loadError.value = null
  try {
    if (!session.loaded) await session.load() // the router guard usually did this already
    const me = session.user
    if (!me) throw new Error('Not signed in')
    const profile = await getProfile(me.username)
    username.value = profile.username
    avatarUrl.value = profile.avatarUrl
    form.value = formFrom(profile)
    status.value = 'ready'
    document.title = 'Edit your profile · Frisson'
  } catch (err) {
    loadError.value = errorMessage(err)
    status.value = 'error'
  }
}

onMounted(load)

/** Exactly the editable fields, in this order. Blank location is sent as null. */
function payloadFrom(value: ProfileForm): UpdateProfileRequest {
  return {
    displayName: value.displayName,
    bio: value.bio,
    location: value.location.trim() ? value.location : null,
    links: value.links.map((link) => ({ platform: link.platform, url: link.url })),
  }
}

/** API issue paths look like 'body/links/0/url'; key them as 'links.0.url'. */
function errorsFromIssues(err: unknown): Record<string, string> {
  if (!(err instanceof ApiRequestError) || !err.body?.issues?.length) return {}
  const errors: Record<string, string> = {}
  for (const issue of err.body.issues) {
    const key = issue.path
      .replace(/^body\/?/, '')
      .split('/')
      .filter(Boolean)
      .join('.')
    errors[key || 'form'] ??= issue.message
  }
  return errors
}

async function save() {
  if (!form.value || saving.value) return
  saving.value = true
  saved.value = false
  formError.value = null
  fieldErrors.value = {}
  try {
    const profile = await session.saveProfile(payloadFrom(form.value))
    username.value = profile.username
    avatarUrl.value = profile.avatarUrl
    form.value = formFrom(profile)
    saved.value = true
  } catch (err) {
    formError.value = errorMessage(err)
    fieldErrors.value = errorsFromIssues(err)
  } finally {
    saving.value = false
  }
}

function onAvatarChanged(profile: PublicProfile) {
  avatarUrl.value = profile.avatarUrl
}

const bioCount = computed(() => form.value?.bio.length ?? 0)
const describedBy = (field: string) => (fieldErrors.value[field] ? `${field}-error` : undefined)
</script>

<template>
  <p v-if="status === 'loading'" class="status-note">Pulling your card from the file…</p>

  <p v-else-if="status === 'error'" class="status-note is-error" role="alert">
    {{ loadError }}
    <button type="button" class="btn" @click="load">Try again</button>
  </p>

  <template v-else-if="form">
    <h1>Edit your profile</h1>

    <div class="card">
      <AvatarUpload
        :avatar-url="avatarUrl"
        :display-name="form.displayName"
        @changed="onAvatarChanged"
      />

      <form class="fields" novalidate @submit.prevent="save">
        <div v-if="formError" class="form-error" role="alert">
          <p>{{ formError }}</p>
          <p v-if="fieldErrors.form">{{ fieldErrors.form }}</p>
        </div>

        <div class="field">
          <label for="displayName">Display name</label>
          <input
            id="displayName"
            v-model="form.displayName"
            :maxlength="DISPLAY_NAME_MAX"
            autocomplete="nickname"
            :aria-invalid="!!fieldErrors.displayName"
            :aria-describedby="describedBy('displayName')"
          />
          <p v-if="fieldErrors.displayName" id="displayName-error" class="error">
            {{ fieldErrors.displayName }}
          </p>
        </div>

        <div class="field">
          <label for="bio">Bio</label>
          <textarea
            id="bio"
            v-model="form.bio"
            rows="4"
            :maxlength="BIO_MAX"
            placeholder="What you dig for, where you dig, what's spinning…"
            :aria-invalid="!!fieldErrors.bio"
            :aria-describedby="fieldErrors.bio ? 'bio-error bio-count' : 'bio-count'"
          />
          <p id="bio-count" class="count" aria-live="polite">{{ bioCount }}/{{ BIO_MAX }}</p>
          <p v-if="fieldErrors.bio" id="bio-error" class="error">{{ fieldErrors.bio }}</p>
        </div>

        <div class="field">
          <label for="location">Location</label>
          <input
            id="location"
            v-model="form.location"
            :maxlength="LOCATION_MAX"
            placeholder="Optional"
            autocomplete="address-level2"
            :aria-invalid="!!fieldErrors.location"
            :aria-describedby="describedBy('location')"
          />
          <p v-if="fieldErrors.location" id="location-error" class="error">
            {{ fieldErrors.location }}
          </p>
        </div>

        <div class="field">
          <LinksEditor v-model="form.links" :errors="fieldErrors" />
        </div>

        <div class="buttons">
          <button type="submit" class="btn" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save profile' }}
          </button>
          <RouterLink :to="`/u/${username}`" class="link">View your profile</RouterLink>
        </div>

        <p v-if="saved" class="saved" role="status">
          Saved. <RouterLink :to="`/u/${username}`">See it at /u/{{ username }}</RouterLink>
        </p>
      </form>
    </div>
  </template>
</template>

<style scoped>
h1 {
  margin: 0 0 1rem;
}

/* A record-store index card: ruled paper with a red header line. */
.card {
  background:
    linear-gradient(var(--marker-red), var(--marker-red)) 0 2.5rem / 100% 2px no-repeat,
    #fffdf7;
  border: 1px solid var(--paper-dark);
  box-shadow: 4px 4px 0 rgb(0 0 0 / 0.1);
  padding: 3.25rem 1.5rem 1.5rem;
  max-width: 40rem;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

label {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.count {
  margin: 0;
  align-self: flex-end;
  font-family: var(--font-display);
  font-size: 0.75rem;
  color: var(--ink-soft);
}

.error {
  margin: 0;
  color: var(--marker-red);
  font-size: 0.85rem;
}

.form-error {
  padding: 0.5rem 0.75rem;
  border-left: 4px solid var(--marker-red);
  background: #fdecea;
}

.form-error p {
  margin: 0;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.buttons .btn {
  margin-left: 0;
  padding: 0.5rem 1.4rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: progress;
}

.link {
  font-family: var(--font-display);
}

.saved {
  margin: 0;
  font-family: var(--font-display);
  color: var(--ok-green);
}
</style>
