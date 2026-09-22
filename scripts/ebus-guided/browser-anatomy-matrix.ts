/**
 * EBUS-PRE-REVIEW-03 condition matrix. Each condition is labelled for what it is: a viewport
 * emulation, a device-pixel-ratio emulation, a root-font enlargement, a CSS-zoom stress, an
 * emulated touch drag through CDP, or a site theme class. None of these is native browser zoom
 * or a physical device, and the report says so.
 *
 * Usage: EBUS_REVIEW_URL=http://127.0.0.1:3132 EBUS_EVIDENCE_DIR=<dir> npx tsx scripts/ebus-guided/browser-anatomy-matrix.ts
 */
import { chromium, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3132'
const out = resolve(
  process.env.EBUS_EVIDENCE_DIR ?? 'artifacts/ebus-guided/anatomy-sweep',
  'matrix',
)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Condition = {
  name: string
  kind: string
  viewport: { width: number; height: number }
  deviceScaleFactor?: number
  hasTouch?: boolean
  rootFontPercent?: number
  cssZoom?: number
  theme?: 'light' | 'dark'
}
const conditions: Condition[] = [
  {
    name: '1246x1021-report',
    kind: 'viewport emulation (the report’s condition)',
    viewport: { width: 1246, height: 1021 },
  },
  { name: '1440x900-laptop', kind: 'viewport emulation', viewport: { width: 1440, height: 900 } },
  { name: '1024x768-laptop', kind: 'viewport emulation', viewport: { width: 1024, height: 768 } },
  {
    name: '390x844-phone',
    kind: 'viewport emulation with touch (phone width: the host shows its desktop/tablet fallback)',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  },
  {
    name: '320x740-phone',
    kind: 'viewport emulation with touch (phone width: the host shows its desktop/tablet fallback)',
    viewport: { width: 320, height: 740 },
    hasTouch: true,
  },
  {
    name: '1246x1021-dpr2',
    kind: 'device-pixel-ratio emulation (2×)',
    viewport: { width: 1246, height: 1021 },
    deviceScaleFactor: 2,
  },
  {
    name: '1440x900-rootfont200',
    kind: 'root-font enlargement (html font-size 200%; not browser zoom)',
    viewport: { width: 1440, height: 900 },
    rootFontPercent: 200,
  },
  {
    name: '1246x1021-csszoom150',
    kind: 'CSS zoom stress (body zoom 1.5; not browser zoom)',
    viewport: { width: 1246, height: 1021 },
    cssZoom: 1.5,
  },
  {
    name: '1246x1021-light',
    kind: 'site theme class: light',
    viewport: { width: 1246, height: 1021 },
    theme: 'light',
  },
  {
    name: '1246x1021-dark',
    kind: 'site theme class: dark',
    viewport: { width: 1246, height: 1021 },
    theme: 'dark',
  },
  {
    name: '768x1024-touch',
    kind: 'viewport emulation with emulated touch (tablet width)',
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
  },
]
async function openLesson(page: Page, id: string) {
  await page.goto(`${base}/en/ebus-guided/learn?section=${id}`, { waitUntil: 'networkidle' })
  for (let i = 0; i < 8; i++) {
    if ((await page.locator('[data-evidence-identity="live"]').count()) > 0) break
    await page.locator('[data-now-primary]').click()
    await page.waitForTimeout(300)
  }
}
async function measure(page: Page) {
  const host = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    fallback: !!Array.from(document.querySelectorAll('h2')).find((h) =>
      h.textContent?.includes('Desktop or tablet lab'),
    ),
    iframeHeight:
      document.querySelector('iframe[title="EBUS workbench"]')?.getBoundingClientRect().height ??
      null,
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
    themeClass: document.documentElement.className,
  }))
  if (host.fallback) return { host, workbench: null }
  const f = page.frameLocator('iframe[title="EBUS workbench"]')
  const started = Date.now()
  let ready = false
  while (Date.now() - started < 90000) {
    if (
      (await f.locator('.linked-structure-callouts, .model-viewport canvas').count()) > 0 &&
      (await f.locator('[role="status"]', { hasText: 'Checking and loading' }).count()) === 0
    ) {
      ready = true
      break
    }
    await wait(300)
  }
  await page.waitForTimeout(1500)
  const workbench = await f.locator('body').evaluate((body) => {
    const host = body.querySelector<HTMLElement>('.linked-canvas')
    const rect = host?.getBoundingClientRect()
    const letters = Array.from(body.querySelectorAll<HTMLButtonElement>('.linked-structure-letter'))
      .filter(
        (b) =>
          !b.hidden && !(b.closest('.linked-structure-callouts') as HTMLElement | null)?.hidden,
      )
      .map((b) => {
        const r = b.getBoundingClientRect()
        return {
          letter: b.querySelector('.linked-structure-glyph')?.textContent,
          left: r.left - (rect?.left ?? 0),
          top: r.top - (rect?.top ?? 0),
          right: r.right - (rect?.left ?? 0),
          bottom: r.bottom - (rect?.top ?? 0),
        }
      })
    let overlaps = 0,
      outside = 0
    for (let i = 0; i < letters.length; i++) {
      const a = letters[i]
      if (
        rect &&
        (a.left < -0.5 ||
          a.top < -0.5 ||
          a.right > rect.width + 0.5 ||
          a.bottom > rect.height + 0.5)
      )
        outside++
      for (let j = i + 1; j < letters.length; j++) {
        const b = letters[j]
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps++
      }
    }
    const dots = Array.from(
      body.querySelectorAll<SVGCircleElement>('.linked-structure-callouts circle'),
    )
      .filter((c) => c.getAttribute('visibility') !== 'hidden')
      .map((c) => [parseFloat(c.getAttribute('cx')!), parseFloat(c.getAttribute('cy')!)])
    let minPair = Infinity
    for (let i = 0; i < dots.length; i++)
      for (let j = i + 1; j < dots.length; j++)
        minPair = Math.min(minPair, Math.hypot(dots[i][0] - dots[j][0], dots[i][1] - dots[j][1]))
    const canvas = host?.querySelector('canvas')
    const compass = body.querySelector<HTMLElement>('.linked-compass')
    const compassRect = compass?.getBoundingClientRect()
    return {
      ready: true,
      canvas: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
      canvasPixels: canvas ? { width: canvas.width, height: canvas.height } : null,
      letters: letters.length,
      letterOverlaps: overlaps,
      lettersOutside: outside,
      minPairwiseDotDistance: Number.isFinite(minPair) ? Math.round(minPair * 10) / 10 : null,
      compassInside:
        compassRect && rect
          ? compassRect.left >= rect.left - 0.5 && compassRect.bottom <= rect.bottom + 0.5
          : null,
      sweepPanel: body.querySelector('.linked-sweep')?.getAttribute('data-sweep-state') ?? null,
      docOverflow: body.scrollWidth > body.clientWidth + 1,
      bodyWidth: body.clientWidth,
      focusables: body.querySelectorAll(
        'button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ).length,
    }
  })
  return { host, workbench: ready ? workbench : { ready: false } }
}
async function run(browser: Browser, condition: Condition) {
  const context = await browser.newContext({
    viewport: condition.viewport,
    deviceScaleFactor: condition.deviceScaleFactor ?? 1,
    hasTouch: !!condition.hasTouch,
    isMobile: false,
  })
  const page = await context.newPage()
  if (condition.rootFontPercent)
    await page.addInitScript((pct) => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = pct + '%'
      })
    }, condition.rootFontPercent)
  if (condition.cssZoom)
    await page.addInitScript((z) => {
      document.addEventListener('DOMContentLoaded', () => {
        ;(document.body.style as unknown as { zoom: string }).zoom = String(z)
      })
    }, condition.cssZoom)
  if (condition.theme)
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('theme', t)
      } catch {
        /* private mode */
      }
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(t)
      })
    }, condition.theme)
  const result: Record<string, unknown> = {
    name: condition.name,
    kind: condition.kind,
    viewport: condition.viewport,
    deviceScaleFactor: condition.deviceScaleFactor ?? 1,
    hasTouch: !!condition.hasTouch,
  }
  await openLesson(page, 'ct-map')
  result.lesson11 = await measure(page)
  await page.screenshot({ path: resolve(out, `${condition.name}-lesson11.png`), fullPage: false })
  const canvas = page.frameLocator('iframe[title="EBUS workbench"]').locator('.linked-canvas')
  if (
    (await canvas.count()) &&
    !(result.lesson11 as { host: { fallback: boolean } }).host.fallback
  ) {
    await canvas.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await canvas.screenshot({ path: resolve(out, `${condition.name}-lesson11-canvas.png`) })
    if (condition.hasTouch) {
      // Emulated one-finger vertical drag on the canvas, through CDP touch events (not a device).
      const cdp = await context.newCDPSession(page)
      const canvasEl = canvas.locator('canvas')
      // Park the canvas in the upper half of the viewport so a finger moving up has room to scroll the page down.
      await page.evaluate(
        (top) => window.scrollTo(0, Math.max(0, window.scrollY + top - 160)),
        (await canvas.boundingBox())!.y,
      )
      await wait(300)
      const drag = async () => {
        const box = (await canvas.boundingBox())!
        const x = box.x + box.width / 2,
          y0 = box.y + box.height * 0.75
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y: y0 }],
        })
        for (let i = 1; i <= 8; i++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y0 - i * 25 }],
          })
          await wait(16)
        }
        // Hold still before lifting so the gesture ends without a fling: a tap during a fling is
        // swallowed by Chromium as a scroll stop, which is browser behaviour, not the page's.
        await wait(350)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await wait(500)
      }
      const engagedBefore = await canvasEl.getAttribute('data-engaged')
      const before = await page.evaluate(() => window.scrollY)
      await drag()
      const afterReleased = await page.evaluate(() => window.scrollY)
      const engagedAfterDrag = await canvasEl.getAttribute('data-engaged')
      // Let any scroll fling settle, then tap to engage; a second drag should orbit and not scroll.
      let settled = await page.evaluate(() => window.scrollY)
      for (let i = 0; i < 20; i++) {
        await wait(150)
        const now = await page.evaluate(() => window.scrollY)
        if (now === settled) break
        settled = now
      }
      const box2 = (await canvas.boundingBox())!
      const tapPoint = { x: box2.x + box2.width / 2, y: box2.y + box2.height / 2 }
      const frameBox = (await page.locator('iframe[title="EBUS workbench"]').boundingBox())!
      const hit = await page
        .frameLocator('iframe[title="EBUS workbench"]')
        .locator('body')
        .evaluate(
          (_body, p) => {
            const el = document.elementFromPoint(p.x, p.y)
            return el
              ? el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '')
              : null
          },
          { x: tapPoint.x - frameBox.x, y: tapPoint.y - frameBox.y },
        )
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tapPoint] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await wait(400)
      const engagedAfterTap = await canvasEl.getAttribute('data-engaged')
      const touchAction = await canvasEl.evaluate((c) => getComputedStyle(c).touchAction)
      const before2 = await page.evaluate(() => window.scrollY)
      await drag()
      const afterEngaged = await page.evaluate(() => window.scrollY)
      result.touch = {
        tapHit: hit,
        released: {
          scrollBefore: before,
          scrollAfter: afterReleased,
          pageScrolled: afterReleased !== before,
          engaged: engagedBefore,
        },
        engagedByTap: engagedAfterTap,
        touchActionWhenEngaged: touchAction,
        engagedDrag: {
          scrollBefore: before2,
          scrollAfter: afterEngaged,
          pageScrolled: afterEngaged !== before2,
        },
      }
    }
  }
  await openLesson(page, 'eus-b-route-model')
  await page.waitForTimeout(5000)
  const vp = page.frameLocator('iframe[title="EBUS workbench"]').locator('.model-viewport')
  result.lesson19 = (await vp.count())
    ? {
        arrowPx: await vp.getAttribute('data-arrow-px'),
        size: await vp.boundingBox(),
        labels: await page
          .frameLocator('iframe[title="EBUS workbench"]')
          .locator('.model-viewport .linked-structure-name')
          .count(),
      }
    : { fallback: true }
  await page.screenshot({ path: resolve(out, `${condition.name}-lesson19.png`), fullPage: false })
  await context.close()
  return result
}
async function main() {
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const results: unknown[] = []
  const only = process.env.EBUS_MATRIX_ONLY
  for (const condition of conditions) {
    if (only && condition.name !== only) continue
    try {
      results.push(await run(browser, condition))
    } catch (e) {
      results.push({ name: condition.name, kind: condition.kind, error: String(e) })
    }
  }
  await writeFile(
    resolve(out, 'matrix.json'),
    JSON.stringify({ base, startedAt: new Date().toISOString(), results }, null, 2),
  )
  console.log(JSON.stringify(results, null, 1))
  await browser.close()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
