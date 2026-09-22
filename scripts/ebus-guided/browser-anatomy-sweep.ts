/**
 * EBUS-PRE-REVIEW-03 evidence: landmark callout geometry, camera and scroll behaviour, and the
 * genuine sweep event sequences, driven through the real host and embedded app.
 *
 * Usage:
 *   EBUS_REVIEW_URL=http://127.0.0.1:3131 EBUS_EVIDENCE_DIR=<dir> npx tsx scripts/ebus-guided/browser-anatomy-sweep.ts <phase>
 * Bridge events are read from the host window's message stream; nothing is seeded. Every capture
 * tolerates a checkout that lacks a control (it records null) so the same script runs against
 * the baseline and the change.
 */
import { chromium, type FrameLocator } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { EbusBridgeMessage } from '../../src/lib/ebus-guided-bridge'

type ObservationMessage = Extract<EbusBridgeMessage, { type: 'observation' }>
declare global {
  interface Window {
    __ebusEvents: ObservationMessage[]
  }
}
const phase = process.argv[2] ?? 'run'
const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3131'
const out = resolve(process.env.EBUS_EVIDENCE_DIR ?? 'artifacts/ebus-guided/anatomy-sweep', phase)
const viewport = { width: 1246, height: 1021 }
const report: Record<string, unknown> = {
  phase,
  base,
  viewport,
  startedAt: new Date().toISOString(),
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const setRange = (el: HTMLInputElement, v: number) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  set.call(el, String(v))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function main() {
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const context = await browser.newContext({ viewport, hasTouch: false })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    window.__ebusEvents = []
    window.addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data?.type === 'observation')
        window.__ebusEvents.push(e.data)
    })
  })
  const primary = () => page.locator('[data-now-primary]')
  const workbench = () => page.frameLocator('iframe[title="EBUS workbench"]')
  const latest = () => page.evaluate(() => window.__ebusEvents.at(-1)?.observation)
  const eventCount = () => page.evaluate(() => window.__ebusEvents.length)
  async function openLesson(id: string, until: 'live' | 'demonstration') {
    await page.goto(`${base}/en/ebus-guided/learn?section=${id}`, { waitUntil: 'networkidle' })
    for (let i = 0; i < 8; i++) {
      if ((await page.locator(`[data-evidence-identity="${until}"]`).count()) > 0) break
      await primary().click()
      await page.waitForTimeout(400)
    }
    if ((await page.locator(`[data-evidence-identity="${until}"]`).count()) === 0)
      throw new Error(`Could not reach ${until} step of ${id}`)
    await page
      .locator('iframe[title="EBUS workbench"]')
      .first()
      .waitFor({ state: 'attached', timeout: 60000 })
  }
  async function waitLinkedReady(timeout = 90000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      const o = await latest()
      if (o?.frameReady && o.linked?.assetsReady) return o
      await wait(200)
    }
    throw new Error('linked workbench never became ready')
  }
  async function calloutGeometry(frame: FrameLocator, label: string) {
    const canvas = frame.locator('.linked-canvas')
    await canvas.scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    const geometry = await canvas.evaluate((host) => {
      const rect = host.getBoundingClientRect()
      const letters = Array.from(
        host.querySelectorAll<HTMLButtonElement>('.linked-structure-letter'),
      )
        .filter((b) => !b.hidden)
        .map((b) => {
          const r = b.getBoundingClientRect()
          return {
            letter: b.querySelector('.linked-structure-glyph')?.textContent ?? b.textContent,
            name: b.querySelector('.linked-structure-name')?.textContent ?? null,
            x: parseFloat(b.style.left),
            y: parseFloat(b.style.top),
            left: r.left - rect.left,
            right: r.right - rect.left,
            top: r.top - rect.top,
            bottom: r.bottom - rect.top,
            pressed: b.getAttribute('aria-pressed'),
            hovered: b.classList.contains('is-hovered'),
            ariaLabel: b.getAttribute('aria-label'),
          }
        })
      const dots = Array.from(
        host.querySelectorAll<SVGCircleElement>('.linked-structure-callouts circle'),
      ).map((c) => ({
        x: parseFloat(c.getAttribute('cx') ?? 'nan'),
        y: parseFloat(c.getAttribute('cy') ?? 'nan'),
        visibility: c.getAttribute('visibility'),
      }))
      const lines = Array.from(
        host.querySelectorAll<SVGPathElement>('.linked-structure-callouts path'),
      ).map((p) => p.getAttribute('d'))
      const canvasEl = host.querySelector('canvas')
      return {
        canvas: { width: rect.width, height: rect.height },
        overlayHidden:
          host.querySelector<HTMLElement>('.linked-structure-callouts')?.hidden ?? null,
        letters,
        dots,
        lines,
        touchAction: canvasEl ? getComputedStyle(canvasEl).touchAction : null,
        canvasTabIndex: canvasEl?.tabIndex ?? null,
        engaged: canvasEl?.dataset.engaged ?? null,
        compass: host.querySelector('.linked-compass')
          ? Array.from(host.querySelectorAll('.linked-compass span')).map((s) => ({
              key: s.textContent,
              left: (s as HTMLElement).style.left,
              top: (s as HTMLElement).style.top,
            }))
          : null,
        modelTriangles: host.dataset.modelTriangles,
        calloutGeometry:
          host.querySelector<HTMLElement>('.linked-structure-callouts')?.dataset.calloutGeometry ??
          null,
      }
    })
    const visibleDots = geometry.dots.filter(
      (d) => d.visibility !== 'hidden' && Number.isFinite(d.x),
    )
    let minPair = Infinity
    const pairs: { a: number; b: number; d: number }[] = []
    for (let i = 0; i < visibleDots.length; i++)
      for (let j = i + 1; j < visibleDots.length; j++) {
        const d = Math.hypot(
          visibleDots[i].x - visibleDots[j].x,
          visibleDots[i].y - visibleDots[j].y,
        )
        pairs.push({ a: i, b: j, d: Math.round(d * 10) / 10 })
        minPair = Math.min(minPair, d)
      }
    const xs = visibleDots.map((d) => d.x),
      ys = visibleDots.map((d) => d.y)
    const spread = visibleDots.length
      ? {
          w: Math.round(Math.max(...xs) - Math.min(...xs)),
          h: Math.round(Math.max(...ys) - Math.min(...ys)),
        }
      : null
    const segs = geometry.lines.map((d) => {
      const m = /M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)/.exec(d ?? '')
      return m ? [+m[1], +m[2], +m[3], +m[4]] : null
    })
    const cross = (a: number[], b: number[]) => {
      const o = (p: number[], q: number[], r: number[]) =>
        Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
      const p1 = [a[0], a[1]],
        p2 = [a[2], a[3]],
        p3 = [b[0], b[1]],
        p4 = [b[2], b[3]]
      return o(p1, p2, p3) !== o(p1, p2, p4) && o(p3, p4, p1) !== o(p3, p4, p2)
    }
    let crossings = 0
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++)
        if (segs[i] && segs[j] && cross(segs[i]!, segs[j]!)) crossings++
    // Letter boxes overlapping each other, and letters fully inside the canvas.
    let letterOverlaps = 0,
      lettersOutside = 0
    const L = geometry.letters
    for (let i = 0; i < L.length; i++) {
      if (
        L[i].left < 0 ||
        L[i].top < 0 ||
        L[i].right > geometry.canvas.width ||
        L[i].bottom > geometry.canvas.height
      )
        lettersOutside++
      for (let j = i + 1; j < L.length; j++)
        if (
          L[i].left < L[j].right &&
          L[j].left < L[i].right &&
          L[i].top < L[j].bottom &&
          L[j].top < L[i].bottom
        )
          letterOverlaps++
    }
    let dotOnLetter = 0
    for (const d of visibleDots)
      for (const l of L)
        if (d.x >= l.left && d.x <= l.right && d.y >= l.top && d.y <= l.bottom) dotOnLetter++
    return {
      label,
      ...geometry,
      visibleDotCount: visibleDots.length,
      minPairwiseDotDistance: Number.isFinite(minPair) ? Math.round(minPair * 10) / 10 : null,
      dotSpread: spread,
      pairs,
      leaderCrossings: crossings,
      letterOverlaps,
      lettersOutsideCanvas: lettersOutside,
      dotsInsideALetter: dotOnLetter,
    }
  }
  async function screenshot(name: string) {
    await page.screenshot({ path: resolve(out, name + '.png'), fullPage: false })
  }
  async function frameScreenshot(frame: FrameLocator, selector: string, name: string) {
    const el = frame.locator(selector).first()
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await el.screenshot({ path: resolve(out, name + '.png') })
  }
  const wheelTest = async (frame: FrameLocator, canvasSelector: string) => {
    const canvas = frame.locator(canvasSelector)
    await canvas.scrollIntoViewIfNeeded()
    // Put the canvas mid-viewport so the page has room to scroll either way.
    await page.evaluate(() => window.scrollBy(0, -160))
    await page.waitForTimeout(200)
    const box = (await canvas.boundingBox())!
    const engagedBefore = await canvas.getAttribute('data-engaged')
    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(400)
    const afterReleased = await page.evaluate(() => window.scrollY)
    // Engage by clicking the canvas, then wheel again.
    const box2 = (await canvas.boundingBox())!
    await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2)
    await page.waitForTimeout(200)
    const engagedAfterClick = await canvas.getAttribute('data-engaged')
    const before2 = await page.evaluate(() => window.scrollY)
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(400)
    const afterEngaged = await page.evaluate(() => window.scrollY)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    const engagedAfterEscape = await canvas.getAttribute('data-engaged')
    return {
      engagedBefore,
      releasedWheel: {
        hostScrollBefore: before,
        hostScrollAfter: afterReleased,
        pageScrolled: afterReleased !== before,
      },
      engagedAfterClick,
      engagedWheel: {
        hostScrollBefore: before2,
        hostScrollAfter: afterEngaged,
        pageScrolled: afterEngaged !== before2,
      },
      engagedAfterEscape,
      touchAction: await canvas.evaluate((c) => getComputedStyle(c).touchAction),
    }
  }
  // --- Lesson 3: scope model, transducer task, camera, wheel ---
  {
    await openLesson('scope-orientation', 'live')
    await waitLinkedReady()
    await page.waitForTimeout(1500)
    const f = workbench()
    const l3: Record<string, unknown> = {}
    l3.initialCallouts = await calloutGeometry(f, 'lesson3-scope-default-camera')
    await screenshot('lesson3-acquire-default')
    await frameScreenshot(f, '.linked-canvas', 'lesson3-canvas-default')
    const letterA = f.locator('.linked-structure-letter').first()
    if (await letterA.count()) {
      await letterA.hover()
      await page.waitForTimeout(400)
      l3.hoverLetterA = {
        letterHoveredClass: await letterA.evaluate((b) => b.classList.contains('is-hovered')),
        hoveredLeaderCount: await f.locator('.linked-structure-callouts .is-hovered').count(),
        selectedLeaderCount: await f.locator('.linked-structure-callouts .is-selected').count(),
      }
      await letterA.focus()
      await page.waitForTimeout(300)
      l3.focusLetterA = {
        letterHoveredClass: await letterA.evaluate((b) => b.classList.contains('is-hovered')),
        hoveredLeaderCount: await f.locator('.linked-structure-callouts .is-hovered').count(),
      }
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      l3.enterOnLetterA = {
        pressed: await letterA.getAttribute('aria-pressed'),
        selectedLeaderCount: await f.locator('.linked-structure-callouts .is-selected').count(),
        selectionText: await f.locator('.linked-selection').allTextContents(),
        evidenceSelected: (await latest())?.linked?.selectedStructure,
      }
      await page.mouse.move(5, 5)
    }
    // Hover the model where letter A's leader ends: does its letter light up?
    const geometry = await calloutGeometry(f, 'lesson3-after-select')
    const first = geometry.dots.find((d) => d.visibility !== 'hidden')
    if (first) {
      const canvasBox = (await f.locator('.linked-canvas').boundingBox())!
      await page.mouse.move(canvasBox.x + first.x, canvasBox.y + first.y)
      await page.waitForTimeout(500)
      l3.hoverModelAtDotA = {
        hoveredLetters: await f.locator('.linked-structure-letter.is-hovered').allTextContents(),
        tooltip: await f
          .locator('.linked-canvas [role="tooltip"]')
          .textContent()
          .catch(() => null),
      }
      await page.mouse.move(5, 5)
    }
    l3.wheel = await wheelTest(f, '.linked-canvas canvas')
    l3.captionText = await f
      .locator('[data-observer-caption], .linked-models .guided-label')
      .allTextContents()
    l3.zoomButtons = await f
      .getByRole('button', { name: /Zoom in|Zoom out|Show structure names|Release wheel control/ })
      .allTextContents()
    // Keyboard camera: focus canvas, press keys; the camera moves only if the observer controls exist.
    const slider = f.getByRole('slider', { name: 'Scope rotation' })
    const columnsAt = async (roll: number) => {
      await slider.evaluate(setRange, roll)
      await page.waitForTimeout(700)
      const g = await calloutGeometry(f, `lesson3-roll-${roll}`)
      return {
        roll,
        letters: g.letters.map((l) => ({
          letter: l.letter,
          side: l.x < g.canvas.width / 2 ? 'left' : 'right',
        })),
        minPair: g.minPairwiseDotDistance,
        spread: g.dotSpread,
      }
    }
    l3.columnsByRoll = [
      await columnsAt(85),
      await columnsAt(40),
      await columnsAt(0),
      await columnsAt(-40),
      await columnsAt(-85),
      await columnsAt(85),
    ]
    const whole = f.getByRole('button', { name: /Show whole scope/ })
    if (await whole.count()) {
      await whole.click()
      await page.waitForTimeout(900)
      l3.wholeScopeCallouts = await calloutGeometry(f, 'lesson3-whole-scope')
      await frameScreenshot(f, '.linked-canvas', 'lesson3-canvas-whole-scope')
      await f.getByRole('button', { name: /Show distal tip/ }).click()
      await page.waitForTimeout(600)
    }
    const names = f.locator('[data-structure-names]')
    if (await names.count()) {
      await names.click()
      await page.waitForTimeout(500)
      l3.namesShown = await calloutGeometry(f, 'lesson3-names')
      await frameScreenshot(f, '.linked-canvas', 'lesson3-canvas-names')
      await names.click()
      await page.waitForTimeout(300)
    }
    const select = f.getByLabel('Select an unnamed structure')
    await select.selectOption({ index: 2 })
    await f.getByRole('button', { name: 'Check landmark' }).click()
    await page.waitForTimeout(300)
    l3.wrongCheckFeedback = await f
      .locator('.linked-landmark-task [role="status"]')
      .allTextContents()
    // Correct landmark: transducer_face is the first candidate in the scope list on this model.
    for (let i = 0; i < 4; i++) {
      await select.selectOption({ index: i + 1 })
      await f.getByRole('button', { name: 'Check landmark' }).click()
      await page.waitForTimeout(300)
      if (
        (await f
          .locator('[data-landmarks-identified], .linked-models p[role="status"]')
          .filter({ hasText: /Landmarks identified/ })
          .count()) > 0
      )
        break
    }
    l3.identifiedText = await f
      .locator('[data-landmarks-identified], .linked-models p[role="status"]')
      .filter({ hasText: /Landmarks identified/ })
      .allTextContents()
    l3.lettersAfterIdentified = await f.locator('.linked-structure-letter:not([hidden])').count()
    l3.lettersOverlayHiddenAfterIdentified = await f
      .locator('.linked-structure-callouts')
      .evaluate((o) => (o as HTMLElement).hidden)
      .catch(() => null)
    l3.sweepPanelAfterIdentified = await f
      .locator('.linked-sweep')
      .evaluate((el) => ({
        state: el.getAttribute('data-sweep-state'),
        inPlane: el.getAttribute('data-sweep-in-plane'),
        text: el.textContent,
      }))
      .catch(() => null)
    // Bronchoscopy caption (L3-12)
    await f.getByRole('button', { name: 'Bronchoscopy' }).click()
    await page.waitForTimeout(1200)
    l3.bronchoscopyCaption = await f
      .locator('[data-optical-caption]')
      .textContent()
      .catch(() => null)
    await frameScreenshot(f, '.guided-anatomy', 'lesson3-bronchoscopy')
    report.lesson3 = l3
  }
  // --- Lesson 4 (acoustic-contact): no landmark task, so no letters (L4-4) ---
  {
    await openLesson('acoustic-contact', 'live')
    await waitLinkedReady()
    await page.waitForTimeout(1200)
    const f = workbench()
    report.lesson4 = {
      lettersVisible: await f.locator('.linked-structure-letter:not([hidden])').count(),
      overlayHidden: await f
        .locator('.linked-structure-callouts')
        .evaluate((o) => (o as HTMLElement).hidden)
        .catch(() => null),
      contactComparisonLegend: await f
        .locator('.linked-contact-comparison .guided-label')
        .first()
        .textContent()
        .catch(() => null),
    }
    await frameScreenshot(f, '.linked-contact-comparison', 'lesson4-contact-comparison').catch(
      () => undefined,
    )
  }
  // --- Lesson 5 (contact cutaway model): condition captions (L5-3) ---
  {
    await openLesson('contact-cutaway-model', 'live')
    await page.waitForTimeout(5000)
    const f = workbench()
    const captions: Record<string, unknown> = {}
    for (const mode of ['gap', 'direct', 'balloon', 'bubble', 'shadow']) {
      await f.getByLabel('Contact condition').selectOption(mode)
      await page.waitForTimeout(500)
      captions[mode] = {
        caption: await f
          .locator('[data-contact-caption]')
          .textContent()
          .catch(() => null),
        labels: await f
          .locator('[data-contact-origin] text')
          .allTextContents()
          .catch(() => []),
      }
    }
    report.lesson5 = captions
    await frameScreenshot(f, '.model-image', 'lesson5-shadow-schematic')
  }
  // --- Lesson 11: ct-map demo (L11-4) and anatomy callouts (L11-3) ---
  {
    await openLesson('ct-map', 'demonstration')
    await page.waitForTimeout(6000)
    const f = workbench()
    const demo: Record<string, unknown> = {}
    demo.pressedTab = await f
      .locator('.guided-tabs[aria-label="Linked model view"] button[aria-pressed="true"]')
      .allTextContents()
    demo.triangles = await f.locator('.linked-canvas').getAttribute('data-model-triangles')
    demo.sectionShown = await f.locator('.linked-section').count()
    await frameScreenshot(f, '.linked-physical', 'lesson11-demo-view')
    const anatomyTab = f.getByRole('button', { name: 'Anatomy model' })
    await anatomyTab.click()
    await page.waitForTimeout(1200)
    demo.isolatedCanvas = await calloutGeometry(f, 'lesson11-demo-anatomy-isolated')
    await frameScreenshot(f, '.linked-canvas', 'lesson11-demo-canvas-isolated')
    report.lesson11Demo = demo
    await openLesson('ct-map', 'live')
    await waitLinkedReady()
    await page.waitForTimeout(1500)
    const g = await calloutGeometry(workbench(), 'lesson11-anatomy-default-camera')
    await frameScreenshot(workbench(), '.linked-canvas', 'lesson11-canvas-default')
    await screenshot('lesson11-acquire-default')
    const whole = workbench().getByRole('button', { name: /Show whole model/ })
    let wholeG = null
    if (await whole.count()) {
      await whole.click()
      await page.waitForTimeout(900)
      wholeG = await calloutGeometry(workbench(), 'lesson11-anatomy-whole')
      await frameScreenshot(workbench(), '.linked-canvas', 'lesson11-canvas-whole')
      await workbench()
        .getByRole('button', { name: /Frame the landmark region/ })
        .click()
      await page.waitForTimeout(600)
    }
    report.lesson11 = {
      callouts: g,
      wholeModel: wholeG,
      wheel: await wheelTest(workbench(), '.linked-canvas canvas'),
    }
  }
  // --- Lesson 13: right paratracheal callouts (L13-3) ---
  {
    await openLesson('right-paratracheal', 'live')
    await waitLinkedReady()
    await page.waitForTimeout(1500)
    const g = await calloutGeometry(workbench(), 'lesson13-anatomy-default-camera')
    await frameScreenshot(workbench(), '.linked-canvas', 'lesson13-canvas-default')
    report.lesson13 = { callouts: g }
  }
  // --- Lesson 12: sweep journeys (L12-4 / L3-6) ---
  {
    await openLesson('station-seven', 'live')
    await waitLinkedReady()
    const f = workbench()
    const slider = f.getByRole('slider', { name: 'Scope rotation' })
    const journeys: Record<string, unknown> = {}
    const sweepOf = (obs: NonNullable<Awaited<ReturnType<typeof latest>>>) => {
      const s = obs.linked?.sweeps?.[obs.linked.approach]
      return s
        ? {
            phase: s.phase,
            samples: s.samples,
            span: s.span,
            outside: s.outside,
            direction: s.direction,
            startRoll: s.startRoll,
          }
        : null
    }
    const panel = () =>
      f
        .locator('.linked-sweep')
        .evaluate((el) => ({
          state: el.getAttribute('data-sweep-state'),
          inPlane: el.getAttribute('data-sweep-in-plane'),
          heading: el.querySelector('strong')?.textContent,
          inPlaneText: el.querySelector('[data-sweep-in-plane-text]')?.textContent ?? null,
          reset: el.querySelector('[data-sweep-reset-reason]')?.textContent ?? null,
          progress: el.querySelector('[data-sweep-progress]')?.textContent ?? null,
          legacyText: el.getAttribute('data-sweep-state') ? null : el.textContent,
        }))
        .catch(() => null)
    const snapshot = async (note: string) => {
      const obs = (await latest())!
      return {
        note,
        roll: obs.roll,
        targetVisible: obs.targetVisible,
        contact: Math.round(obs.contactQuality * 1000) / 1000,
        frameReady: obs.frameReady,
        actionCount: obs.actionCount,
        approach: obs.linked?.approach,
        sweep: sweepOf(obs),
        scanned: obs.linked?.scannedApproaches,
        panel: await panel(),
      }
    }
    const settle = async (roll: number, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        const obs = await latest()
        if (obs && obs.roll === roll && obs.frameReady) return obs
        await wait(60)
      }
      throw new Error('frame for roll ' + roll + ' never settled')
    }
    const jump = async (roll: number) => {
      await slider.evaluate(setRange, roll)
      await settle(roll)
      await page.waitForTimeout(120)
    }
    const slow = async (to: number, step: number, log: unknown[], every = 1) => {
      let roll = (await latest())!.roll
      const dir = Math.sign(to - roll)
      let n = 0
      while (roll !== to) {
        roll += dir * Math.min(step, Math.abs(to - roll))
        await jump(roll)
        if (n++ % every === 0 || roll === to) log.push(await snapshot('step'))
      }
    }
    // J2: default start already inside the target (left main bronchus)
    await f.getByRole('button', { name: /Left main bronchus/ }).click()
    await waitLinkedReady()
    await page.waitForTimeout(800)
    const j2: unknown[] = [await snapshot('after choosing LMS at initial roll')]
    await slow(60, 5, j2)
    await slow(-40, 10, j2, 2)
    journeys.J2_defaultInsideTarget_lms = j2
    await screenshot('lesson12-lms-inside-start')
    const j2b: unknown[] = []
    await slow(-70, 5, j2b)
    await slow(-20, 5, j2b)
    journeys.J2b_leaveThenReturn_lms = j2b
    // Right main bronchus: J4 jump first, then J3 reverse, then J1 the full crossing.
    await f.getByRole('button', { name: /Right main bronchus/ }).click()
    await waitLinkedReady()
    await page.waitForTimeout(800)
    const j4: unknown[] = [await snapshot('after choosing RMS at initial roll (+85, outside)')]
    await jump(80)
    j4.push(await snapshot('one small step while outside (+80)'))
    await jump(30)
    j4.push(await snapshot('after a 55° jump into the target'))
    await slow(20, 10, j4)
    j4.push(await snapshot('one small step further inside'))
    journeys.J4_jumpTooFast_rms = j4
    const j3: unknown[] = []
    await slow(85, 10, j3, 3)
    j3.push(await snapshot('back at +85 (outside)'))
    await slow(20, 10, j3)
    j3.push(await snapshot('crossing to +20, now reversing'))
    await slow(30, 10, j3)
    j3.push(await snapshot('after reversing to +30'))
    journeys.J3_reversePartway_rms = j3
    const j1: unknown[] = []
    await slow(85, 10, j1, 3)
    j1.push(await snapshot('back at +85 (outside)'))
    await slow(-80, 10, j1)
    journeys.J1_outsideCrossExit_rms = j1
    await screenshot('lesson12-rms-complete')
    journeys.J7_skipButtonVisible = await page.locator('[data-skip-acquisition]').isVisible()
    const beforeReset = await snapshot('before reset')
    const countBefore = await eventCount()
    await f.getByRole('button', { name: 'Reset acquisition' }).click()
    await page.waitForTimeout(2500)
    const afterReset = await waitLinkedReady()
    journeys.J5_reset = {
      beforeReset,
      afterReset: {
        roll: afterReset.roll,
        actionCount: afterReset.actionCount,
        sweeps: afterReset.linked?.sweeps,
        scanned: afterReset.linked?.scannedApproaches,
        panel: await panel(),
        sessionChanged:
          afterReset.acquisitionSession !==
          (await page.evaluate((n) => window.__ebusEvents[n - 1]?.sessionId, countBefore)),
      },
    }
    // J5 continued: change position after the reset and repeat a short pass
    await f.getByRole('button', { name: /Left main bronchus/ }).click()
    await waitLinkedReady()
    await page.waitForTimeout(600)
    const j5b: unknown[] = [await snapshot('after reset, LMS chosen')]
    await jump(90)
    j5b.push(await snapshot('at +90 (outside from LMS)'))
    await slow(60, 5, j5b, 2)
    journeys.J5b_changePositionRepeat_lms = j5b
    await page.locator('[data-skip-acquisition]').click()
    await page.waitForTimeout(600)
    journeys.J7_skip = {
      evidenceIdentity: await page
        .locator('[data-evidence-identity]')
        .getAttribute('data-evidence-identity'),
      text: await page.locator('[data-evidence-identity]').textContent(),
    }
    report.lesson12 = journeys
  }
  // --- J6: demonstration then real attempt ---
  {
    await openLesson('station-seven', 'demonstration')
    await page.waitForTimeout(5000)
    const f = workbench()
    const demoRoll = f.getByRole('slider', { name: 'Scope rotation' })
    const j6: Record<string, unknown> = { demoSliderCount: await demoRoll.count() }
    if (await demoRoll.count()) {
      for (const v of [60, 30, 0, -30]) {
        await demoRoll.evaluate(setRange, v)
        await page.waitForTimeout(400)
      }
      await f.getByRole('button', { name: 'Demonstrate rotation' }).click()
      await page.waitForTimeout(800)
    }
    const demoObs = await latest()
    j6.demoLastObservation = demoObs
      ? {
          ready: demoObs.ready,
          actionCount: demoObs.actionCount,
          roll: demoObs.roll,
          sweeps: demoObs.linked?.sweeps,
        }
      : null
    j6.demoSweepPanelPresent = await f.locator('.linked-sweep').count()
    for (
      let i = 0;
      i < 4 && (await page.locator('[data-evidence-identity="live"]').count()) === 0;
      i++
    ) {
      await primary().click()
      await page.waitForTimeout(400)
    }
    const real = await waitLinkedReady()
    j6.firstRealObservation = {
      actionCount: real.actionCount,
      roll: real.roll,
      sweeps: real.linked?.sweeps,
      scanned: real.linked?.scannedApproaches,
      session: real.acquisitionSession,
      demoSession: demoObs?.acquisitionSession,
    }
    report.J6_demoThenReal = j6
  }
  // --- Lesson 19: route model arrows and labels (L19-1) ---
  {
    await openLesson('eus-b-route-model', 'live')
    await page.waitForTimeout(6000)
    const f = workbench()
    const l19: Record<string, unknown> = {}
    l19.caption = await f.locator('.model-image .model-caption').allTextContents()
    l19.viewport = await f.locator('.model-viewport').boundingBox()
    const capture = async (name: string) => {
      await page.waitForTimeout(900)
      await frameScreenshot(f, '.model-viewport', name)
      return {
        arrowPx: await f.locator('.model-viewport').getAttribute('data-arrow-px'),
        labels: await f
          .locator('.model-viewport .linked-structure-letter:not([hidden]) .linked-structure-name')
          .allTextContents(),
      }
    }
    l19['4L:airway'] = await capture('lesson19-4L-airway')
    await f.getByLabel('Target / region').selectOption('7')
    l19['7:airway'] = await capture('lesson19-7-airway')
    await f.getByLabel('Approach').selectOption('esophagus')
    l19['7:esophagus'] = await capture('lesson19-7-esophagus')
    await f.getByLabel('Target / region').selectOption('4L')
    l19['4L:esophagus'] = await capture('lesson19-4L-esophagus')
    l19.wheel = await wheelTest(f, '.model-viewport canvas')
    l19.observerCaption = await f
      .locator('[data-observer-caption]')
      .textContent()
      .catch(() => null)
    report.lesson19 = l19
  }
  report.pageErrors = errors
  report.finishedAt = new Date().toISOString()
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log('written ' + resolve(out, 'report.json'))
  await browser.close()
}
main().catch(async (e) => {
  console.error(e)
  await writeFile(
    resolve(out, 'report.partial.json'),
    JSON.stringify({ ...report, error: String(e) }, null, 2),
  ).catch(() => undefined)
  process.exit(1)
})
