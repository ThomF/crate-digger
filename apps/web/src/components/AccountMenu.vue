<script setup lang="ts">
// The signed-in account control in the masthead: a round avatar button that opens a
// small paper dropdown with the user's name, View profile, Edit profile and Log out.
// Data classification: CONFIDENTIAL (PII). Shows the signed-in user's name and username.
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { PublicUser } from '@frisson/shared'
import { errorMessage } from '../api/client.ts'
import { useSessionStore } from '../stores/session.ts'
import UserAvatar from './profile/UserAvatar.vue'
import VerifiedBadge from './profile/VerifiedBadge.vue'

const props = defineProps<{ user: PublicUser }>()

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const menuId = `account-menu-${useId()}`
const open = ref(false)
const logOutError = ref<string | null>(null)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

const name = computed(() => props.user.displayName.trim() || props.user.username)
const profilePath = computed(() => `/u/${encodeURIComponent(props.user.username)}`)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return
  const target = event.target
  if (target instanceof Node && root.value?.contains(target)) return
  close()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (!open.value || event.key !== 'Escape') return
  close()
  trigger.value?.focus()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})

watch(
  () => route.fullPath,
  () => close(),
)

async function logOut() {
  logOutError.value = null
  close()
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
  <nav ref="root" class="user-menu" aria-label="Account">
    <button
      ref="trigger"
      type="button"
      class="avatar-btn"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="menuId"
      :aria-label="`Account menu for ${name}`"
      @click="toggle"
    >
      <UserAvatar
        :avatar-url="user.avatarUrl"
        :display-name="user.displayName"
        :username="user.username"
      />
    </button>

    <div v-if="open" :id="menuId" class="menu" role="menu" :aria-label="`Account: ${name}`">
      <div class="menu-head">
        <p class="menu-name">
          {{ name }}
          <VerifiedBadge v-if="user.verified" />
        </p>
        <p class="menu-handle">@{{ user.username }}</p>
      </div>
      <RouterLink role="menuitem" class="menu-item" :to="profilePath" @click="close">
        View profile
      </RouterLink>
      <RouterLink role="menuitem" class="menu-item" :to="{ name: 'profile-edit' }" @click="close">
        Edit profile
      </RouterLink>
      <button type="button" role="menuitem" class="menu-item" @click="logOut">Log out</button>
    </div>

    <span v-if="logOutError" class="menu-error" role="alert">{{ logOutError }}</span>
  </nav>
</template>

<style scoped>
.user-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: var(--font-display);
}

.avatar-btn {
  display: inline-flex;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  box-shadow: 2px 2px 0 var(--cardboard-dark);
}

.avatar-btn:hover,
.avatar-btn[aria-expanded='true'] {
  box-shadow: 2px 2px 0 var(--marker-red);
}

.menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 20;
  min-width: 12rem;
  max-width: min(18rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  text-align: left;
  background: var(--paper);
  border: 2px solid var(--ink);
  box-shadow: 4px 4px 0 var(--cardboard-dark);
}

.menu-head {
  padding: 0.6rem 0.75rem;
  border-bottom: 2px dashed var(--cardboard-dark);
  background: var(--paper-dark);
  overflow-wrap: anywhere;
}

.menu-name {
  margin: 0;
  font-weight: bold;
  color: var(--ink);
}

.menu-handle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.menu-item {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: none;
  font-family: var(--font-display);
  font-size: 0.9rem;
  text-align: left;
  text-decoration: none;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.menu-item + .menu-item {
  border-top: 1px solid var(--paper-dark);
}

.menu-item:hover,
.menu-item:focus-visible {
  background: var(--cardboard);
  color: var(--ink);
}

.menu-item:last-child:hover,
.menu-item:last-child:focus-visible {
  color: var(--marker-red);
}

.menu-error {
  margin-top: 0.4rem;
  max-width: 14rem;
  font-size: 0.8rem;
  text-align: right;
  color: var(--marker-red);
}
</style>
