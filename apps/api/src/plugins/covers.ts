import { mkdir } from 'node:fs/promises'
import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import { COVERS_URL_PREFIX } from '../services/covers.ts'

declare module 'fastify' {
  interface FastifyInstance {
    coversDir: string
  }
}

export type CoversPluginOptions = { dir: string }

// Everything cover files need: somewhere to put them and a way to serve them back.
// Receiving uploads (multipart parsing) is the shared uploadsPlugin's job.
export const coversPlugin = fp<CoversPluginOptions>(async (app, opts) => {
  await mkdir(opts.dir, { recursive: true })
  app.decorate('coversDir', opts.dir)

  // GET /covers/<file> straight from disk. File names change whenever a cover changes,
  // so browsers may cache them for a year without asking again.
  await app.register(fastifyStatic, {
    root: opts.dir,
    prefix: COVERS_URL_PREFIX,
    decorateReply: false,
    immutable: true,
    maxAge: '365d',
  })
})
