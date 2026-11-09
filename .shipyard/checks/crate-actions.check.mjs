// AC11, AC12: crate page actions on /crates/:id, on a temp DB and port 4327.
// Run: node .shipyard/checks/crate-actions.check.mjs. Screenshots go to an OS temp dir.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { deadSpots, startApp, until } from './lib.mjs'

const NEEDLES = ['Edit crates', 'Add a record']
const PASSWORD = 'crate-actions-test-password'
const shots = mkdtempSync(join(tmpdir(), 'crate-actions-shots-'))
const failures = { AC11: [], AC12: [] }
const check = (ac, ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${ac}] ${msg}`)
  if (!ok) failures[ac].push(msg)
}

// Records every moment the toolbar text is in the DOM, from before the app's first script runs.
const recorder = (needles) => {
  window.__seen = []
  const scan = () => {
    const text = document.body?.textContent ?? ''
    for (const n of needles) {
      if (text.includes(n)) window.__seen.push({ n, path: location.pathname, t: Math.round(performance.now()) })
    }
  }
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true })
  const tick = () => {
    scan()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
const seenOn = (page, id) =>
  page.evaluate((p) => window.__seen.filter((s) => s.path === p), `/crates/${id}`)

const app = await startApp(4327)
const { base } = app
const browser = await chromium.launch()

async function seedUser(name, crates) {
  const signup = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${name}@example.test`, username: name, password: PASSWORD }),
  })
  if (!signup.ok) throw new Error(`signup ${signup.status}`)
  const cookie = signup.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  const send = async (path, body) => {
    const res = await fetch(`${base}/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`POST ${path} ${res.status}`)
    return res.json()
  }
  const me = await (await fetch(`${base}/api/auth/me`, { headers: { cookie } })).json()
  if (me.role !== 'user') throw new Error(`${name} is ${me.role}, expected a non-admin`)
  const ids = {}
  for (const [crateName, records] of crates) {
    const c = await send('/crates', { name: crateName })
    ids[crateName] = c.id
    for (let i = 1; i <= records; i++) await send('/albums', { crateId: c.id, title: `${crateName} ${i}`, artist: 'Artist' })
  }
  return ids
}

async function signIn(page, name) {
  await page.goto(`${base}/login`)
  await page.locator('#email').fill(`${name}@example.test`)
  await page.locator('#password').fill(PASSWORD)
  await page.locator('button[type=submit]').click()
  if (!(await until(() => !page.url().includes('/login'), 5000))) throw new Error(`sign in failed for ${name}`)
}

const toolbar = (page) => page.locator('.toolbar')
const addLink = (page) => toolbar(page).getByRole('link', { name: '+ Add a record' })
const editLink = (page) => toolbar(page).getByRole('link', { name: 'Edit crates' })
const pageHas = (page) => page.evaluate((ns) => ns.filter((n) => document.body.textContent.includes(n)), NEEDLES)

async function assertReadOnly(page, ac, where, id, name) {
  await page.locator('h1', { hasText: name }).waitFor()
  check(ac, (await pageHas(page)).length === 0, `${where}: action text absent from the page`)
  const seen = await seenOn(page, id)
  check(ac, seen.length === 0, `${where}: never in the DOM after navigation (${JSON.stringify(seen.slice(0, 2))})`)
}

async function runWidth(width, A, B) {
  console.log(`width ${width}`)
  const ctx = await browser.newContext({ viewport: { width, height: 800 } })
  await ctx.addInitScript(recorder, NEEDLES)
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await signIn(page, 'alice')

  // AC11: B's crates, on a full page load, at normal speed and with the API slowed so the
  // loading window is wide enough to show any flash.
  for (const [label, delay] of [['normal', 0], ['slow api', 500]]) {
    for (const [name, id] of [['Bob Records', B['Bob Records']], ['Bob Empty', B['Bob Empty']]]) {
      if (delay) await page.route('**/api/**', async (r) => { await new Promise((d) => setTimeout(d, delay)); await r.continue() })
      await page.goto(`${base}/crates/${id}`)
      await assertReadOnly(page, 'AC11', `${width}px ${label} ${name}`, id, name)
      if (delay) await page.unrouteAll({ behavior: 'wait' })
      const crates = toolbar(page).getByRole('link', { name: 'Crates', exact: true })
      const list = toolbar(page).getByRole('link', { name: 'List', exact: true })
      check('AC11', (await crates.isVisible()) && (await list.isVisible()), `${width}px ${label} ${name}: Crates and List visible`)
      const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth, b: document.body.scrollWidth }))
      check('AC11', m.s <= m.c && m.b <= m.c, `${width}px ${label} ${name}: no horizontal overflow (${JSON.stringify(m)})`)
    }
  }
  await page.goto(`${base}/crates/${B['Bob Records']}`)
  await page.locator('h1').waitFor()
  await page.screenshot({ path: join(shots, `other-${width}.png`) })

  // Control: the recorder and needles do see the actions on A's own crate.
  const own = A['Alice Second']
  const ownUrl = `${base}/crates/${own}`
  const openOwn = async () => {
    await page.goto(ownUrl)
    await addLink(page).waitFor()
  }
  await openOwn()
  check('AC12', (await seenOn(page, own)).length > 0, `${width}px control: recorder saw the actions on A's crate`)
  await page.screenshot({ path: join(shots, `own-${width}.png`) })

  // AC12: '+ Add a record', clicked across the button.
  const picker = page.locator('select').filter({ has: page.locator('option', { hasText: 'Alice Second' }) })
  const addLanded = () =>
    until(async () => {
      const u = new URL(page.url())
      return u.pathname === '/albums/new' && u.search === `?crateId=${own}` && (await picker.inputValue()) === String(own)
    })
  let dead = await deadSpots(page, addLink(page), addLanded, openOwn)
  check('AC12', dead.length === 0, `${width}px + Add a record lands on /albums/new?crateId=${own} with the crate picked; dead ${JSON.stringify(dead)}`)

  // AC12: 'Edit crates', clicked across the link.
  const editLanded = () =>
    until(async () => new URL(page.url()).pathname === '/crates' && (await page.getByRole('heading', { name: 'New crate' }).isVisible()))
  dead = await deadSpots(page, editLink(page), editLanded, openOwn)
  check('AC12', dead.length === 0, `${width}px Edit crates lands on /crates with New crate heading; dead ${JSON.stringify(dead)}`)

  // AC12: B's crate from B's profile page, clicked across the card.
  const bid = B['Bob Records']
  const card = page.locator('li.crate', { hasText: 'Bob Records' })
  const openProfile = async () => {
    await page.goto(`${base}/u/bob`)
    await card.waitFor()
  }
  const noActionsAfterClick = async () => {
    const at = await until(() => new URL(page.url()).pathname === `/crates/${bid}`)
    if (!at) return false
    await page.locator('h1', { hasText: 'Bob Records' }).waitFor()
    await page.waitForLoadState('networkidle')
    return (await pageHas(page)).length === 0 && (await seenOn(page, bid)).length === 0
  }
  await openProfile()
  dead = await deadSpots(page, card, noActionsAfterClick, openProfile)
  check('AC12', dead.length === 0, `${width}px profile card opens B's crate with no actions; dead ${JSON.stringify(dead)}`)

  // Observation, not a criterion: /shelf with B's crate selected.
  await page.goto(`${base}/shelf`)
  const tab = page.locator('.tab', { hasText: 'Bob Records' })
  await tab.waitFor()
  await tab.click()
  await until(async () => (await tab.getAttribute('aria-pressed')) === 'true')
  const shelf = {
    edit: await editLink(page).isVisible(),
    add: await addLink(page).isVisible(),
    addHref: await addLink(page).getAttribute('href').catch(() => null),
  }
  console.log(`OBS ${width}px /shelf with B's crate selected: ${JSON.stringify(shelf)}`)
  await page.screenshot({ path: join(shots, `shelf-${width}.png`) })

  // AC12 extra: same path with the store already loaded, from the shelf through the owner link.
  await page.locator('a[href="/u/bob"]').first().click()
  await card.waitFor()
  await card.locator('a.crate-link').click()
  check('AC12', await noActionsAfterClick(), `${width}px shelf > owner link > profile > crate, no reload: no actions`)

  check('AC11', pageErrors.length === 0, `${width}px no page errors (${pageErrors.slice(0, 2).join(' | ')})`)
  await ctx.close()
}

let crashed = null
try {
  const A = await seedUser('alice', [['Alice First', 2], ['Alice Second', 2]])
  const B = await seedUser('bob', [['Bob Records', 3], ['Bob Empty', 0]])
  for (const width of [1280, 390]) await runWidth(width, A, B)
} catch (err) {
  crashed = err
  console.log(`ERROR ${err.stack ?? err}`)
} finally {
  await browser.close()
  app.stop()
}
console.log(`screenshots ${shots}`)
for (const ac of ['AC11', 'AC12']) console.log(`${!crashed && failures[ac].length === 0 ? 'PASS' : 'FAIL'} ${ac}`)
process.exit(crashed || failures.AC11.length || failures.AC12.length ? 1 : 0)
