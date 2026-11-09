<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { AdminUser } from '@frisson/shared'
import { errorMessage } from '../../api/client.ts'
import { setVerified } from '../../api/profiles.ts'
import { useSessionStore } from '../../stores/session.ts'
import DemoTag from '../DemoTag.vue'
import VerifiedBadge from '../profile/VerifiedBadge.vue'
import AdminFormError from './AdminFormError.vue'
import { toFormError, type FormError } from './adminPanel.ts'

// Data classification: CONFIDENTIAL (PII). Shows a user's email. Never persist or log it.
const props = defineProps<{ user: AdminUser }>()
const emit = defineEmits<{ verified: [id: number, verified: boolean] }>()

const session = useSessionStore()
const busy = ref(false)
const error = ref<FormError | null>(null)

const action = computed(() => (props.user.verified ? 'Unverify' : 'Verify'))

async function toggle() {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    const profile = await setVerified(props.user.username, !props.user.verified)
    emit('verified', props.user.id, profile.verified)
    if (session.user?.id === props.user.id) await refreshMasthead()
  } catch (err) {
    error.value = toFormError(err)
  } finally {
    busy.value = false
  }
}

/** The change itself is saved by now, so say only what went wrong: the masthead's badge. */
async function refreshMasthead() {
  try {
    await session.refresh()
  } catch (err) {
    error.value = {
      message: `Saved, but your own badge may be out of date: ${errorMessage(err)}`,
      issues: [],
    }
  }
}
</script>

<template>
  <li class="admin-card">
    <h3>
      {{ user.displayName }}
      <VerifiedBadge v-if="user.verified" />
      <DemoTag v-if="user.isDemo" />
    </h3>
    <dl class="admin-facts">
      <div>
        <dt>Email</dt>
        <dd>{{ user.email }}</dd>
      </div>
      <div>
        <dt>Username</dt>
        <dd>
          <RouterLink :to="{ name: 'profile', params: { username: user.username } }">
            {{ user.username }}
          </RouterLink>
        </dd>
      </div>
      <div>
        <dt>Role</dt>
        <dd>{{ user.role }}</dd>
      </div>
      <div>
        <dt>Crates</dt>
        <dd>{{ user.crateCount }}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{{ user.verified ? 'Verified' : 'Not verified' }}</dd>
      </div>
    </dl>
    <div class="admin-actions">
      <button
        type="button"
        class="admin-secondary"
        :disabled="busy"
        :aria-label="`${action}: ${user.username}`"
        @click="toggle"
      >
        {{ action }}
      </button>
    </div>
    <AdminFormError v-if="error" :error="error" />
  </li>
</template>
