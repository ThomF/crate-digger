<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { errorMessage } from '../api/client.ts'
import { useSessionStore } from '../stores/session.ts'
import { safeRedirect } from '../utils/redirect.ts'

// Data classification: CONFIDENTIAL (credentials). The password only lives in this
// component's state until it is sent.
const props = defineProps<{ next?: string }>()
const session = useSessionStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const emailInput = useTemplateRef<HTMLInputElement>('email-input')
const passwordInput = useTemplateRef<HTMLInputElement>('password-input')

onMounted(() => {
  document.title = 'Log in · Frisson'
  emailInput.value?.focus()
})

async function submit() {
  busy.value = true
  error.value = null
  try {
    await session.logIn(email.value, password.value)
    await router.replace(safeRedirect(props.next))
  } catch (err) {
    error.value = errorMessage(err)
    password.value = ''
    passwordInput.value?.focus()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="card" @submit.prevent="submit">
    <h1>Log in</h1>
    <p>Log in to add, edit and rearrange your crates. Everyone can browse.</p>

    <label for="email">Email</label>
    <input
      id="email"
      ref="email-input"
      v-model="email"
      type="email"
      autocomplete="email"
      required
      :aria-invalid="!!error"
      :aria-describedby="error ? 'login-error' : undefined"
    />

    <label for="password">Password</label>
    <input
      id="password"
      ref="password-input"
      v-model="password"
      type="password"
      autocomplete="current-password"
      required
      :aria-invalid="!!error"
      :aria-describedby="error ? 'login-error' : undefined"
    />
    <p v-if="error" id="login-error" class="error" role="alert">{{ error }}</p>

    <button type="submit" class="btn" :disabled="busy || !email || !password">
      {{ busy ? 'Checking…' : 'Log in' }}
    </button>

    <p class="switch">
      New here?
      <RouterLink :to="{ name: 'signup', query: props.next ? { next: props.next } : {} }">
        Sign up
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
