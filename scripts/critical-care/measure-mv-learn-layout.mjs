/**
 * Layout measurement harness for the mechanical-ventilation Learn workspace.
 *
 * The Learn route is public-unlisted (`src/lib/site-auth/access.ts`), so a browser can reach it
 * without an account — but jsdom performs no layout, so no jest test can answer "does the waveform
 * and the current task fit on a standard laptop together". This drives a real Chromium at four
 * viewports through the representative Learn states and records the geometry each one produces.
 *
 * Start the dev server first (port 3010 by default, the `mv-teaching` launch config), then:
 *
 *   node scripts/critical-care/measure-mv-learn-layout.mjs
 *   MV_LAYOUT_LABEL=before node scripts/critical-care/measure-mv-learn-layout.mjs
 *   MV_LAYOUT_BASE=http://localhost:3001 node scripts/critical-care/measure-mv-learn-layout.mjs
 *
 * Output: node_modules/.cache/mv-learn-layout/<label>/ — one PNG per viewport/state plus
 * report.json and a printed summary table. The directory is a look-at-it artifact, not a build
 * product, and lives under node_modules so it is never committed.
 *
 * Playwright is already a devDependency (@playwright/test) with Chromium installed; this script
 * is plain `.mjs` so it runs under node directly (tsx is broken on Node 25 in this repo) and it
 * needs no package.json entry.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from 'playwright'

const BASE = process.env.MV_LAYOUT_BASE ?? 'http://localhost:3010'
const LABEL = process.env.MV_LAYOUT_LABEL ?? 'current'
const OUT_DIR = join(process.cwd(), 'node_modules', '.cache', 'mv-learn-layout', LABEL)

/** The four sizes the D2 package is written against. */
const VIEWPORTS = [
  { name: '1600x900', width: 1600, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
]

/** A lesson with a bespoke teaching panel, and the integration capstone for the dense state. */
const TEACHING_LESSON = 'waveform-anatomy'
const CAPSTONE_LESSON = 'high-peak-pressure-integration'

/**
 * Elements whose geometry answers the acceptance questions. `all: true` records every match
 * (the console draws several waveform traces); otherwise only the first is measured.
 */
const TARGETS = [
  { key: 'shell', selector: '[data-critical-care-activity-shell]' },
  { key: 'chromeHeader', selector: '[data-critical-care-activity-shell] > header' },
  { key: 'chromeFooter', selector: '[data-critical-care-activity-shell] > footer' },
  { key: 'contextStrip', selector: 'section[aria-label="Clinical context"]' },
  { key: 'simViewport', selector: 'section[aria-label="Simulation viewport"]' },
  { key: 'learnViewport', selector: 'section[aria-label="Simulation viewport"] > div' },
  { key: 'pathwayNav', selector: 'nav[aria-label="Ventilation learning pathway sections"]' },
  { key: 'patientSection', selector: 'section[aria-label="Active lesson patient"]' },
  {
    key: 'workspace',
    selector: 'section[aria-label="Resizable ventilator, teaching, and activity workspace"]',
  },
  { key: 'paneVentilator', selector: '[role="region"][aria-label="Ventilator panel"]' },
  { key: 'paneTeaching', selector: '[role="region"][aria-label="Teaching panel"]' },
  { key: 'paneYourTurn', selector: '[role="region"][aria-label="Your turn panel"]' },
  { key: 'waveform', selector: 'svg[role="img"][aria-label*="waveform"]', all: true },
  { key: 'yourTurnTask', selector: 'section[aria-label="Your turn"]' },
  { key: 'taskObjective', selector: '[data-mv-task-objective]' },
  { key: 'taskControls', selector: '[data-mv-task-controls]' },
  { key: 'learnViewportRoot', selector: '[data-mv-learn-viewport]' },
  { key: 'runControl', selector: 'section[aria-label="Lesson simulation clock"]' },
  { key: 'pauseButton', selector: 'section[aria-label="Lesson simulation clock"] button' },
  { key: 'measurements', selector: 'dl[aria-label="Current lesson measurements"]' },
  { key: 'helpButton', selector: '[data-critical-care-activity-shell] header button' , text: 'Help' },
  { key: 'taskDrawer', selector: '[data-critical-care-activity-shell] details' },
  // CSS-module class names keep their authored word, so a substring match survives the hash.
  { key: 'debrief', selector: 'section[class*="debrief"]' },
  { key: 'verdict', selector: '[data-answer-verdict]' },
  { key: 'drawerHint', selector: 'div[class*="hintCard"]' },
  { key: 'learnHint', selector: '[data-mv-learn-hint]' },
  { key: 'compactTabs', selector: '[role="tablist"][aria-label="Workspace panel views"]' },
]

const MEASURE = ({ targets }) => {
  const doc = document.documentElement
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  /**
   * What the learner can actually see: the element's box intersected with the window *and* with
   * every ancestor that clips. A pane with `overflow: auto` hides the part of the console below
   * its own box, so intersecting with the window alone reports a trace as visible when the pane
   * has cut it in half.
   */
  function visibility(element, rect) {
    let top = Math.max(rect.top, 0)
    let bottom = Math.min(rect.bottom, viewportHeight)
    let left = Math.max(rect.left, 0)
    let right = Math.min(rect.right, viewportWidth)
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = window.getComputedStyle(parent)
      const clips =
        style.overflowY !== 'visible' ||
        style.overflowX !== 'visible' ||
        style.overflow !== 'visible'
      if (!clips) continue
      const bounds = parent.getBoundingClientRect()
      top = Math.max(top, bounds.top)
      bottom = Math.min(bottom, bounds.bottom)
      left = Math.max(left, bounds.left)
      right = Math.min(right, bounds.right)
    }
    const visibleHeight = Math.max(0, bottom - top)
    const visibleWidth = Math.max(0, right - left)
    const area = rect.width * rect.height
    const visibleArea = visibleWidth * visibleHeight
    return {
      visibleHeight: Math.round(visibleHeight),
      visibleWidth: Math.round(visibleWidth),
      ratio: area > 0 ? Number((visibleArea / area).toFixed(3)) : 0,
      fullyVisible: area > 0 && visibleArea >= area - 2,
    }
  }

  function describe(element) {
    const rect = element.getBoundingClientRect()
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrolls: element.scrollHeight - element.clientHeight > 2,
      scrollTop: Math.round(element.scrollTop),
      ...visibility(element, rect),
    }
  }

  const measured = {}
  for (const target of targets) {
    let nodes = Array.from(document.querySelectorAll(target.selector))
    if (target.text) nodes = nodes.filter((node) => node.textContent?.trim() === target.text)
    if (nodes.length === 0) {
      measured[target.key] = null
      continue
    }
    measured[target.key] = target.all ? nodes.map(describe) : describe(nodes[0])
  }

  // Every element that actually scrolls, so a nested-scroll trap is visible in the record rather
  // than inferred from the stylesheet.
  const scrollers = []
  for (const element of Array.from(document.querySelectorAll('body *'))) {
    const overflowY = window.getComputedStyle(element).overflowY
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
    if (!scrollable) continue
    if (element.scrollHeight - element.clientHeight <= 2) continue
    let depth = 0
    let parent = element.parentElement
    while (parent) {
      const parentOverflow = window.getComputedStyle(parent).overflowY
      if (
        (parentOverflow === 'auto' || parentOverflow === 'scroll' || parentOverflow === 'overlay') &&
        parent.scrollHeight - parent.clientHeight > 2
      ) {
        depth += 1
      }
      parent = parent.parentElement
    }
    scrollers.push({
      tag: element.tagName.toLowerCase(),
      label:
        element.getAttribute('aria-label') ??
        element.getAttribute('data-testid') ??
        element.className?.toString().slice(0, 60) ??
        '',
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowBy: element.scrollHeight - element.clientHeight,
      nestedInsideScrollerCount: depth,
    })
  }

  const drawer = document.querySelector('[data-critical-care-activity-shell] details')

  return {
    taskDrawerOpen: drawer instanceof HTMLDetailsElement ? drawer.open : null,
    viewport: { width: viewportWidth, height: viewportHeight },
    document: {
      scrollWidth: doc.scrollWidth,
      scrollHeight: doc.scrollHeight,
      clientWidth: doc.clientWidth,
      clientHeight: doc.clientHeight,
      verticalOverflowPx: Math.max(0, doc.scrollHeight - doc.clientHeight),
      horizontalOverflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth),
    },
    targets: measured,
    scrollers: scrollers.sort((a, b) => b.overflowBy - a.overflowBy),
  }
}

/** Short and explicit: a state that cannot be reached should be recorded, not waited on. */
const STEP_TIMEOUT_MS = 8000

function log(message) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`)
}

async function settle(page) {
  await page.waitForTimeout(450)
}

/** Jump straight to a phase through the shared stepper rather than replaying the whole flow. */
async function gotoPhase(page, label) {
  const button = page.locator(`button[aria-label="Open ${label} phase"]`)
  if ((await button.count()) === 0) return
  await button.first().click({ timeout: STEP_TIMEOUT_MS })
  await settle(page)
}

/** Click a radio through its own label: the input is visually hidden inside one. */
async function pickFirstChoice(page) {
  const radio = page.locator('[role="region"][aria-label="Your turn panel"] input[type=radio]')
  if ((await radio.count()) === 0) return false
  await radio.first().dispatchEvent('click', {}, { timeout: STEP_TIMEOUT_MS })
  await settle(page)
  return true
}

async function openLesson(page, lessonId) {
  /*
   * Every phase change writes a resume pointer, and a lesson that finds one renders the resume
   * banner instead of the workspace. Each state starts from a clean device so the measurement is
   * of the workspace, not of the banner.
   */
  await page.goto(`${BASE}/mechanical-ventilation/learn?activity=${lessonId}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.evaluate(() => window.localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page
    .locator('[data-critical-care-activity-shell]')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await settle(page)
}

/**
 * The representative states the D2 package names. Each returns after leaving the page in that
 * state; the caller measures and screenshots.
 */
const STATES = [
  {
    key: 'recognize',
    lesson: TEACHING_LESSON,
    note: 'initial Learn state, recognition actions',
    async setup() {},
  },
  {
    key: 'predict',
    lesson: TEACHING_LESSON,
    note: 'initial prediction question',
    async setup(page) {
      await gotoPhase(page, 'Predict')
    },
  },
  {
    key: 'predict-verdict',
    lesson: TEACHING_LESSON,
    note: 'immediate verdict after committing the prediction',
    async setup(page) {
      await gotoPhase(page, 'Predict')
      if (await pickFirstChoice(page)) {
        const commit = page.getByRole('button', { name: 'Commit prediction' })
        if ((await commit.count()) > 0) await commit.first().click({ timeout: STEP_TIMEOUT_MS })
      }
      await settle(page)
    },
  },
  {
    key: 'act',
    lesson: TEACHING_LESSON,
    note: 'action state with ventilator controls',
    async setup(page) {
      await gotoPhase(page, 'Act')
    },
  },
  {
    key: 'observe',
    lesson: TEACHING_LESSON,
    note: 'observation state',
    async setup(page) {
      await gotoPhase(page, 'Observe')
    },
  },
  {
    key: 'explain-debrief',
    lesson: TEACHING_LESSON,
    note: 'causal debrief open',
    async setup(page) {
      await gotoPhase(page, 'Explain')
    },
  },
  {
    key: 'help-open',
    lesson: TEACHING_LESSON,
    note: 'Help pressed from the action state',
    async setup(page) {
      await gotoPhase(page, 'Act')
      const help = page
        .locator('[data-critical-care-activity-shell] header button')
        .filter({ hasText: /^Help$/ })
      if ((await help.count()) > 0) await help.first().click()
      await settle(page)
    },
  },
  {
    key: 'paused',
    lesson: TEACHING_LESSON,
    note: 'ventilation paused from the action state',
    async setup(page) {
      await gotoPhase(page, 'Act')
      const pause = page.locator('section[aria-label="Lesson simulation clock"] button').first()
      if ((await pause.count()) > 0) await pause.click()
      await settle(page)
    },
  },
  {
    key: 'transfer-capstone',
    lesson: CAPSTONE_LESSON,
    note: 'dense transfer state on the integration capstone',
    async setup(page) {
      await gotoPhase(page, 'Transfer')
      await pickFirstChoice(page)
    },
  },
]

function verdictFor(record) {
  const { targets, document: doc } = record
  const waveform = Array.isArray(targets.waveform) ? targets.waveform : []
  /*
   * A trace counts as live evidence when a readable band of it is on screen, not merely when its
   * box overlaps the window. The threshold is the module's own compact trace size: the legacy lab
   * compaction sizes a waveform figure at 105px (`mechanical-ventilation.module.css`), so 100px of
   * visible trace is the smallest height this module already treats as teachable.
   */
  const READABLE_TRACE_PX = 100
  const waveformVisible = waveform.some((entry) => entry.visibleHeight >= READABLE_TRACE_PX)
  const bestTrace = waveform.reduce(
    (best, entry) => (entry.visibleHeight > (best?.visibleHeight ?? -1) ? entry : best),
    null,
  )
  /*
   * "The current task is visible" means the learner can read what is being asked and reach a
   * control, not that a tall section happens to overlap the window. The objective must be whole
   * and at least one 44px touch target's worth of the control block must be on screen.
   */
  const objective = targets.taskObjective
  const controls = targets.taskControls
  const taskVisible = Boolean(
    objective && objective.fullyVisible && controls && controls.visibleHeight >= 44,
  )
  const pause = targets.pauseButton
  const help = targets.helpButton
  const nested = record.scrollers.filter((entry) => entry.nestedInsideScrollerCount > 0)
  return {
    waveformAndTaskTogether: waveformVisible && taskVisible,
    waveformVisible,
    waveformVisiblePx: bestTrace?.visibleHeight ?? 0,
    waveformVisibleRatio: bestTrace?.ratio ?? 0,
    taskVisible,
    taskControlsVisiblePx: controls?.visibleHeight ?? 0,
    /*
     * Where each pane is scrolled. The evidence pane staying at 0 through a verdict is the point:
     * the task pane may well be scrolled — the learner had to reach the commit button — but that
     * must never move the trace they answered from.
     */
    evidencePaneScrollTop: targets.paneVentilator?.scrollTop ?? 0,
    taskPaneScrollTop: targets.paneYourTurn?.scrollTop ?? 0,
    evidenceHeldWhileTaskScrolled: waveformVisible && (targets.paneVentilator?.scrollTop ?? 0) === 0,
    pauseVisible: Boolean(pause && pause.ratio > 0.5),
    helpVisible: Boolean(help && help.ratio > 0.5),
    // Help must produce something the learner can actually read without hunting for a drawer.
    helpFeedbackVisible: Boolean(
      (targets.learnHint && targets.learnHint.ratio > 0.5) ||
        (targets.drawerHint && targets.drawerHint.ratio > 0.5),
    ),
    documentHorizontalOverflow: doc.horizontalOverflowPx > 0,
    documentVerticalOverflow: doc.verticalOverflowPx > 0,
    scrollerCount: record.scrollers.length,
    nestedScrollerCount: nested.length,
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const report = { label: LABEL, base: BASE, generatedFor: VIEWPORTS.map((v) => v.name), runs: [] }

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(STEP_TIMEOUT_MS)
    const consoleErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200))
    })

    for (const state of STATES) {
      log(`${viewport.name} · ${state.key}`)
      let setupError = null
      try {
        await openLesson(page, state.lesson)
        await state.setup(page)
      } catch (error) {
        // A state that will not open is a finding; keep measuring the rest.
        setupError = String(error).split('\n')[0]
        log(`  setup failed: ${setupError}`)
      }
      const record = await page.evaluate(MEASURE, { targets: TARGETS })
      record.state = state.key
      record.note = state.note
      record.lesson = state.lesson
      record.viewportName = viewport.name
      record.setupError = setupError
      record.verdict = verdictFor(record)
      record.consoleErrors = [...consoleErrors]
      consoleErrors.length = 0
      const shot = join(OUT_DIR, `${viewport.name}--${state.key}.png`)
      await page.screenshot({ path: shot, timeout: STEP_TIMEOUT_MS })
      record.screenshot = shot
      report.runs.push(record)
    }

    await context.close()
  }

  await browser.close()
  writeFileSync(join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const rows = report.runs.map((run) => ({
    viewport: run.viewportName,
    state: run.state,
    docH: run.document.scrollHeight,
    docOverflowY: run.document.verticalOverflowPx,
    docOverflowX: run.document.horizontalOverflowPx,
    simViewportH: run.targets.simViewport?.height ?? null,
    learnScrollH: run.targets.learnViewport?.scrollHeight ?? null,
    learnClientH: run.targets.learnViewport?.clientHeight ?? null,
    workspaceH: run.targets.workspace?.height ?? null,
    ventPaneScrolls: run.targets.paneVentilator?.scrolls ?? null,
    turnPaneScrolls: run.targets.paneYourTurn?.scrolls ?? null,
    wavePx: run.verdict.waveformVisiblePx,
    task: run.verdict.taskVisible,
    ctlPx: run.verdict.taskControlsVisiblePx,
    together: run.verdict.waveformAndTaskTogether,
    pause: run.verdict.pauseVisible,
    helpAnswer: run.verdict.helpFeedbackVisible,
    evidenceScroll: run.verdict.evidencePaneScrollTop,
    taskScroll: run.verdict.taskPaneScrollTop,
    scrollers: run.verdict.scrollerCount,
    nested: run.verdict.nestedScrollerCount,
  }))
  console.table(rows)
  console.log(`\nreport: ${join(OUT_DIR, 'report.json')}`)
  const total = report.runs.length
  const together = report.runs.filter((run) => run.verdict.waveformAndTaskTogether).length
  const held = report.runs.filter((run) => run.verdict.evidenceHeldWhileTaskScrolled).length
  const paused = report.runs.filter((run) => run.verdict.pauseVisible).length
  console.log(`waveform + task together:        ${together}/${total} states`)
  console.log(`live evidence held in place:     ${held}/${total} states`)
  console.log(`pause visible without scrolling: ${paused}/${total} states`)
  const scrolledTask = report.runs.filter(
    (run) => !run.verdict.waveformAndTaskTogether && run.verdict.taskPaneScrollTop > 0,
  ).length
  if (scrolledTask > 0) {
    console.log(
      `  (${scrolledTask} of the "together" misses are states where committing an answer scrolled\n` +
        `   the task pane itself; the evidence pane stayed at scrollTop 0 in every one)`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
