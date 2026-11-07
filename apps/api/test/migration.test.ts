import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/db/client.ts'

const DRIZZLE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle')
const OLD_TAGS = ['0000_init', '0001_crate_sort_by', '0002_album_spin_count']

/** A migrations folder holding only 0000-0002, i.e. the database as it was before accounts. */
function writePreAccountsMigrations(dir: string) {
  mkdirSync(join(dir, 'meta'), { recursive: true })
  for (const tag of OLD_TAGS) copyFileSync(join(DRIZZLE_DIR, `${tag}.sql`), join(dir, `${tag}.sql`))
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8'))
  journal.entries = journal.entries.filter((e: { tag: string }) => OLD_TAGS.includes(e.tag))
  expect(journal.entries).toHaveLength(3)
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(journal))
}

describe('migrations', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'frisson-migrate-'))
  })
  afterEach(() => rmSync(tmp, { recursive: true, force: true }))

  it('migration 0003 preserves existing crates, albums and tracks', () => {
    const dbPath = join(tmp, 'crate.db')
    const oldMigrations = join(tmp, 'migrations')
    writePreAccountsMigrations(oldMigrations)

    // 1. A database at 0002, with data in it.
    const old = new Database(dbPath)
    old.pragma('foreign_keys = ON')
    migrate(drizzle(old), { migrationsFolder: oldMigrations })
    const insertCrate = old.prepare(
      'INSERT INTO crates (name, color, label, sort_by, sort_order) VALUES (?, ?, ?, ?, ?)',
    )
    insertCrate.run('Jazz', '#112233', 'JAZZ', 'artist', 0)
    insertCrate.run('Empty', '#c8a374', null, 'manual', 1)
    old
      .prepare(
        `INSERT INTO albums (crate_id, title, artist, year, genre, format, rating, notes, position, spin_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, 'Kind of Blue', 'Miles Davis', 1959, 'Jazz', 'LP', 5, 'Mint', 0, 7)
    const insertTrack = old.prepare(
      'INSERT INTO tracks (album_id, side, position, title, duration_sec) VALUES (?, ?, ?, ?, ?)',
    )
    insertTrack.run(1, 'A', 1, 'So What', 562)
    insertTrack.run(1, 'B', 1, 'All Blues', 693)
    const snapshot = {
      crates: old.prepare('SELECT * FROM crates ORDER BY id').all(),
      albums: old.prepare('SELECT * FROM albums ORDER BY id').all(),
      tracks: old.prepare('SELECT * FROM tracks ORDER BY id').all(),
    }
    old.close()

    // 2. Open it the way the app does, which applies 0003.
    const { close } = createDb(dbPath)
    close()

    // 3. Everything is still there, untouched, and the new structure exists.
    const after = new Database(dbPath, { readonly: true })
    try {
      const crates = after.prepare('SELECT * FROM crates ORDER BY id').all()
      expect(crates).toEqual(snapshot.crates.map((c) => ({ ...(c as object), owner_id: null })))
      expect(after.prepare('SELECT * FROM albums ORDER BY id').all()).toEqual(snapshot.albums)
      expect(after.prepare('SELECT * FROM tracks ORDER BY id').all()).toEqual(snapshot.tracks)

      const tables = after
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((t) => (t as { name: string }).name)
      expect(tables).toEqual(expect.arrayContaining(['users', 'sessions', 'crates', 'albums']))
      expect(after.pragma('foreign_key_check')).toEqual([])
      const ownerFk = (
        after.pragma('foreign_key_list(crates)') as { from: string; table: string }[]
      ).find((fk) => fk.from === 'owner_id')
      expect(ownerFk?.table).toBe('users')
    } finally {
      after.close()
    }
  })
})
