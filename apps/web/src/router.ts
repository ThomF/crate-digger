import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from './stores/session.ts'
import CrateView from './views/CrateView.vue'
import LibraryView from './views/LibraryView.vue'
import NotFoundView from './views/NotFoundView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Only for visitors allowed to change the collection. */
    requiresEdit?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'library', component: CrateView },
    { path: '/list', name: 'list', component: LibraryView },
    {
      path: '/crates',
      name: 'crates',
      component: () => import('./views/CratesView.vue'),
      meta: { requiresEdit: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./views/LoginView.vue'),
      props: (route) => ({
        next: typeof route.query.next === 'string' ? route.query.next : undefined,
      }),
    },
    {
      // (\\d+) = only match numeric ids; /albums/abc falls through to not-found.
      path: '/albums/:id(\\d+)',
      name: 'album',
      // Lazy-loaded: this view's code is only downloaded when someone opens an album.
      component: () => import('./views/AlbumView.vue'),
      // Hand the id to the view as a typed prop instead of reading route.params inside it.
      props: (route) => ({ id: Number(route.params.id) }),
    },
    {
      path: '/albums/new',
      name: 'album-new',
      component: () => import('./views/AlbumEditorView.vue'),
      meta: { requiresEdit: true },
      // /albums/new?crateId=3 pre-selects a crate.
      props: (route) => ({ crateId: Number(route.query.crateId) || null }),
    },
    {
      path: '/albums/:id(\\d+)/edit',
      name: 'album-edit',
      component: () => import('./views/AlbumEditorView.vue'),
      meta: { requiresEdit: true },
      props: (route) => ({ id: Number(route.params.id) }),
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Pages that change things send visitors to log in first (or home, if the app is read-only).
// The API enforces this anyway; the guard just avoids showing forms that can't be saved.
router.beforeEach(async (to) => {
  if (!to.meta.requiresEdit) return
  const session = useSessionStore()
  await session.load()
  if (session.canEdit) return
  return session.canLogIn ? { name: 'login', query: { next: to.fullPath } } : { name: 'library' }
})
