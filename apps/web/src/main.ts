import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router.ts'
import { installViewTransitions } from './viewTransitions.ts'
import './styles/base.css'

installViewTransitions(router)

createApp(App).use(createPinia()).use(router).mount('#app')
