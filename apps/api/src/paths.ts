import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Where the API keeps things on disk. Everything you'd back up lives under DATA_DIR,
// so self-hosting means mounting one folder. Each path can be overridden with an env var.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export const DATA_DIR = process.env.DATA_DIR ?? resolve(repoRoot, 'data')
export const DEFAULT_DB_PATH = process.env.DATABASE_PATH ?? resolve(DATA_DIR, 'crate.db')
export const DEFAULT_COVERS_DIR = process.env.COVERS_DIR ?? resolve(DATA_DIR, 'covers')
