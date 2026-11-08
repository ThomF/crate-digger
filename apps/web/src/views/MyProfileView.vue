<script setup lang="ts">
import { useSessionStore } from '../stores/session.ts'
import ProfileView from './ProfileView.vue'

// Data classification: PUBLIC. Passes on the signed-in user's public username only.

// The URL stays /profile. The v-if means a logout during the visit renders nothing, not a crash.
const session = useSessionStore()
</script>

<template>
  <ProfileView v-if="session.user" :username="session.user.username" />
</template>
