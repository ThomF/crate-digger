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

// ── Crate sleeve click fix: AC1, AC2, AC3. Real mouse and touch input, one line per sample. ──
const AC_IDS = ['AC1', 'AC2', 'AC3']
const acState = Object.fromEntries(AC_IDS.map((id) => [id, { fails: [], samples: 0, done: false }]))
const MOUSE_1280 = { viewport: { width: 1280, height: 900 } }
const MOUSE_390 = { viewport: { width: 390, height: 800 } }
const TOUCH_390 = { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }

function sample(id, ok, msg) {
  acState[id].samples++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id} ${msg}`)
  if (!ok) acState[id].fails.push(msg)
}

async function until(fn, ms = 1500) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await sleep(25)
  }
  return false
}

// .count disappears once an album has opened, so this must not wait for it.
async function countNow(page) {
  const loc = page.locator('.now .count').first()
  if ((await loc.count()) === 0) return null
  return (await loc.innerText()).trim()
}
const posOf = (c) => (c ? Number(c.split('/')[0]) : NaN)
const short = (page) => page.url().replace(BASE, '')

// Waits out the flip transition by watching the animations rather than sleeping.
const settle = (page) =>
  page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(r))
    await frame()
    await frame()
    const anims = document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity)
    await Promise.race([
      Promise.all(anims.map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 1500)),
    ])
    await frame()
  })

const rectOf = (page, sel) =>
  page.evaluate((s) => {
    const b = document.querySelector(s).getBoundingClientRect()
    return { l: b.left, t: b.top, r: b.right, b: b.bottom, cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2 }
  }, sel)

const hitInfo = (page, x, y) =>
  page.evaluate(([px, py]) => {
    const e = document.elementFromPoint(px, py)
    if (!e) return { name: 'none', inSleeve: false, inCurrent: false }
    const s = e.closest('.sleeve')
    const cur = !!s && s.classList.contains('current')
    const where = s ? (cur ? ' (in current .sleeve)' : ' (in non-current .sleeve)') : ''
    return { name: `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')}${where}`, inSleeve: !!s, inCurrent: cur }
  }, [x, y])

const xy = (x, y) => `(${x.toFixed(1)},${y.toFixed(1)})`

// Clicks across an element. Returns each point where landed() was false.
async function deadSpots(page, target, landed, reset, { xs = [0.25, 0.5, 0.75], ys = [0.25, 0.5, 0.75] } = {}) {
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

async function openCrate(page, url) {
  await page.goto(url)
  await page.locator('.scene').waitFor()
  await settle(page)
}

// A fresh visit, then real flips up to position pos of 4.
async function reach(page, url, pos, via) {
  await openCrate(page, url)
  for (let p = 2; p <= pos; p++) {
    if (via === 'ArrowDown') {
      await page.locator('.scene').focus()
      await page.keyboard.press('ArrowDown')
    } else if (via === 'Flip-tap') {
      const flip = page.locator('.controls button').last()
      await flip.scrollIntoViewIfNeeded()
      const b = await flip.boundingBox()
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    } else {
      const g = await artGeometry(page)
      const y = (g.top + g.panelTop) / 2
      await page.mouse.move(g.x, y)
      if (via === 'wheel') await page.mouse.wheel(0, 120)
      else {
        await page.mouse.down()
        for (let i = 1; i <= 4; i++) await page.mouse.move(g.x, y + i * 10)
        await page.mouse.up()
      }
    }
    if (!(await until(async () => (await countNow(page)) === `${p} / 4`))) return false
    await settle(page)
  }
  return true
}

async function press(page, key) {
  await page.locator('.scene').focus()
  await page.keyboard.press(key)
}

const AC1_POINTS = [
  ['tape label centre', (L) => [L.cx, L.cy]],
  ['tape label left end', (L) => [L.l + 3, L.cy]],
  ['tape label right end', (L) => [L.r - 3, L.cy]],
  ['just above tape label', (L) => [L.cx, L.t - 4]],
  ['midway tape label to panel bottom', (L, P) => [L.cx, (L.b + P.b) / 2]],
  ['8px inside panel left at label height', (L, P) => [P.l + 8, L.cy]],
  ['8px inside panel right at label height', (L, P) => [P.r - 8, L.cy]],
  ['3px outside panel left at label height', (L, P) => [P.l - 3, L.cy]],
  ['3px outside panel right at label height', (L, P) => [P.r + 3, L.cy]],
]

async function ac1Matrix(page, tag, url, pos, via, touch) {
  const want = `${pos} / 4`
  if (!(await reach(page, url, pos, via))) {
    sample('AC1', false, `${tag} pos=${want} via=${via} could not reach the position (count ${await countNow(page)})`)
    return
  }
  for (const [name, at] of AC1_POINTS) {
    const [x, y] = at(await rectOf(page, '.crate-label'), await rectOf(page, '.panel.front'))
    const hit = await hitInfo(page, x, y)
    if (touch) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)
    await sleep(150)
    const after = await countNow(page)
    const ok = hit.name !== 'none' && !hit.inSleeve && after === want && page.url() === url
    sample('AC1', ok, `${tag} pos=${want} via=${via} point="${name}" at=${xy(x, y)} hit=${hit.name} count=${want}->${after} url=${short(page)}`)
    if (after !== want || page.url() !== url) await reach(page, url, pos, via)
  }
}

async function ac1(browser, ids) {
  const url = `${BASE}/crates/${ids[3]}`
  for (const [tag, opts, via, touch] of [
    ['1280-mouse', MOUSE_1280, 'ArrowDown', false],
    ['390-mouse', MOUSE_390, 'ArrowDown', false],
    ['390-touch', TOUCH_390, 'Flip-tap', true],
    ['1280-mouse', MOUSE_1280, 'wheel', false],
    ['1280-mouse', MOUSE_1280, 'drag', false],
  ]) {
    const ctx = await browser.newContext(opts)
    const page = await ctx.newPage()
    for (const pos of [2, 3]) await ac1Matrix(page, tag, url, pos, via, touch)
    await ctx.close()
  }

  const ctx = await browser.newContext(MOUSE_1280)
  const page = await ctx.newPage()

  // (a) No wait: the click goes straight after the flip. The hit is read from the click itself,
  // because asking elementFromPoint first would spend time the sample is meant not to have.
  await openCrate(page, url)
  await page.evaluate(() => {
    document.addEventListener('click', (e) => {
      const s = e.target.closest?.('.sleeve')
      window.__lastClick = `${e.target.tagName.toLowerCase()}.${String(e.target.className).split(' ').join('.')}${s ? ' (in .sleeve)' : ''}`
    }, true)
  })
  const L = await rectOf(page, '.crate-label')
  for (const pos of [2, 3]) {
    const want = `${pos} / 4`
    await press(page, 'ArrowDown')
    await page.mouse.click(L.cx, L.cy)
    await sleep(150)
    const after = await countNow(page)
    const hit = await page.evaluate(() => window.__lastClick)
    const ok = after === want && page.url() === url && !String(hit).includes('.sleeve')
    sample('AC1', ok, `(a) 1280-mouse pos=${want} via=ArrowDown point="tape label centre, no wait" at=${xy(L.cx, L.cy)} hit=${hit} count=${want}->${after} url=${short(page)}`)
    if (!ok) {
      await reach(page, url, pos, 'ArrowDown')
      await page.evaluate(() => (window.__lastClick = null))
    }
    await settle(page)
  }

  // Recorded, not asserted: the same no-wait click straight after flipping BACK.
  await reach(page, url, 3, 'ArrowDown')
  await press(page, 'ArrowUp')
  await page.mouse.click(L.cx, L.cy)
  await sleep(150)
  console.log(`  OBS AC1 1280-mouse tape label click with no wait after ArrowUp from 3 / 4: count ${await countNow(page)}, url ${short(page)}`)

  // (b) Position survives a trip to the album, so flipped sleeves exist with no flip on this visit.
  await reach(page, url, 3, 'ArrowDown')
  const g = await artGeometry(page)
  const href = await page.locator('.now h2 a').getAttribute('href')
  await page.mouse.click(g.x, (g.top + g.panelTop) / 2)
  const opened = await until(() => page.url() === `${BASE}${href}`, 2500)
  await page.goBack()
  const back = await until(async () => page.url() === url && (await countNow(page)) === '3 / 4', 2500)
  sample('AC1', opened && back, `(b) 1280-mouse opened ${href} from 3 / 4 (${opened}), Back shows count=${await countNow(page)} url=${short(page)}`)
  if (back) {
    await settle(page)
    const lb = await rectOf(page, '.crate-label')
    const hit = await hitInfo(page, lb.cx, lb.cy)
    await page.mouse.click(lb.cx, lb.cy)
    await sleep(150)
    const after = await countNow(page)
    const ok = !hit.inSleeve && after === '3 / 4' && page.url() === url
    sample('AC1', ok, `(b) 1280-mouse pos=3 / 4 via=album-and-Back point="tape label centre" at=${xy(lb.cx, lb.cy)} hit=${hit.name} count=3 / 4->${after} url=${short(page)}`)
  }

  // (c) /shelf shares the component. Both the first crate and one picked with a tab.
  const shelf = `${BASE}/shelf`
  for (const pick of [null, 'Crate 3']) {
    await page.goto(shelf)
    await page.locator('.scene').waitFor()
    if (pick) await page.locator('.tab', { hasText: pick }).first().click()
    await settle(page)
    for (const pos of [2, 3]) {
      const want = `${pos} / 4`
      await press(page, 'ArrowDown')
      await until(async () => (await countNow(page)) === want)
      await settle(page)
      const lb = await rectOf(page, '.crate-label')
      const hit = await hitInfo(page, lb.cx, lb.cy)
      await page.mouse.click(lb.cx, lb.cy)
      await sleep(150)
      const after = await countNow(page)
      const ok = !hit.inSleeve && after === want && page.url() === shelf
      sample('AC1', ok, `(c) 1280-mouse /shelf crate=${pick ?? 'first'} pos=${want} via=ArrowDown point="tape label centre" at=${xy(lb.cx, lb.cy)} hit=${hit.name} count=${want}->${after} url=${short(page)}`)
      if (!ok) break
    }
  }
  await ctx.close()
}

async function ac2(browser, ids) {
  const url = `${BASE}/crates/${ids[3]}`
  for (const [tag, opts, via, touch] of [
    ['1280-mouse', MOUSE_1280, 'ArrowDown', false],
    ['390-mouse', MOUSE_390, 'ArrowDown', false],
    ['390-touch', TOUCH_390, 'Flip-tap', true],
  ]) {
    const ctx = await browser.newContext(opts)
    const page = await ctx.newPage()
    for (const pos of [2, 3]) {
      const want = `${pos} / 4`
      if (!(await reach(page, url, pos, via))) {
        sample('AC2', false, `${tag} pos=${want} via=${via} could not reach the position`)
        continue
      }
      const href = await page.locator('.now h2 a').getAttribute('href')
      const points = touch ? [['50% of art', 0.5]] : [['25% of art', 0.25], ['50% of art', 0.5], ['75% of art', 0.75], ['2px above panel top', null]]
      for (const [name, f] of points) {
        const g = await artGeometry(page)
        const y = f === null ? g.panelTop - 2 : g.top + (g.panelTop - g.top) * f
        const hit = await hitInfo(page, g.x, y)
        if (touch) await page.touchscreen.tap(g.x, y)
        else await page.mouse.click(g.x, y)
        const opened = await until(() => page.url() === `${BASE}${href}`, 2500)
        const landedAt = short(page)
        let after = null
        if (opened) {
          await page.goBack()
          await until(async () => page.url() === url && (await countNow(page)) === want, 2500)
          after = await countNow(page)
          await settle(page)
        }
        const ok = opened && after === want && page.url() === url
        sample('AC2', ok, `${tag} pos=${want} via=${via} point="${name}" at=${xy(g.x, y)} hit=${hit.name} opened=${landedAt} expected=${href} backCount=${after} backUrl=${short(page)}`)
        if (!ok) await reach(page, url, pos, via)
      }

      // Across the art, not only down its centre. ys stop short of the panel, which covers the rest.
      if (!touch && (pos === 3 || tag === '1280-mouse')) {
        const sleeve = page.locator('.sleeve.current')
        const g = await artGeometry(page)
        const box = await sleeve.boundingBox()
        const vis = (g.panelTop - box.y) / box.height
        const xs = [0.25, 0.5, 0.75]
        const ys = [0.25, 0.5, 0.75].map((f) => f * vis)
        const dead = await deadSpots(
          page,
          sleeve,
          () => until(() => page.url() === `${BASE}${href}`, 1500),
          async () => {
            if (page.url() === `${BASE}${href}`) {
              await page.goBack()
              await until(async () => page.url() === url && (await countNow(page)) === want, 2500)
              await settle(page)
            } else await reach(page, url, pos, via)
          },
          { xs, ys },
        )
        sample('AC2', dead.length === 0, `${tag} pos=${want} via=${via} point="sweep of 9 across visible art" hit=current .sleeve expected=${href} dead=${JSON.stringify(dead)}`)
      }
    }
    await ctx.close()
  }
}

async function ac3(browser, ids) {
  const url = `${BASE}/crates/${ids[3]}`
  const tag = '1280-mouse'
  const ctx = await browser.newContext(MOUSE_1280)
  const page = await ctx.newPage()
  const from = (pos) => reach(page, url, pos, 'ArrowDown')

  // (a) Scan upward from the current sleeve's top edge for a sleeve further back.
  await from(2)
  const g = await rectOf(page, '.sleeve.current')
  let edge = null
  for (let y = g.t - 1; y > g.t - 80 && !edge; y -= 1) {
    const hit = await hitInfo(page, g.cx, y)
    if (hit.inSleeve && !hit.inCurrent) edge = { y, hit }
  }
  if (!edge) sample('AC3', false, `(a) ${tag} pos=2 / 4 point="scan up from current sleeve top" found no non-current .sleeve in 80px above y=${g.t.toFixed(1)}`)
  else {
    await page.mouse.click(g.cx, edge.y)
    await sleep(150)
    const after = await countNow(page)
    sample('AC3', posOf(after) > 2 && page.url() === url, `(a) ${tag} pos=2 / 4 point="scan up from current sleeve top" at=${xy(g.cx, edge.y)} hit=${edge.hit.name} count=2 / 4->${after} url=${short(page)}`)
  }

  // (a) again, along the back sleeve's visible strip rather than one point on it.
  await from(2)
  const next = page.locator('.sleeve.current + .sleeve')
  const nb = await next.boundingBox()
  const cur = await rectOf(page, '.sleeve.current')
  const dead = await deadSpots(
    page,
    next,
    () => until(async () => (await countNow(page)) === '3 / 4' && page.url() === url, 500),
    () => from(2),
    { ys: [(cur.t - nb.y) / 2 / nb.height] },
  )
  sample('AC3', dead.length === 0, `(a) ${tag} pos=2 / 4 point="sweep of 3 along back sleeve edge" hit=non-current .sleeve dead=${JSON.stringify(dead)}`)

  // (b) The Back button, then both flip buttons across their faces.
  await from(2)
  const backBtn = page.locator('.controls button').first()
  const flipBtn = page.locator('.controls button').last()
  await backBtn.scrollIntoViewIfNeeded() // below the fold at 900px tall
  const bb = await backBtn.boundingBox()
  const bx = bb.x + bb.width / 2
  const by = bb.y + bb.height / 2
  const hitB = await hitInfo(page, bx, by)
  await page.mouse.click(bx, by)
  const atOne = await until(async () => (await countNow(page)) === '1 / 4')
  sample('AC3', atOne, `(b) ${tag} pos=2 / 4 point="Back button centre" at=${xy(bx, by)} hit=${hitB.name} count=2 / 4->${await countNow(page)}`)
  await from(2)
  const deadBack = await deadSpots(
    page,
    backBtn,
    () => until(async () => (await countNow(page)) === '1 / 4', 500),
    async () => {
      await press(page, 'ArrowDown')
      await until(async () => (await countNow(page)) === '2 / 4')
    },
  )
  sample('AC3', deadBack.length === 0, `(b) ${tag} pos=2 / 4 point="sweep of 9 across Back button" hit=button dead=${JSON.stringify(deadBack)}`)
  const deadFlip = await deadSpots(
    page,
    flipBtn,
    () => until(async () => (await countNow(page)) === '3 / 4', 500),
    async () => {
      await press(page, 'ArrowUp')
      await until(async () => (await countNow(page)) === '2 / 4')
    },
  )
  sample('AC3', deadFlip.length === 0, `(b) ${tag} pos=2 / 4 point="sweep of 9 across Flip button" hit=button dead=${JSON.stringify(deadFlip)}`)

  // (c) and (d) from 3 / 4 as well: from 2 / 4 a double step would be hidden by the clamp at 1 / 4.
  for (const pos of [2, 3]) {
    await from(pos)
    await press(page, 'ArrowUp')
    await sleep(100)
    const after = await countNow(page)
    sample('AC3', after === `${pos - 1} / 4`, `(c) ${tag} pos=${pos} / 4 point="keyboard ArrowUp" hit=.scene focus count=${pos} / 4->${after}`)
  }
  for (const pos of [2, 3]) {
    await from(pos)
    const L = await rectOf(page, '.crate-label')
    const hit = await hitInfo(page, L.cx, L.cy)
    await page.mouse.move(L.cx, L.cy)
    await page.mouse.wheel(0, -120)
    await until(async () => (await countNow(page)) !== `${pos} / 4`)
    await sleep(150)
    const after = await countNow(page)
    sample('AC3', after === `${pos - 1} / 4` && page.url() === url, `(d) ${tag} pos=${pos} / 4 point="wheel -120 on tape label" at=${xy(L.cx, L.cy)} hit=${hit.name} count=${pos} / 4->${after} url=${short(page)}`)
  }

  // (e) Drags that start on the tape label.
  for (const [pos, dy, dir] of [[2, 80, 'down'], [2, -80, 'up'], [3, -80, 'up']]) {
    await from(pos)
    const L = await rectOf(page, '.crate-label')
    const hit = await hitInfo(page, L.cx, L.cy)
    await page.mouse.move(L.cx, L.cy)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(L.cx, L.cy + (dy * i) / 8)
    await page.mouse.up()
    await sleep(200)
    const after = await countNow(page)
    const moved = dy > 0 ? posOf(after) > pos : posOf(after) < pos
    sample('AC3', moved && page.url() === url, `(e) ${tag} pos=${pos} / 4 point="drag ${Math.abs(dy)}px ${dir} from tape label" at=${xy(L.cx, L.cy)} hit=${hit.name} count=${pos} / 4->${after} url=${short(page)}`)
  }
  await ctx.close()
}

async function runAc(id, statement, fn) {
  console.log(`(${id}) ${statement}`)
  const started = Date.now()
  try {
    await fn()
    acState[id].done = true
  } catch (err) {
    sample(id, false, `script error: ${err.stack ?? err}`)
  }
  console.log(`  ${id}: ${acState[id].samples} samples in ${((Date.now() - started) / 1000).toFixed(1)}s`)
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
  await runAc('AC1', 'crate front does nothing after a flip', () => ac1(browser, ids))
  await runAc('AC2', 'visible art opens the record on show after a flip', () => ac2(browser, ids))
  await runAc('AC3', 'flip controls still work', () => ac3(browser, ids))
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
for (const id of AC_IDS) {
  const st = acState[id]
  if (st.done && st.samples > 0 && st.fails.length === 0) console.log(`PASS ${id}`)
  else console.log(`FAIL ${id} (${st.fails.length} of ${st.samples} samples failed${st.done ? '' : ', did not finish'})`)
}
const acsOk = AC_IDS.every((id) => acState[id].done && acState[id].samples > 0 && acState[id].fails.length === 0)
process.exit(failures.length === 0 && acsOk ? 0 : 1)
