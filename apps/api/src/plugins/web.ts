import { existsSync } from 'node:fs'
import { join } from 'node:path'
import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'

/** URL prefixes that are never app pages, so a miss there is a JSON 404, not index.html. */
const NOT_PAGES = ['/api/', '/covers/', '/avatars/']

export type WebPluginOptions = { dir?: string }

// In production the API also serves the built Vue app (apps/web/dist), so the whole thing
// is one process on one port. In development Vite serves the app instead, and this is off.
export const webPlugin = fp<WebPluginOptions>(async (app, opts) => {
  const dir = opts.dir
  if (!dir) return
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error(`WEB_DIR is set to ${dir}, but there's no index.html there. Build the web app?`)
  }

  await app.register(fastifyStatic, {
    root: dir,
    prefix: '/',
    // Vite puts a content hash in every file name under /assets, so those never change and
    // can be cached forever. index.html must always be fresh, or browsers keep old builds.
    setHeaders(reply, path) {
      reply.header(
        'cache-control',
        path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      )
    },
  })

  // The app's own URLs (/albums/7, /list, …) aren't files. Answer them with index.html and
  // let Vue Router show the right page. API, cover and avatar URLs still get a real 404.
  app.setNotFoundHandler((req, reply) => {
    const isPage = req.method === 'GET' && !NOT_PAGES.some((prefix) => req.url.startsWith(prefix))
    if (isPage) return reply.header('cache-control', 'no-cache').sendFile('index.html')
    return reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `No route for ${req.method} ${req.url}`,
    })
  })
})
