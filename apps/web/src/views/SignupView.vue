<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { signupInput } from '@frisson/shared'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { useSessionStore } from '../stores/session.ts'
import { safeRedirect } from '../utils/redirect.ts'

// Data classification: CONFIDENTIAL (PII + credentials). Email, name and password only
// live in this component's state until they are sent.
const props = defineProps<{ next?: string }>()
const session = useSessionStore()
const router = useRouter()

const email = ref('')
const username = ref('')
const displayName = ref('')
const password = ref('')
const error = ref<string | null>(null)
/** Per-field messages, from the client-side check or the API's 400 issues. */
const fieldErrors = ref<Record<string, string>>({})
const busy = ref(false)
const emailInput = useTemplateRef<HTMLInputElement>('email-input')

const canSubmit = computed(
  () => !busy.value && !!email.value && !!username.value && !!password.value,
)

onMounted(() => {
  document.title = 'Sign up · Frisson'
  emailInput.value?.focus()
})

function describedBy(field: string, hint?: string) {
  const ids = [hint, fieldErrors.value[field] ? `${field}-error` : undefined].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

async function submit() {
  error.value = null
  fieldErrors.value = {}

  const parsed = signupInput.safeParse({
    email: email.value,
    username: username.value,
    displayName: displayName.value.trim() || undefined,
    password: password.value,
  })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? 'form')
      fieldErrors.value[field] ??= issue.message
    }
    return
  }

  busy.value = true
  try {
    await session.signUp(parsed.data)
    await router.replace(safeRedirect(props.next))
  } catch (err) {
    // 409: email or username taken. 400: the API's own validation, with per-field issues.
    if (err instanceof ApiRequestError && err.status === 400 && err.body?.issues?.length) {
      for (const issue of err.body.issues) {
        const field = issue.path.split('.')[0] || 'form'
        fieldErrors.value[field] ??= issue.message
      }
    }
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="card" novalidate @submit.prevent="submit">
    <h1>Sign up</h1>
    <p>Make an account to build crates of your own. Everyone can browse.</p>

    <label for="email">Email</label>
    <input
      id="email"
      ref="email-input"
      v-model="email"
      type="email"
      autocomplete="email"
      required
      :aria-invalid="!!fieldErrors.email"
      :aria-describedby="describedBy('email')"
    />
    <p v-if="fieldErrors.email" id="email-error" class="error">{{ fieldErrors.email }}</p>

    <label for="username">Username</label>
    <input
      id="username"
      v-model="username"
      type="text"
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
      required
      :aria-invalid="!!fieldErrors.username"
      :aria-describedby="describedBy('username', 'username-hint')"
    />
    <p id="username-hint" class="hint">3-32 lower-case letters, digits, - or _</p>
    <p v-if="fieldErrors.username" id="username-error" class="error">
      {{ fieldErrors.username }}
    </p>

    <label for="display-name">Display name <span class="optional">(optional)</span></label>
    <input
      id="display-name"
      v-model="displayName"
      type="text"
      autocomplete="nickname"
      :aria-invalid="!!fieldErrors.displayName"
      :aria-describedby="describedBy('displayName')"
    />
    <p v-if="fieldErrors.displayName" id="displayName-error" class="error">
      {{ fieldErrors.displayName }}
    </p>

    <label for="password">Password</label>
    <input
      id="password"
      v-model="password"
      type="password"
      autocomplete="new-password"
      minlength="8"
      required
      :aria-invalid="!!fieldErrors.password"
      :aria-describedby="describedBy('password', 'password-hint')"
    />
    <p id="password-hint" class="hint">At least 8 characters</p>
    <p v-if="fieldErrors.password" id="password-error" class="error">
      {{ fieldErrors.password }}
    </p>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <button type="submit" class="btn" :disabled="!canSubmit">
      {{ busy ? 'Signing up…' : 'Sign up' }}
    </button>

    <p class="switch">
      Already have an account?
      <RouterLink :to="{ name: 'login', query: props.next ? { next: props.next } : {} }">
        Log in
      </RouterLink>
    </p>
  </form>
</template>

<style scoped>
.card {
  max-width: 22rem;
  margin: 2rem auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.5rem;
  background: #fffdf7;
  border: 1px solid var(--paper-dark);
  box-shadow: 4px 4px 0 rgb(0 0 0 / 0.1);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
}

p {
  margin: 0 0 0.5rem;
  color: var(--ink-soft);
}

label {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.optional {
  font-size: 0.75rem;
}

.hint {
  margin: -0.25rem 0 0;
  font-size: 0.8rem;
}

.error {
  color: var(--marker-red);
  margin: 0;
}

.btn {
  margin: 0.5rem 0 0;
  align-self: flex-start;
}

.btn:disabled {
  opacity: 0.6;
}

.switch {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}

.switch a {
  color: var(--marker-red);
}
</style>
