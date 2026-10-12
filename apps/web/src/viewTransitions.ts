import { nextTick } from 'vue'
import type { Router } from 'vue-router'

// Animates page changes with the browser's View Transitions API.
//
// How it works: the browser screenshots the old page, we swap in the new page, and the
// browser animates between them. Elements that share a `view-transition-name` on both pages
// (like `sleeve-42` on the crate's front sleeve and on the album page) morph from one
// position and size to the other: that's the "pulling the record out" effect.
//
// Browsers without the API, and people who prefer reduced motion, just get instant navigation.

type ViewTransitionDocument = Pick<Document, 'startViewTransition'>

export function installViewTransitions(
  router: Router,
  doc: Partial<ViewTransitionDocument> = document,
  prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
) {
  if (!doc.startViewTransition) return

  let finishTransition: (() => void) | null = null

  // The last guard before a navigation is confirmed (async route components are loaded by now).
  router.beforeResolve((to, from) => {
    const isFirstLoad = from.matched.length === 0
    if (isFirstLoad || to.fullPath === from.fullPath || prefersReducedMotion()) return

    // Wait until the browser has captured the old page, then let the navigation continue.
    // The transition's update callback stays pending until afterEach says the new page is in.
    return new Promise<void>((captured) => {
      doc.startViewTransition!(
        () =>
          new Promise<void>((pageIsReady) => {
            finishTransition = pageIsReady
            captured()
          }),
      )
    })
  })

  // Runs after every navigation, including failed or cancelled ones, so the
  // transition is never left hanging.
  router.afterEach(async () => {
    await nextTick() // let Vue render the new page first
    finishTransition?.()
    finishTransition = null
  })
}

/** The shared name that makes a sleeve morph between pages. */
export const sleeveTransitionName = (albumId: number) => `sleeve-${albumId}`
