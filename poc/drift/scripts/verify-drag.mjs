import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const errors = []
const origin = process.env.DRIFT_ORIGIN || 'http://127.0.0.1:8510'
const selector = '.drift-tile[data-project="movas-sign"]:not([aria-hidden])'
async function dimensions(page) {
  return page.evaluate(() => {
    const f = document.querySelector('#field'), d = document.documentElement
    return [f.scrollWidth, f.scrollHeight, f.clientWidth, d.scrollWidth, d.clientWidth, getComputedStyle(d).getPropertyValue('--nav-right-comp')]
  })
}
try {
  for (const width of [1440, 390]) for (const theme of ['day', 'night']) {
    const touch = width === 390
    const page = await browser.newPage({ viewport: { width, height: touch ? 844 : 1000 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' })
    page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(t => { localStorage.setItem('theme', t); localStorage.setItem('play.panel', 'min') }, theme)
    await page.goto(`${origin}/20260922/drift/`)
    await page.waitForSelector(selector)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(100)
    const tile = page.locator(selector)
    await tile.evaluate(e => { document.querySelector('#field').scrollTop = Math.max(window.drift.view.period, parseFloat(e.style.top) - 250) })
    await page.waitForTimeout(50)
    const before = await dimensions(page)
    const box = await tile.boundingBox()
    const start = { x: box.x + box.width / 2, y: box.y + 24 }
    const cdp = touch ? await page.context().newCDPSession(page) : null
    async function down(x, y) {
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      else { await page.mouse.move(x, y); await page.mouse.down() }
    }
    async function move(x, y) {
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
      else await page.mouse.move(x, y, { steps: 5 })
    }
    async function up() {
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      else await page.mouse.up()
    }
    await down(start.x, start.y); await move(start.x + 80, start.y + 100)
    const moved = await tile.boundingBox()
    assert.ok(Math.abs(moved.x - box.x - 80) < 1 && Math.abs(moved.y - box.y - 100) < 1, 'Frame tracks the pointer exactly')
    await up()
    assert.ok(await page.locator('#viewer').isHidden(), 'Drag release does not open the gallery')
    const transforms = await page.locator('.drift-tile[data-project="movas-sign"]').evaluateAll(es => es.map(e => e.style.transform))
    assert.equal(new Set(transforms).size, 1, 'Repeat copies preserve the same placement')
    assert.deepEqual(await dimensions(page), before, 'Drag does not change scrollbar or chrome geometry')
    if (!touch) {
      await down(moved.x + moved.width / 2, moved.y + 24)
      await move(width + 600, 1800)
      await up()
      assert.ok((await tile.boundingBox()).x > width, 'Frame can leave the viewport entirely')
      assert.deepEqual(await dimensions(page), before, 'Out-of-window frame does not expand scroll dimensions')
      await page.locator('#reset').click()
      assert.equal(await tile.evaluate(e => e.style.transform), '', 'Reset recovers offscreen frames')
      await tile.evaluate(e => { document.querySelector('#field').scrollTop = Math.max(window.drift.view.period, parseFloat(e.style.top) - 250) })
      const resetBox = await tile.boundingBox()
      await down(resetBox.x + 60, resetBox.y + 24); await move(resetBox.x + 160, resetBox.y + 124)
      await page.keyboard.press('Escape'); await up()
      assert.ok(await page.locator('#viewer').isHidden(), 'Cancelled drag stays in drift')
      assert.equal(await tile.evaluate(e => e.style.transform), 'translate(0px, 0px)', 'Escape restores the starting placement')
      await tile.focus(); await page.keyboard.press('Alt+ArrowRight')
      assert.equal(await tile.evaluate(e => e.style.transform), 'translate(24px, 0px)', 'Keyboard can reposition frames')
    } else {
      // Swiping on media still scrolls instead of moving its frame.
      await page.locator('#reset').tap()
      await tile.evaluate(e => { document.querySelector('#field').scrollTop = Math.max(window.drift.view.period, parseFloat(e.style.top) - 180) })
      const media = await tile.locator('img').boundingBox()
      const scroll = await page.locator('#field').evaluate(e => e.scrollTop)
      const x = media.x + media.width / 2, y = Math.min(650, media.y + media.height / 2)
      await down(x, y)
      for (let delta = 20; delta <= 160; delta += 20) await move(x, y - delta)
      await up(); await page.waitForTimeout(300)
      assert.ok(Math.abs(await page.locator('#field').evaluate(e => e.scrollTop) - scroll) > 50, 'Media swipe keeps native scrolling')
      assert.equal(await tile.evaluate(e => e.style.transform), '', 'Media swipe does not move the frame')
    }
    await tile.evaluate(e => { document.querySelector('#field').scrollTop = Math.max(window.drift.view.period, parseFloat(e.style.top) - 250) })
    if (touch) await tile.tap({ position: { x: 80, y: 100 } }); else await tile.click({ position: { x: 80, y: 100 } })
    assert.ok(await page.locator('#group-view').isVisible(), 'Ordinary activation still opens the gallery')
    console.log(`✓ ${width} ${theme}: drag, click separation, repeating copies, fixed overflow, recovery and ${touch ? 'native touch scrolling' : 'keyboard movement'}`)
    await page.close()
  }
  const live = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await live.addInitScript(() => localStorage.setItem('play.panel', 'min'))
  await live.goto(`${origin}/20260922/drift/`)
  await live.waitForSelector(selector)
  await live.evaluate(() => document.fonts.ready); await live.waitForTimeout(200)
  const tile = live.locator(selector)
  await tile.evaluate(e => { document.querySelector('#field').scrollTop = Math.max(window.drift.view.period, parseFloat(e.style.top) - 250) })
  await live.waitForTimeout(50)
  const box = await tile.boundingBox()
  await live.mouse.move(box.x + 50, box.y + 24); await live.mouse.down()
  await live.mouse.move(box.x + 130, box.y + 100)
  const scroll = await live.locator('#field').evaluate(e => e.scrollTop)
  const idle = await live.evaluate(() => window.drift.state.resume * 1000)
  await live.waitForTimeout(idle + 200)
  assert.equal(await live.locator('#field').evaluate(e => e.scrollTop), scroll, 'Drift pauses throughout a held drag')
  await live.mouse.up(); await live.waitForTimeout(idle + 500)
  assert.ok(await live.locator('#field').evaluate(e => e.scrollTop) > scroll + 5, 'Drift resumes after release and idle delay')
  console.log('✓ Drag pauses automatic motion until release and the configured idle delay')
  await live.close()
  assert.deepEqual(errors, [])
  console.log('Drag checks passed with zero page errors')
} finally { await browser.close() }
