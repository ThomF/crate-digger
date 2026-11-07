import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import { MAX_AVATAR_BYTES, MAX_COVER_BYTES } from '@frisson/shared'

// Parses multipart/form-data (how browsers upload files) for every upload route. It is
// registered once, here: covers and avatars both need it, and registering it twice fails.
// The global fileSize is the largest any route accepts; each route passes its own, smaller
// limit to req.file(). Limits are enforced while streaming, so an oversized upload is
// rejected without buffering all of it.
export const uploadsPlugin = fp(async (app) => {
  await app.register(multipart, {
    limits: { fileSize: Math.max(MAX_COVER_BYTES, MAX_AVATAR_BYTES), files: 1, fields: 0 },
  })
})
