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
    <div class="brand">
      <!-- A plain <a>, so the sign doesn't carry a second aria-current next to the Home link. -->
      <RouterLink v-slot="{ href, navigate }" to="/" custom>
        <a :href="href" class="sign" @click="navigate">Frisson</a>
      </RouterLink>
      <p class="tagline">Used &amp; new vinyl · est. 1994</p>
    </div>

    <div v-if="session.loaded" class="account">
      <AccountMenu v-if="session.user" :user="session.user" />
      <nav v-else class="auth-links" aria-label="Account">
        <RouterLink v-if="$route.name !== 'login'" :to="{ name: 'login' }">Log in</RouterLink>
        <RouterLink v-if="$route.name !== 'signup'" :to="{ name: 'signup' }">Sign up</RouterLink>
      </nav>
    </div>

    <nav class="main-nav" aria-label="Main">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/following">Following</RouterLink>
      <RouterLink to="/profile">Profile</RouterLink>
      <RouterLink to="/about">About</RouterLink>
    </nav>
  </header>

  <main class="page">
    <RouterView />
  </main>
</template>

<style scoped>
.masthead {
  position: relative;
  text-align: center;
  padding-bottom: 0.5rem;
  border-bottom: 3px double var(--cardboard-dark);
}

.brand {
  /* Side padding keeps the centered sign clear of the account control on the right. */
  padding: 2rem 4.75rem 0.5rem;
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

/* One line at every width: its full-width row (outside .brand's padding) fits all four at 320px. */
.main-nav {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  padding-inline: 0.5rem;
  font-family: var(--font-display);
  font-size: 0.875rem;
  white-space: nowrap;
}

.main-nav a {
  padding: 0.5rem;
  text-decoration: none;
  color: var(--ink);
}

.main-nav a:hover {
  color: var(--marker-red);
}

.main-nav a[aria-current='page'] {
  background: var(--ink);
  color: var(--paper);
}

@media (min-width: 40rem) {
  .brand {
    padding-inline: 10rem;
  }

  .main-nav {
    gap: 1rem;
    font-size: 1rem;
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
