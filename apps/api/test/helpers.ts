import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../src/app.ts'
import { crates } from '../src/db/schema.ts'

/**
 * A fresh app on an empty in-memory database, with its own temporary covers folder
 * (deleted on close). Call `app.close()` when done.
 */
export async function buildTestApp() {
  const coversDir = await mkdtemp(join(tmpdir(), 'crate-digger-covers-'))
  const app = await buildApp({ dbPath: ':memory:', coversDir })
  app.addHook('onClose', async () => rm(coversDir, { recursive: true, force: true }))
  return app
}

export type TestApp = Awaited<ReturnType<typeof buildTestApp>>

/** There's no POST /api/crates until M8, so tests insert crates straight into the db. */
export function addCrate(app: TestApp, name = 'Test crate', sortOrder = 0) {
  return app.db.insert(crates).values({ name, sortOrder }).returning().get()
}

/**
 * Builds a multipart/form-data body by hand, the same bytes a browser sends for
 * <input type="file">. Each part is separated by a boundary line.
 */
export function multipart(fieldName: string, fileName: string, contentType: string, data: Buffer) {
  const boundary = '----crate-digger-test-boundary'
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}
