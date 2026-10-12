import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DEFAULT_DB_PATH } from '../paths.ts'
import * as schema from './schema.ts'

// apps/api/drizzle, where drizzle-kit writes the generated SQL migrations.
const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle')

/**
 * Opens (or creates) the SQLite database and brings it up to date with all migrations.
 * Pass ':memory:' for a throwaway database — that's what the tests do.
 */
export function createDb(path: string = DEFAULT_DB_PATH) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const sqlite = new Database(path)
  // SQLite ignores foreign keys unless you switch them on, per connection.
  sqlite.pragma('foreign_keys = ON')
  // WAL lets reads continue while a write happens; better for a web server.
  if (path !== ':memory:') sqlite.pragma('journal_mode = WAL')

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })

  return { db, close: () => sqlite.close() }
}

export type Db = ReturnType<typeof createDb>['db']
