import { mkdir } from 'node:fs/promises'
import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { COVERS_URL_PREFIX, MAX_COVER_BYTES } from '../services/covers.ts'

declare module 'fastify' {
  interface FastifyInstance {
    coversDir: string
  }
}

export type CoversPluginOptions = { dir: string }

// Everything cover files need: somewhere to put them, a way to receive uploads,
// and a way to serve them back.
export const coversPlugin = fp<CoversPluginOptions>(async (app, opts) => {
  await mkdir(opts.dir, { recursive: true })
  app.decorate('coversDir', opts.dir)

  // Parses multipart/form-data (how browsers upload files). Limits are enforced while
  // streaming, so an oversized upload is rejected without buffering all of it.
  await app.register(multipart, {
    limits: { fileSize: MAX_COVER_BYTES, files: 1, fields: 0 },
  })

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
