// Browser check for crate favorites (AC9, AC10). Starts its own app on a temp DB; writes nothing to the repo.
import { chromium } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startApp, deadSpots, until } from './lib.mjs'

const PORT = 4917
const shots = mkdtempSync(join(tmpdir(), 'fav-shots-'))
const app = await startApp(PORT)
const browser = await chromium.launch()
const results = {}
const notes = []
const note = (s) => { notes.push(s); console.log('  ' + s) }

async function signup(ctx, u) {
  const r = await ctx.request.post(`${app.base}/api/auth/signup`, {
    data: { email: `${u}@example.test`, username: u, displayName: `${u} Display`, password: 'testpass123' },
  })
  if (r.status() !== 201) throw new Error(`signup ${u}: ${r.status()} ${await r.text()}`)
}
async function crate(ctx, name) {
  const r = await ctx.request.post(`${app.base}/api/crates`, { data: { name } })
  if (r.status() !== 201) throw new Error(`crate ${name}: ${r.status()} ${await r.text()}`)
  return (await r.json()).id
}

try {
  const ctxB = await browser.newContext()
  await signup(ctxB, 'bea')
  const b1 = await crate(ctxB, 'Bea Funk Box')
  const b2 = await crate(ctxB, 'Bea Jazz Box')
  const b3 = await crate(ctxB, 'Bea Soul Box')
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await signup(ctxA, 'alf')
  const a1 = await crate(ctxA, 'Alf Own Box')
  const page = await ctxA.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // ── AC9 ─────────────────────────────────────────────────────────────
  {
    let ok = true
    const fail = (m) => { ok = false; note('AC9: ' + m) }
    await page.goto(`${app.base}/crates/${b1}`)
    const btn = page.getByRole('button', { name: 'Favorite' })
    if (!(await until(() => btn.isVisible(), 8000))) fail('no Favorite button on B crate')
    else {
      if ((await btn.getAttribute('aria-pressed')) !== 'false') fail('initial aria-pressed not false')
      // Every click point on the button must toggle it (each click flips the state).
      let expect = 'true'
      const dead = await deadSpots(
        page, btn,
        async () => {
          const got = await until(async () => (await btn.getAttribute('aria-pressed')) === expect && (await btn.isEnabled()), 3000)
          return got
        },
        async () => { expect = expect === 'true' ? 'false' : 'true' },
      )
      if (dead.length) fail('Favorite button dead spots ' + JSON.stringify(dead))
      // 9 clicks -> ends pressed
      if ((await btn.getAttribute('aria-pressed')) !== 'true') fail('button not pressed after odd number of clicks')
      await page.screenshot({ path: join(shots, 'ac9-pressed.png') })

      await page.goto(`${app.base}/profile`)
      const fav = page.locator('section.favorites li.crate', { hasText: 'Bea Funk Box' })
      if (!(await until(() => fav.isVisible(), 8000))) fail('crate not listed under Favorites on /profile')
      if ((await page.locator('section.crates', { hasText: 'Bea Funk Box' }).count()) > 0) fail('crate listed under Crates')
      if (!(await page.locator('section.crates', { hasText: 'Alf Own Box' }).count())) fail('own crate missing from Crates')
      const favH = await page.getByRole('heading', { name: 'Favorites' }).count()
      if (!favH) fail('no Favorites heading')
      await page.screenshot({ path: join(shots, 'ac9-profile.png'), fullPage: true })
      if (await fav.count()) {
        const profileUrl = page.url()
        const dead2 = await deadSpots(
          page, fav,
          () => until(() => new URL(page.url()).pathname === `/crates/${b1}`, 3000),
          async () => { await page.goto(profileUrl); await until(() => fav.isVisible(), 8000) },
        )
        if (dead2.length) fail('Favorites card dead spots ' + JSON.stringify(dead2))
        await fav.click()
        if (!(await until(() => new URL(page.url()).pathname === `/crates/${b1}`, 3000))) fail('card click did not open crate')
        else if (!(await until(() => page.getByRole('heading', { name: /Bea Funk Box/ }).first().isVisible().catch(() => false) || page.getByText('Bea Funk Box').first().isVisible(), 5000))) fail('crate page did not show crate')
      }
      // Unfavorite from the crate page.
      if (new URL(page.url()).pathname !== `/crates/${b1}`) await page.goto(`${app.base}/crates/${b1}`)
      const btn2 = page.getByRole('button', { name: 'Favorite' })
      await until(() => btn2.isVisible(), 8000)
      if ((await btn2.getAttribute('aria-pressed')) !== 'true') fail('button not pressed on return to crate page')
      await btn2.click()
      if (!(await until(async () => (await btn2.getAttribute('aria-pressed')) === 'false', 3000))) fail('button did not unpress')
      await page.goto(`${app.base}/profile`)
      await page.reload()
      await until(() => page.getByText('No favorites yet.').isVisible(), 8000)
      if ((await page.locator('section.favorites', { hasText: 'Bea Funk Box' }).count()) > 0) fail('crate still in Favorites after unfavorite + reload')
      if (!(await page.getByText('No favorites yet.').isVisible())) fail('empty state not shown')
    }
    results.AC9 = ok
  }

  // ── AC10 ────────────────────────────────────────────────────────────
  {
    let ok = true
    const fail = (m) => { ok = false; note('AC10: ' + m) }
    await page.goto(`${app.base}/crates/${a1}`)
    await until(() => page.getByText('Alf Own Box').first().isVisible(), 8000)
    await page.waitForTimeout(1500) // let any favorite-state fetch settle
    if ((await page.getByRole('button', { name: 'Favorite' }).count()) > 0) fail('Favorite button shown on own crate')
    // Sanity: the same wait on B crate shows the button, so absence above is meaningful.
    await page.goto(`${app.base}/crates/${b2}`)
    const fb = page.getByRole('button', { name: 'Favorite' })
    if (!(await until(() => fb.isVisible(), 8000))) fail('no button on other crate (sanity)')
    else { await fb.click(); await until(async () => (await fb.getAttribute('aria-pressed')) === 'true', 3000) }
    await page.goto(`${app.base}/crates/${b3}`)
    const fb3 = page.getByRole('button', { name: 'Favorite' })
    if (await until(() => fb3.isVisible(), 8000)) { await fb3.click(); await until(async () => (await fb3.getAttribute('aria-pressed')) === 'true', 3000) }

    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      const url = `${app.base}/u/alf`
      await page.goto(url)
      const cards = page.locator('section.favorites li.crate')
      await until(async () => (await cards.count()) >= 2, 8000)
      const n = await cards.count()
      if (n < 2) { fail(`${width}px: expected >=2 favorites, got ${n}`); continue }
      if (!(await page.locator('section.crates').isVisible())) fail(`${width}px: Crates section not visible`)
      if (!(await page.locator('section.favorites').isVisible())) fail(`${width}px: Favorites section not visible`)
      const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }))
      if (ov.sw > ov.cw || ov.bw > ov.cw) fail(`${width}px: horizontal overflow ${JSON.stringify(ov)}`)
      await page.screenshot({ path: join(shots, `ac10-${width}.png`), fullPage: true })
      const order = await cards.allInnerTexts()
      note(`${width}px favorites order: ${order.map((t) => t.split('\n')[0]).join(' | ')}`)
      for (let i = 0; i < n; i++) {
        const card = cards.nth(i)
        const href = await card.locator('a').getAttribute('href')
        // Centre click, as the criterion states.
        await card.scrollIntoViewIfNeeded()
        const box = await card.boundingBox()
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        if (!(await until(() => new URL(page.url()).pathname === href, 3000))) fail(`${width}px: centre click on favorite ${i} did not open ${href} (at ${page.url()})`)
        await page.goto(url); await until(async () => (await cards.count()) >= 2, 8000)
        // And the rest of the card.
        const dead = await deadSpots(
          page, card,
          () => until(() => new URL(page.url()).pathname === href, 3000),
          async () => { if (page.url() !== url) { await page.goto(url); await until(async () => (await cards.count()) >= 2, 8000) } },
        )
        if (dead.length) fail(`${width}px: favorite ${i} dead spots ${JSON.stringify(dead)}`)
      }
      // Crate cards in the Crates section must still open their own crate, not a favorite.
      const own = page.locator('section.crates li.crate').first()
      const ownHref = await own.locator('a').getAttribute('href')
      const deadOwn = await deadSpots(
        page, own,
        () => until(() => new URL(page.url()).pathname === ownHref, 3000),
        async () => { if (page.url() !== url) { await page.goto(url); await until(async () => (await cards.count()) >= 2, 8000) } },
      )
      if (deadOwn.length) fail(`${width}px: own crate card dead spots ${JSON.stringify(deadOwn)}`)
    }
    results.AC10 = ok
  }
  if (errors.length) note('page errors: ' + errors.join(' ; '))
} catch (e) {
  note('ERROR ' + (e.stack || e))
} finally {
  await browser.close()
  app.stop()
}
for (const id of ['AC9', 'AC10']) console.log(`${results[id] ? 'PASS' : 'FAIL'} ${id}`)
console.log('screenshots: ' + shots)
