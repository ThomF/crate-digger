import { buildApp } from '../src/app.ts'
import { crates } from '../src/db/schema.ts'

/** A fresh app on an empty in-memory database. Call `app.close()` when done. */
export async function buildTestApp() {
  return buildApp({ dbPath: ':memory:' })
}

type TestApp = Awaited<ReturnType<typeof buildTestApp>>

/** There's no POST /api/crates until M8, so tests insert crates straight into the db. */
export function addCrate(app: TestApp, name = 'Test crate', sortOrder = 0) {
  return app.db.insert(crates).values({ name, sortOrder }).returning().get()
}
