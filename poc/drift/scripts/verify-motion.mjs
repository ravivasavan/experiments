import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const origin = process.env.DRIFT_ORIGIN || 'http://127.0.0.1:8510'
const rect = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height} }
const near = (a,b) => { for(const k of ['x','y','width','height']) assert.ok(Math.abs(a[k]-b[k])<1,`${k}: ${a[k]} vs ${b[k]}`) }
try {
for (const width of [1440,390]) for (const theme of ['day','night']) {
  const page=await browser.newPage({viewport:{width,height:900}}), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(t=>{localStorage.setItem('theme',t);localStorage.setItem('play.panel','min')},theme)
  await page.route('**/*-full.webp', async route=>{await new Promise(r=>setTimeout(r,700));await route.continue()})
  await page.goto(`${origin}/20260922/drift/`)
  await page.waitForSelector('.dialkit-root',{state:'attached'})
  const card=page.locator('.drift-tile[data-project="op-1-field"]:not([aria-hidden])')
  await card.focus();await page.keyboard.press('Enter')
  const thumb=page.locator('.drift-group-card').nth(2)
  await page.waitForFunction(()=>[...document.querySelectorAll('#group-grid img')].every(e=>e.complete&&e.naturalWidth))
  await thumb.focus()
  assert.equal(await thumb.evaluate(e=>getComputedStyle(e).borderRadius),'12px')
  await page.screenshot({path:`/tmp/drift-focus-${width}-${theme}.png`})
  const start=await thumb.evaluate(rect)
  await thumb.evaluate(e=>{e.click();const a=document.querySelector('.drift-transition-media').getAnimations()[0];a.pause();a.currentTime=0})
  near(await page.locator('.drift-transition-media').evaluate(rect),start)
  assert.equal(await page.locator('.drift-transition-media').evaluate(e=>e.getAnimations()[0].effect.getTiming().duration),220)
  await page.evaluate(()=>{
    window.blankFrames=0;window.watchImage=true;
    function check(){
      if(!window.watchImage)return;
      const e=document.querySelector('.drift-transition-media')||document.querySelector('#detail-media img');
      if(!e||!e.complete||!e.naturalWidth||getComputedStyle(e).visibility==='hidden')window.blankFrames++;
      requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
    document.querySelector('.drift-transition-media').getAnimations()[0].play();
  })
  await page.waitForFunction(()=>document.querySelector('#detail-media img')?.src.includes('-full.webp'))
  assert.equal(await page.evaluate(()=>{window.watchImage=false;return window.blankFrames}),0)
  assert.equal(await page.locator('.drift-transition-media').count(),0)
  await page.locator('[data-view="in"]').click()
  const full=await page.locator('#detail-media img').evaluate(rect)
  await page.locator('#gallery-mode').evaluate(e=>{e.click();const a=document.querySelector('.drift-transition-media').getAnimations()[0];a.pause();a.currentTime=0})
  near(await page.locator('.drift-transition-media').evaluate(rect),full)
  const target=await page.locator('.drift-group-card').nth(2).evaluate(rect)
  await page.locator('.drift-transition-media').evaluate(e=>{const a=e.getAnimations()[0];a.currentTime=a.effect.getTiming().duration})
  near(await page.locator('.drift-transition-media').evaluate(rect),target)
  await page.locator('.drift-transition-media').evaluate(e=>e.getAnimations()[0].currentTime=90)
  const halfway=await page.locator('.drift-transition-media').evaluate(rect)
  await page.locator('#gallery-mode').evaluate(e=>{e.click();const a=document.querySelector('.drift-transition-media').getAnimations()[0];a.pause();a.currentTime=0})
  near(await page.locator('.drift-transition-media').evaluate(rect),halfway)
  await page.keyboard.press('Escape');await page.keyboard.press('Escape')
  assert.equal(await page.locator('.drift-transition-media').count(),0)
  assert.ok(await page.locator('#viewer').isHidden())
  await page.waitForTimeout(800)
  assert.equal(await page.locator('#detail-media img').count(),0,'Late decode cannot reinsert closed media')
  await page.emulateMedia({reducedMotion:'reduce'})
  await card.focus();await page.keyboard.press('Enter');await page.locator('.drift-group-card').first().click()
  assert.equal(await page.locator('.drift-transition-media').count(),0)
  await page.keyboard.press('Escape')
  assert.ok(await page.locator('.drift-group-card').first().evaluate(e=>e===document.activeElement))
  assert.deepEqual(errors,[])
  console.log(`✓ ${width} ${theme}: rounded focus, spatial endpoints, interrupted reversal, decoded swap without blank frames, stale-load cleanup, reduced motion`)
  await page.close()
}
} finally {await browser.close()}
