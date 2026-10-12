import { createRouter, createWebHistory } from 'vue-router'
import CrateView from './views/CrateView.vue'
import LibraryView from './views/LibraryView.vue'
import NotFoundView from './views/NotFoundView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'library', component: CrateView },
    { path: '/list', name: 'list', component: LibraryView },
    { path: '/crates', name: 'crates', component: () => import('./views/CratesView.vue') },
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
      // /albums/new?crateId=3 pre-selects a crate.
      props: (route) => ({ crateId: Number(route.query.crateId) || null }),
    },
    {
      path: '/albums/:id(\\d+)/edit',
      name: 'album-edit',
      component: () => import('./views/AlbumEditorView.vue'),
      props: (route) => ({ id: Number(route.params.id) }),
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
