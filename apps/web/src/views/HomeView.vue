<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { listRecommendedCrates } from '../api/crates.ts'
import { listNews } from '../api/news.ts'
import DemoTag from '../components/DemoTag.vue'
import { useAsyncSection } from '../composables/useAsyncSection.ts'

// Data classification: PUBLIC. News and recommended crates are shown to anyone. Crate and owner
// names are user typed text, so everything is rendered with {{ }} only, never as HTML.

// The two sections load and fail on their own. Branch on status, not on data: a failed request
// can leave old data in place.
const news = useAsyncSection(listNews)
const recommended = useAsyncSection(listRecommendedCrates)

// Dates are fixed to UTC so the text matches the <time datetime> value for every visitor.
const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})
const formatDate = (iso: string) => dateFormat.format(new Date(iso))

/** The link's accessible name: its two lines of text, spelled out so they read as two. */
const crateLinkName = (crate: { name: string; label: string | null }) =>
  crate.label ? `${crate.label}: ${crate.name}` : crate.name

const recordCount = (n: number) => (n === 1 ? '1 record' : `${n} records`)

onMounted(() => {
  document.title = 'Home · Frisson'
  news.load()
  recommended.load()
})
</script>

<template>
  <div class="home">
    <!-- The masthead sign is a link, so the page's own top heading lives here. -->
    <h1 class="sr-only">Home</h1>

    <section class="news" aria-labelledby="home-news-heading">
      <h2 id="home-news-heading">Music news</h2>

      <p v-if="news.status.value === 'loading'" class="status-note" role="status">
        Fetching the news…
      </p>

      <p v-else-if="news.status.value === 'error'" class="status-note is-error" role="alert">
        {{ news.error.value }}
        <button type="button" class="btn" @click="news.load()">Try again</button>
      </p>

      <template v-else-if="news.data.value?.length">
        <article v-for="item in news.data.value" :key="item.id" class="story">
          <h3>{{ item.title }}</h3>
          <p class="summary">{{ item.summary }}</p>
          <p class="meta">
            <span>{{ item.source }}</span>
            <time :datetime="item.publishedAt">{{ formatDate(item.publishedAt) }}</time>
            <DemoTag v-if="item.isDemo" />
          </p>
        </article>
      </template>

      <p v-else class="status-note">No news to show yet.</p>
    </section>

    <!-- AC9: the note below must be the only 'AI' here, once rendered. 'Try again' is a reason
         never to upper-case this section with CSS, and the other copy avoids the letters 'ai'. -->
    <section class="recommended" aria-labelledby="home-recommended-heading">
      <h2 id="home-recommended-heading">Recommended crates</h2>
      <p class="note">Curated picks. No AI model is involved yet.</p>

      <p v-if="recommended.status.value === 'loading'" class="status-note" role="status">
        Pulling the picks…
      </p>

      <p v-else-if="recommended.status.value === 'error'" class="status-note is-error" role="alert">
        {{ recommended.error.value }}
        <button type="button" class="btn" @click="recommended.load()">Try again</button>
      </p>

      <ul v-else-if="recommended.data.value?.length" class="cards">
        <li v-for="crate in recommended.data.value" :key="crate.id" class="crate-card">
          <span class="swatch" :style="{ background: crate.color }" aria-hidden="true"></span>
          <div class="details">
            <RouterLink
              :to="{ name: 'crate', params: { id: crate.id } }"
              class="crate-link"
              :aria-label="crateLinkName(crate)"
            >
              <span v-if="crate.label" class="crate-label">{{ crate.label }}</span>
              <span class="crate-name">{{ crate.name }}</span>
            </RouterLink>
            <p class="count">{{ recordCount(crate.albumCount) }}</p>
            <p class="owner">
              {{ crate.ownerDisplayName }}
              <span class="handle">@{{ crate.ownerUsername }}</span>
              <DemoTag v-if="crate.isDemo" />
            </p>
          </div>
        </li>
      </ul>

      <p v-else class="status-note">No picks to show yet.</p>
    </section>

    <p class="browse">
      <RouterLink :to="{ name: 'library' }">Browse all crates</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
}

h2 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  border-bottom: 3px double var(--cardboard-dark);
  margin: 0 0 0.75rem;
}

/* Text from the API can be one long word; it must wrap rather than widen the page. */
.story,
.crate-card {
  overflow-wrap: anywhere;
}

.story {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--cardboard-dark);
}

.story:last-child {
  border-bottom: none;
}

h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.summary {
  margin: 0.35rem 0;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.meta :deep(.demo-tag) {
  margin-left: 0;
}

.note {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  color: var(--ink-soft);
}

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* min(): a column can never be wider than the page on a narrow phone. */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.75rem;
}

.crate-card {
  display: flex;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: var(--paper-dark);
  border: 1px solid var(--cardboard-dark);
}

/* A stretched link: the ::after covers the whole card, so a click anywhere opens the crate and
   there is still only one link, with nothing interactive nested in it. */
.crate-card {
  position: relative;
  cursor: pointer;
}

.crate-card:hover {
  background: var(--paper);
}

.crate-link {
  display: block;
  font-weight: bold;
  text-decoration: none;
}

.crate-card:hover .crate-link {
  text-decoration: underline;
}

.crate-link::after {
  content: '';
  position: absolute;
  inset: 0;
}

/* The focus ring goes around the card the link covers, not just its text. */
.crate-link:focus-visible {
  outline: none;
}

.crate-link:focus-visible::after {
  outline: 3px solid var(--marker-red);
  outline-offset: 2px;
}

.swatch {
  width: 1rem;
  height: 1rem;
  margin-top: 0.2rem;
  border: 1px solid var(--ink);
  flex: none;
}

.details {
  min-width: 0;
}

.details p {
  margin: 0;
}

.crate-label,
.crate-name {
  display: block;
}

/* Under a tape label the name is the second line; without one it is the card's title. */
.crate-label + .crate-name {
  font-weight: normal;
  color: var(--ink-soft);
}

.handle {
  color: var(--ink-soft);
}

.count,
.handle {
  font-family: var(--font-display);
}

.count {
  color: var(--ink-soft);
}

.browse {
  margin: 0;
  text-align: center;
  font-family: var(--font-display);
}
</style>
