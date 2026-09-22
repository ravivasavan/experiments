import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const origin = process.env.DRIFT_ORIGIN || 'http://127.0.0.1:8510'
const url = `${origin}/20260922/drift/`
const browser = await chromium.launch({ headless: true })
const issues = []
let checks = 0
function check(condition, message) { assert.ok(condition, message); checks++; console.log(`✓ ${message}`) }
async function open(width = 1440, theme = 'day', options = {}) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, ...options })
  const page = await context.newPage()
  page.on('pageerror', (e) => issues.push(e.message))
  page.on('console', (e) => { if (e.type() === 'error') issues.push(`${e.text()} (${e.location().url})`) })
  await page.addInitScript((theme) => { localStorage.setItem('theme', theme); localStorage.setItem('play.panel', 'open') }, theme)
  return { context, page }
}
async function ready(page) {
  await page.goto(url)
  await page.waitForSelector('.drift-tile')
  await page.waitForSelector('.dialkit-slider')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(100)
}
async function seed(page) { return page.evaluate(() => window.drift.state.seed) }
async function scroll(page) { return page.locator('#field').evaluate((e) => e.scrollTop) }

try {
  for (const width of [1440, 390]) for (const theme of ['day', 'night']) {
    const { context, page } = await open(width, theme)
    await ready(page)
    check(await page.evaluate(() => document.body.scrollWidth === innerWidth), `${width} ${theme}: viewport width`)
    const panel = await page.locator('.dialkit-panel-inner').boundingBox()
    check(panel.x >= 0 && panel.x + panel.width <= width + 1, `${width} ${theme}: native panel within viewport`)
    check(await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.drift-tile')].map(e => ({ y: parseFloat(e.style.top), h: parseFloat(e.style.height) }));
      return cards.flatMap(p => [p.y, p.y - innerHeight + 1]).every(top => cards.filter(q => q.y < top + innerHeight && q.y + q.h > top + 0.1).length <= 3);
    }), `${width} ${theme}: no more than three framed works in any viewport`)
    check(await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.drift-tile:not([aria-hidden])')].map(e => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height), paired: e.dataset.paired === 'true' }));
      return cards.every((p, i) => p.x >= 0 && p.x + p.w <= innerWidth && cards.slice(i + 1).every((q, j) => (j === 0 && q.paired) || p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y));
    }), `${width} ${theme}: frames stay in bounds with only deliberate pair overlaps`)
    check(await page.locator('.drift-tile:not([aria-hidden]) .drift-card-heading').count() === 15, `${width} ${theme}: every work has its own title and type`)
    check(await page.locator('.dialkit-slider').count() === 5, `${width} ${theme}: five native parameters`)
    const speed = page.locator('.dialkit-slider').filter({ hasText: 'Speed' })
    const box = await speed.boundingBox()
    await page.mouse.move(box.x + 80, box.y + 20); await page.mouse.down()
    await page.mouse.move(box.x + 170, box.y + 20, { steps: 5 }); await page.mouse.up()
    await page.waitForFunction(() => window.drift.state.speed !== 30)
    check(true, `${width} ${theme}: panel drives engine`)
    await page.locator('.dialkit-panel-header .dialkit-folder-header-top').click()
    await page.waitForFunction(() => localStorage.getItem('play.panel') === 'min')
    check(await page.locator('.dialkit-panel-inner').getAttribute('data-collapsed') === 'true', `${width} ${theme}: native bubble`)
    await page.locator('#shuffle').click()
    const changed = await seed(page)
    await page.locator('.dialkit-panel-inner').click()
    await page.waitForFunction((s) => [...document.querySelectorAll('.dialkit-slider')].some((e) => e.textContent.includes('Seed') && e.textContent.includes(String(s))), changed)
    check(true, `${width} ${theme}: engine drives panel`)
    await context.close()
  }

  const { context, page } = await open()
  await ready(page)
  await page.locator('.dialkit-panel-header .dialkit-folder-header-top').click()
  const start = await scroll(page)
  await page.waitForTimeout(1100)
  check((await scroll(page)) > start + 10, 'Automatic scrolling advances')
  await page.mouse.move(650, 500); await page.mouse.wheel(0, 250)
  await page.waitForTimeout(250)
  const manual = await scroll(page)
  await page.waitForTimeout(700)
  check(Math.abs((await scroll(page)) - manual) < 2, 'Wheel immediately takes over and holds')
  await page.waitForTimeout(5000)
  check((await scroll(page)) > manual + 5, 'Drift resumes after idle')
  await page.locator('#playback').click()
  const paused = await scroll(page)
  await page.waitForTimeout(400)
  check((await scroll(page)) === paused, 'Explicit Pause stays still')
  // Crossing either end keeps the same repeating content and a bounded scroll offset.
  await page.evaluate(() => { const f = document.querySelector('#field'); f.scrollTop = window.drift.view.period * 2 + 120 })
  await page.waitForTimeout(100)
  check(await page.evaluate(() => Math.abs(document.querySelector('#field').scrollTop - window.drift.view.period - 120) < 2), 'Forward loop wraps without changing content offset')
  await page.evaluate(() => { const f = document.querySelector('#field'); f.scrollTop = window.drift.view.period - 120 })
  await page.waitForTimeout(100)
  check(await page.evaluate(() => Math.abs(document.querySelector('#field').scrollTop - (window.drift.view.period * 2 - 120)) < 2), 'Reverse loop wraps without changing content offset')
  const card = page.locator('.drift-tile[data-project="op-1-field"]:not([aria-hidden])')
  await card.focus(); await page.keyboard.press('Enter')
  await page.waitForSelector('#viewer:not([hidden])')
  check(await page.locator('.drift-group-card').count() === 3, 'Grouped work opens as an overview grid')
  await page.locator('.drift-group-card').nth(1).click()
  check(await page.evaluate(() => window.drift.view.galleryMode === 'single' && window.drift.view.slide === 1), 'Overview thumbnail opens the selected single view')
  await page.locator('#gallery-mode').click()
  check(await page.locator('#group-view').isVisible(), 'Rail returns to overview')
  await page.locator('#gallery-mode').click()
  const initial = await page.evaluate(() => window.drift.view.slide)
  await page.locator('#next').click()
  check(await page.evaluate(() => window.drift.view.slide) !== initial, 'Gallery advances')
  await page.keyboard.press('ArrowLeft')
  check(await page.evaluate(() => window.drift.view.slide) === initial, 'Keyboard gallery navigation')
  await page.waitForFunction(() => document.querySelector('#detail-media img')?.naturalWidth === 3840)
  check(true, 'Viewer loads the full 3840px image')
  check(await page.evaluate(() => {
    const pills = [...document.querySelector('.dock').children].filter((e) => !e.hidden)
    const first = pills[0].getBoundingClientRect(), last = pills.at(-1).getBoundingClientRect()
    return Math.abs((first.left + last.right) / 2 - innerWidth / 2) < 1
  }), 'Gallery dock stays centred when leading actions are hidden')
  await page.locator('[data-view="in"]').click()
  await page.mouse.move(720, 500); await page.mouse.down(); await page.mouse.move(810, 570, { steps: 5 }); await page.mouse.up()
  check(await page.locator('#detail-stage').evaluate((e) => e.style.transform.includes('translate') && e.style.transform.includes('scale')), 'Shared stage pans and zooms')
  await page.locator('[data-view="fit"]').click()
  check(await page.locator('#detail-stage').evaluate((e) => e.style.transform === ''), 'Shared Fit resets the view')
  await page.keyboard.press('Escape')
  check(await page.locator('#group-view').isVisible(), 'Escape from single returns to overview')
  check(await page.evaluate(() => window.drift.view.slide) === initial, 'Overview preserves the selected image')
  await page.keyboard.press('Escape')
  check(await card.evaluate((e) => document.activeElement === e), 'Escape restores collection focus')
  const videoCard = page.locator('.drift-tile[data-project="circular-sideboard"]:not([aria-hidden])')
  await videoCard.focus(); await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('#detail-media video')?.readyState >= 2)
  check(await page.locator('#detail-media video').evaluate((v) => v.videoWidth === 960 && !v.error), 'Imported motion plays in the viewer')
  await page.locator('#playback').click()
  check(await page.locator('#detail-media video').evaluate((v) => v.paused), 'Viewer video pauses')
  await context.close()

  const slow = await open()
  await slow.page.route('**/20260922/drift/app.js', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue() })
  await ready(slow.page)
  check(await slow.page.locator('.dialkit-slider').filter({ hasText: 'Seed' }).innerText().then((t) => t.includes('1801')), 'Delayed engine mounts panel on its published state')
  await slow.context.close()

  const motion = await open(390, 'day', { reducedMotion: 'reduce', isMobile: true, hasTouch: true })
  await ready(motion.page)
  check(await motion.page.evaluate(() => !window.drift.view.playing), 'Reduced motion starts still')
  await motion.page.locator('.dialkit-panel-header .dialkit-folder-header-top').tap()
  const touchTile = motion.page.locator('.drift-tile[data-project="movas-sign"]:not([aria-hidden])')
  await touchTile.evaluate(e => { document.querySelector('#field').scrollTop = Math.max(window.drift.view.period, parseFloat(e.style.top) - 180) })
  const mediaBox = await touchTile.locator('img').boundingBox()
  const touchX = mediaBox.x + mediaBox.width / 2, touchY = mediaBox.y + mediaBox.height / 2
  const before = await scroll(motion.page)
  const cdp = await motion.context.newCDPSession(motion.page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] })
  for (let y = touchY - 20; y >= touchY - 160; y -= 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await motion.page.waitForTimeout(500)
  check(Math.abs((await scroll(motion.page)) - before) > 100, 'Touch swipe scrolls natively')
  check(await motion.page.locator('.drift-tile video').evaluateAll((videos) => videos.every((v) => v.paused)), 'Reduced motion keeps grid videos still')
  await motion.context.close()
  check(issues.length === 0, `Zero browser errors (${issues.join('; ')})`)
  console.log(`\n${checks} checks passed`)
} finally { await browser.close() }
