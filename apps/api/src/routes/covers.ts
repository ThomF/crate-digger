import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { albumDetail, idParams } from '@frisson/shared'
import { badRequest } from '../errors.ts'
import { assertCanEditAlbum } from '../services/permissions.ts'
import { MAX_COVER_BYTES, removeCover, setCover } from '../services/covers.ts'

export const coverRoutes: FastifyPluginAsyncZod = async (app) => {
  // Body: multipart/form-data with one image in a field named "cover".
  // There's no Zod schema for the body: it's a file stream, not JSON.
  app.post(
    '/albums/:id/cover',
    { schema: { params: idParams, response: { 200: albumDetail } } },
    async (req) => {
      // Check before reading the upload, so strangers can't make us buffer files.
      assertCanEditAlbum(app.db, req.user, req.params.id)
      // The shared multipart limit is the largest of all uploads; covers have their own.
      const file = await req.file({ limits: { fileSize: MAX_COVER_BYTES } })
      if (!file || file.fieldname !== 'cover') {
        throw badRequest('Attach an image in a form field named "cover"')
      }
      const upload = await file.toBuffer() // throws 413 if it's over the size limit
      return setCover(app.db, app.coversDir, req.user, req.params.id, upload)
    },
  )

  app.delete(
    '/albums/:id/cover',
    { schema: { params: idParams, response: { 200: albumDetail } } },
    async (req) => removeCover(app.db, app.coversDir, req.user, req.params.id),
  )
}
