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
const PRE_PROFILE_TAGS = [...OLD_TAGS, '0003_accounts']

/** A migrations folder holding only the given tags, i.e. the database as it was back then. */
function writeMigrations(dir: string, tags: string[]) {
  mkdirSync(join(dir, 'meta'), { recursive: true })
  for (const tag of tags) copyFileSync(join(DRIZZLE_DIR, `${tag}.sql`), join(dir, `${tag}.sql`))
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8'))
  journal.entries = journal.entries.filter((e: { tag: string }) => tags.includes(e.tag))
  expect(journal.entries).toHaveLength(tags.length)
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(journal))
}

/** A migrations folder holding only 0000-0002, i.e. the database as it was before accounts. */
function writePreAccountsMigrations(dir: string) {
  writeMigrations(dir, OLD_TAGS)
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

  describe('migration 0004', () => {
    it('migration 0004 keeps users, sessions, crates, albums and tracks and gives users empty profiles', () => {
      const dbPath = join(tmp, 'crate.db')
      const oldMigrations = join(tmp, 'migrations')
      writeMigrations(oldMigrations, PRE_PROFILE_TAGS)

      // 1. A database at 0003, with an account, a session and a collection in it.
      const old = new Database(dbPath)
      old.pragma('foreign_keys = ON')
      migrate(drizzle(old), { migrationsFolder: oldMigrations })
      old
        .prepare(
          'INSERT INTO users (email, username, display_name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        )
        .run('ada@example.com', 'ada', 'Ada', 'scrypt$placeholder', 'admin')
      old
        .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .run('a'.repeat(64), 1, 2_000_000_000)
      old
        .prepare(
          'INSERT INTO crates (name, color, label, sort_by, sort_order, owner_id) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('Jazz', '#112233', 'JAZZ', 'artist', 0, 1)
      old
        .prepare(
          `INSERT INTO albums (crate_id, title, artist, year, genre, format, rating, notes, position, spin_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(1, 'Kind of Blue', 'Miles Davis', 1959, 'Jazz', 'LP', 5, 'Mint', 0, 7)
      old
        .prepare(
          'INSERT INTO tracks (album_id, side, position, title, duration_sec) VALUES (?, ?, ?, ?, ?)',
        )
        .run(1, 'A', 1, 'So What', 562)
      const snapshot = {
        users: old.prepare('SELECT * FROM users ORDER BY id').all(),
        sessions: old.prepare('SELECT * FROM sessions ORDER BY id').all(),
        crates: old.prepare('SELECT * FROM crates ORDER BY id').all(),
        albums: old.prepare('SELECT * FROM albums ORDER BY id').all(),
        tracks: old.prepare('SELECT * FROM tracks ORDER BY id').all(),
      }
      old.close()

      // 2. Open it the way the app does, which applies 0004.
      const { close } = createDb(dbPath)
      close()

      // 3. Every row is intact, and the existing user has an empty profile.
      const after = new Database(dbPath, { readonly: true })
      try {
        expect(after.prepare('SELECT * FROM users ORDER BY id').all()).toEqual(
          snapshot.users.map((u) => ({
            ...(u as object),
            bio: '',
            location: null,
            avatar_path: null,
            verified: 0,
          })),
        )
        expect(after.prepare('SELECT * FROM sessions ORDER BY id').all()).toEqual(snapshot.sessions)
        expect(after.prepare('SELECT * FROM crates ORDER BY id').all()).toEqual(snapshot.crates)
        expect(after.prepare('SELECT * FROM albums ORDER BY id').all()).toEqual(snapshot.albums)
        expect(after.prepare('SELECT * FROM tracks ORDER BY id').all()).toEqual(snapshot.tracks)
        expect(after.prepare('SELECT COUNT(*) AS n FROM user_links').get()).toEqual({ n: 0 })
        expect(after.pragma('foreign_key_check')).toEqual([])
      } finally {
        after.close()
      }

      // 4. Through Drizzle, verified reads back as the boolean false.
      const reopened = createDb(dbPath)
      try {
        const user = reopened.db.query.users.findFirst().sync()
        expect(user?.verified).toBe(false)
        expect(user?.bio).toBe('')
        expect(user?.location).toBeNull()
        expect(user?.avatarPath).toBeNull()
      } finally {
        reopened.close()
      }
    })
  })
})
