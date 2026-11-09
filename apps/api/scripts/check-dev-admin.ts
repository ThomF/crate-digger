// Real-server check of the dev admin step: `npm run check:dev-admin -w apps/api`.
// It starts the actual API on temporary databases and prints PASS or FAIL per step. Exits
// non-zero on any failure. It never opens the repo's data/crate.db.
//
// Data classification: CONFIDENTIAL (credentials). Everything here is throwaway fixture data in
// temp folders, but the dumps hold password hashes, so they are compared and never printed.

import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { createDb } from '../src/db/client.ts'
import { albums, crates, follows, newsItems, tracks, users } from '../src/db/schema.ts'
import { DEV_ADMIN_EMAIL } from '../src/services/dev-admin.ts'
import { hashPassword } from '../src/services/passwords.ts'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const OWNER_DB = join(REPO_ROOT, 'data', 'crate.db')
// In WAL mode writes land in the -wal file first, so crate.db alone can miss them.
const OWNER_DB_WAL = `${OWNER_DB}-wal`
const DEV_ADMIN_PASSWORD = 'admin'
const SESSION_COOKIE = 'frisson_session'
const START_TIMEOUT_MS = 30_000
const STOP_TIMEOUT_MS = 10_000

type Row = Record<string, unknown>
type Dump = Record<string, Row[]>

let failures = 0
function report(ok: boolean, step: string, detail?: string) {
  if (ok) {
    console.log(`PASS ${step}`)
  } else {
    failures += 1
    console.log(`FAIL ${step}${detail ? `: ${detail}` : ''}`)
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// What the servers printed, kept for the log scan. Hashes are redacted before any of it is shown.
const serverOutput: string[] = []
const redact = (text: string) => text.replace(/scrypt\$\S+/g, 'scrypt$<redacted>')

// ---- Everything that must be cleaned up, whichever way the run ends ----

const tempDirs = new Set<string>()
const children = new Set<ChildProcess>()

async function cleanUp() {
  for (const child of children) child.kill('SIGKILL')
  children.clear()
  const results = await Promise.allSettled(
    [...tempDirs].map((dir) => rm(dir, { recursive: true, force: true })),
  )
  tempDirs.clear()
  for (const result of results) {
    if (result.status === 'rejected') {
      report(false, 'temp folders removed', errorText(result.reason))
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void cleanUp().finally(() => process.exit(1))
  })
}

async function newTempDir(label: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `frisson-check-${label}-`))
  tempDirs.add(dir)
  return dir
}

// ---- The owner's database stays out of this ----

function realLocation(path: string): string {
  try {
    return join(realpathSync(dirname(path)), basename(path))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return resolve(path)
    throw err
  }
}

function assertNotOwnerDb(path: string) {
  if (realLocation(path) === realLocation(OWNER_DB)) {
    throw new Error(`Refusing to run against the repo's own database: ${path}`)
  }
}

async function fingerprint(file: string): Promise<string> {
  try {
    const { size, mtimeMs } = await stat(file)
    return `${size} bytes, mtime ${mtimeMs}`
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 'absent'
    throw err
  }
}

// ---- Fixture ----

async function buildFixture(dbPath: string) {
  assertNotOwnerDb(dbPath)
  const { db, close } = createDb(dbPath)
  try {
    // A random password, so a real scrypt hash is in play for the log scan.
    const passwordHash = await hashPassword(randomBytes(16).toString('hex'))
    const owner = db
      .insert(users)
      .values({
        email: 'owner@example.test',
        username: 'owner',
        displayName: 'Owner',
        passwordHash,
        role: 'admin',
      })
      .returning()
      .get()
    const member = db
      .insert(users)
      .values({
        email: 'member@example.test',
        username: 'member',
        displayName: 'Member',
        passwordHash,
      })
      .returning()
      .get()
    // Every crate MUST have an owner. Bootstrap hands ownerless crates to the earliest admin on
    // the next start. That is existing documented behaviour, but it would change rows here and
    // this check is about what the dev admin step changes.
    const crate = db
      .insert(crates)
      .values({ name: 'Owner crate', ownerId: owner.id, sortOrder: 0 })
      .returning()
      .get()
    db.insert(crates).values({ name: 'Member crate', ownerId: member.id, sortOrder: 1 }).run()
    const album = db
      .insert(albums)
      .values({ crateId: crate.id, title: 'Fixture album', artist: 'Fixture artist', position: 0 })
      .returning()
      .get()
    db.insert(tracks)
      .values({ albumId: album.id, side: 'A', position: 0, title: 'Fixture track' })
      .run()
    db.insert(follows).values({ followerId: member.id, followeeId: owner.id }).run()
    db.insert(newsItems)
      .values({
        seedKey: 'check:fixture',
        title: 'Fixture news',
        summary: 'Fixture summary',
        source: 'Fixture source',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      })
      .run()
  } finally {
    close()
  }
}

// ---- Dumps, from a connection of their own ----

function dumpDb(dbPath: string): Dump {
  assertNotOwnerDb(dbPath)
  const sqlite = new Database(dbPath, { readonly: true })
  try {
    const tables = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ESCAPE '\\'`)
      .all('table', 'sqlite\\_%') as { name: string }[]
    const dump: Dump = {}
    for (const { name } of tables) {
      // Identifiers can't be bound as parameters. The name comes from sqlite_master and is quoted.
      const table = `"${name.replaceAll('"', '""')}"`
      dump[name] = sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Row[]
    }
    return dump
  } finally {
    sqlite.close()
  }
}

/** Compares against a baseline. Returns the added rows, and problems for all else that differs. */
function compareDumps(before: Dump, after: Dump) {
  const problems: string[] = []
  const added: Record<string, Row[]> = {}
  for (const table of Object.keys(before)) {
    if (!after[table]) problems.push(`table ${table} is gone`)
  }
  for (const [table, rows] of Object.entries(after)) {
    const earlier = before[table]
    if (!earlier) {
      problems.push(`table ${table} is new`)
      continue
    }
    const seen = new Set(rows.map((row) => JSON.stringify(row)))
    const known = new Set(earlier.map((row) => JSON.stringify(row)))
    // Row contents are never printed: they hold hashes.
    const lost = earlier.filter((row) => !seen.has(JSON.stringify(row))).length
    if (lost > 0) problems.push(`${lost} earlier row(s) in ${table} changed or vanished`)
    const fresh = rows.filter((row) => !known.has(JSON.stringify(row)))
    if (fresh.length > 0) added[table] = fresh
  }
  return { problems, added }
}

/** The earlier rows are identical and the only addition is the one dev admin users row. */
function reportOnlyDevAdminAdded(step: string, before: Dump, after: Dump): Row | undefined {
  const { problems, added } = compareDumps(before, after)
  for (const table of Object.keys(added)) {
    if (table !== 'users') problems.push(`${added[table]!.length} row(s) added to ${table}`)
  }
  const addedUsers = added.users ?? []
  if (addedUsers.length !== 1) problems.push(`${addedUsers.length} users rows added, expected 1`)
  const row = addedUsers[0]
  if (row && (row.email !== DEV_ADMIN_EMAIL || row.role !== 'admin')) {
    problems.push('the added users row is not the dev admin with role admin')
  }
  const countBefore = before.users?.length ?? 0
  const countAfter = after.users?.length ?? 0
  if (countAfter !== countBefore + 1) {
    problems.push(`users count went from ${countBefore} to ${countAfter}`)
  }
  report(problems.length === 0, step, problems.join('; '))
  return row
}

// ---- The real server ----

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => {
        if (address && typeof address === 'object') resolvePort(address.port)
        else reject(new Error('Could not find a free port'))
      })
    })
  })
}

type RunningServer = {
  child: ChildProcess
  baseUrl: string
  exited: Promise<void>
}

async function startServer(dataDir: string, extraEnv: NodeJS.ProcessEnv): Promise<RunningServer> {
  assertNotOwnerDb(join(dataDir, 'crate.db'))
  const port = await freePort()
  // Built from scratch, so nothing in the caller's shell (NODE_ENV, ADMIN_*, DATABASE_PATH,
  // WEB_DIR and so on) can leak in and change what is being checked.
  const env: NodeJS.ProcessEnv = {
    DATA_DIR: dataDir,
    PORT: String(port),
    HOST: '127.0.0.1',
    SEED_DEMO_DATA: 'false',
    ...extraEnv,
  }
  if (process.env.PATH) env.PATH = process.env.PATH
  if (process.env.HOME) env.HOME = process.env.HOME

  // process.execPath is this same `node`, whatever PATH resolves it to.
  const child = spawn(process.execPath, ['apps/api/src/server.ts'], {
    cwd: REPO_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  const output: string[] = []
  const capture = (chunk: Buffer) => {
    const text = chunk.toString()
    output.push(text)
    serverOutput.push(text)
  }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)

  let hasExited = false
  const exited = new Promise<void>((resolveExit) => {
    child.once('close', () => {
      hasExited = true
      children.delete(child)
      resolveExit()
    })
  })
  child.once('error', (err) => {
    output.push(`Could not spawn the server: ${err.message}`)
  })

  const baseUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + START_TIMEOUT_MS
  let lastProblem = 'no response yet'
  while (Date.now() < deadline) {
    if (hasExited) {
      throw new Error(`The server exited during start:\n${redact(output.join(''))}`)
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1_000) })
      if (res.ok) return { child, baseUrl, exited }
      lastProblem = `health returned ${res.status}`
    } catch (err) {
      // Refused until the server is listening: keep polling until the deadline.
      lastProblem = errorText(err)
    }
    await new Promise((wake) => setTimeout(wake, 100))
  }
  throw new Error(
    `The server was not healthy in time (${lastProblem}):\n${redact(output.join(''))}`,
  )
}

async function stopServer(server: RunningServer) {
  server.child.kill('SIGTERM')
  let timer: NodeJS.Timeout | undefined
  const timedOut = await Promise.race([
    server.exited.then(() => false),
    new Promise<boolean>((wake) => {
      timer = setTimeout(() => wake(true), STOP_TIMEOUT_MS)
    }),
  ])
  clearTimeout(timer)
  if (timedOut) {
    server.child.kill('SIGKILL')
    await server.exited
    throw new Error('The server ignored SIGTERM')
  }
}

const logIn = (server: RunningServer, password: string) =>
  fetch(`${server.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEV_ADMIN_EMAIL, password }),
  })

function sessionCookie(res: Response): string | undefined {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  return cookie?.split(';')[0]
}

// ---- The check ----

/** Fixture, two starts with NODE_ENV unset, comparisons while up, then a real login. */
async function checkDevelopmentStarts() {
  const dataDir = await newTempDir('dev')
  const dbPath = join(dataDir, 'crate.db')
  await buildFixture(dbPath)
  const baseline = dumpDb(dbPath)
  report(true, 'fixture has users, crates, albums, tracks and news, all crates owned')

  const first = await startServer(dataDir, {})
  report(true, 'first start with NODE_ENV unset is healthy')
  await stopServer(first)
  const afterFirst = reportOnlyDevAdminAdded(
    'after the first start, the only change is one added admin row',
    baseline,
    dumpDb(dbPath),
  )

  const second = await startServer(dataDir, {})
  report(true, 'second start is healthy')
  try {
    // Taken before logging in, because a login adds a sessions row.
    const up = dumpDb(dbPath)
    const afterSecond = reportOnlyDevAdminAdded(
      'after the second start, the only change is still one added admin row',
      baseline,
      up,
    )
    report(
      afterFirst !== undefined &&
        afterSecond !== undefined &&
        afterFirst.password_hash === afterSecond.password_hash,
      'the second start left the dev admin password_hash byte-identical',
    )

    const login = await logIn(second, DEV_ADMIN_PASSWORD)
    const loginBody = await login.text()
    report(login.status === 200, 'login with the dev admin returns 200', `got ${login.status}`)
    report(
      !loginBody.includes('scrypt$') && !loginBody.includes('passwordHash'),
      'the login response has no password hash',
    )

    const cookie = sessionCookie(login)
    report(cookie !== undefined, 'login set a session cookie')
    const me = await fetch(`${second.baseUrl}/api/auth/me`, {
      headers: cookie ? { cookie } : {},
    })
    const meBody = (await me.json()) as { role?: unknown }
    report(
      me.status === 200 && meBody.role === 'admin',
      'the session user has role admin',
      `got ${me.status}, role ${String(meBody.role)}`,
    )
  } finally {
    await stopServer(second)
  }
  return dumpDb(dbPath)
}

/** A separate database, with NODE_ENV=production and SEED_DEV_ADMIN=true trying to override it. */
async function checkProductionStart() {
  const dataDir = await newTempDir('prod')
  const dbPath = join(dataDir, 'crate.db')
  await buildFixture(dbPath)
  const baseline = dumpDb(dbPath)

  const server = await startServer(dataDir, { NODE_ENV: 'production', SEED_DEV_ADMIN: 'true' })
  report(true, 'production start is healthy')
  try {
    const login = await logIn(server, DEV_ADMIN_PASSWORD)
    report(login.status === 401, 'production login returns 401', `got ${login.status}`)
  } finally {
    await stopServer(server)
  }

  const after = dumpDb(dbPath)
  report(
    !after.users?.some((row) => row.email === DEV_ADMIN_EMAIL),
    'production has no dev admin row',
  )
  const { problems, added } = compareDumps(baseline, after)
  for (const table of Object.keys(added)) problems.push(`row(s) added to ${table}`)
  report(problems.length === 0, 'production left every table unchanged', problems.join('; '))
  return after
}

function checkServerOutput(dumps: Dump[]) {
  const output = serverOutput.join('')
  report(output.length > 0, 'captured server output to scan')
  report(!output.includes('scrypt$'), 'server output has no scrypt$ string')
  const hashes = dumps.flatMap((dump) => (dump.users ?? []).map((row) => String(row.password_hash)))
  report(
    hashes.length > 0 && !hashes.some((hash) => output.includes(hash)),
    'server output has no password_hash value',
  )
  // 'admin' alone is everywhere in ordinary messages, so look for it as a password value.
  report(!/password\W+admin\b/i.test(output), 'server output has no plaintext dev admin password')
}

async function main() {
  const ownerBefore = await fingerprint(OWNER_DB)
  const walBefore = await fingerprint(OWNER_DB_WAL)
  try {
    const devDump = await checkDevelopmentStarts()
    const prodDump = await checkProductionStart()
    checkServerOutput([devDump, prodDump])
  } catch (err) {
    report(false, 'the check ran to the end', redact(errorText(err)))
  } finally {
    await cleanUp()
  }
  const ownerAfter = await fingerprint(OWNER_DB)
  report(
    ownerBefore === ownerAfter,
    'data/crate.db size and mtime are unchanged',
    `before ${ownerBefore}, after ${ownerAfter}`,
  )
  // A warning, not a failure: the servers above only ever see temp folders, so a change here
  // means some other process is writing, such as `npm run dev` restarting on a source edit.
  const walAfter = await fingerprint(OWNER_DB_WAL)
  if (walBefore !== walAfter) {
    console.log(
      `WARN data/crate.db-wal changed during the check (before ${walBefore}, after ${walAfter}). ` +
        'Another process, probably a running npm run dev, is writing to data/crate.db.',
    )
  }

  console.log(failures === 0 ? '\nAll steps passed.' : `\n${failures} step(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
