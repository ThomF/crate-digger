import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // In dev, the browser talks only to Vite; Vite forwards /api calls to Fastify.
    // In production, one server serves both, so the frontend never needs a full API URL.
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/covers': 'http://127.0.0.1:3000',
    },
  },
  test: {
    // A fake browser DOM so components can render inside Node.
    environment: 'happy-dom',
  },
})
