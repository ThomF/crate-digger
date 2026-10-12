import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  albumDetail,
  albumQuery,
  albumSummary,
  createAlbumInput,
  idParams,
  tracklistInput,
  updateAlbumInput,
} from '@crate-digger/shared'
import {
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbums,
  replaceTracks,
  updateAlbum,
} from '../services/albums.ts'

// Routes stay thin: declare the schema, call a service, pick a status code.
// Fastify validates params/query/body against the schema *before* the handler runs,
// so req.body etc. are already typed and trustworthy here.
export const albumRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/albums',
    { schema: { querystring: albumQuery, response: { 200: albumSummary.array() } } },
    async (req) => listAlbums(app.db, req.query),
  )

  app.get(
    '/albums/:id',
    { schema: { params: idParams, response: { 200: albumDetail } } },
    async (req) => getAlbum(app.db, req.params.id),
  )

  app.post(
    '/albums',
    { schema: { body: createAlbumInput, response: { 201: albumDetail } } },
    async (req, reply) => reply.code(201).send(createAlbum(app.db, req.body)),
  )

  app.patch(
    '/albums/:id',
    { schema: { params: idParams, body: updateAlbumInput, response: { 200: albumDetail } } },
    async (req) => updateAlbum(app.db, req.params.id, req.body),
  )

  app.delete('/albums/:id', { schema: { params: idParams } }, async (req, reply) => {
    deleteAlbum(app.db, req.params.id)
    return reply.code(204).send()
  })

  app.put(
    '/albums/:id/tracks',
    { schema: { params: idParams, body: tracklistInput, response: { 200: albumDetail } } },
    async (req) => replaceTracks(app.db, req.params.id, req.body),
  )
}
