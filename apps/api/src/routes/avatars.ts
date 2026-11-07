import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { publicProfile } from '@frisson/shared'
import { badRequest } from '../errors.ts'
import { requireUser } from '../services/permissions.ts'
import { MAX_AVATAR_BYTES, removeAvatar, setAvatar } from '../services/avatars.ts'

// Data classification: PUBLIC responses only (publicProfile). Avatars only ever change for
// request.user; there is no route that targets another user.
export const avatarRoutes: FastifyPluginAsyncZod = async (app) => {
  // Body: multipart/form-data with one image in a field named "avatar".
  app.post('/me/avatar', { schema: { response: { 200: publicProfile } } }, async (req) => {
    // Check before reading the upload, so strangers can't make us buffer files.
    requireUser(req.user)
    const file = await req.file({ limits: { fileSize: MAX_AVATAR_BYTES } })
    if (!file || file.fieldname !== 'avatar') {
      throw badRequest('Attach an image in a form field named "avatar"')
    }
    const upload = await file.toBuffer() // throws 413 if it's over the size limit
    return setAvatar(app.db, app.avatarsDir, req.user, upload)
  })

  app.delete('/me/avatar', { schema: { response: { 200: publicProfile } } }, async (req) =>
    removeAvatar(app.db, app.avatarsDir, req.user),
  )
}
