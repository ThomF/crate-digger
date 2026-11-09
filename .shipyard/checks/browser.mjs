// AC12: one real-browser pass against a temp DB. Run: node .shipyard/checks/browser.mjs
// Starts its own API (port 4311) serving a fresh vite build from a temp dir; touches nothing else.
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { chromium } from 'playwright'

const repo = resolve(import.meta.dirname, '../..')
const PORT = 4311
const BASE = `http://127.0.0.1:${PORT}`
const tmp = mkdtempSync(join(tmpdir(), 'ac12-'))
const LONG = 'Long-Named-Crate-'.padEnd(80, 'x')
const failures = []
let api = null

const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`)
  if (!ok) failures.push(msg)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, what, ms = 4000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await sleep(100)
  }
  console.log(`  (timed out waiting for ${what})`)
  return false
}

async function post(path, body, cookie) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} ${res.status} ${await res.text()}`)
  return { res, json: await res.json() }
}

async function setup() {
  console.log('building web into temp dir')
  const build = spawnSync(
    'npx',
    ['vite', 'build', '--outDir', join(tmp, 'web'), '--emptyOutDir', '--logLevel', 'error'],
    { cwd: join(repo, 'apps/web'), encoding: 'utf8' },
  )
  if (build.status !== 0) throw new Error(`vite build failed: ${build.stdout}${build.stderr}`)

  api = spawn('node', ['apps/api/src/server.ts'], {
    cwd: repo,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATA_DIR: join(tmp, 'data'),
      SEED_DEMO_DATA: 'false',
      WEB_DIR: join(tmp, 'web'),
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  api.stderr.on('data', (d) => process.stderr.write(`[api] ${d}`))
  const up = await waitFor(
    async () => {
      try {
        return (await fetch(`${BASE}/api/health`)).ok
      } catch {
        return false
      }
    },
    'api',
    15000,
  )
  if (!up) throw new Error('API did not start')

  const { res } = await post('/auth/signup', {
    email: 'ac12@example.test',
    username: 'ac12user',
    password: 'ac12-test-password',
  })
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')

  const ids = []
  for (let i = 0; i < 12; i++) {
    const { json: c } = await post('/crates', { name: i === 0 ? 'Temp' : `Crate ${i}` }, cookie)
    ids.push(c.id)
    for (let a = 1; a <= 4; a++) {
      await post('/albums', { crateId: c.id, title: `Album ${i}-${a}`, artist: `Artist ${a}` }, cookie)
    }
  }
  const db = new DatabaseSync(join(tmp, 'data', 'crate.db'))
  db.exec('PRAGMA busy_timeout = 5000')
  // The API caps names at 60 characters, so the 80-character name is written to the temp DB.
  db.prepare('UPDATE crates SET name = ?, label = NULL WHERE id = ?').run(LONG, ids[0])
  ids.forEach((id, i) => db.prepare('UPDATE crates SET recommended_rank = ? WHERE id = ?').run(i + 1, id))
  db.close()
  return ids
}

const visibleTabs = (page) => page.locator('.tab:visible').count()
const count = async (page) => (await page.locator('.now .count').first().innerText()).trim()
const h1s = (page) => page.locator('h1').allInnerTexts()

async function partA(browser, ids) {
  for (const width of [1280, 390, 320]) {
    console.log(`(a) width ${width}`)
    const ctx = await browser.newContext({ viewport: { width, height: 800 } })
    const page = await ctx.newPage()
    for (const [name, id] of [[LONG, ids[0]], ['Crate 5', ids[5]]]) {
      await page.goto(`${BASE}/`)
      const link = page.locator('a.crate-link', { hasText: name }).first()
      await link.waitFor()
      await link.click()
      const landed = await waitFor(() => page.url() === `${BASE}/crates/${id}`, 'crate url')
      check(landed, `${width}px: card "${name.slice(0, 20)}" lands on /crates/${id} (url ${page.url()})`)
      await page.locator('.scene').waitFor()
      check((await visibleTabs(page)) === 0, `${width}px: no visible .tab`)
      check(
        (await page.locator('.tab').count()) === 0 && (await page.locator('[aria-label="Crates"][role="group"]').count()) === 0,
        `${width}px: no .tab nodes and no Crates group at all`,
      )
      const heads = await h1s(page)
      check(heads.length === 1 && heads[0].trim() === name, `${width}px: exactly one h1 equal to name (got ${JSON.stringify(heads)})`)
      const m = await page.evaluate(() => {
        const de = document.documentElement
        const front = document.querySelector('.panel.front')
        const label = document.querySelector('.crate-label')
        const h1 = document.querySelector('h1')
        const r = (el) => (el ? el.getBoundingClientRect() : null)
        const f = r(front), l = r(label), h = r(h1)
        return {
          scrollWidth: de.scrollWidth,
          clientWidth: de.clientWidth,
          panel: f && [Math.round(f.left), Math.round(f.right)],
          label: l && [Math.round(l.left), Math.round(l.right)],
          h1: h && [Math.round(h.left), Math.round(h.right)],
          labelScrollW: label && label.scrollWidth,
          labelClientW: label && label.clientWidth,
        }
      })
      check(m.scrollWidth <= m.clientWidth, `${width}px: scrollWidth ${m.scrollWidth} <= clientWidth ${m.clientWidth} (${name === LONG ? '80-char crate' : 'normal crate'})`)
      if (name === LONG) {
        const overflow = m.label && m.panel && (m.label[0] < m.panel[0] - 1 || m.label[1] > m.panel[1] + 1)
        console.log(`  OBS ${width}px 80-char: panel x=${m.panel} label x=${m.label} h1 x=${m.h1} label scrollW/clientW=${m.labelScrollW}/${m.labelClientW} labelOutsidePanel=${Boolean(overflow)}`)
        await page.screenshot({ path: join(repo, `.shipyard/checks/ac12-long-${width}.png`) })
      }
    }
    await ctx.close()
  }
}

async function artGeometry(page) {
  return page.evaluate(() => {
    const sl = document.querySelector('.sleeve.current').getBoundingClientRect()
    const panel = document.querySelector('.panel.front').getBoundingClientRect()
    return { x: sl.left + sl.width / 2, top: sl.top, panelTop: panel.top, w: sl.width }
  })
}
const hitAt = (page, x, y) =>
  page.evaluate(([px, py]) => {
    const e = document.elementFromPoint(px, py)
    return e ? `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')}` : 'none'
  }, [x, y])

async function partB(browser, ids) {
  console.log('(b) wheel / arrows / drag at 1280')
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const url = `${BASE}/crates/${ids[3]}`
  await page.goto(url)
  await page.locator('.scene').waitFor()
  check((await count(page)) === '1 / 4', `starts at "1 / 4" (got "${await count(page)}")`)
  const box = await page.locator('.scene').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 120)
  check(await waitFor(async () => (await count(page)) === '2 / 4', 'wheel'), `mouse wheel advances .count to "2 / 4" (got "${await count(page)}")`)
  await page.locator('.scene').focus()
  await page.keyboard.press('ArrowDown')
  check(await waitFor(async () => (await count(page)) === '3 / 4', 'arrow'), `ArrowDown advances .count to "3 / 4" (got "${await count(page)}")`)
  await page.keyboard.press('ArrowRight')
  check(await waitFor(async () => (await count(page)) === '4 / 4', 'arrow'), `ArrowRight advances .count to "4 / 4" (got "${await count(page)}")`)
  await page.keyboard.press('ArrowUp')
  await waitFor(async () => (await count(page)) === '3 / 4', 'arrow up')
  await ctx.close()

  // Drag on the art must flip and must not open the album.
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p2 = await ctx2.newPage()
  await p2.goto(url)
  await p2.locator('.scene').waitFor()
  await sleep(800)
  const before = await count(p2)
  const g = await artGeometry(p2)
  const y = g.top + (g.panelTop - g.top) / 2
  await p2.mouse.move(g.x, y)
  await p2.mouse.down()
  for (let i = 1; i <= 12; i++) await p2.mouse.move(g.x, y + i * 12)
  await p2.mouse.up()
  await sleep(900)
  const after = await count(p2)
  check(before !== after, `pointer drag on art flips (.count "${before}" -> "${after}")`)
  check(p2.url() === url, `pointer drag did not open the album (url ${p2.url()})`)
  await ctx2.close()
}

async function clickCase(browser, ids, label, opts, tap) {
  const url = `${BASE}/crates/${ids[3]}`
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  // Learn the expected album id from the title link of the front record.
  await page.goto(url)
  await page.locator('.scene').waitFor()
  await sleep(900)
  const expected = await page.locator('.now h2 a').getAttribute('href')
  const g = await artGeometry(page)
  const h = g.panelTop - g.top
  console.log(`  [${label}] art top ${g.top.toFixed(1)} panel top ${g.panelTop.toFixed(1)} visible height ${h.toFixed(1)} expect ${expected}`)
  const points = tap
    ? [['tap mid-art', 0.5]]
    : [['25%', 0.25], ['50%', 0.5], ['75%', 0.75], ['just above panel', (h - 2) / h]]
  for (const [name, f] of points) {
    await page.goto(url) // fresh visit each time
    await page.locator('.scene').waitFor()
    await sleep(900)
    const geo = await artGeometry(page)
    const py = geo.top + (geo.panelTop - geo.top) * f
    const hit = await hitAt(page, geo.x, py)
    if (tap) await page.touchscreen.tap(geo.x, py)
    else await page.mouse.click(geo.x, py)
    const ok = await waitFor(() => page.url() === `${BASE}${expected}`, 'album', 2500)
    check(ok, `${label} ${name} (y=${py.toFixed(1)}, hit ${hit}) opens ${expected} (url ${page.url()})`)
    if (ok) {
      await page.goBack()
      const back = await waitFor(() => page.url() === url, 'back')
      check(back, `${label} ${name}: Back returns to ${url} (url ${page.url()})`)
    }
  }
  if (!tap) {
    // Does the crate front panel take clicks over lower art? Just below the panel top.
    await page.goto(url)
    await page.locator('.scene').waitFor()
    await sleep(900)
    const geo = await artGeometry(page)
    const py = geo.panelTop + 10
    const hit = await hitAt(page, geo.x, py)
    await page.mouse.click(geo.x, py)
    await sleep(700)
    console.log(`  OBS ${label} click 10px below panel top (y=${py.toFixed(1)}): hit ${hit}, url ${page.url()}, count ${await count(page)}`)
  }
  await ctx.close()
}

async function partB2(browser, ids) {
  console.log('(b2) front-sleeve clicks')
  await clickCase(browser, ids, '1280', { viewport: { width: 1280, height: 900 } }, false)
  await clickCase(browser, ids, '390', { viewport: { width: 390, height: 800 } }, false)
  await clickCase(browser, ids, '390-touch', { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }, true)
}

async function partC(browser, ids) {
  console.log('(c) toolbar Crates link and /shelf')
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/crates/${ids[2]}`)
  await page.locator('.scene').waitFor()
  await page.getByRole('link', { name: 'Crates', exact: true }).click()
  const onShelf = await waitFor(() => page.url() === `${BASE}/shelf`, 'shelf url')
  check(onShelf, `toolbar Crates opens /shelf (url ${page.url()})`)
  await page.locator('.tab').first().waitFor()
  const total = (await (await fetch(`${BASE}/api/crates`)).json()).length
  const tabs = await page.locator('.tab:visible').count()
  check(tabs === total && total >= 11, `all ${total} crates are visible tabs (got ${tabs})`)
  const target = page.locator('.tab').last()
  const title = (await page.locator('.now h2').innerText()).trim()
  await target.click()
  const pressed = await waitFor(async () => (await target.getAttribute('aria-pressed')) === 'true', 'pressed')
  check(pressed, 'clicked tab has aria-pressed=true')
  const changed = await waitFor(async () => (await page.locator('.now h2').innerText()).trim() !== title, 'crate switch')
  check(changed, `crate switched: .now h2 "${title}" -> "${(await page.locator('.now h2').innerText()).trim()}"`)
  check(page.url() === `${BASE}/shelf`, `URL stays /shelf (url ${page.url()})`)
  check((await page.locator('.tab:visible').count()) === total, 'tabs still all visible')
  await ctx.close()
}

let browser = null
try {
  const ids = await setup()
  console.log(`seeded ${ids.length} crates, 80-char name length ${LONG.length}`)
  browser = await chromium.launch()
  await partA(browser, ids)
  await partB(browser, ids)
  await partB2(browser, ids)
  await partC(browser, ids)
} catch (err) {
  console.log(`  FAIL script error: ${err.stack ?? err}`)
  failures.push('script error')
} finally {
  if (browser) await browser.close()
  if (api) api.kill('SIGTERM')
  await sleep(300)
  rmSync(tmp, { recursive: true, force: true })
}
console.log(failures.length === 0 ? 'PASS AC12' : `FAIL AC12 (${failures.length}: ${failures.join(' | ')})`)
process.exit(failures.length === 0 ? 0 : 1)
