<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useSessionStore } from './stores/session.ts'

const session = useSessionStore()
const router = useRouter()
onMounted(() => session.load())

async function logOut() {
  await session.logOut()
  if (router.currentRoute.value.meta.requiresEdit) router.push({ name: 'library' })
}
</script>

<template>
  <header class="masthead">
    <RouterLink to="/" class="sign">Crate Digger</RouterLink>
    <p class="tagline">Used &amp; new vinyl · est. 1994</p>
  </header>

  <main class="page">
    <RouterView />
  </main>

  <footer v-if="session.canLogIn && $route.name !== 'login'" class="staff">
    <button v-if="session.canEdit" type="button" @click="logOut">Log out</button>
    <RouterLink v-else :to="{ name: 'login' }">Staff log in</RouterLink>
  </footer>
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

.staff {
  text-align: center;
  padding: 0 1rem 2rem;
  font-family: var(--font-display);
  font-size: 0.8rem;
}

.staff button {
  background: none;
  border: none;
  text-decoration: underline;
  color: var(--ink-soft);
}

.staff a {
  color: var(--ink-soft);
}

.page {
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
</style>
