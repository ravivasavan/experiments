import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const origin = process.env.DRIFT_ORIGIN || 'http://127.0.0.1:8510'
const errors = []
try {
for (const width of [1440, 390]) for (const theme of ['day', 'night']) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'reduce' })
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(t => { localStorage.setItem('theme', t); localStorage.setItem('play.panel', 'min') }, theme)
  await page.goto(`${origin}/20260922/drift/`); await page.waitForSelector('.drift-tile')
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100)
  assert.ok(await page.locator('.drift-tile:not([aria-hidden])').evaluateAll(es => es.some((e, i) => {
    if (!i || !e.dataset.paired) return false
    const a=e.getBoundingClientRect(), b=es[i-1].getBoundingClientRect()
    return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top
  })), 'Seeded layout contains deliberate overlaps')
  await page.screenshot({ path: `/tmp/drift-overlap-${width}-${theme}.png` })
  const card = page.locator('.drift-tile[data-project="movas-sign"]:not([aria-hidden])')
  await card.focus(); await page.keyboard.press('Enter')
  assert.equal(await page.locator('#detail-rail button:visible').count(), 1)
  assert.equal(await page.locator('#original, #back, #grid, #single').count(), 0)
  assert.equal(await page.locator('#gallery-dialog').getAttribute('aria-modal'), 'true')
  assert.ok(await page.locator('[data-chrome]').evaluate(e=>e.inert))
  await page.waitForFunction(()=>[...document.querySelectorAll('#group-grid img')].every(i=>i.complete&&i.naturalWidth))
  await page.locator('#group-grid img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())))
  await page.waitForTimeout(100)
  assert.ok(await page.locator('#group-grid img').evaluateAll(es=>es.every(e=>parseFloat(getComputedStyle(e).borderRadius)===12)))
  await page.screenshot({ path: `/tmp/drift-gallery-new-${width}-${theme}.png` })
  if(width===1440&&theme==='night') { await page.setViewportSize({width:1280,height:800});await page.screenshot({path:'/tmp/drift-gallery-new-timeline.png'});await page.setViewportSize({width,height:1000}) }
  await page.locator('.drift-group-card').nth(1).click()
  assert.equal(await page.evaluate(()=>window.drift.view.galleryMode),'single')
  assert.equal(await page.locator('.drift-mode-glyph').getAttribute('data-mode'),'single')
  assert.equal(await page.locator('#detail-media img').evaluate(e=>getComputedStyle(e).borderRadius),'0px')
  assert.equal(await page.locator('#work-count').innerText(),'2/6')
  assert.equal(await page.locator('#work-name').innerText(),'2026-02-11-MovasSign-Renders-002A')
  assert.equal(await page.locator('.dock #previous, .dock #next, .dock [data-view]').count(),5)
  await page.locator('[data-view="in"]').click()
  assert.equal(await page.locator('[data-view-level]').innerText(),'125%')
  await page.locator('[data-view="fit"]').click()
  await page.locator('#next').click();assert.equal(await page.locator('#work-count').innerText(),'3/6')
  await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#work-count').innerText(),'2/6')
  const controls=page.locator('#gallery-dialog button:visible')
  await controls.last().focus();await page.keyboard.press('Tab');assert.ok(await controls.first().evaluate(e=>e===document.activeElement))
  await page.keyboard.press('Shift+Tab');assert.ok(await controls.last().evaluate(e=>e===document.activeElement))
  await page.mouse.move(0,0)
  await page.screenshot({path:`/tmp/drift-single-new-${width}-${theme}.png`})
  if(width===1440&&theme==='night') { await page.setViewportSize({width:1280,height:800});await page.screenshot({path:'/tmp/drift-single-new-timeline.png'});await page.setViewportSize({width,height:1000}) }
  await page.keyboard.press('Escape');assert.ok(await page.locator('#group-view').isVisible())
  assert.ok(await page.locator('.drift-group-card').nth(1).evaluate(e=>e===document.activeElement))
  await page.locator('#gallery-mode').click();assert.equal(await page.evaluate(()=>window.drift.view.galleryMode),'single')
  // Same outside point backs out once, then once again.
  await page.mouse.click(width-3, Math.floor((width===390?844:1000)/2))
  assert.equal(await page.evaluate(()=>window.drift.view.galleryMode),'grid')
  assert.ok(await page.locator('#viewer').isVisible())
  await page.mouse.click(width-3, Math.floor((width===390?844:1000)/2))
  assert.ok(await page.locator('#viewer').isHidden())
  assert.ok(await card.evaluate(e=>e===document.activeElement))
  assert.ok(await page.locator('[data-chrome]').evaluate(e=>!e.inert))
  assert.ok(await page.locator('#drift-dock').evaluate(e=>e.parentElement===document.body))
  await card.focus();await page.keyboard.press('Enter');await page.locator('#gallery-mode').click();await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.ok(await page.locator('#viewer').isHidden())
  for (const id of ['custom-sideboard', 'bag-close-ups', 'twisting-ropes']) {
    const source = page.locator(`.drift-tile[data-project="${id}"]:not([aria-hidden])`)
    await source.focus(); await page.keyboard.press('Enter')
    const sizes = await page.locator('.drift-group-card').evaluateAll(es => es.map(e => { const r=e.getBoundingClientRect(); return { h:r.height, w:r.width, ratio:parseFloat(e.style.aspectRatio) }; }))
    assert.ok(sizes.every(s => Math.abs(s.h - sizes[0].h) < 1 && Math.abs(s.w / s.h - s.ratio) < 0.01), 'All rows share one media height without distortion')
    await page.locator('#close').click()
  }
  console.log(`✓ ${width} ${theme}: overlaps, thumbnail corners, one morphing toggle, dock chips/controls, focus containment and two-step dismissal`)
  await page.close()
}
assert.deepEqual(errors,[])
console.log('Gallery checks passed with zero page errors')
} finally { await browser.close() }
