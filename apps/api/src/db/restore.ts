import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import { DEFAULT_DB_PATH } from '../paths.ts'

// Replaces the database with a backup made by backup.ts. Stop the app first.
//   node src/db/restore.ts path/to/crate-2026-10-12T21-32-14.db
//
// Why not just copy the file over crate.db? The live database may have a crate.db-wal file
// next to it holding recent changes; drop a different crate.db beside that and SQLite can
// mix the two. Restoring through SQLite's backup API lets SQLite handle all of that.

const source = process.argv[2]
if (!source || !existsSync(source)) {
  console.error('Usage: node src/db/restore.ts <backup file>')
  process.exit(1)
}

const backup = new Database(source, { readonly: true, fileMustExist: true })
const check = backup.pragma('integrity_check', { simple: true })
if (check !== 'ok') {
  console.error(`Refusing to restore: the backup failed SQLite's integrity check (${check}).`)
  process.exit(1)
}

await backup.backup(DEFAULT_DB_PATH)
const albums = backup.prepare('SELECT count(*) AS n FROM albums').get() as { n: number }
backup.close()

console.log(`Restored ${albums.n} albums from ${source} into ${DEFAULT_DB_PATH}`)
console.log('Restore the covers folder too if you backed it up, then start the app.')
