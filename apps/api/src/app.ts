import Fastify from 'fastify'

// Builds the app without starting it. Tests call this and use app.inject()
// to send fake requests, so no real port is ever opened.
export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  })

  app.get('/api/health', async () => {
    return { status: 'ok', service: 'crate-digger-api' }
  })

  return app
}
