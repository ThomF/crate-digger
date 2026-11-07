import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { HttpError } from '../errors.ts'

// Data classification: CONFIDENTIAL (credentials). Plain passwords pass through here
// and must never be logged or stored; only the scrypt hash is kept.

export const MIN_PASSWORD_LENGTH = 8

const N = 16384
const r = 8
const p = 1
const KEY_LENGTH = 64
const SALT_BYTES = 16
// scrypt needs about 128 * N * r bytes; leave headroom over Node's 32 MiB default.
const SCRYPT_OPTIONS: ScryptOptions = { N, r, p, maxmem: 128 * N * r * 2 }

// Self-describing so the parameters can change later without breaking old hashes:
// scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>
const PREFIX = 'scrypt'

function derive(plain: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(plain.normalize('NFKC'), salt, keyLength, options, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

/** Hashes a password with a fresh random salt. Throws 400 for passwords under 8 characters. */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string' || plain.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(plain, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return [PREFIX, N, r, p, salt.toString('base64'), key.toString('base64')].join('$')
}

function parse(stored: string) {
  const [prefix, costText, blockText, parallelText, saltText, keyText, ...rest] = stored.split('$')
  if (prefix !== PREFIX || rest.length > 0) return null
  if (!costText || !blockText || !parallelText || !saltText || !keyText) return null
  const cost = Number(costText)
  const blockSize = Number(blockText)
  const parallel = Number(parallelText)
  const salt = Buffer.from(saltText, 'base64')
  const key = Buffer.from(keyText, 'base64')
  const valid =
    [cost, blockSize, parallel].every((n) => Number.isInteger(n) && n > 0) &&
    cost > 1 &&
    cost <= 1 << 20 &&
    (cost & (cost - 1)) === 0 && // scrypt requires N to be a power of two
    blockSize <= 32 &&
    parallel <= 16 &&
    salt.length > 0 &&
    key.length > 0
  if (!valid) return null
  return { cost, blockSize, parallel, salt, key }
}

/** Constant-time check of a password against a stored hash. Malformed hashes give false. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false
  const parsed = parse(stored)
  if (!parsed) return false
  const { cost, blockSize, parallel, salt, key } = parsed
  const actual = await derive(plain, salt, key.length, {
    N: cost,
    r: blockSize,
    p: parallel,
    maxmem: 128 * cost * blockSize * 2,
  })
  return actual.length === key.length && timingSafeEqual(actual, key)
}

// A real hash of a random password nobody knows, computed once on first use.
let dummyHash: Promise<string> | undefined

/**
 * Spends the same scrypt time as a real verify, then returns false. Login calls this
 * for unknown emails so response timing doesn't reveal which accounts exist.
 */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64'))
  await verifyPassword(typeof plain === 'string' ? plain : '', await dummyHash)
  return false
}
