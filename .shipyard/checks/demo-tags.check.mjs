// Home labels demo content only: admin-written news and admin-suggested crates carry no Demo tag,
// with demo seeding on so both kinds sit side by side. Temp database, never the owner's data.
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const repo = new URL('../..', import.meta.url).pathname
const port = 4361
const base = `http://127.0.0.1:${port}`
const shot = process.env.SHOT_DIR
let failures = 0
const report = (ok, id) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`)
  if (!ok) failures++
}

const tmp = mkdtempSync(join(tmpdir(), 'shipyard-check-'))
const build = spawnSync(
  'npx',
  ['vite', 'build', '--outDir', join(tmp, 'web'), '--emptyOutDir', '--logLevel', 'error'],
  { cwd: join(repo, 'apps/web'), encoding: 'utf8' },
)
if (build.status !== 0) throw new Error(`vite build failed: ${build.stderr}`)
const api = spawn('node', ['apps/api/src/server.ts'], {
  cwd: repo,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    DATA_DIR: join(tmp, 'data'),
    SEED_DEMO_DATA: 'true',
    ADMIN_EMAIL: '',
    WEB_DIR: join(tmp, 'web'),
    NODE_ENV: 'development',
  },
  stdio: 'ignore',
})
const browser = await chromium.launch()
try {
  for (let i = 0; i < 75; i++) {
    const up = await fetch(`${base}/api/health`).then((r) => r.ok, () => false)
    if (up) break
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await admin.newPage()
  await page.goto(`${base}/login`)
  await page.getByLabel(/email/i).fill('admin@frisson.com')
  await page.getByLabel(/password/i).fill('admin')
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  const post = (path, body) =>
    page.evaluate(
      async ([p, b]) =>
        (
          await fetch(p, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(b),
          })
        ).status,
      [path, body],
    )
  report(
    (await post('/api/admin/news', { title: 'Admin headline', summary: 'Real.', source: 'Frisson' })) ===
      201,
    'create-news',
  )
  report((await post('/api/admin/crates', { name: 'Admin pick', suggested: true })) === 201, 'create-crate')

  const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const home = await visitor.newPage()
  await home.goto(base)
  await home.locator('.story').first().waitFor()
  await home.locator('.crate-card').first().waitFor()
  const written = home.locator('.story', { hasText: 'Admin headline' })
  report((await written.count()) === 1, 'admin-news-on-home')
  report((await written.locator('.demo-tag').count()) === 0, 'admin-news-untagged')
  const demoNews = home.locator('.story', { hasNotText: 'Admin headline' })
  const demoCount = await demoNews.count()
  report(
    demoCount > 0 && (await demoNews.locator('.demo-tag').count()) === demoCount,
    'demo-news-tagged',
  )
  const pick = home.locator('.crate-card', { hasText: 'Admin pick' })
  report((await pick.count()) === 1, 'admin-crate-on-home')
  report((await pick.locator('.demo-tag').count()) === 0, 'admin-crate-untagged')
  const demoCrates = home.locator('.crate-card', { hasNotText: 'Admin pick' })
  const demoCrateCount = await demoCrates.count()
  report(
    demoCrateCount > 0 && (await demoCrates.locator('.demo-tag').count()) === demoCrateCount,
    'demo-crates-tagged',
  )
  report(!/demo/i.test(await home.locator('section.recommended .note').innerText()), 'note-neutral')
  if (shot) await home.screenshot({ path: join(shot, 'home-demo-tags.png'), fullPage: true })
  // The tag sits inside a card whose link is stretched over it, so the card must still open.
  const tag = demoCrates.first().locator('.demo-tag')
  await tag.scrollIntoViewIfNeeded()
  // Let the view transition after the page load finish; it swallows clicks while it runs.
  await home.waitForTimeout(800)
  const box = await tag.boundingBox()
  await home.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await home.waitForURL(/\/crates\/\d+/)
  report(true, 'click-on-tag-opens-crate')
  await home.goto(`${base}/about`)
  report(
    (await home.getByText('Anything marked Demo').count()) === 1,
    'about-copy',
  )
} finally {
  await browser.close()
  api.kill('SIGTERM')
  rmSync(tmp, { recursive: true, force: true })
}
process.exit(failures === 0 ? 0 : 1)
