import { mkdir } from 'node:fs/promises'
import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import { AVATARS_URL_PREFIX } from '../services/avatars.ts'

declare module 'fastify' {
  interface FastifyInstance {
    avatarsDir: string
  }
}

export type AvatarsPluginOptions = { dir: string }

// Somewhere to keep avatar files and a way to serve them back. Uploads are parsed by the
// shared uploadsPlugin.
export const avatarsPlugin = fp<AvatarsPluginOptions>(async (app, opts) => {
  await mkdir(opts.dir, { recursive: true })
  app.decorate('avatarsDir', opts.dir)

  // GET /avatars/<file> straight from disk. Names change whenever an avatar changes,
  // so browsers may cache them for a year.
  await app.register(fastifyStatic, {
    root: opts.dir,
    prefix: AVATARS_URL_PREFIX,
    decorateReply: false,
    immutable: true,
    maxAge: '365d',
  })
})
