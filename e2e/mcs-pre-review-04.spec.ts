import { expect, test, type Page } from '@playwright/test'

/**
 * MCS-PRE-REVIEW-04 — self-paced teaching, sources and flow, in a real browser.
 *
 * The journeys a self-paced learner takes: enter from the hub, read without answering, answer
 * wrongly and read why, open a hint, open the glossary and come back, open a worked response,
 * reach the recap, use the open sandbox, and work a case. Each check reads the rendered page:
 * what is on screen, whether it fits, whether focus returns, whether anything was stored.
 *
 *   MCS_E2E_BASE_URL=http://localhost:3153 npx playwright test e2e/mcs-pre-review-04.spec.ts
 *
 * The jsdom contracts are in `mcs-pre-review-04*.test.ts(x)` beside the feature.
 */

test.use({ baseURL: process.env.MCS_E2E_BASE_URL ?? 'http://127.0.0.1:3001' })

const MCS = '/en/mechanical-circulatory-support'
const PROGRESS_KEY = 'interventionalpulm:mcs-progress:v1'
const SIZES = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const

test.beforeEach(async ({ page }) => {
  await page.route('**/api/analytics**', (route) => route.fulfill({ status: 204, body: '' }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function openLesson(page: Page, lesson: string) {
  await page.goto(`${MCS}/learn?lesson=${lesson}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-now-card], [data-prerequisite-reference]')
  await page.waitForTimeout(800)
  for (let guard = 0; guard < 6; guard += 1) {
    const reference = page.locator('[data-prerequisite-reference] button', {
      hasText: /Next reference|Begin the patient example|Continue/,
    })
    if (!(await reference.count())) break
    await reference.first().click()
    await page.waitForTimeout(150)
  }
  await expect(page.locator('[data-now-card]')).toBeVisible()
}

async function stepKicker(page: Page) {
  return (await page.locator('[data-now-card] p').first().textContent()) ?? ''
}

/** Continue until the step of the given 1-based ordinal is on screen; a pre-hydration click is retried. */
async function goToStep(page: Page, ordinal: number) {
  for (let guard = 0; guard < 40; guard += 1) {
    const kicker = await stepKicker(page)
    const current = Number(kicker.match(/Step (\d+) of/)?.[1] ?? 0)
    if (current >= ordinal) return
    await page.locator('[data-step-bar-continue]').click()
    await page
      .waitForFunction(
        (previous) => (document.querySelector('[data-now-card] p')?.textContent ?? '') !== previous,
        kicker,
        { timeout: 4000 },
      )
      .catch(() => undefined)
  }
  throw new Error(`step ${ordinal} was not reached`)
}

async function goToPhase(page: Page, phase: string) {
  for (let guard = 0; guard < 40; guard += 1) {
    const kicker = await stepKicker(page)
    if (new RegExp(`· ${phase}$`, 'i').test(kicker.trim())) return
    await page.locator('[data-step-bar-continue]').click()
    await page
      .waitForFunction(
        (previous) => (document.querySelector('[data-now-card] p')?.textContent ?? '') !== previous,
        kicker,
        { timeout: 4000 },
      )
      .catch(() => undefined)
  }
  throw new Error(`phase ${phase} was not reached`)
}

async function documentOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

async function storedProgress(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_KEY)
}

async function enlargeText(page: Page) {
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
    .toBe('32px')
}

const SCORE_LANGUAGE =
  /\b\d+\s+of\s+\d+\s+(correct|answered|predictions)|\bscore\b|first[- ]attempt|competen/i

/* ------------------------------------------------------------------ F02 hub */

for (const size of SIZES) {
  test(`F02 · hub leads with audience, objectives, Start and an optional refresher (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto(MCS, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-hub-audience]')).toBeVisible()
    const objectives = page.locator('[data-hub-objective]')
    expect(await objectives.count()).toBeGreaterThanOrEqual(3)
    expect(await objectives.count()).toBeLessThanOrEqual(5)

    const start = page.locator('[data-mcs-continue]')
    await expect(start).toHaveText(/^Start — /)
    // The way in comes before the pathway and before any reviewer material.
    const order = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY
      return {
        objectives: top('[data-hub-objectives]'),
        start: top('[data-mcs-continue]'),
        pathway: top('#mcs-hub-pathway'),
        reviewer: top('[data-reviewer-layer]'),
      }
    })
    expect(order.objectives).toBeLessThan(order.start)
    expect(order.start).toBeLessThan(order.pathway)
    expect(order.pathway).toBeLessThan(order.reviewer)

    await expect(page.locator('[data-hub-refresher]')).toContainText('not required')
    expect(
      await page
        .locator('[data-reviewer-layer]')
        .evaluate((node) => (node as HTMLDetailsElement).open),
    ).toBe(false)
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)

    // An objective's link opens its section directly: the refresher gates nothing.
    await objectives.nth(1).locator('a').first().click()
    await page.waitForURL(/learn\?lesson=iabp-timing-triggering/)
  })
}

test('F02 · a returning learner is offered Resume and nothing is reset', async ({ page }) => {
  await openLesson(page, 'iabp-timing-triggering')
  await goToStep(page, 3)
  const before = await storedProgress(page)
  expect(before).toContain('iabp-timing-triggering')
  await page.goto(MCS, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-mcs-continue]')).toHaveText(/^Resume — /)
  const after = JSON.parse((await storedProgress(page))!) as {
    selfPaced: { visitedLessonIds: string[] }
  }
  expect(after.selfPaced.visitedLessonIds).toContain('iabp-timing-triggering')
})

/* ------------------------------------------------------------------ F06 / F08 ladder */

for (const size of SIZES) {
  test(`F06/F08 · the ladder has one number per rung and one orientation (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openLesson(page, 'mcs-foundations-signals')
    await goToStep(page, 2)
    const ladder = page.locator('[data-causal-ladder]')
    await expect(ladder).toBeVisible()
    expect(await ladder.evaluate((node) => getComputedStyle(node).listStyleType)).toBe('none')
    await expect(page.locator('[data-ladder-orientation]')).toContainText(
      'organ response is the top',
    )
    expect(await page.locator('[data-mcs-stage]').innerText()).not.toMatch(/bottom rung/i)
    // The optional detail is a native disclosure, reachable from the keyboard.
    const detail = page.locator('[data-rung-detail="oxygen-delivery"] summary')
    await detail.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-rung-detail="oxygen-delivery"]')).toHaveAttribute('open', '')
    // The panel's own text equivalent is a visible, closed disclosure — not screen-reader-only.
    const inWords = page.locator('[data-panel-section="signals-ladder"] > [data-text-equivalent]')
    await expect(inWords.locator('> summary')).toBeVisible()
    expect(await inWords.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false)
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)
  })
}

/* ------------------------------------------------------------------ the learning paths */

test('no answer → explanation → continue, through a whole section, to a recap that counts nothing', async ({
  page,
}) => {
  await openLesson(page, 'mcs-foundations-signals')
  await goToPhase(page, 'Recognize')
  await goToStep(page, 4)
  await expect(page.locator('[data-worked-explanation-label]')).toBeVisible()
  await page.locator('[data-now-card]').getByRole('button', { name: 'Show explanation' }).click()
  await expect(page.locator('[data-provided-explanation]')).toBeVisible()
  expect(await page.locator('input[type="radio"]:checked').count()).toBe(0)

  await goToStep(page, 9)
  const recap = page.locator('[data-section-recap]')
  await expect(recap).toBeVisible()
  expect(await recap.innerText()).not.toMatch(SCORE_LANGUAGE)
  expect(await page.locator('[data-mcs-stage]').innerText()).not.toMatch(SCORE_LANGUAGE)
  expect(await page.locator('input[type="radio"]:checked').count()).toBe(0)

  const stored = JSON.parse((await storedProgress(page))!) as Record<string, unknown>
  expect(Object.keys(stored).sort()).toEqual(['selfPaced', 'version'])
  expect(Object.keys(stored.selfPaced as object).sort()).toEqual([
    'lastActivityId',
    'lastDevice',
    'lastPhase',
    'lastSection',
    'locationUpdatedAt',
    'visitedCaseIds',
    'visitedLessonIds',
  ])
  // A recap link goes back to a step.
  await recap.locator('[data-recap-revisit-disclosure] > summary').click()
  await recap.locator('[data-recap-step]').nth(3).click()
  await expect.poll(() => stepKicker(page)).toMatch(/Step 4 of 9/)
})

test('wrong answer → supported explanation → retry → continue, with no total', async ({ page }) => {
  await openLesson(page, 'mcs-foundations-signals')
  await goToStep(page, 4)
  const card = page.locator('[data-now-card]')
  await expect(card.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  await page.getByLabel(/Whether the organs are being perfused/).check()
  await card.getByRole('button', { name: 'Compare answer' }).click()
  const feedback = page.locator('[data-identify-feedback]')
  await expect(feedback).toContainText('Not correct.')
  await expect(feedback).toContainText('Organ response is the top of the ladder')
  await expect(feedback).toContainText('What holds:')
  await card.getByRole('button', { name: 'Try again' }).click()
  await expect(feedback).toHaveCount(0)
  expect(await page.locator('input[type="radio"]:checked').count()).toBe(0)
  expect(await storedProgress(page)).not.toMatch(/organs-perfused|attempt/)
  await page.locator('[data-step-bar-continue]').click()
  await expect.poll(() => stepKicker(page)).toMatch(/Step 5 of 9/)
})

test('F11 · Hint is this item’s nudge and Help is the instruction; focus returns to the trigger', async ({
  page,
}) => {
  await openLesson(page, 'mcs-foundations-signals')
  await goToStep(page, 4)
  const instruction = await page.locator('[data-now-card] h2 + p').first().innerText()
  const hint = page.locator('[data-step-hint-trigger]')
  await hint.focus()
  await page.keyboard.press('Enter')
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toContainText('Hint')
  await expect(dialog.locator('[data-step-hint]')).toContainText('Look at the unit')
  expect(await dialog.innerText()).not.toContain(instruction)
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(hint).toBeFocused()
})

test('F11 · the Explain question is an optional reflection with a worked response and no text box', async ({
  page,
}) => {
  await openLesson(page, 'iabp-efficacy-limits')
  await goToPhase(page, 'Explain')
  const card = page.locator('[data-now-card]')
  await expect(card.getByRole('button', { name: 'Hint' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  const reflection = page.locator('[data-optional-reflection]')
  await expect(reflection).toBeVisible()
  expect(
    await page.locator('[data-mcs-stage] textarea, [data-mcs-stage] input[type="text"]').count(),
  ).toBe(0)
  const worked = reflection.locator('[data-worked-response]')
  await worked.locator('summary').click()
  await expect(worked).toHaveAttribute('open', '')
  await expect(worked).toContainText('Lead with the limiting problem')
  expect(await storedProgress(page)).not.toMatch(/reflection|response/i)
  await page.locator('[data-step-bar-continue]').click()
  await expect.poll(() => stepKicker(page)).toMatch(/Transfer/)
})

/* ------------------------------------------------------------------ F13 / F15 Section 2 */

for (const size of SIZES) {
  test(`F13/F15 · Section 2 shows the three flow lines as arithmetic and names its sort (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openLesson(page, 'mcs-foundations-mechanisms')
    await goToPhase(page, 'Act')
    for (const id of ['control:select-iabp', 'control:select-impella', 'control:select-lvad']) {
      await page.locator(`[data-now-card] [data-mcs-control="${id}"]`).first().click()
      await page.waitForTimeout(250)
    }
    await goToPhase(page, 'Observe')
    const arithmetic = page.locator('[data-flow-arithmetic="captured"]').first()
    await expect(arithmetic).toBeVisible()
    const deltas = await arithmetic
      .locator('[data-flow-arithmetic-device="impella"] [data-delta]')
      .evaluateAll((nodes) =>
        Object.fromEntries(
          nodes.map((node) => [
            node.getAttribute('data-delta'),
            Number(node.textContent!.replace('−', '-')),
          ]),
        ),
      )
    expect(deltas.device).toBeGreaterThan(0)
    expect(deltas.native).toBeLessThan(0)
    expect(deltas.effective).toBeGreaterThan(0)
    expect(deltas.effective).toBeLessThan(deltas.device)
    expect(Math.abs(deltas.device + deltas.native - deltas.effective)).toBeLessThan(0.011)
    // Three separate rows are still three separate rows.
    for (const metric of ['nativeFlowLMin', 'deviceFlowLMin', 'effectiveSystemicFlowLMin']) {
      await expect(page.locator(`[data-comparison-metric="${metric}"]`).first()).toBeVisible()
    }
    expect(await page.locator('[data-mcs-stage]').innerText()).not.toMatch(
      /does not move by the size of the device number|mcs-reference-patient-v1\./,
    )

    await goToPhase(page, 'Explain')
    await expect(page.locator('[data-now-card] h2')).toContainText('What can be set')
    await expect(page.locator('[data-now-card] h2 + p').first()).toContainText('Sort each item')
    // The sort still works: classify one item and compare.
    const select = page.locator('[data-control-panel-sort] select').first()
    await select.selectOption({ index: 1 })
    await expect(page.locator('[data-optional-reflection]')).toContainText(
      'native contribution fell by the same amount',
    )
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)
  })
}

/* ------------------------------------------------------------------ F18 Section 3 */

test('F18 · the optional clean timing view hides letters, never the alarm, and reveals at once', async ({
  page,
}) => {
  await openLesson(page, 'iabp-timing-triggering')
  await goToStep(page, 6)
  await expect(page.locator('[data-now-card] h2 + p').first()).toContainText('annotated')
  const letters = page.locator('[data-iabp-landmark]')
  expect(await letters.count()).toBeGreaterThan(0)
  const stage = page.locator('[data-mcs-stage]')
  await expect(stage).toContainText('Inflation before aortic-valve closure')
  const toggle = page.getByRole('checkbox', { name: /Optional clean view/ })
  await toggle.check()
  await expect(letters).toHaveCount(0)
  await expect(stage).toContainText('Inflation before aortic-valve closure')
  await toggle.uncheck()
  expect(await letters.count()).toBeGreaterThan(0)
  // The reference legend is open on the step that names the relationship.
  await expect(page.locator('[data-iabp-reference-detail]')).toHaveAttribute('open', '')
})

test('F39 · the timing reference keeps its limit in the open and folds its legend on the demonstrations', async ({
  page,
}) => {
  await openLesson(page, 'iabp-timing-triggering')
  await goToStep(page, 3)
  await expect(page.locator('[data-iabp-live-trace-rule]')).toBeVisible()
  await expect(page.locator('[data-iabp-authored-reference]')).toContainText(
    'not a run of this simulation',
  )
  expect(
    await page
      .locator('[data-iabp-reference-detail]')
      .evaluate((node) => (node as HTMLDetailsElement).open),
  ).toBe(false)
})

/* ------------------------------------------------------------------ F30 Section 9, S6 */

for (const size of SIZES) {
  test(`F30 · Section 9 keeps the seven questions open and folds the lookup blocks (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openLesson(page, 'mcs-device-selection-integration')
    await expect(page.locator('[data-common-model-answers]')).toBeVisible()
    await expect(page.locator('[data-congestion-limit]')).toBeVisible()
    for (const id of [
      'integration-congestion-evidence',
      'integration-flow',
      'integration-guides',
      'integration-strategy',
    ]) {
      const block = page.locator(`[data-panel-section="${id}"]`)
      expect(await block.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false)
    }
    // One click opens a reference, from the keyboard too.
    const summary = page.locator('[data-panel-section="integration-guides"] > summary')
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-panel-section="integration-guides"]')).toHaveAttribute(
      'open',
      '',
    )
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)
  })
}

test('Section 6 keeps its story pair and the kept-apart flow account', async ({ page }) => {
  await openLesson(page, 'impella-suction-purge-rv')
  await goToPhase(page, 'Observe')
  await expect(page.locator('[data-story-choices]').first()).toBeVisible()
  expect(await page.locator('[data-story-choices]').count()).toBe(2)
  await goToPhase(page, 'Explain')
  await expect(page.locator('[data-panel-section="rv-flow"]')).toBeVisible()
  await expect(page.locator('[data-serial-flow-warning]').first()).toBeVisible()
})

/* ------------------------------------------------------------------ F42 glossary */

for (const size of SIZES) {
  test(`F42 · the glossary opens from a lesson and returns to the same place (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openLesson(page, 'impella-unloading-placement')
    await goToStep(page, 3)
    await page.locator('fieldset[data-prediction-choices] input[type="radio"]').first().check()
    const before = {
      kicker: await stepKicker(page),
      identity: await page.locator('[data-session-identity]').innerText(),
      scroll: await page.evaluate(() => window.scrollY),
    }
    const trigger = page.locator('[data-glossary-trigger]')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Glossary')
    await expect(dialog.locator('[data-term-id]')).toHaveCount(8)
    await expect(dialog.locator('[data-naming-row="impella-cp"]')).toContainText('Impella 5.5')
    await expect(dialog.locator('[data-naming-row="lvad"]')).toContainText(
      'not a HeartMate 3 simulator',
    )
    // The dialog fits the viewport and scrolls inside itself.
    const box = await dialog.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(size.width)
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(await stepKicker(page)).toBe(before.kicker)
    expect(await page.locator('[data-session-identity]').innerText()).toBe(before.identity)
    expect(
      await page.locator('fieldset[data-prediction-choices] input[type="radio"]:checked').count(),
    ).toBe(1)
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)
  })
}

/* ------------------------------------------------------------------ F36 studio */

for (const size of SIZES) {
  test(`F36 · Mechanism Studio is an open reference-patient sandbox (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto(`${MCS}/practice`, { waitUntil: 'domcontentloaded' })
    const entry = page.locator('section[aria-label="Choose your practice"]')
    await expect(entry).toContainText('open sandbox')
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await entry
        .getByRole('button', { name: 'Explore mechanisms' })
        .click()
        .catch(() => undefined)
      if (await page.locator('[data-mechanism-studio]').count()) break
      await page.waitForTimeout(500)
    }
    const studio = page.locator('[data-mechanism-studio]')
    await expect(studio).toContainText('open sandbox on this module’s reference patient')
    await expect(studio).toContainText('no case to solve, no question to answer and no debrief')
    // The six-stage stepper and the mode badge are gone for the sandbox.
    await expect(
      page.locator('[role="group"][aria-label="MCS shared activity phases"]'),
    ).toBeHidden()
    await expect(page.locator('[data-critical-care-activity-shell] header h1')).toHaveText(
      'Mechanism Studio',
    )
    await expect(page.locator('[data-critical-care-activity-shell] header h1 + span')).toBeHidden()
    await expect(page.locator('[data-worked-explanation]')).toHaveCount(0)

    // Free experimentation: an ordinary control moves the model.
    const preload = page.getByRole('slider', { name: 'Preload' })
    await preload.focus()
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#mcs-activity-viewport')).toBeVisible()
    // Nothing is recorded for the sandbox.
    expect(await storedProgress(page)).toBeNull()
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)

    // A case still has its stepper.
    await page.goto(`${MCS}/practice?case=IABP-01`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-case-workflow]')
    await expect(
      page.locator('[role="group"][aria-label="MCS shared activity phases"]'),
    ).toBeVisible()
  })
}

/* ------------------------------------------------------------------ F31 / F32 / F33 case */

for (const size of SIZES) {
  test(`F31/F32/F33 · a case gives reasoning for every option and names the run’s actions (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto(`${MCS}/practice?case=IABP-01`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-case-workflow]')
    await page.waitForTimeout(800)
    await expect(page.locator('[data-case-kind]')).toContainText('worked teaching case')
    // The real alarm and the informative title are both on screen: nothing is hidden.
    await expect(page.locator('#case-workflow-heading')).toHaveText(
      'The balloon that stays inflated too long',
    )
    await expect(page.getByText('CRITICAL · Late deflation').first()).toBeVisible()
    await expect(page.locator('[data-try-prediction-again]')).toHaveCount(0)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.getByLabel('Low preload is the primary problem').check()
      await page.getByRole('button', { name: 'Compare prediction' }).click()
      if (await page.locator('[data-prediction-reasoning-list]').count()) break
      await page.waitForTimeout(500)
    }
    const reasoning = page.locator('[data-prediction-reasoning-list]')
    await expect(reasoning).toContainText('Why this does not fit this modeled state')
    await expect(reasoning).toContainText('Why this fits this modeled state')
    expect(await reasoning.locator('[data-prediction-reasoning]').count()).toBe(3)
    expect(await reasoning.innerText()).not.toMatch(SCORE_LANGUAGE)
    // The reasoning uses the width it has.
    const widths = await reasoning.evaluate((node) => ({
      own: node.getBoundingClientRect().width,
      parent: node.parentElement!.getBoundingClientRect().width,
    }))
    expect(widths.own).toBeGreaterThan(widths.parent * 0.6)

    await page.getByRole('button', { name: /Arterial waveform/ }).click()
    await page.getByRole('button', { name: 'Open worked explanation' }).click()
    const run = page.locator('[data-debrief-run]')
    await expect(run.locator('[data-run-actions] li').first()).toHaveText(
      'Read the arterial waveform',
    )
    expect(await run.locator('[data-run-actions]').innerText()).not.toMatch(/[a-z]:[a-z]/)
    await expect(page.locator('[data-worked-explanation] [data-claim-source-checks]')).toBeVisible()
    await expect(page.locator('[data-condition-contract]')).toBeVisible()
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)
    expect(await storedProgress(page)).not.toMatch(/underfilled|late-deflation/)
  })
}

/* ------------------------------------------------------------------ F10 sources */

test('F10 · the section sources are classed, with authoring provenance last and labelled', async ({
  page,
}) => {
  await openLesson(page, 'iabp-timing-triggering')
  // The sources are a native disclosure; a click that lands before hydration settles is retried.
  const sources = page.locator('[data-mcs-stage] [data-stage-sources]')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await sources.evaluate((node) => (node as HTMLDetailsElement).open)) break
    await sources.locator('> summary').click()
    await page.waitForTimeout(300)
  }
  const rows = page.locator('[data-mcs-source-list] li')
  await expect(rows.first()).toBeVisible()
  const classes = await rows.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-source-class')),
  )
  expect(classes[0]).toBe('primary-clinical-device')
  expect(classes[classes.length - 1]).toBe('authoring-provenance')
  await expect(
    page.locator('[data-source-id="master-hemodynamics-reference"] [data-source-class-label]'),
  ).toContainText('not independent clinical evidence')
  const checks = page.locator('[data-mcs-stage] [data-claim-source-checks]')
  await checks.locator('summary').click()
  await expect(checks).toContainText('NOT REVIEWED')
  await expect(checks.locator('[data-claim-check]')).toHaveCount(3)
})

/* ------------------------------------------------------------------ 320 px and 200% text */

for (const lesson of ['mcs-foundations-signals', 'mcs-device-selection-integration']) {
  test(`320 px · the new step chrome fits without sideways scroll (${lesson})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await openLesson(page, lesson)
    await expect(page.locator('[data-glossary-trigger]')).toBeVisible()
    await expect(page.locator('[data-step-bar-continue]')).toBeVisible()
    await page.locator('[data-model-limits] summary').click()
    await expect(page.locator('[data-model-limit="simulated-values"]')).toBeVisible()
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1)
  })
}

test('200% text at 390 px · hub objectives, the recap and the glossary stay inside the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(MCS, { waitUntil: 'domcontentloaded' })
  await enlargeText(page)
  await expect(page.locator('[data-hub-objectives]')).toBeVisible()
  // The blocks this slice added sit inside the viewport. (The hub as a whole already scrolled
  // sideways at this size before this slice; that is recorded in the handoff, not asserted here.)
  for (const selector of ['[data-hub-audience]', '[data-hub-objectives]', '[data-hub-refresher]']) {
    const box = (await page.locator(selector).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(391)
  }

  await openLesson(page, 'lvad-alarms-emergencies')
  await enlargeText(page)
  await goToPhase(page, 'Transfer')
  await expect(page.locator('[data-section-recap]')).toBeVisible()
  const recapOverflow = await page
    .locator('[data-section-recap]')
    .evaluate((node) => node.scrollWidth - node.clientWidth)
  expect(recapOverflow).toBeLessThanOrEqual(1)
  await page.locator('[data-glossary-trigger]').click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(391)
})

/* ------------------------------------------------------------------ themes */

for (const theme of ['light', 'dark'] as const) {
  test(`the hub objectives and a case’s option reasoning are readable in the ${theme} site theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.addInitScript((value) => window.localStorage.setItem('theme', value), theme)
    const contrast = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((node) => {
          const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
          const luminance = ([r, g, b]: number[]) => {
            const channel = (v: number) => {
              const s = v / 255
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
            }
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
          }
          let background = [255, 255, 255]
          for (let el: Element | null = node; el; el = el.parentElement) {
            const value = parse(getComputedStyle(el).backgroundColor)
            if (value.length >= 3 && (value[3] === undefined || value[3] > 0.5)) {
              background = value.slice(0, 3)
              break
            }
          }
          const foreground = parse(getComputedStyle(node).color).slice(0, 3)
          const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x)
          return (a + 0.05) / (b + 0.05)
        })

    await page.goto(MCS, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-hub-objective]').first()).toBeVisible()
    expect(await contrast('[data-hub-objective]')).toBeGreaterThanOrEqual(4.5)
    expect(await contrast('[data-hub-refresher]')).toBeGreaterThanOrEqual(4.5)

    await page.goto(`${MCS}/practice?case=IMP-01`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-case-workflow]')
    await page.waitForTimeout(800)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.getByLabel('The performance level is too low').check()
      await page.getByRole('button', { name: 'Compare prediction' }).click()
      if (await page.locator('[data-prediction-reasoning-list]').count()) break
      await page.waitForTimeout(500)
    }
    expect(await contrast('[data-prediction-reasoning-list] p')).toBeGreaterThanOrEqual(4.5)
  })
}
