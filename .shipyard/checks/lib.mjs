// Shared helpers for .shipyard/checks/*.check.mjs. Each check starts its own API on a temp DB.
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const repo = resolve(import.meta.dirname, '../..')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function until(fn, ms = 3000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if (await fn()) return true
    } catch {
      // A navigation can destroy the context mid-read; try again.
    }
    await sleep(50)
  }
  return false
}

// Clicks across an element. Returns each point where landed() was false.
export async function deadSpots(page, target, landed, reset, { xs = [0.25, 0.5, 0.75], ys = [0.25, 0.5, 0.75] } = {}) {
  const dead = []
  for (const fx of xs) for (const fy of ys) {
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
    if (!(await landed())) dead.push([fx, fy])
    await reset()
  }
  return dead
}

// Builds the web client into a temp dir and serves it from the API on a fresh temp DB.
export async function startApp(port) {
  const tmp = mkdtempSync(join(tmpdir(), 'shipyard-check-'))
  const build = spawnSync(
    'npx',
    ['vite', 'build', '--outDir', join(tmp, 'web'), '--emptyOutDir', '--logLevel', 'error'],
    { cwd: join(repo, 'apps/web'), encoding: 'utf8' },
  )
  if (build.status !== 0) throw new Error(`vite build failed: ${build.stdout}${build.stderr}`)
  const api = spawn('node', ['apps/api/src/server.ts'], {
    cwd: repo,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DATA_DIR: join(tmp, 'data'),
      SEED_DEMO_DATA: 'false',
      ADMIN_EMAIL: '',
      WEB_DIR: join(tmp, 'web'),
      NODE_ENV: 'development',
    },
    stdio: 'ignore',
  })
  const base = `http://127.0.0.1:${port}`
  const up = await until(async () => (await fetch(`${base}/api/health`)).ok, 15000)
  if (!up) {
    api.kill('SIGTERM')
    throw new Error('API did not start')
  }
  return {
    base,
    tmp,
    stop() {
      api.kill('SIGTERM')
      rmSync(tmp, { recursive: true, force: true })
    },
  }
}
