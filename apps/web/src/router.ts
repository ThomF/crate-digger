import { createRouter, createWebHistory, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useSessionStore } from './stores/session.ts'
import HomeView from './views/HomeView.vue'
import LibraryView from './views/LibraryView.vue'
import NotFoundView from './views/NotFoundView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Only for signed-in visitors. */
    requiresAuth?: boolean
  }
}

// Shared by /shelf and /crates/:id, so moving between them keeps the same view instance.
const CrateView = () => import('./views/CrateView.vue')

const inCrateBrowser = (route: RouteLocationNormalizedLoaded) =>
  route.name === 'library' || route.name === 'crate'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/shelf', name: 'library', component: CrateView },
    { path: '/list', name: 'list', component: LibraryView },
    {
      path: '/crates',
      name: 'crates',
      component: () => import('./views/CratesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Public deep link to one crate. /crates (above) stays the guarded manage page, and
      // (\\d+) sends /crates/abc to not-found.
      path: '/crates/:id(\\d+)',
      name: 'crate',
      component: CrateView,
      props: (route) => ({ crateId: Number(route.params.id) }),
    },
    {
      path: '/following',
      name: 'following',
      component: () => import('./views/FollowingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('./views/AboutView.vue'),
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
      path: '/signup',
      name: 'signup',
      component: () => import('./views/SignupView.vue'),
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
      meta: { requiresAuth: true },
      // /albums/new?crateId=3 pre-selects a crate.
      props: (route) => ({ crateId: Number(route.query.crateId) || null }),
    },
    {
      path: '/albums/:id(\\d+)/edit',
      name: 'album-edit',
      component: () => import('./views/AlbumEditorView.vue'),
      meta: { requiresAuth: true },
      props: (route) => ({ id: Number(route.params.id) }),
    },
    {
      path: '/u/:username',
      name: 'profile',
      // Public: anyone can look at a profile.
      component: () => import('./views/ProfileView.vue'),
      props: (route) => ({ username: String(route.params.username) }),
    },
    {
      path: '/profile',
      name: 'my-profile',
      component: () => import('./views/MyProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile/edit',
      name: 'profile-edit',
      component: () => import('./views/EditProfileView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
  // Crate tabs change the URL; they shouldn't also jump the page back to the top.
  scrollBehavior: (to, from) => (inCrateBrowser(to) && inCrateBrowser(from) ? false : { top: 0 }),
})

// Pages that change things send signed-out visitors to log in first, then back here.
// The API enforces this anyway; the guard just avoids showing forms that can't be saved.
router.beforeEach(async (to) => {
  const session = useSessionStore()
  await session.load()
  if (!to.meta.requiresAuth || session.signedIn) return
  return { name: 'login', query: { next: to.fullPath } }
})
