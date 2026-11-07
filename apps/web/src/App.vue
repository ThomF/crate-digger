<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { errorMessage } from './api/client.ts'
import { useSessionStore } from './stores/session.ts'

const session = useSessionStore()
const router = useRouter()
onMounted(() => session.load())

const logOutError = ref<string | null>(null)

async function logOut() {
  logOutError.value = null
  try {
    await session.logOut()
  } catch (err) {
    logOutError.value = errorMessage(err)
    return
  }
  if (router.currentRoute.value.meta.requiresAuth) await router.push({ name: 'library' })
}
</script>

<template>
  <header class="masthead">
    <RouterLink to="/" class="sign">Frisson</RouterLink>
    <p class="tagline">Used &amp; new vinyl · est. 1994</p>

    <nav v-if="session.loaded" class="user-menu" aria-label="Account">
      <template v-if="session.user">
        <span class="who" :title="`@${session.user.username}`">
          {{ session.user.displayName || session.user.username }}
        </span>
        <button type="button" @click="logOut">Log out</button>
      </template>
      <template v-else>
        <RouterLink v-if="$route.name !== 'login'" :to="{ name: 'login' }">Log in</RouterLink>
        <RouterLink v-if="$route.name !== 'signup'" :to="{ name: 'signup' }">Sign up</RouterLink>
      </template>
      <span v-if="logOutError" class="menu-error" role="alert">{{ logOutError }}</span>
    </nav>
  </header>

  <main class="page">
    <RouterView />
  </main>
</template>

<style scoped>
.masthead {
  text-align: center;
  padding: 2rem 1rem 1rem;
  border-bottom: 3px double var(--cardboard-dark);
}

.sign {
  font-family: var(--font-display);
  font-size: clamp(2rem, 7vw, 3.5rem);
  font-weight: bold;
  letter-spacing: 0.05em;
  color: var(--marker-red);
  text-shadow: 3px 3px 0 var(--cardboard);
  text-decoration: none;
}

.tagline {
  font-family: var(--font-display);
  color: var(--ink-soft);
  margin: 0.25rem 0 0;
}

.user-menu {
  display: flex;
  justify-content: center;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.75rem;
  font-family: var(--font-display);
  font-size: 0.85rem;
}

.who {
  color: var(--ink);
  font-weight: bold;
}

.user-menu button {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  text-decoration: underline;
  color: var(--ink-soft);
  cursor: pointer;
}

.user-menu a {
  color: var(--ink-soft);
}

.menu-error {
  color: var(--marker-red);
}

.page {
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
</style>
