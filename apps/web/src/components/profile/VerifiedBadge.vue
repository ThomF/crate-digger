<script setup lang="ts">
// A small marker-red check stamp shown next to a verified user's name.
</script>

<template>
  <span class="verified-badge" role="img" aria-label="Verified" title="Verified">
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path
        d="M4.5 8.3 7 10.7l4.6-5"
        fill="none"
        stroke="var(--paper)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
</template>

<style scoped>
.verified-badge {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 0.25em;
  color: var(--marker-red);
  font-size: 0.9em;
  line-height: 1;
}
</style>
