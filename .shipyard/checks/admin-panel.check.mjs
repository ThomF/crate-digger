// AC10, AC11: the admin panel at /admin, on a temp DB and port 4332. Also a real-admin pass, whose
// findings print as OBS lines. Run: node .shipyard/checks/admin-panel.check.mjs
// Screenshots go to an OS temp dir. Logins and signups are budgeted under the limit of 10 per IP.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { deadSpots, startApp, until } from './lib.mjs'

const PASSWORD = 'admin-panel-test-password'
const shots = mkdtempSync(join(tmpdir(), 'admin-panel-shots-'))
const failures = { AC10: [], AC11: [] }
const check = (ac, step, ok, msg = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${ac}.${step} ${msg}`)
  if (!ok) failures[ac].push(step)
  return ok
}
const obs = (msg) => console.log(`OBS ${msg}`)

// A failure in one stage must not hide the ones after it.
async function stage(ac, name, fn) {
  try {
    await fn()
  } catch (err) {
    check(ac, `${name}.crashed`, false, String(err.message ?? err).split('\n').slice(0, 3).join(' ') + ' @' + (err.stack?.match(/check\.mjs:\d+/)?.[0] ?? ''))
  }
}

const app = await startApp(4332)
const { base } = app
const browser = await chromium.launch()

const section = (page, name) =>
  page.locator('section.admin-section').filter({ has: page.getByRole('heading', { name, exact: true, level: 2 }) })
const homeSection = (page, name) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true, level: 2 }) })
const adminPanel = (page) => page.locator('.admin-panel')
const accountButton = (page) => page.getByRole('button', { name: /^Account menu for/ })
const adminItem = (page) => page.getByRole('menuitem', { name: 'Admin', exact: true })
const userRow = (page, email) => section(page, 'Users').locator('li.admin-card').filter({ hasText: email })
const newsForm = (page) => page.locator('form[aria-label="New news item"]')
const crateForm = (page) => page.locator('form[aria-label="New crate"]')
const importForm = (page) => page.locator('form[aria-label="Bulk import"]')
const crateRow = (page, sec, name) => section(page, sec).locator('li.admin-card').filter({ hasText: name })

const markPage = (page) => page.evaluate(() => { window.__notReloaded = true })
const notReloaded = (page) => page.evaluate(() => window.__notReloaded === true)
const seen = (page, loc) => until(() => loc.isVisible())
const gone = (page, loc) => until(async () => (await loc.count()) === 0)
// A route change runs a view transition of about half a second, and until it ends every click on
// the page lands on <html>. A raw mouse or touch click has to wait, as a person's eye would.
const settled = (page) => until(() => page.evaluate(() => !document.activeViewTransition))

async function type(loc, text) {
  await loc.click()
  await loc.pressSequentially(text)
}
async function tapOn(page, loc, fx = 0.5, fy = 0.5) {
  await loc.scrollIntoViewIfNeeded()
  const b = await loc.boundingBox()
  await page.touchscreen.tap(b.x + b.width * fx, b.y + b.height * fy)
}
async function deadTaps(page, target, landed, reset, { xs = [0.25, 0.5, 0.75], ys = [0.25, 0.5, 0.75] } = {}) {
  const dead = []
  for (const fx of xs) for (const fy of ys) {
    await tapOn(page, target, fx, fy)
    if (!(await landed())) dead.push([fx, fy])
    await reset()
  }
  return dead
}
async function typeTouch(page, loc, text) {
  await tapOn(page, loc)
  await page.keyboard.type(text)
}

async function signup(name, extra = {}) {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${name}@example.test`, username: name, password: PASSWORD, ...extra }),
  })
  if (!res.ok) throw new Error(`signup ${name} ${res.status} ${await res.text()}`)
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}
const adminApi = (page, path, method = 'GET', body) =>
  page.evaluate(
    async ([path, method, body]) => {
      const res = await fetch(`/api${path}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: res.status, json: await res.json().catch(() => null) }
    },
    [path, method, body],
  )
const snapshot = async (page) => {
  const out = {}
  for (const p of ['overview', 'crates', 'news', 'users']) out[p] = (await adminApi(page, `/admin/${p}`)).json
  return JSON.stringify(out)
}
const overflow = (page) =>
  page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    client: document.documentElement.clientWidth,
    inner: window.innerWidth,
  }))
async function noOverflow(ac, page, width, label) {
  const m = await overflow(page)
  check(ac, `overflow.${width}.${label}`, m.doc <= width && m.body <= width && m.inner <= width, JSON.stringify(m))
}

// Everything seen in the DOM while on /admin, from before the app's first script.
const panelRecorder = () => {
  window.__panel = []
  const scan = () => {
    if (location.pathname === '/admin' && document.querySelector('.admin-panel')) window.__panel.push(performance.now())
    if (document.querySelector('.admin-panel')) window.__panelAnywhere = true
  }
  new MutationObserver(scan).observe(document, { subtree: true, childList: true })
}

let anon, anonPage, adminCtx, page
const pageErrors = []

async function signInAdmin(p, viaTouch) {
  await p.goto(`${base}/login`)
  if (viaTouch) {
    await typeTouch(p, p.getByLabel('Email'), 'admin@frisson.com')
    await typeTouch(p, p.getByLabel('Password'), 'admin')
    await tapOn(p, p.getByRole('button', { name: 'Log in' }))
  } else {
    await type(p.getByLabel('Email'), 'admin@frisson.com')
    await type(p.getByLabel('Password'), 'admin')
    await p.getByRole('button', { name: 'Log in' }).click()
  }
  const left = await until(() => !p.url().includes('/login'), 5000)
  await settled(p)
  return left
}

try {
  await signup('ruth')
  const ruthCookie = await signup('longuser', {
    email: `${'e'.repeat(60)}@example.test`,
    username: 'u'.repeat(32),
    displayName: 'D'.repeat(60),
  })
  void ruthCookie

  anon = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  anonPage = await anon.newPage()
  anonPage.on('pageerror', (e) => pageErrors.push(`anon: ${e.message}`))

  // ── AC10, 1280px, real mouse and keyboard ──
  adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await adminCtx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  page = await adminCtx.newPage()
  page.on('pageerror', (e) => pageErrors.push(`admin: ${e.message}`))

  const newsTitle = 'Wax fair returns to Leeds'
  const newsSummary = 'The fair is back for spring with sixty dealers.'
  const newsSource = 'The Wax Gazette'
  const crateName = 'Panel Suggested Picks'

  await stage('AC10', 'login', async () => {
    check('AC10', 'login.typed', await signInAdmin(page, false), page.url())
    const menuOpens = await deadSpots(
      page,
      accountButton(page),
      () => seen(page, adminItem(page)),
      async () => {
        await page.keyboard.press('Escape')
        await gone(page, adminItem(page))
      },
    )
    check('AC10', 'menu.opens-across-button', menuOpens.length === 0, JSON.stringify(menuOpens))
    const openMenu = async () => {
      await page.goto(`${base}/`)
      await accountButton(page).click()
      await adminItem(page).waitFor()
    }
    await openMenu()
    const dead = await deadSpots(
      page,
      adminItem(page),
      () => until(async () => new URL(page.url()).pathname === '/admin' && (await adminPanel(page).isVisible())),
      openMenu,
    )
    check('AC10', 'menu.admin-lands-on-admin', dead.length === 0, JSON.stringify(dead))
    await adminItem(page).click() // the last reset left the menu open
    await adminPanel(page).waitFor()
    await page.screenshot({ path: join(shots, 'admin-1280.png'), fullPage: true })
  })

  await stage('AC10', 'panel-create', async () => {
    await markPage(page)
    const f = newsForm(page)
    await type(f.getByLabel('Title'), newsTitle)
    await type(f.getByLabel('Summary'), newsSummary)
    await type(f.getByLabel('Source'), newsSource)
    await f.getByRole('button', { name: 'Create news item' }).click()
    const row = section(page, 'News').locator('.admin-list li').filter({ hasText: newsTitle })
    check('AC10', 'news.appears-in-panel', await seen(page, row))
    check('AC10', 'news.form-cleared', (await f.getByLabel('Title').inputValue()) === '')

    const c = crateForm(page)
    await type(c.getByLabel('Name'), crateName)
    await c.getByRole('checkbox', { name: 'Suggested' }).click()
    check('AC10', 'crate.suggested-ticked', await c.getByRole('checkbox', { name: 'Suggested' }).isChecked())
    await c.getByRole('button', { name: 'Create crate' }).click()
    const r = crateRow(page, 'Suggested crates', crateName)
    check('AC10', 'crate.appears-in-suggested', await seen(page, r))
    check('AC10', 'crate.shows-owner', (await r.textContent()).includes('@admin'))
    check('AC10', 'crate.not-in-user-created', (await crateRow(page, 'User created crates', crateName).count()) === 0)
    check('AC10', 'panel.no-reload', await notReloaded(page))
    await page.screenshot({ path: join(shots, 'admin-after-create-1280.png'), fullPage: true })
  })

  await stage('AC10', 'signed-out', async () => {
    await anonPage.goto(`${base}/`)
    const news = homeSection(anonPage, 'Music news')
    const rec = homeSection(anonPage, 'Recommended crates')
    check('AC10', 'home.news-under-music-news', await seen(anonPage, news.getByRole('heading', { name: newsTitle })))
    const article = news.locator('article').filter({ hasText: newsTitle })
    const articleText = await article.textContent()
    check('AC10', 'home.news-summary-source', articleText.includes(newsSummary) && articleText.includes(newsSource))
    if (await article.locator('.demo-tag').count()) obs(`Home tags admin-created news as demo: "${articleText.trim().slice(-40)}"`)
    check('AC10', 'home.crate-under-recommended', await seen(anonPage, rec.locator('.crate-card').filter({ hasText: crateName })))
    await anonPage.screenshot({ path: join(shots, 'home-signed-out.png'), fullPage: true })
    await anonPage.goto(`${base}/list`)
    const onList = await until(async () => (await anonPage.locator('main').textContent()).includes(crateName), 4000)
    check('AC10', 'list.shows-crate', onList)
    await anonPage.screenshot({ path: join(shots, 'list-signed-out.png'), fullPage: true })
    const after = await until(async () => (await anonPage.locator('main').textContent()).length > 0)
    if (after && !onList) obs(`/list text: ${(await anonPage.locator('main').innerText()).slice(0, 200).replace(/\s+/g, ' ')}`)
    // Also reachable as a visitor would, from Home's link.
    await anonPage.goto(`${base}/`)
    await anonPage.getByRole('link', { name: 'Browse all crates' }).click()
    await until(() => new URL(anonPage.url()).pathname === '/list')
    check(
      'AC10',
      'list.shows-crate-from-home-link',
      await until(async () => (await anonPage.locator('main').textContent()).includes(crateName), 4000),
    )
  })

  await stage('AC10', 'role-user', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await ctx.addInitScript(panelRecorder)
    const p = await ctx.newPage()
    await p.goto(`${base}/login`)
    await type(p.getByLabel('Email'), 'ruth@example.test')
    await type(p.getByLabel('Password'), PASSWORD)
    await p.getByRole('button', { name: 'Log in' }).click()
    await until(() => !p.url().includes('/login'), 5000)
    for (const [label, delay] of [['normal', 0], ['slow-api', 600]]) {
      if (delay) await p.route('**/api/**', async (r) => { await new Promise((d) => setTimeout(d, delay)); await r.continue() })
      await p.goto(`${base}/admin`)
      const home = await until(() => new URL(p.url()).pathname === '/' && homeSection(p, 'Music news').isVisible(), 6000)
      check('AC10', `user.${label}.ends-on-home`, home, p.url())
      const text = await p.locator('body').textContent()
      check('AC10', `user.${label}.no-panel-content`, (await adminPanel(p).count()) === 0 && !text.includes('Bulk import') && !text.includes('admin@frisson.com'))
      const flashed = await p.evaluate(() => window.__panelAnywhere === true)
      check('AC10', `user.${label}.panel-never-in-dom`, !flashed)
      if (delay) await p.unrouteAll({ behavior: 'wait' })
    }
    await accountButton(p).click()
    check('AC10', 'user.no-admin-menu-link', (await adminItem(p).count()) === 0)
    check('AC10', 'user.api-refuses', (await adminApi(p, '/admin/users')).status === 403)
    await ctx.close()

    const out = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const op = await out.newPage()
    await op.goto(`${base}/admin`)
    const toLogin = await until(() => new URL(op.url()).pathname === '/login')
    if (!toLogin || new URL(op.url()).searchParams.get('next') !== '/admin') obs(`signed-out /admin went to ${op.url()}`)
    await out.close()
  })

  // ── A real admin's path: outside the criteria, so these are observations ──
  try {
    const name = 'Add Records Crate'
    await page.goto(`${base}/admin`)
    await adminPanel(page).waitFor()
    const c = crateForm(page)
    await type(c.getByLabel('Name'), name)
    await c.getByRole('button', { name: 'Create crate' }).click()
    const row = crateRow(page, 'User created crates', name)
    await row.waitFor({ timeout: 4000 })
    await row.getByRole('link', { name: 'Add records', exact: true }).click()
    await until(() => new URL(page.url()).pathname === '/albums/new')
    await page.locator('#title').waitFor()
    const picked = await page.locator('select#crate option:checked').textContent()
    if (!new URL(page.url()).search.startsWith('?crateId=') || picked.trim() !== name) obs(`Add records did not pick the crate: ${page.url()} picked "${picked}"`)
    await type(page.locator('#title'), 'Harbor Lights')
    await type(page.locator('#artist'), 'The Tide')
    await page.getByRole('button', { name: 'Add to collection' }).click()
    const saved = await until(() => /^\/albums\/\d+/.test(new URL(page.url()).pathname), 5000)
    if (!saved) obs(`Add records did not save: ${page.url()} ${(await page.locator('main').innerText()).slice(0, 200)}`)
    await accountButton(page).click()
    await adminItem(page).click()
    await adminPanel(page).waitFor()
    const again = crateRow(page, 'User created crates', name)
    await again.waitFor({ timeout: 4000 })
    if (!(await again.textContent()).includes('1 record')) obs(`panel crate row after add: ${await again.textContent()}`)
    await again.getByRole('button', { name: `Suggest: ${name}` }).click()
    const moved = await seen(page, crateRow(page, 'Suggested crates', name))
    if (!moved) obs('Suggest did not move the row to Suggested crates')
    await anonPage.goto(`${base}/`)
    const card = homeSection(anonPage, 'Recommended crates').locator('.crate-card').filter({ hasText: name })
    if (!(await seen(anonPage, card))) obs('Suggest toggle did not reach Home')
    else if (!(await card.textContent()).includes('1 record')) obs(`Home card lacks record count: ${await card.textContent()}`)
    await crateRow(page, 'Suggested crates', name).getByRole('button', { name: `Stop suggesting: ${name}` }).click()
    await crateRow(page, 'User created crates', name).waitFor({ timeout: 4000 })
    await anonPage.goto(`${base}/`)
    await homeSection(anonPage, 'Recommended crates').locator('.crate-card').first().waitFor()
    if (await card.count()) obs('Stop suggesting did not remove the crate from Home')
    console.log('INFO real-admin path: add record and suggested toggle completed')

    // Double activation of Create: must not make two.
    const dbl = 'Double Click Crate'
    await type(c.getByLabel('Name'), dbl)
    await c.getByRole('button', { name: 'Create crate' }).dblclick()
    await crateRow(page, 'User created crates', dbl).first().waitFor({ timeout: 4000 })
    await page.waitForLoadState('networkidle')
    const dupes = (await adminApi(page, '/admin/crates')).json.filter((x) => x.name === dbl).length
    if (dupes !== 1) obs(`double-click on Create crate made ${dupes} crates`)
  } catch (err) {
    obs(`real-admin path stopped: ${String(err.message).split('\n')[0]}`)
  }

  // ── AC11, 1280px: verify ──
  const profileBadge = (p) => p.locator('h1 [role=img][aria-label="Verified"]')
  await stage('AC11', 'verify-1280', async () => {
    await page.goto(`${base}/admin`)
    await adminPanel(page).waitFor()
    const row = userRow(page, 'ruth@example.test')
    await row.waitFor()
    const statusIs = (want) => until(async () => (await row.locator('dd').nth(4).textContent()).trim() === want)
    await markPage(page)
    await row.getByRole('button', { name: 'Verify: ruth' }).click()
    check('AC11', 'verify.row-shows-verified', await statusIs('Verified'))
    check('AC11', 'verify.row-badge', await seen(page, row.locator('[role=img][aria-label="Verified"]')))
    check('AC11', 'verify.no-reload', await notReloaded(page))
    await anonPage.goto(`${base}/u/ruth`)
    check('AC11', 'verify.public-badge', await seen(anonPage, profileBadge(anonPage)))
    await row.getByRole('button', { name: 'Unverify: ruth' }).click()
    check('AC11', 'unverify.row', await statusIs('Not verified'))
    await anonPage.reload()
    await anonPage.locator('h1').waitFor()
    await anonPage.waitForLoadState('networkidle')
    check('AC11', 'unverify.public-badge-gone-after-reload', (await profileBadge(anonPage).count()) === 0)
    await page.reload()
    await row.waitFor()
    check('AC11', 'unverify.row-after-reload', await statusIs('Not verified'))
    check('AC11', 'unverify.row-badge-gone-after-reload', (await row.locator('[role=img][aria-label="Verified"]').count()) === 0)

    const btn = row.locator('.admin-actions button')
    const dead = await deadSpots(page, btn, () => statusIs('Verified'), async () => {
      if ((await btn.textContent()).trim() === 'Unverify') await btn.click()
      await statusIs('Not verified')
    })
    check('AC11', 'verify.mouse-across-button-1280', dead.length === 0, JSON.stringify(dead))
  })

  // ── AC11: bulk import ──
  const bulk = {
    crates: [
      {
        name: 'Bulk Dub Crate',
        albums: [
          { title: 'Bulk First Record', artist: 'The Tide', year: 1979 },
          { title: 'Bulk Second Record', artist: 'Low Water' },
        ],
      },
    ],
    news: [{ title: 'Bulk imported headline', summary: 'From the bulk form.', source: 'The Wax Gazette' }],
  }
  async function paste(p, loc, text) {
    await p.evaluate((t) => navigator.clipboard.writeText(t), text)
    await loc.click()
    await p.keyboard.press('ControlOrMeta+A')
    await p.keyboard.press('ControlOrMeta+V')
    if ((await loc.inputValue()) !== text) throw new Error('paste did not reach the textarea')
  }
  await stage('AC11', 'bulk', async () => {
    await page.goto(`${base}/admin`)
    await adminPanel(page).waitFor()
    await page.getByRole('link', { name: 'Home', exact: true }).click() // leaves and comes back without a load
    await page.getByRole('link', { name: 'Browse all crates' }).click()
    await until(() => new URL(page.url()).pathname === '/list')
    await accountButton(page).click()
    await adminItem(page).click()
    await adminPanel(page).waitFor()
    await markPage(page)

    const before = JSON.parse(await snapshot(page))
    const f = importForm(page)
    const area = f.getByLabel('JSON to import')
    await paste(page, area, JSON.stringify(bulk, null, 2))
    await f.getByRole('button', { name: 'Import' }).click()
    const status = f.getByRole('status')
    check('AC11', 'bulk.success-count', await seen(page, status))
    const said = (await status.textContent()).trim()
    check('AC11', 'bulk.count-text', /1 crate/.test(said) && /2 albums/.test(said) && /1 news item/.test(said), said)
    const after = JSON.parse(await snapshot(page))
    check('AC11', 'bulk.server-counts', after.overview.crates === before.overview.crates + 1 && after.overview.albums === before.overview.albums + 2 && after.overview.news === before.overview.news + 1)
    const row = crateRow(page, 'User created crates', 'Bulk Dub Crate')
    check('AC11', 'bulk.crate-in-panel-no-reload', (await seen(page, row)) && (await notReloaded(page)))
    check('AC11', 'bulk.news-in-panel-no-reload', await seen(page, section(page, 'News').locator('.admin-list li').filter({ hasText: 'Bulk imported headline' })))
    const link = row.getByRole('link', { name: 'Bulk Dub Crate' })
    const id = (await link.getAttribute('href')).match(/\/crates\/(\d+)/)?.[1]

    await link.click()
    const showsBoth = (p) =>
      until(async () => {
        const t = await p.locator('main').textContent()
        return new URL(p.url()).pathname === `/crates/${id}` && t.includes('Bulk First Record') && t.includes('Bulk Second Record')
      }, 4000)
    check('AC11', 'bulk.crate-opens-from-panel-with-both', await showsBoth(page), page.url())
    await anonPage.goto(`${base}/crates/${id}`)
    check('AC11', 'bulk.crate-opens-signed-out-with-both', await showsBoth(anonPage), anonPage.url())
    await page.screenshot({ path: join(shots, 'bulk-crate.png') })
    const reopen = async () => {
      await page.goto(`${base}/admin`)
      await link.waitFor()
    }
    await reopen()
    const dead = await deadSpots(page, link, () => showsBoth(page), reopen, { ys: [0.5] })
    check('AC11', 'bulk.crate-link-across', dead.length === 0, JSON.stringify(dead))

    await anonPage.goto(`${base}/`)
    check('AC11', 'bulk.news-on-home', await seen(anonPage, homeSection(anonPage, 'Music news').getByRole('heading', { name: 'Bulk imported headline' })))
  })

  await stage('AC11', 'bad-json', async () => {
    await page.goto(`${base}/admin`)
    await adminPanel(page).waitFor()
    const f = importForm(page)
    const area = f.getByLabel('JSON to import')
    const err = f.locator('.admin-error[role=alert]')
    const button = f.getByRole('button', { name: 'Import' })
    let posted = 0
    page.on('request', (r) => { if (r.url().includes('/api/admin/import')) posted++ })
    const cases = [
      ['truncated', '{ "crates": [ { "name": "Never Added"', /not valid JSON/i, true],
      ['not-json', 'crates: nope', /not valid JSON/i, true],
      ['empty', '', /not valid JSON/i, true],
      ['array', '[]', /must be an object/i, true],
      ['one-bad-crate', JSON.stringify({ crates: [{ name: 'Never Added' }, { name: '' }], news: [{ title: 'Never Added News', summary: 's', source: 's' }] }), /./, false],
      ['nothing', '{}', /./, false],
    ]
    for (const [label, text, want, clientOnly] of cases) {
      const before = await snapshot(page)
      posted = 0
      if (text) await paste(page, area, text)
      else await area.fill('')
      await button.click()
      check('AC11', `invalid.${label}.inline-error`, await seen(page, err), (await err.textContent().catch(() => '')).trim().slice(0, 90))
      check('AC11', `invalid.${label}.message`, want.test(await err.textContent()))
      check('AC11', `invalid.${label}.no-success`, (await f.getByRole('status').count()) === 0)
      check('AC11', `invalid.${label}.text-kept`, (await area.inputValue()) === text)
      if (clientOnly) check('AC11', `invalid.${label}.not-sent`, posted === 0)
      await page.waitForLoadState('networkidle')
      check('AC11', `invalid.${label}.adds-nothing`, (await snapshot(page)) === before)
      if (label === 'truncated') await noOverflow('AC11', page, 1280, 'error-shown')
    }
    await page.screenshot({ path: join(shots, 'bulk-error-1280.png'), fullPage: true })
    await area.fill('')
  })

  // ── Long text a real panel can hold, then overflow and every create control ──
  await stage('AC11', 'width-1280', async () => {
    const res = await adminApi(page, '/admin/import', 'POST', {
      crates: [{ name: 'W'.repeat(60), suggested: true, albums: [{ title: 'T'.repeat(200), artist: 'A'.repeat(200) }] }, { name: 'V'.repeat(60) }],
      news: [{ title: 'N'.repeat(200), summary: 'S'.repeat(2000), source: 'X'.repeat(100) }],
    })
    if (res.status >= 300) obs(`long-text import ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`)
    await page.goto(`${base}/admin`)
    await adminPanel(page).waitFor()
    await page.waitForLoadState('networkidle')
    await noOverflow('AC11', page, 1280, 'long-text')
    await page.locator('details.admin-example summary').click()
    await noOverflow('AC11', page, 1280, 'example-open')
    await page.locator('details.admin-example summary').click()

    let n = 0
    const f = newsForm(page)
    const fillNews = async () => {
      n++
      await f.getByLabel('Title').fill(`Mouse news ${n}`)
      await f.getByLabel('Summary').fill('Summary')
      await f.getByLabel('Source').fill('Source')
    }
    const newsRow = () => section(page, 'News').locator('.admin-list li').filter({ hasText: new RegExp(`Mouse news ${n}(?!\\d)`) })
    await fillNews()
    let dead = await deadSpots(page, f.getByRole('button', { name: 'Create news item' }), () => seen(page, newsRow()), fillNews)
    check('AC11', 'create-news.mouse-across-button-1280', dead.length === 0, JSON.stringify(dead))
    await f.getByLabel('Title').fill('')
    await f.getByLabel('Summary').fill('')
    await f.getByLabel('Source').fill('')

    let m = 0
    const c = crateForm(page)
    const fillCrate = async () => { m++; await c.getByLabel('Name').fill(`Mouse crate ${m}`) }
    const row = () => crateRow(page, 'User created crates', new RegExp(`Mouse crate ${m}(?!\\d)`))
    await fillCrate()
    dead = await deadSpots(page, c.getByRole('button', { name: 'Create crate' }), () => seen(page, row()), fillCrate)
    check('AC11', 'create-crate.mouse-across-button-1280', dead.length === 0, JSON.stringify(dead))
    await c.getByLabel('Name').fill('')

    const label = c.locator('label.admin-check')
    const box = c.getByRole('checkbox', { name: 'Suggested' })
    let want = false
    dead = await deadSpots(page, label, async () => { want = !want; return (await box.isChecked()) === want }, async () => {}, { xs: [0.01, 0.05, 0.1], ys: [0.5] })
    check('AC11', 'suggested-label.mouse-1280', dead.length === 0, JSON.stringify(dead))
    if (await box.isChecked()) await box.click()
    await page.screenshot({ path: join(shots, 'admin-long-1280.png'), fullPage: true })
  })

  // ── AC11, 390px, real touch ──
  await stage('AC11', 'width-390', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => pageErrors.push(`touch: ${e.message}`))
    if (!(await signInAdmin(p, true))) throw new Error('touch sign in failed')
    const deadMenu = await deadTaps(p, accountButton(p), () => seen(p, adminItem(p)), async () => {
      if (await adminItem(p).count()) await tapOn(p, accountButton(p))
      await gone(p, adminItem(p))
    })
    check('AC11', 'touch.menu-opens-across-button', deadMenu.length === 0, JSON.stringify(deadMenu))
    await tapOn(p, accountButton(p))
    await adminItem(p).waitFor()
    await tapOn(p, adminItem(p))
    await adminPanel(p).waitFor()
    await p.waitForLoadState('networkidle')
    await settled(p)
    check('AC11', 'touch.menu-reaches-admin', new URL(p.url()).pathname === '/admin')
    await noOverflow('AC11', p, 390, 'long-text')
    await p.screenshot({ path: join(shots, 'admin-390.png'), fullPage: true })

    const row = userRow(p, 'ruth@example.test')
    const statusIs = (want) => until(async () => (await row.locator('dd').nth(4).textContent()).trim() === want)
    const btn = row.locator('.admin-actions button')
    let dead = await deadTaps(p, btn, () => statusIs('Verified'), async () => {
      // Only if the tap landed: a missed tap must not flip every later point.
      if ((await btn.textContent()).trim() === 'Unverify') await tapOn(p, btn)
      await statusIs('Not verified')
    })
    check('AC11', 'verify.touch-across-button-390', dead.length === 0, JSON.stringify(dead))
    await tapOn(p, btn)
    check('AC11', 'verify.touch-row-shows-verified', await statusIs('Verified'))
    await noOverflow('AC11', p, 390, 'verified-row')
    await anonPage.goto(`${base}/u/ruth`)
    check('AC11', 'verify.touch-public-badge', await seen(anonPage, profileBadge(anonPage)))
    await tapOn(p, btn)
    await statusIs('Not verified')
    await anonPage.reload()
    await anonPage.locator('h1').waitFor()
    await anonPage.waitForLoadState('networkidle')
    check('AC11', 'unverify.touch-public-badge-gone', (await profileBadge(anonPage).count()) === 0)

    let n = 0
    const f = newsForm(p)
    const fillNews = async () => {
      n++
      await f.getByLabel('Title').fill(`Touch news ${n}`)
      await f.getByLabel('Summary').fill('Summary')
      await f.getByLabel('Source').fill('Source')
    }
    const newsRow = () => section(p, 'News').locator('.admin-list li').filter({ hasText: new RegExp(`Touch news ${n}(?!\\d)`) })
    await fillNews()
    dead = await deadTaps(p, f.getByRole('button', { name: 'Create news item' }), () => seen(p, newsRow()), fillNews)
    check('AC11', 'create-news.touch-across-button-390', dead.length === 0, JSON.stringify(dead))
    await f.getByLabel('Title').fill('')
    await f.getByLabel('Summary').fill('')
    await f.getByLabel('Source').fill('')

    let m = 0
    const c = crateForm(p)
    const fillCrate = async () => { m++; await c.getByLabel('Name').fill(`Touch crate ${m}`) }
    const crow = () => crateRow(p, 'User created crates', new RegExp(`Touch crate ${m}(?!\\d)`))
    await fillCrate()
    dead = await deadTaps(p, c.getByRole('button', { name: 'Create crate' }), () => seen(p, crow()), fillCrate)
    check('AC11', 'create-crate.touch-across-button-390', dead.length === 0, JSON.stringify(dead))
    await c.getByLabel('Name').fill('')

    const box = c.getByRole('checkbox', { name: 'Suggested' })
    await tapOn(p, box)
    check('AC11', 'suggested.touch-checkbox', await box.isChecked())
    await c.getByLabel('Name').fill('Touch suggested crate')
    await tapOn(p, c.getByRole('button', { name: 'Create crate' }))
    check('AC11', 'suggested.touch-creates-suggested', await seen(p, crateRow(p, 'Suggested crates', 'Touch suggested crate')))
    await noOverflow('AC11', p, 390, 'after-creates')

    const imp = importForm(p)
    const area = imp.getByLabel('JSON to import')
    await area.fill('{ "crates": [ { "name": "' + 'x'.repeat(400))
    await tapOn(p, imp.getByRole('button', { name: 'Import' }))
    await imp.locator('.admin-error').waitFor({ timeout: 3000 })
    await noOverflow('AC11', p, 390, 'error-shown')
    await area.fill(JSON.stringify({ news: [{ title: 'Touch bulk news', summary: 's', source: 's' }] }))
    await tapOn(p, imp.getByRole('button', { name: 'Import' }))
    check('AC11', 'import.touch-success', await seen(p, imp.getByRole('status')))
    await tapOn(p, p.locator('details.admin-example summary'))
    check('AC11', 'example.touch-opens', await seen(p, p.locator('details.admin-example pre')))
    await noOverflow('AC11', p, 390, 'example-open')
    const wide = await p.evaluate(() =>
      [...document.querySelectorAll('.admin-panel *')]
        .filter((e) => e.getBoundingClientRect().right > 390.5 && !e.closest('.admin-example pre'))
        .slice(0, 5)
        .map((e) => `${e.tagName}.${e.className}`),
    )
    if (wide.length) obs(`elements past the 390px edge: ${wide.join(', ')}`)
    await p.screenshot({ path: join(shots, 'admin-390-end.png'), fullPage: true })
    await ctx.close()
  })

  check('AC11', 'no-page-errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
} catch (err) {
  console.log(`ERROR ${err.stack ?? err}`)
  for (const ac of Object.keys(failures)) failures[ac].push('crashed')
} finally {
  await browser.close()
  app.stop()
}
console.log(`screenshots ${shots}`)
for (const [ac, f] of Object.entries(failures)) console.log(`${f.length === 0 ? 'PASS' : 'FAIL'} ${ac} ${f.join(', ')}`)
process.exit(Object.values(failures).some((f) => f.length) ? 1 : 0)
