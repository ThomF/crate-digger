<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useSessionStore } from './stores/session.ts'
import AccountMenu from './components/AccountMenu.vue'

const session = useSessionStore()
onMounted(() => session.load())
</script>

<template>
  <header class="masthead">
    <RouterLink to="/" class="sign">Frisson</RouterLink>
    <p class="tagline">Used &amp; new vinyl · est. 1994</p>

    <div v-if="session.loaded" class="account">
      <AccountMenu v-if="session.user" :user="session.user" />
      <nav v-else class="auth-links" aria-label="Account">
        <RouterLink v-if="$route.name !== 'login'" :to="{ name: 'login' }">Log in</RouterLink>
        <RouterLink v-if="$route.name !== 'signup'" :to="{ name: 'signup' }">Sign up</RouterLink>
      </nav>
    </div>
  </header>

  <main class="page">
    <RouterView />
  </main>
</template>

<style scoped>
.masthead {
  position: relative;
  text-align: center;
  /* Side padding keeps the centered sign clear of the account control on the right. */
  padding: 2rem 4.75rem 1rem;
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

.account {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
}

.auth-links {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  font-family: var(--font-display);
  font-size: 0.75rem;
}

.auth-links a {
  color: var(--ink-soft);
}

.auth-links a:hover {
  color: var(--marker-red);
}

@media (min-width: 40rem) {
  .masthead {
    padding-inline: 10rem;
  }

  .account {
    top: 1.25rem;
    right: 1.5rem;
  }

  .auth-links {
    flex-direction: row;
    gap: 0.75rem;
    font-size: 0.85rem;
  }
}

.page {
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
</style>
