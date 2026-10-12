import { createRouter, createWebHistory } from 'vue-router'
import LibraryView from './views/LibraryView.vue'
import NotFoundView from './views/NotFoundView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'library', component: LibraryView },
    {
      // (\\d+) = only match numeric ids; /albums/abc falls through to not-found.
      path: '/albums/:id(\\d+)',
      name: 'album',
      // Lazy-loaded: this view's code is only downloaded when someone opens an album.
      component: () => import('./views/AlbumView.vue'),
      // Hand the id to the view as a typed prop instead of reading route.params inside it.
      props: (route) => ({ id: Number(route.params.id) }),
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
