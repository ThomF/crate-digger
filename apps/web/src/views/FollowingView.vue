<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { getFeed, listFollowing, listSuggestedCollectors } from '../api/follows.ts'
import DemoTag from '../components/DemoTag.vue'
import FollowButton from '../components/profile/FollowButton.vue'
import VerifiedBadge from '../components/profile/VerifiedBadge.vue'
import { useAsyncSection } from '../composables/useAsyncSection.ts'

// Data classification: PUBLIC. Public collector summaries and crate cards, requested for the
// signed-in user through their session. All user typed text is rendered with {{ }} only.

// One instance per section, so a failure in one never affects another. A failed refresh keeps
// the old data, so the template branches on status, never on data being present.
const following = reactive(useAsyncSection(listFollowing))
const feed = reactive(useAsyncSection(getFeed))
const suggested = reactive(useAsyncSection(listSuggestedCollectors))

const recordCount = (n: number) => (n === 1 ? '1 record' : `${n} records`)

/** A follow or unfollow can change all three lists; each is re-requested without a page load. */
function refreshAll() {
  void following.refresh()
  void feed.refresh()
  void suggested.refresh()
}

onMounted(() => {
  document.title = 'Following · Frisson'
  void following.load()
  void feed.load()
  void suggested.load()
})
</script>

<template>
  <div class="following-page">
    <section class="following">
      <h2>Following</h2>
      <p v-if="following.status === 'loading'" class="status-note" role="status">
        Finding your collectors…
      </p>
      <p v-else-if="following.status === 'error'" class="status-note is-error" role="alert">
        {{ following.error }}
        <button type="button" class="btn" @click="following.load()">Try again</button>
      </p>
      <ul v-else-if="following.data?.length" class="collectors">
        <li v-for="user in following.data" :key="user.username" class="row">
          <span class="who">
            <RouterLink :to="{ name: 'profile', params: { username: user.username } }">
              {{ user.displayName }}
            </RouterLink>
            <VerifiedBadge v-if="user.verified" />
            <DemoTag v-if="user.isDemo" />
            <span class="handle">@{{ user.username }}</span>
          </span>
          <FollowButton :username="user.username" :following="true" @changed="refreshAll" />
        </li>
      </ul>
      <p v-else class="status-note">You aren't following anyone yet.</p>
    </section>

    <section class="feed">
      <h2>Crates from people you follow</h2>
      <p v-if="feed.status === 'loading'" class="status-note" role="status">
        Flipping through crates…
      </p>
      <p v-else-if="feed.status === 'error'" class="status-note is-error" role="alert">
        {{ feed.error }}
        <button type="button" class="btn" @click="feed.load()">Try again</button>
      </p>
      <ul v-else-if="feed.data?.length" class="crates">
        <li v-for="crate in feed.data" :key="crate.id" class="row">
          <span class="swatch" :style="{ background: crate.color }" aria-hidden="true"></span>
          <span class="who">
            <RouterLink :to="{ name: 'crate', params: { id: crate.id } }">
              {{ crate.label ?? crate.name }}
            </RouterLink>
            <span class="handle"> {{ crate.ownerDisplayName }} @{{ crate.ownerUsername }} </span>
          </span>
          <span class="count">{{ recordCount(crate.albumCount) }}</span>
        </li>
      </ul>
      <p v-else class="status-note">No crates here yet. Follow a collector to see theirs.</p>
    </section>

    <!-- Once loaded, an empty list means nobody is left to suggest, so the section goes away. -->
    <section v-if="suggested.status !== 'ready' || suggested.data?.length" class="suggested">
      <h2>Suggested collectors</h2>
      <p v-if="suggested.status === 'loading'" class="status-note" role="status">
        Looking for collectors…
      </p>
      <p v-else-if="suggested.status === 'error'" class="status-note is-error" role="alert">
        {{ suggested.error }}
        <button type="button" class="btn" @click="suggested.load()">Try again</button>
      </p>
      <ul v-else class="collectors">
        <li v-for="user in suggested.data" :key="user.username" class="row">
          <span class="who">
            <RouterLink :to="{ name: 'profile', params: { username: user.username } }">
              {{ user.displayName }}
            </RouterLink>
            <VerifiedBadge v-if="user.verified" />
            <DemoTag v-if="user.isDemo" />
            <span class="handle">@{{ user.username }}</span>
          </span>
          <FollowButton :username="user.username" :following="false" @changed="refreshAll" />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.following-page {
  display: grid;
  gap: 1.5rem;
  min-width: 0;
}

section {
  min-width: 0;
}

h2 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  border-bottom: 3px double var(--cardboard-dark);
  margin: 0 0 0.5rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.6rem;
  align-items: center;
  padding: 0.4rem 0.6rem;
  background: var(--paper-dark);
  border: 1px solid var(--cardboard-dark);
}

.who {
  flex: 1 1 10rem;
  min-width: 0;
  font-weight: bold;
  overflow-wrap: anywhere;
}

.handle {
  display: block;
  font-family: var(--font-display);
  font-weight: normal;
  color: var(--ink-soft);
}

.swatch {
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--ink);
  flex: none;
}

.count {
  font-family: var(--font-display);
  color: var(--ink-soft);
}
</style>
