import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { DATA_DIR, DEFAULT_DB_PATH } from '../paths.ts'

// Copies the database to data/backups/crate-<timestamp>.db while the app keeps running.
// Run with: npm run db:backup -w apps/api   (in Docker: see docs/DEPLOY.md)
//
// Why not just copy crate.db? If the app writes mid-copy you can get a half-old, half-new
// file, and recent changes may still sit in the separate WAL file. SQLite's online backup
// API takes a consistent snapshot instead.

const backupsDir = join(DATA_DIR, 'backups')
mkdirSync(backupsDir, { recursive: true })

const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
const target = join(backupsDir, `crate-${stamp}.db`)

const db = new Database(DEFAULT_DB_PATH, { fileMustExist: true, readonly: true })
await db.backup(target)
db.close()

// The copy inherits WAL mode from the live database, and a WAL database needs to create
// helper files (-wal, -shm) even to be read, so it can't be opened from a read-only folder.
// Switching the copy to the classic journal makes it one self-contained file.
const copy = new Database(target)
copy.pragma('journal_mode = DELETE')
copy.close()

console.log(`Backed up the database to ${target}`)
console.log('Cover images are plain files in the covers folder; copy that folder too.')
