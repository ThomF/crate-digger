import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  adminCrate,
  adminCreateCrateInput,
  adminImportInput,
  adminImportResult,
  adminNewsInput,
  adminNewsItem,
  adminNoContent,
  adminOverview,
  adminSetSuggestedInput,
  adminUpdateNewsInput,
  adminUser,
  idParams,
} from '@frisson/shared'
import {
  createAdminCrate,
  createAdminNews,
  deleteAdminNews,
  getAdminOverview,
  listAdminCrates,
  listAdminNews,
  listAdminUsers,
  runAdminImport,
  setCrateSuggested,
  updateAdminNews,
} from '../services/admin.ts'
import { requireAdmin } from '../services/permissions.ts'

// Data classification: CONFIDENTIAL. GET /admin/users returns PII (emails), to admins only.
//
// Do not wrap this plugin in fastify-plugin: the hook below must stay encapsulated to it.
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  // Every route here is admin-only, so a new route cannot forget the guard. onRequest runs before
  // the body is read, so a signed-out oversized or malformed body gets 401, not 413 or 400.
  // authPlugin's global onRequest hook has already set req.user.
  app.addHook('onRequest', async (req) => {
    requireAdmin(req.user)
  })

  app.get('/admin/overview', { schema: { response: { 200: adminOverview } } }, async () =>
    getAdminOverview(app.db),
  )

  app.get('/admin/users', { schema: { response: { 200: adminUser.array() } } }, async () =>
    listAdminUsers(app.db),
  )

  app.get('/admin/crates', { schema: { response: { 200: adminCrate.array() } } }, async () =>
    listAdminCrates(app.db),
  )

  app.post(
    '/admin/crates',
    { schema: { body: adminCreateCrateInput, response: { 201: adminCrate } } },
    async (req, reply) =>
      reply.code(201).send(createAdminCrate(app.db, requireAdmin(req.user), req.body)),
  )

  app.patch(
    '/admin/crates/:id/suggested',
    {
      schema: { params: idParams, body: adminSetSuggestedInput, response: { 200: adminCrate } },
    },
    async (req) => setCrateSuggested(app.db, req.params.id, req.body.suggested),
  )

  app.get('/admin/news', { schema: { response: { 200: adminNewsItem.array() } } }, async () =>
    listAdminNews(app.db),
  )

  app.post(
    '/admin/news',
    { schema: { body: adminNewsInput, response: { 201: adminNewsItem } } },
    async (req, reply) => reply.code(201).send(createAdminNews(app.db, req.body)),
  )

  app.patch(
    '/admin/news/:id',
    { schema: { params: idParams, body: adminUpdateNewsInput, response: { 200: adminNewsItem } } },
    async (req) => updateAdminNews(app.db, req.params.id, req.body),
  )

  app.delete(
    '/admin/news/:id',
    { schema: { params: idParams, response: { 204: adminNoContent } } },
    async (req, reply) => {
      deleteAdminNews(app.db, req.params.id)
      return reply.code(204).send(null)
    },
  )

  app.post(
    '/admin/import',
    { schema: { body: adminImportInput, response: { 201: adminImportResult } } },
    async (req, reply) =>
      reply.code(201).send(runAdminImport(app.db, requireAdmin(req.user), req.body)),
  )
}
