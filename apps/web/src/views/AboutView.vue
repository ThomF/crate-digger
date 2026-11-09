<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  document.title = 'About · Frisson'
})
</script>

<template>
  <article class="about">
    <h1>About Frisson</h1>

    <p>
      Frisson is your music collection as 90s record crates. Flip through, pull one out, spin it.
    </p>

    <section>
      <h2>Your collection</h2>
      <p>
        Records live in crates. Sort them however you think about your music, and give each crate a
        color and a tape label. Anyone can browse crates, signed in or not.
      </p>
    </section>

    <section>
      <h2>Collectors</h2>
      <p>
        Every collector has a profile. Once you sign in, following a collector puts the crates they
        make on your Following page.
      </p>
    </section>

    <section>
      <h2>Your own copy</h2>
      <p>
        Frisson is self-hosted. It runs on a machine you control and your collection stays in its
        database. You catalog your records by hand; nothing is pulled from outside music services.
      </p>
    </section>

    <section>
      <h2>What's real here</h2>
      <p>
        Anything marked Demo, including the demo collectors, is demo data. It is made up, to show
        how the app feels with people in it. Recommendations are curated by hand and no AI model is
        involved. In production, demo data is only added if the person running the app turns it on.
      </p>
    </section>
  </article>
</template>

<style scoped>
.about {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
  overflow-wrap: anywhere;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.75rem;
}

h2 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  border-bottom: 3px double var(--cardboard-dark);
  margin: 0 0 0.5rem;
}

p {
  margin: 0;
}
</style>
