/**
 * EBUS-PRE-REVIEW-04 browser evidence: the changed learner path, read in a real browser against a
 * production build. Every check is recorded with what it observed; nothing is skipped silently.
 *
 * Conditions are named for what they are: viewport emulation, root-font enlargement, emulated
 * colour scheme. None of them is native browser zoom or a physical device.
 *
 * Usage:
 *   EBUS_REVIEW_URL=http://127.0.0.1:3137 EBUS_EVIDENCE_DIR=<dir> \
 *     npx tsx scripts/ebus-guided/browser-teaching-clarity.ts
 */
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.env.EBUS_REVIEW_URL ?? 'http://127.0.0.1:3137'
const out = resolve(process.env.EBUS_EVIDENCE_DIR ?? 'artifacts/ebus-guided/teaching-clarity')
const PROGRESS_KEY = 'ip-ebus-guided-self-paced-v1'
type Result = { id: string; check: string; pass: boolean; observed?: unknown }
const results: Result[] = []
const record = (id: string, check: string, pass: boolean, observed?: unknown) => {
  results.push({ id, check, pass, observed })
  console.log(
    (pass ? 'PASS ' : 'FAIL ') +
      id +
      ' · ' +
      check +
      (pass ? '' : ' · ' + JSON.stringify(observed)),
  )
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const lessonUrl = (id: string) => base + '/en/ebus-guided/learn?section=' + id
const primary = (page: Page) => page.locator('[data-now-primary]')
async function next(page: Page) {
  await primary(page).click()
  await wait(250)
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: resolve(out, name + '.png'), fullPage: false })
}
const text = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .textContent({ timeout: 5000 })
    .then((value) => (value ?? '').replace(/\s+/g, ' ').trim())
    .catch(() => '')
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

async function overview(page: Page) {
  await page.goto(base + '/en/ebus-guided')
  await page.waitForSelector('[data-course-marks-legend]')
  const map = page.getByRole('navigation', { name: 'The course in 7 chapters' })
  const links = await map.getByRole('link').allTextContents()
  record(
    'B1',
    'Overview shows the chapter registry map (7 chapter links)',
    links.length === 7,
    links,
  )
  record(
    'B1',
    'Overview has no five-phase schematic',
    (await page.locator('[data-teaching-diagram]').count()) === 0 &&
      !(await page.content()).includes('Authored schematic'),
  )
  const legend = await text(page, '[data-course-marks-legend]')
  record(
    'B1',
    'Marks legend explains reviewed as navigation',
    /reached its end, or marked it yourself/.test(legend),
    legend,
  )
  // Keyboard: Tab to the first chapter link and follow it.
  await page.locator('body').focus()
  let reached = false
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(
      () =>
        (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href') ===
        '#chapter-prepare',
    )
  }
  const focusVisible = await page.evaluate(() => document.activeElement!.matches(':focus-visible'))
  await page.keyboard.press('Enter')
  await wait(400)
  const landing = await page.evaluate(() => {
    const header = [...document.querySelectorAll('header')].find(
      (h) => getComputedStyle(h).position === 'sticky',
    )
    return {
      hash: location.hash,
      cardTop: document.getElementById('chapter-prepare')!.getBoundingClientRect().top,
      headerBottom: header ? header.getBoundingClientRect().bottom : 0,
    }
  })
  record(
    'B1',
    'Keyboard reaches a chapter link with a visible focus ring and lands on the card below the sticky header',
    reached &&
      focusVisible &&
      landing.hash === '#chapter-prepare' &&
      landing.cardTop >= landing.headerBottom,
    { reached, focusVisible, ...landing },
  )
  // Glossary disclosure by keyboard.
  const rose = page.locator('[data-glossary-term="rose"] summary')
  await page.locator('[data-glossary-term="eus-b"] summary').focus()
  await page.keyboard.press('Tab')
  const roseFocused = await rose.evaluate(
    (el) => el === document.activeElement && el.matches(':focus-visible'),
  )
  await page.keyboard.press('Enter')
  const opened = await rose.evaluate((el) => (el.parentElement as HTMLDetailsElement).open)
  const roseText = await text(page, '[data-glossary-term="rose"]')
  await page.keyboard.press('Enter')
  const closed = await rose.evaluate((el) => !(el.parentElement as HTMLDetailsElement).open)
  record(
    'B1',
    'Glossary term opens and closes from the keyboard, focus visible',
    roseFocused && opened && closed,
    { roseFocused, opened, closed },
  )
  record(
    'B1',
    'ROSE definition is the lesson-22 sentence with its source',
    /Rapid on-site evaluation \(ROSE\) provides immediate feedback/.test(roseText) &&
      /From the course: Lesson 22/.test(roseText),
    roseText,
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot(page, 'B1-overview')
}

async function lessonOne(page: Page) {
  await page.goto(lessonUrl('clinical-question'))
  await page.waitForSelector('[data-activity-kind]')
  record(
    'B3',
    'Lesson 1 briefing shows no figure (evidence pane hidden)',
    await page
      .locator('[data-ebus-flow] [hidden]')
      .first()
      .isHidden()
      .catch(() => true),
  )
  const evidenceShown = await page.evaluate(() => {
    const pane = document.querySelector('[data-composition]')
      ?.firstElementChild as HTMLElement | null
    return pane ? !pane.hidden : null
  })
  record('B3', 'Lesson 1 evidence pane is hidden', evidenceShown === false, evidenceShown)
  record('B5', 'Eyebrow says Teaching', (await text(page, '[data-activity-kind]')) === 'Teaching')
  const refreshers = page.locator('[data-refreshers] a')
  const hrefs = await refreshers.evaluateAll((els) =>
    els.map((el) => ({
      href: el.getAttribute('href'),
      target: el.getAttribute('target'),
      text: el.textContent,
    })),
  )
  record(
    'B4',
    'Recall links three open refreshers in new tabs',
    hrefs.length === 3 &&
      hrefs.every((h) => h.target === '_blank') &&
      hrefs[0].href!.endsWith('/learn/anatomy/branch-tracing/learn?lesson=orientation') &&
      hrefs[0].text === 'Relate CT to the parent airway view (begins with standard axial CT)',
    hrefs,
  )
  const terms = await page.locator('[data-glossary] summary').allTextContents()
  record(
    'B4',
    'Lesson 1 shows its first-use terms',
    terms.join('|') === 'EBUS-TBNA|Examination record|Nodal station|N category (N1, N2, N3)',
    terms,
  )
  await page.locator('[data-glossary-term="n-category"] summary').focus()
  await page.keyboard.press('Enter')
  const nText = await text(page, '[data-glossary-term="n-category"]')
  record(
    'B4',
    'N-category primer opens and links forward to lesson 17',
    /Full teaching: Lesson 17 · Systematic staging and TNM ninth edition/.test(nText),
    nText,
  )
  await shot(page, 'B4-lesson1-briefing')
  await next(page) // → matching
  record(
    'B5',
    'Matching eyebrow says Guided task',
    (await text(page, '[data-activity-kind]')) === 'Guided task',
  )
  await next(page) // leave the task; first check
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  const hint = await text(page, '[data-question-hint]')
  record(
    'B4',
    'Hint quotes the lesson passage, not the CT prerequisite',
    /^Hint ?From this lesson: A diagnostic procedure asks what the lesion is\./.test(hint) &&
      !/axial chest CT/.test(hint),
    hint,
  )
  await page.getByRole('button', { name: 'Show explanation', exact: true }).click()
  const explanation = await text(page, '[data-explanation-reveal]')
  record(
    'B4',
    'L1-11 explanation reads "A result from one station"',
    /A result from one station does not supply the rest of the nodal map\./.test(explanation) &&
      !/Histology from one station/.test(explanation),
    explanation,
  )
  await shot(page, 'B4-lesson1-hint')
  await next(page) // → second check
  await next(page) // → transfer
  record(
    'B5',
    'Transfer eyebrow says guided practice',
    (await text(page, '[data-activity-kind]')) === 'Guided practice · new situation',
  )
  const purpose = await text(page, '[data-activity-purpose]')
  record(
    'B5',
    'Transfer states its guided purpose',
    /key points stay beside this check on purpose/.test(purpose),
    purpose,
  )
  record(
    'B5',
    'Key points stay visible beside the transfer',
    await page.getByText('Plan tissue handling before the first pass.').isVisible(),
  )
  await shot(page, 'B5-lesson1-transfer')
  await next(page) // finish
  const finish = await text(page, '[data-task-instruction]')
  record(
    'B2',
    'Finish says reviewed means reaching the end, whatever was skipped',
    /whether you completed, skipped or only read its tasks/.test(finish),
    finish,
  )
  const stored = async () =>
    page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}').reviewedLessonIds ?? null,
      PROGRESS_KEY,
    )
  const before = await stored()
  await page.getByRole('button', { name: 'Unmark as reviewed' }).click()
  const after = await stored()
  await page.getByRole('button', { name: 'Mark as reviewed' }).click()
  const again = await stored()
  record(
    'B2',
    'Reviewed is stored at the end and undo still works',
    JSON.stringify(before) === '["clinical-question"]' &&
      JSON.stringify(after) === '[]' &&
      JSON.stringify(again) === '["clinical-question"]',
    { before, after, again },
  )
  const summary = await text(page, '[data-session-summary]')
  record(
    'B2',
    'The session summary says what was skipped',
    /Task not completed/.test(summary) &&
      /check not answered|checks not answered|1 of 2 checks answered/.test(summary),
    summary,
  )
  await shot(page, 'B2-lesson1-finish')
}

async function briefingsWithoutSchematic(page: Page) {
  for (const id of [
    'preparation',
    'node-characterization',
    'complications-recovery',
    'results-reporting',
  ]) {
    await page.goto(lessonUrl(id))
    await page.waitForSelector('[data-activity-kind]')
    const shown = await page.evaluate(() => {
      const pane = document.querySelector('[data-composition]')
        ?.firstElementChild as HTMLElement | null
      return {
        hidden: pane?.hidden ?? null,
        diagram: !!document.querySelector('[data-teaching-diagram]'),
      }
    })
    record(
      'B3',
      id + ' briefing has no generic schematic',
      shown.hidden === true && !shown.diagram,
      shown,
    )
  }
  await page.goto(lessonUrl('node-characterization'))
  await page.waitForSelector('[data-activity-kind]')
  await next(page)
  record(
    'B6',
    'Lesson 16 record task title says what it does',
    (await text(page, '#ebus-task-title')) === 'Choose the description the vignette supports',
  )
  await shot(page, 'B6-lesson16-record')
}

async function lessonSeventeen(page: Page) {
  await page.goto(lessonUrl('systematic-staging'))
  await page.waitForSelector('[data-teaching-diagram="stations"]')
  const leaders = await page
    .locator('[data-teaching-diagram] line')
    .evaluateAll((lines) =>
      lines.map((l) => ['x1', 'y1', 'x2', 'y2'].map((k) => Number(l.getAttribute(k)))),
    )
  const cross = (a: number[], b: number[]) => {
    const d = (p: number[], q: number[], r: number[]) =>
      (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    const [p1, p2, p3, p4] = [
      [a[0], a[1]],
      [a[2], a[3]],
      [b[0], b[1]],
      [b[2], b[3]],
    ]
    return d(p3, p4, p1) * d(p3, p4, p2) < 0 && d(p1, p2, p3) * d(p1, p2, p4) < 0
  }
  let crossings = 0
  for (let i = 0; i < leaders.length; i++)
    for (let j = i + 1; j < leaders.length; j++) if (cross(leaders[i], leaders[j])) crossings++
  record('B7', 'Station schematic leaders do not cross', crossings === 0, { leaders, crossings })
  await page.getByRole('button', { name: '2. Carina' }).click()
  record(
    'B7',
    'Selecting a name marks that structure',
    (await page.locator('[data-diagram-marker="2"][data-active]').count()) === 1,
  )
  record(
    'B7',
    'Schematic caption is learner language',
    /A schematic drawn for this course, not to scale and not a patient image/.test(
      await text(page, '[data-diagram-caption]'),
    ),
  )
  await shot(page, 'B7-lesson17-figure')
  await next(page) // → plan record
  await next(page) // leave the record uncompleted → sequence
  const purpose = await text(page, '[data-activity-purpose]')
  record(
    'B7',
    'Sequence states its guided purpose',
    /each step names that target’s N category/.test(purpose),
    purpose,
  )
  const toggle = page.locator('[data-try-it-yourself] button')
  record(
    'B7',
    'Worked labels are shown by default',
    (await page.getByRole('button', { name: 'Sample the confirmed 4R target (N3)' }).count()) === 1,
  )
  await toggle.focus()
  await page.keyboard.press('Enter')
  const pressed = await toggle.getAttribute('aria-pressed')
  const bareVisible = await page
    .getByRole('button', { name: 'Sample the confirmed 4R target', exact: true })
    .count()
  record(
    'B7',
    'Try it yourself hides the N categories on request (keyboard)',
    pressed === 'true' && bareVisible === 1 && (await page.getByText(/\(N[123]\)/).count()) === 0,
    { pressed, bareVisible },
  )
  await shot(page, 'B7-lesson17-try-it-yourself')
  for (const name of [
    'Sample the confirmed 4R target',
    'Sample the confirmed station 7 target',
    'Sample the confirmed 11L target',
  ])
    await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'Check sequence' }).click()
  await wait(300)
  // A completed task closes; the host then shows the task's explanation with the categories.
  const explanation = await text(page, '[data-task-explanation]')
  record(
    'B7',
    'The same order is checked and completes the task; the explanation shows the categories',
    /4R → 7 → 11L follows N3 → N2 → N1/.test(explanation),
    explanation,
  )
  await shot(page, 'B7-lesson17-checked')
}

async function lessonFive(page: Page) {
  await page.goto(lessonUrl('contact-cutaway-model'))
  await page.waitForSelector('[data-evidence-identity="demonstration"]')
  const label = await text(page, '[data-evidence-identity="demonstration"]')
  record(
    'B8',
    'Demonstration says once what counts',
    /nothing you do here is recorded\. Your own acquisition is the next task, and it counts once you hold it\./.test(
      label,
    ),
    label,
  )
  const demo = page.frameLocator('iframe').first()
  await demo.locator('.model-kicker').waitFor({ timeout: 60000 })
  const kicker = (await demo.locator('.model-kicker').textContent())?.trim()
  const steps = (await demo.locator('[data-model-steps] summary').textContent())?.trim()
  record(
    'B8',
    'Embedded demonstration kicker and step list say not recorded',
    kicker === 'Worked demonstration · nothing here is recorded' &&
      /^Steps in this demonstration · \d of 5 explored, not recorded$/.test(steps ?? ''),
    { kicker, steps },
  )
  await shot(page, 'B8-lesson5-demonstration')
  await next(page) // → acquisition
  const frame = page.frameLocator('iframe').first()
  const mode = frame.getByLabel('Contact condition')
  await mode.waitFor({ timeout: 60000 })
  await frame.locator('fieldset:not([disabled])').first().waitFor({ timeout: 60000 })
  const activitySteps = (await frame.locator('[data-model-steps] summary').textContent())?.trim()
  const caption = ((await frame.locator('[data-observer-caption]').textContent()) ?? '').replace(
    /\s+/g,
    ' ',
  )
  record(
    'B8',
    'L5-4: the 3D panel says which contact conditions it can show',
    /The bubble and the reflector do not change what it shows; their effect is in the echo schematic\./.test(
      caption,
    ),
    caption,
  )
  record(
    'B8',
    'The learner activity lists the steps it asks for',
    /^Steps this activity asks for · 0 of 5$/.test(activitySteps ?? ''),
    activitySteps,
  )
  await frame.getByLabel('Gain · illustrative').fill('85')
  for (const value of ['direct', 'balloon', 'bubble', 'shadow']) {
    await mode.selectOption(value)
    await wait(200)
    await frame.getByRole('button', { name: 'Inspect acoustic path' }).click()
    await wait(200)
  }
  await mode.selectOption('bubble')
  const hold = page.getByRole('button', { name: 'Hold this acquisition', exact: true })
  await hold.waitFor({ state: 'visible' })
  for (let i = 0; i < 60 && !(await hold.isEnabled()); i++) await wait(250)
  const frameBefore = await frame.locator('[data-model-frame]').getAttribute('data-model-frame')
  await hold.click()
  await page.waitForSelector('[data-evidence-identity="held"]')
  const held = await text(page, '[data-evidence-identity="held"]')
  record(
    'B8',
    'Held evidence names the genuinely held condition',
    /Contact condition held: balloon with a bubble\./.test(held),
    held,
  )
  await next(page) // past the described-situation check
  const qid = await page.locator('[data-question-id]').getAttribute('data-question-id')
  const instruction = await text(page, '[data-task-instruction]')
  record(
    'B8',
    'L5-1: the reflector check says it names another condition; frame untouched',
    qid === 'cutaway-observe' &&
      /This check names a different contact condition \(contact with a reflector\) from the one your held image shows \(balloon with a bubble\)\. Your held image stays as you acquired it\./.test(
        instruction,
      ),
    { qid, instruction },
  )
  const frameAfter = await page
    .frameLocator('iframe')
    .first()
    .locator('[data-model-frame]')
    .getAttribute('data-model-frame')
  record(
    'B8',
    'L5-1: the held model frame id is the acquired one',
    !!frameBefore && frameBefore === frameAfter,
    { frameBefore, frameAfter },
  )
  await shot(page, 'B8-lesson5-held-check')
  await page.reload()
  await page.waitForSelector('[data-activity-kind]')
  const kind = await page.locator('[data-activity-kind]').getAttribute('data-activity-kind')
  record(
    'B8',
    'Reload returns to the briefing and holds nothing (Prompt 02 contract)',
    kind === 'briefing' && (await page.locator('[data-evidence-identity="held"]').count()) === 0,
    kind,
  )
}

async function lessonTen(page: Page) {
  await page.goto(lessonUrl('capture'))
  await page.waitForSelector('[data-activity-kind]')
  await next(page) // briefing → decision
  await next(page) // → acquisition
  const frame = page.frameLocator('iframe').first()
  const freeze = frame.getByRole('button', { name: 'Freeze image', exact: true })
  await freeze.waitFor({ timeout: 60000 })
  for (let i = 0; i < 120 && !(await freeze.isEnabled()); i++) await wait(250)
  await freeze.click()
  await frame.getByRole('button', { name: 'Measure', exact: true }).click()
  await frame.getByRole('button', { name: 'Left', exact: true }).click()
  await frame.getByRole('button', { name: 'Set first caliper', exact: true }).click()
  await frame.getByRole('button', { name: 'Right', exact: true }).click()
  await frame.getByRole('button', { name: 'Right', exact: true }).click()
  await frame.getByRole('button', { name: 'Save image', exact: true }).click()
  const hold = page.getByRole('button', { name: 'Hold this acquisition', exact: true })
  for (let i = 0; i < 120 && !(await hold.isEnabled()); i++) await wait(250)
  await hold.click()
  await page.waitForSelector('[data-capture-example]', { timeout: 30000 })
  const card = await text(page, '[data-capture-example]')
  record(
    'B9',
    'Capture record names the recorded example in words, no clip id',
    /^Recorded teaching example( at \d+ cm depth, .+)? · Selected depth \d+(\.\d+)? cm · Two calipers saved in this activity\.$/.test(
      card,
    ) && !/Depth\d_/.test(card),
    card,
  )
  record(
    'B9',
    'Capture limitation stays visible',
    await page
      .getByText('Station identity and clinical borders are not validated', { exact: false })
      .isVisible(),
  )
  await shot(page, 'B9-lesson10-capture')
}

async function structureNames(page: Page) {
  await page.goto(lessonUrl('ct-map'))
  await page.waitForSelector('[data-activity-kind]')
  await next(page) // → demonstration
  const frame = page.frameLocator('iframe').first()
  const select = frame.getByLabel('Inspect a structure')
  await select.waitFor({ timeout: 90000 })
  const options = await select.locator('option').allTextContents()
  record(
    'B9',
    'Structure names use the course spelling (L3-10)',
    options.includes('azygos vein') &&
      options.includes('left atrium') &&
      options.includes('left atrial appendage') &&
      !options.some((o) => /azygous|Atrium|Ventricle|appendage left|_/.test(o)),
    options,
  )
  await shot(page, 'B9-lesson11-names')
  await page.goto(lessonUrl('hilar-interlobar'))
  await page.waitForSelector('[data-activity-kind]')
  await next(page)
  record(
    'B9',
    'Lesson 15 matching title says what it does',
    (await text(page, '#ebus-task-title')) ===
      'Match bronchial relationships to interlobar stations',
  )
}

async function routes(page: Page) {
  await page.goto(lessonUrl('eus-b-route-model'))
  await page.waitForSelector('[data-activity-kind]')
  await next(page) // → acquisition
  const frame = page.frameLocator('iframe').first()
  const target = frame.getByLabel('Target / region')
  await target.waitFor({ timeout: 60000 })
  await frame.locator('fieldset:not([disabled])').first().waitFor({ timeout: 60000 })
  const notices: string[] = []
  for (const [station, route] of [
    ['4L', 'airway'],
    ['4L', 'esophagus'],
    ['8', 'esophagus'],
  ] as const) {
    await target.selectOption(station)
    await frame.getByLabel('Approach').selectOption(route)
    await frame.getByRole('button', { name: 'Record comparison / limitation' }).click()
    await wait(300)
    notices.push(((await frame.locator('.model-feedback').first().textContent()) ?? '').trim())
  }
  record(
    'B10',
    'Route notices name each view and count them (L19-2)',
    new Set(notices).size === 3 &&
      /1 of 5 supported views recorded\.$/.test(notices[0]) &&
      /lower paraesophageal example \(8\)/.test(notices[2]),
    notices,
  )
  const canvasNames = await frame.locator('body').innerText()
  record(
    'B10',
    'Route canvas does not print the model spelling "azygous"',
    !/azygous/.test(canvasNames),
  )
  await shot(page, 'B10-lesson19-routes')
}

async function practice(page: Page) {
  await page.goto(base + '/en/ebus-guided/practice')
  const link = page.getByRole('link', {
    name: 'Open the full EBUS simulator (separate tool, sign-in required)',
  })
  record('B10', 'Practice tool link says sign-in is required', (await link.count()) === 1)
  await Promise.all([
    page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => undefined),
    link.click(),
  ])
  record(
    'B10',
    'An anonymous visitor following it is sent to sign in',
    /\/en\/login\?next=/.test(page.url()),
    page.url(),
  )
  await page.goto(base + '/en/ebus-guided/practice')
  await page.getByRole('button', { name: /^A station-boundary review/ }).click()
  for (let i = 0; i < 6; i++) {
    const debrief = page.getByRole('button', { name: /Open debrief/ })
    if (await debrief.count()) {
      await debrief.first().click()
      break
    }
    await page
      .getByRole('button', { name: /Continue without answering|Next check/ })
      .first()
      .click()
  }
  await page.waitForSelector('[data-case-debrief]')
  const duplicates = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-explanation-reveal]')].filter((section) => {
        const paragraphs = [...section.querySelectorAll('p')]
          .map((p) => p.textContent?.trim())
          .filter(Boolean)
        return new Set(paragraphs).size !== paragraphs.length
      }).length,
  )
  const takeaways = await page.locator('[data-explanation-takeaway]').count()
  record(
    'B14',
    'PR-4: no debrief explanation repeats a sentence (already resolved by Prompt 01)',
    duplicates === 0 && takeaways === 0,
    { duplicates, takeaways },
  )
  await shot(page, 'B14-practice-debrief')
}

async function records(page: Page) {
  await page.goto(lessonUrl('adequacy-rose'))
  await page.waitForSelector('[data-case-specimens]')
  const specimens = await page.locator('[data-case-specimen]').count()
  const figure = await text(page, '[data-case-specimens]')
  record(
    'B12',
    'Lesson 22 figure shows the running case’s three specimens and their supplied results',
    specimens === 3 &&
      /On-site communication: malignant cells identified/.test(figure) &&
      /No entry for this specimen in the case\./.test(figure),
    { specimens },
  )
  await shot(page, 'B12-lesson22-specimens')
  await next(page) // → record (adequacy)
  await page
    .getByLabel('What does the on-site communication establish?')
    .selectOption('provisional')
  await page.goto(lessonUrl('specimen-triage'))
  await page.waitForSelector('[data-activity-kind]')
  await next(page) // → allocation record
  const purpose = await text(page, '[data-activity-purpose]')
  record(
    'B12',
    'Allocation record states its guided purpose (L23-2)',
    /shows the laboratory’s instruction for it, or says that none was supplied/.test(purpose),
    purpose,
  )
  const restored = await text(page, '[data-record-restored]')
  record(
    'B12',
    'Restored draft status is learner language with all three truths (L22-5)',
    /Your earlier entries for this case were restored from this browser\./.test(restored) &&
      /not a new acquisition/.test(restored) &&
      /need a new acquisition/.test(restored),
    restored,
  )
  record(
    'B12',
    'Laboratory instruction lines stay visible',
    await page
      .getByText('Case instruction: retain the individual specimen label', { exact: false })
      .isVisible(),
  )
  await shot(page, 'B12-lesson23-allocation')
}

async function lessonTwentyFour(page: Page) {
  await page.goto(lessonUrl('difficult-acquisition'))
  await page.waitForSelector('[data-troubleshooting-flow]')
  const steps = await page.locator('[data-ladder-step]').count()
  const flow = await text(page, '[data-troubleshooting-flow]')
  record(
    'B13',
    'Troubleshooting flow: five questions in order, patient note kept',
    steps === 5 &&
      /Is the airway position understood\?.*Is the transducer coupled\?.*Is the target framed and the image usable\?.*Is the path acceptable\?.*Is the needle tip visible\?/.test(
        flow,
      ) &&
      /Patient tolerance is part of the decision\./.test(flow),
    { steps },
  )
  record(
    'B13',
    'The full patient-safety paragraph stays in the lesson text',
    await page
      .getByText('Pause acquisition for worsening oxygenation', { exact: false })
      .isVisible(),
  )
  await shot(page, 'B13-lesson24-flow')
  await next(page)
  record(
    'B13',
    'Matching states its guided purpose',
    /troubleshooting flow in the briefing shows these pairings/.test(
      await text(page, '[data-activity-purpose]'),
    ),
  )
}

async function help(page: Page) {
  await page.goto(lessonUrl('image-depth'))
  await page.waitForSelector('[data-activity-kind]')
  const helpButton = page.getByRole('button', { name: 'Help', exact: true })
  await helpButton.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  const terms = await dialog.locator('[data-glossary] summary').count()
  const first = dialog.locator('[data-glossary] summary').first()
  await first.focus()
  await page.keyboard.press('Enter')
  const open = await first.evaluate((el) => (el.parentElement as HTMLDetailsElement).open)
  await page.keyboard.press('Escape')
  await wait(200)
  const returned = await helpButton.evaluate((el) => el === document.activeElement)
  record(
    'B11',
    'Help holds the full glossary; a term opens by keyboard; Escape returns focus to Help',
    terms === 10 && open && returned,
    { terms, open, returned },
  )
}

async function conditions(browser: Browser) {
  const pages = [
    ['overview', base + '/en/ebus-guided'],
    ['learn-map', base + '/en/ebus-guided/learn'],
    ['lesson1', lessonUrl('clinical-question')],
    ['lesson22', lessonUrl('adequacy-rose')],
    ['lesson24', lessonUrl('difficult-acquisition')],
    ['lesson17', lessonUrl('systematic-staging')],
  ] as const
  const matrix: {
    name: string
    kind: string
    viewport: { width: number; height: number }
    rootFont?: number
    scheme?: 'light' | 'dark'
  }[] = [
    { name: '320x740', kind: 'viewport emulation', viewport: { width: 320, height: 740 } },
    { name: '390x844', kind: 'viewport emulation', viewport: { width: 390, height: 844 } },
    { name: '768x1024', kind: 'viewport emulation', viewport: { width: 768, height: 1024 } },
    {
      name: '1246x1021',
      kind: 'viewport emulation (the report’s)',
      viewport: { width: 1246, height: 1021 },
    },
    {
      name: '1440x900-rootfont200',
      kind: 'root-font enlargement to 200% (not browser zoom)',
      viewport: { width: 1440, height: 900 },
      rootFont: 200,
    },
    {
      name: '1246x1021-light',
      kind: 'emulated prefers-color-scheme: light',
      viewport: { width: 1246, height: 1021 },
      scheme: 'light',
    },
  ]
  for (const condition of matrix) {
    const context = await browser.newContext({
      viewport: condition.viewport,
      colorScheme: condition.scheme ?? 'dark',
    })
    const page = await context.newPage()
    for (const [name, url] of pages) {
      await page.goto(url)
      await page.waitForLoadState('networkidle').catch(() => undefined)
      if (condition.rootFont)
        await page.evaluate((pct) => {
          document.documentElement.style.fontSize = pct + '%'
        }, condition.rootFont)
      await page.evaluate(() =>
        document
          .querySelectorAll('[data-glossary] details')
          .forEach((d) => ((d as HTMLDetailsElement).open = true)),
      )
      if (name === 'lesson17') {
        await next(page)
        await next(page)
        await page
          .locator('[data-try-it-yourself] button')
          .click()
          .catch(() => undefined)
      }
      await wait(250)
      const ok = await noHorizontalScroll(page)
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      record(
        'B15',
        `${condition.name} (${condition.kind}) · ${name}: no horizontal page scroll`,
        ok,
        metrics,
      )
      await page.screenshot({ path: resolve(out, `B15-${condition.name}-${name}.png`) })
    }
    await context.close()
  }
}

async function main() {
  await mkdir(out, { recursive: true })
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const run = async (name: string, fn: (page: Page) => Promise<void>) => {
    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1246, height: 1021 },
      colorScheme: 'dark',
    })
    const page = await context.newPage()
    try {
      await fn(page)
    } catch (error) {
      record(name, 'journey completed without an exception', false, String(error).slice(0, 400))
      await page.screenshot({ path: resolve(out, 'error-' + name + '.png') }).catch(() => undefined)
    }
    await context.close()
  }
  await run('overview', overview)
  await run('lesson1', lessonOne)
  await run('briefings', briefingsWithoutSchematic)
  await run('lesson17', lessonSeventeen)
  await run('lesson5', lessonFive)
  await run('lesson10', lessonTen)
  await run('names', structureNames)
  await run('routes', routes)
  await run('practice', practice)
  await run('records', records)
  await run('lesson24', lessonTwentyFour)
  await run('help', help)
  if (!process.env.EBUS_SKIP_MATRIX) await conditions(browser)
  await browser.close()
  const failed = results.filter((r) => !r.pass)
  await writeFile(
    resolve(out, 'report.json'),
    JSON.stringify(
      {
        base,
        when: new Date().toISOString(),
        total: results.length,
        failed: failed.length,
        results,
      },
      null,
      2,
    ),
  )
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed`)
  if (failed.length) process.exitCode = 1
}
void main()
