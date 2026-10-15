import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Use the full Chromium headless browser, also used for actual tab-zoom verification.
test.use({ channel: 'chromium' })

test.beforeEach(async ({ context, page }) => {
  if (process.env.ICU_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.ICU_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/icu-hemodynamics`, {
        timeout: 30_000,
      })
      .catch((error: unknown) => {
        throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function primary(page: Page) {
  const control = page.locator('[data-now-card] [data-now-primary]')
  await expect(control).toBeEnabled()
  await expect(control).toBeVisible()
  await control.focus()
  await control.press('Enter')
}
/** A section paired to a case ends on it; Skip the case finishes the section without running it. */
async function skipCase(page: Page) {
  const skip = page
    .locator('[data-now-card] [data-now-secondary]')
    .filter({ hasText: 'Skip the case · finish the section' })
  await expect(skip).toBeVisible()
  await skip.click()
}
async function capture(page: Page, name: string) {
  const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
  await page.screenshot({ path: test.info().outputPath(`${name}-viewport.png`) })
  // Capture the page from its start so the site's fixed navigation is not stitched through
  // the middle of a long document. Scrolling never invokes an application action.
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true })
  await page.evaluate(
    ({ x, y }) => window.scrollTo({ left: x, top: y, behavior: 'instant' }),
    scroll,
  )
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    console.log(
      'Overflow:',
      await page.evaluate(() =>
        [...document.querySelectorAll('*')]
          .filter((e) => {
            const b = e.getBoundingClientRect()
            return b.width && (b.right > innerWidth + 1 || b.left < -1)
          })
          .slice(0, 18)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            width: e.getBoundingClientRect().width,
            text: e.textContent?.slice(0, 50),
          })),
      ),
    )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
}
/** Every goal of the current task is met by what was done on it. */
async function goalsMet(page: Page) {
  const goals = page.locator('[data-step-goals] li')
  await expect(goals).not.toHaveCount(0)
  for (const goal of await goals.all()) await expect(goal).toHaveAttribute('data-met', 'true')
}
async function flush(page: Page, response: 'acceptable' | 'overdamped' | 'underdamped') {
  const dock = page.locator('[data-dock="flush"]')
  await page.locator('#hemodynamics-control-flush').click()
  // Where the task asks for a modeled acquisition, the classification waits for the release.
  await dock.locator(`[data-flush-classification] input[value="${response}"]`).check()
  await dock.getByRole('button', { name: 'Say what it is', exact: true }).click()
  await expect(dock.locator('[data-flush-outcome]')).toHaveAttribute(
    'data-flush-outcome',
    'correct',
  )
  if (response !== 'acceptable') {
    await page
      .getByRole('button', { name: 'Apply the simulated line correction', exact: true })
      .click()
    await expect(dock.locator('[data-flush-stale]')).toBeVisible()
    // The repair alone does not finish the pressure task: the corrected line is read again.
    const recheck = page
      .locator('[data-step-goals] li')
      .filter({ hasText: 'Flush the corrected line again' })
    if (await recheck.count()) await expect(recheck).toHaveAttribute('data-met', 'false')
    await flush(page, 'acceptable')
  }
}
/**
 * Check what is chosen on the Now card's question, and read its stated verdict. Since HD-01 a
 * question is optional and checked by its own control: the primary action moves past it whether or
 * not it was answered, so it is pressed only once the verdict is on screen.
 */
async function check(page: Page) {
  await page.locator('[data-now-card] [data-question-check]').first().click()
  await expect(page.locator('[data-now-card] [data-answer-verdict]').first()).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )
}

test('pressure flow preserves independent baselines, complete repair and transfer', async ({
  page,
}) => {
  // Thirteen tasks, four flushes and three full-page captures: close to the default 30 s budget.
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/en/icu-hemodynamics/learn?activity=pressure-system&phase=transfer')
  const flow = page.locator('[data-lesson-shell][data-stage]')
  await expect(flow).toHaveAttribute('data-stage', 'pressure-system-1-recognize')
  await expect(flow).toHaveAttribute('data-presentation', 'signal-lab')
  await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
  await primary(page)
  await primary(page)
  await page.locator('#hemodynamics-control-level').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-level-readout]')).toHaveText('+1 cm')
  await expect(
    page.getByRole('region', { name: 'Retained demonstration comparison' }),
  ).toContainText('Reference')
  await capture(page, 'pressure-level-reference-current')
  await page.getByRole('button', { name: 'Reset demonstration', exact: true }).click()
  await expect(page.locator('[data-level-readout]')).toHaveText('0 cm')
  await primary(page)
  await page.locator('#hemodynamics-control-zero').click()
  await primary(page)
  await page.locator('#hemodynamics-control-scale').selectOption('240')
  await capture(page, 'pressure-scale')
  await primary(page)
  await expect(page.getByRole('heading', { name: 'Reference flush responses' })).toBeVisible()
  await primary(page)
  await answer(page, /off level, not zeroed and underdamped/i)
  await expect(flow).toHaveAttribute('data-stage', 'pressure-system-7-act')
  await page.locator('#hemodynamics-control-level').fill('0')
  await page.locator('#hemodynamics-control-zero').click()
  await goalsMet(page)
  await primary(page)
  await flush(page, 'underdamped')
  await goalsMet(page)
  await primary(page)
  await expect(page.locator('[data-before-after] tbody tr')).toHaveCount(4)
  await capture(page, 'pressure-repaired-comparison')
  await primary(page)
  await answer(page, /Re-level the transducer and repair the overdamped line/)
  await page.locator('#hemodynamics-control-level').fill('0')
  if (await page.locator('#hemodynamics-control-zero').isEnabled())
    await page.locator('#hemodynamics-control-zero').click()
  await flush(page, 'overdamped')
  await goalsMet(page)
  await primary(page)
  await primary(page)
  await skipCase(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
  // HD-01: a finished section is marked reviewed in the self-paced record; the retired Learn
  // record is never written.
  const records = () =>
    page.evaluate(() => ({
      reviewed: JSON.parse(localStorage.getItem('icu-hemodynamics-self-paced-v1') || '{}')
        .reviewedSectionIds,
      learn: localStorage.getItem('icu-hemodynamics-learn-v1'),
    }))
  expect((await records()).reviewed).toContain('pressure-system')
  expect((await records()).learn).toBeNull()
  await page.reload()
  await expect(flow).toHaveAttribute('data-stage', 'pressure-system-1-recognize')
  expect((await records()).reviewed).toContain('pressure-system')
})

const sections = [
  'why-measure',
  'pressure-system',
  'waveform-interpretation',
  'waveform-components',
  'catheter-advancement',
  'pawp-capture',
  'thermodilution-series',
  'derived-hemodynamics',
  'pac-signal-validation',
]
async function open(page: Page, section: string) {
  await page.goto(`/en/icu-hemodynamics/learn?activity=${section}`)
  await page.bringToFront()
  await expect(page.locator('[data-lesson-shell][data-stage]')).toHaveAttribute(
    'data-stage',
    `${section}-1-recognize`,
  )
}
/** Choose an answer to the Now card's question, check it, and move on. */
async function answer(page: Page, label: RegExp) {
  await page.locator('[data-prediction-choices]').getByRole('radio', { name: label }).check()
  await check(page)
  await primary(page)
}
async function readings(page: Page) {
  for (let i = 0; i < 20 && (await page.locator('[data-flow-reading]').count()); i++)
    await primary(page)
}
async function inject(page: Page) {
  const button = page.locator('#hemodynamics-control-inject')
  await button.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(2500)
  await page.keyboard.up('Space')
}
async function decideTrials(page: Page) {
  for (const card of await page.locator('[data-dock="thermodilution"] article').all()) {
    const review = card.getByRole('button', { name: 'Review this curve' })
    if (await review.count()) await review.click()
    const reason = card.locator('select')
    if ((await reason.count()) && (await reason.isEnabled())) {
      const value = await reason.locator('option').nth(1).getAttribute('value')
      await reason.selectOption(value!)
      await card.getByRole('button', { name: /Exclude/ }).click()
    } else {
      const accept = card.getByRole('button', { name: /Accept/ })
      if ((await accept.count()) && (await accept.isEnabled())) await accept.click()
    }
  }
}
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1280, height: 600 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`every section opens in document flow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    for (const section of sections) {
      await open(page, section)
      await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
      await expect(page.locator('[data-now-card]')).toBeVisible()
      await capture(page, `${section}-${viewport.width}x${viewport.height}`)
    }
  })
}
test('blinded waveform progression retains answers through Back and layout changes', async ({
  page,
}) => {
  await open(page, 'waveform-interpretation')
  while (
    !(await page.locator('[data-lesson-shell][data-stage]').getAttribute('data-stage'))!.endsWith(
      '-predict',
    )
  )
    await primary(page)
  await expect(page.locator('[data-catheter-map]')).toHaveAttribute('data-tip', 'withheld')
  await page
    .locator('[data-catheter-map-answer]')
    .getByText('The right ventricle', { exact: true })
    .click()
  await check(page)
  await expect(page.locator('[data-map-emphasis-target="rv"]')).toHaveCount(1)
  await primary(page)
  // HD-02: the practice tracings are an optional try, one at a time, with the labels hidden until
  // a reading is checked; nothing is tallied, so each reading is judged on its own tracing.
  const drill = page.locator('[data-surface="recognition"]')
  const readingsInOrder = [
    'Right ventricle',
    'Pulmonary artery',
    'Pulmonary capillary wedge',
    'Right atrium / CVP',
    'Right atrium / CVP',
    'Cannot be named from this display',
  ]
  const reveal = drill.locator('[data-recognition-reveal]')
  for (const [index, name] of readingsInOrder.entries()) {
    await expect(reveal).toHaveCount(0)
    await drill.getByRole('radio', { name, exact: true }).check()
    await drill.getByRole('button', { name: 'Check answer', exact: true }).click()
    await expect(reveal).toHaveAttribute('data-recognition-reveal', 'checked')
    await expect(reveal).toHaveAttribute('data-correct', 'true')
    if (index < readingsInOrder.length - 1)
      await drill.getByRole('button', { name: 'Next tracing', exact: true }).click()
  }
  await page.locator('[data-now-back]').click()
  await primary(page)
  await expect(reveal).toHaveAttribute('data-correct', 'true')
  await expect(
    drill.getByRole('radio', { name: /^Cannot be named from this display/ }),
  ).toBeChecked()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(reveal).toHaveAttribute('data-correct', 'true')
  await capture(page, 'waveform-completed-record-compact')
  await primary(page)
  await primary(page)
  await page
    .locator('[data-catheter-map-answer]')
    .getByText('Wedge tracing', { exact: true })
    .click()
  await check(page)
  await primary(page)
  await primary(page)
  await skipCase(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})
test('advancement uses actual transit, confirmation, repair and transfer controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, 'catheter-advancement')
  await primary(page)
  await answer(page, /Advance, expecting a right-ventricular tracing/)
  for (const name of ['The right atrium', 'The right ventricle', 'The pulmonary artery']) {
    if (name !== 'The right atrium') await page.locator('#hemodynamics-control-advance').click()
    await expect(page.locator('#hemodynamics-control-withdraw')).toBeEnabled({ timeout: 15000 })
    await expect(async () => {
      await page.locator('[data-catheter-map-answer]').getByText(name, { exact: true }).click()
      await expect(page.locator('[data-place-note]')).toContainText('Confirmed:')
    }).toPass({ timeout: 15000 })
  }
  await goalsMet(page)
  await capture(page, 'advancement-confirmed-pa')
  await primary(page)
  await expect(page.locator('[data-ventricle-artery]')).toBeVisible()
  await primary(page)
  await primary(page)
  await answer(page, /Hold position and repair the dynamic response/)
  await flush(page, 'underdamped')
  await page.locator('#hemodynamics-control-advance').click()
  await expect(page.locator('#hemodynamics-control-withdraw')).toBeEnabled({ timeout: 15000 })
  await page
    .locator('[data-catheter-map-answer]')
    .getByText('The right ventricle', { exact: true })
    .click()
  await expect(page.locator('[data-place-note]')).toContainText('Confirmed:')
  await goalsMet(page)
  // The flow-directed balloon is still up in the ventricle: the step is not left until the float
  // is finished, which lets the balloon down as the artery appears.
  await expect(page.locator('[data-now-card] [data-now-primary]')).toBeDisabled()
  await expect(page.locator('[data-now-card] [data-now-disabled-reason]')).toContainText(
    'flow-directed balloon is up',
  )
  await page.locator('#hemodynamics-control-advance').click()
  await expect(page.locator('#hemodynamics-control-withdraw')).toBeEnabled({ timeout: 15000 })
  await primary(page)
  await primary(page)
  await skipCase(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})
async function acquireWedge(page: Page) {
  const leave = page.locator('[data-now-card] [data-now-primary]')
  await page.locator('#hemodynamics-control-inflate').click()
  // While the balloon is up nothing lets the learner leave the task.
  await expect(page.locator('[data-now-back]')).toHaveCount(0)
  await expect(leave).toBeDisabled()
  // The cursor is offered once the tracing has settled; the assisted placement is labelled as such.
  await page.locator('[data-cursor-action="assisted"]').click()
  await page.locator('#hemodynamics-control-store').click()
  await expect(page.locator('[data-stored-wedge-provenance]')).toContainText('assisted cursor')
  await expect(leave).toBeDisabled()
  await page.locator('#hemodynamics-control-deflate').click()
  await expect(leave).toBeEnabled()
}
test('wedge requires capture, learner deflation and PA return on both acquisitions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, 'pawp-capture')
  await primary(page)
  await answer(page, /Read at end expiration, store the value/)
  await acquireWedge(page)
  await goalsMet(page)
  await primary(page)
  for (const [block, keyed] of [
    ['Is the stored value plausible?', /^Little\. It still needs wave timing/],
    ['And if it had not come back?', /^Confirm the balloon is fully down, do not flush/],
  ] as const) {
    const commitment = page.getByRole('region', { name: block, exact: true })
    await commitment.getByRole('radio', { name: keyed }).check()
    await commitment.locator('[data-question-check]').click()
    await expect(commitment.locator('[data-answer-verdict]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
  }
  await page.getByRole('button', { name: 'The artery is back', exact: true }).click()
  await expect(page.locator('[data-return-response]')).toHaveAttribute(
    'data-return-response',
    'agrees',
  )
  await goalsMet(page)
  await capture(page, 'wedge-stored-and-pa-return-verified')
  await primary(page)
  await primary(page)
  await answer(page, /Use the end-expiratory point, then deflate/)
  await acquireWedge(page)
  await page.getByRole('button', { name: 'The artery is back', exact: true }).click()
  await goalsMet(page)
  await primary(page)
  await primary(page)
  await skipCase(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})
test('thermodilution ledger precedes Fick and keeps disagreement decisions separate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, 'thermodilution-series')
  await readings(page)
  await primary(page)
  await answer(page, /Accept the two smooth curves and repeat the trial/)
  await decideTrials(page)
  await inject(page)
  await decideTrials(page)
  await expect(page.locator('[data-dock="thermodilution"] article')).toHaveCount(4)
  await expect(page.locator('[data-series-average]')).toBeVisible()
  await goalsMet(page)
  await capture(page, 'accepted-trial-ledger')
  await primary(page)
  await readings(page)
  await page
    .getByRole('radio', { name: /Only the result whose oxygen uptake was measured/ })
    .check()
  await page.getByRole('button', { name: 'Check this reading', exact: true }).click()
  await expect(page.locator('[data-provenance-outcome]')).toHaveAttribute(
    'data-provenance-outcome',
    'correct',
  )
  await primary(page)
  await primary(page)
  await answer(page, /Reject the poor curve and repeat it at end expiration/)
  const lab = page.locator('[data-surface="disagreement"]')
  const correct = [
    /Report the Fick result with its method named/i,
    /Report the thermodilution/i,
    /Withhold both/i,
    /Report both/i,
  ]
  for (let i = 0; i < 4; i++) {
    await lab.getByLabel('Measurement comparison').selectOption(String(i))
    await lab.getByRole('radio', { name: correct[i] }).check()
    await lab.getByRole('button', { name: 'Check this position', exact: true }).click()
    await expect(lab.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  }
  await capture(page, 'methods-remain-separate')
  await lab.getByLabel('Measurement comparison').selectOption('0')
  await expect(lab.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  await primary(page)
  await primary(page)
  await skipCase(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})

test('clinical question and all seven attribution decisions lead to transfer', async ({ page }) => {
  await open(page, 'why-measure')
  await expect(
    page.locator('[data-focused-monitor], [data-catheter-map], [data-dock]'),
  ).toHaveCount(0)
  await primary(page)
  await answer(page, /pressure is low at this site; the output and the cause are still unknown/)
  await primary(page)
  const decisions: Record<string, string> = {
    'pa-pressure': 'measured',
    'wedge-pressure': 'measured',
    'cardiac-output': 'calculated',
    'vascular-resistance': 'calculated',
    'oxygen-delivery': 'calculated',
    'fluid-responsiveness': 'beyond',
    cause: 'beyond',
  }
  for (const [row, value] of Object.entries(decisions))
    await page.locator(`[data-sort-row="${row}"] select`).selectOption(value)
  await page.locator('[data-now-card] [data-question-check]').click()
  await expect(
    page.locator('[data-sort-row="cardiac-output"] [data-sort-verdict]'),
  ).toHaveAttribute('data-sort-verdict', 'not-correct')
  await expect(page.locator('[data-sort-verdict="correct"]')).toHaveCount(6)
  await capture(page, 'clinical-question-attribution-feedback')
  await primary(page)
  await primary(page)
  await answer(page, /Pressures, a thermodilution curve for cardiac output/)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})

test('derived inputs withhold only dependent results and clear an answer on retry', async ({
  page,
}) => {
  await open(page, 'derived-hemodynamics')
  await readings(page)
  const drill = page.locator('[data-surface="provenance-drill"]')
  for (const [label, value] of [
    ['Mean PA pressure on the monitor', 'measured'],
    ['SVR on the flowsheet', 'calculated'],
    ['Body surface area in the chart header', 'calculated'],
    ['The oxygen uptake inside a Fick result with no expired-gas collection', 'assumed'],
    ['Injectate volume typed into the cardiac-output computer', 'entered'],
    ['Mixed-venous saturation on a blood-gas slip', 'sampled'],
  ])
    await drill.getByLabel(label, { exact: true }).selectOption(value)
  await drill.getByRole('button', { name: 'Check these classifications', exact: true }).click()
  await expect(drill.locator('[data-verdict="defensible"]')).toHaveCount(6)
  await primary(page)
  await answer(page, /Withhold SVR until the transducer is leveled and zeroed/)
  const work = page.locator('[data-surface="derived-workbench"]')
  /** One question on the workbench, found by one of its own options. */
  const question = (option: RegExp) =>
    work.locator('fieldset').filter({ has: page.getByRole('radio', { name: option }) })
  const chain = work
    .locator('fieldset')
    .filter({ has: page.getByRole('checkbox', { name: 'Mean PAWP', exact: true }) })
  for (const label of ['Mean pulmonary artery pressure', 'Mean PAWP', 'Cardiac output'])
    await chain.getByRole('checkbox', { name: label, exact: true }).check()
  await chain.getByRole('button', { name: 'Check the dependency chain', exact: true }).click()
  await expect(chain.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  const method = question(/^Bolus thermodilution$/)
  await method.getByRole('radio', { name: 'Bolus thermodilution', exact: true }).check()
  await method.getByRole('button', { name: 'Check the method', exact: true }).click()
  await expect(method.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  // The threshold question opens with the results once the chain and the method are both right.
  const threshold = question(/As a universal rule/)
  const universal = threshold.getByRole('radio', { name: /As a universal rule/ })
  await universal.check()
  await threshold.getByRole('button', { name: 'Check this position', exact: true }).click()
  await expect(threshold.locator('[data-verdict]')).toHaveAttribute(
    'data-verdict',
    'not-defensible',
  )
  // HD-01: Try again clears a checked answer rather than keeping the first one on record.
  await threshold.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(universal).not.toBeChecked()
  await expect(threshold.locator('[data-verdict]')).toHaveCount(0)
  await threshold.getByRole('radio', { name: /As a cohort finding from acute inferior MI/ }).check()
  await threshold.getByRole('button', { name: 'Check this position', exact: true }).click()
  await expect(threshold.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  await work
    .getByRole('tab', { name: 'The stored wedge is not interpretable', exact: true })
    .click()
  await work.getByLabel(/PVR = \(mPAP − mean PAWP\) \/ CO/).selectOption('withhold')
  await work
    .getByLabel('Withholding reason for PVR', { exact: true })
    .selectOption('required-input-invalid-pawp')
  for (const label of [/SVR = 80/, /PAPi = \(PASP/, /CI = CO/])
    await work.getByLabel(label).selectOption('calculate')
  await work.getByRole('button', { name: 'Check these decisions', exact: true }).click()
  await expect(work.locator('[data-verdict="not-defensible"]')).toHaveCount(0)
  await capture(page, 'derived-invalid-wedge-selective-withholding')
  await work
    .getByRole('tab', { name: 'Two defensible flows, two result sets', exact: true })
    .click()
  const twoFlows = question(/Keep two method-labeled result sets/)
  await twoFlows.getByRole('radio', { name: /Keep two method-labeled result sets/ }).check()
  await twoFlows.getByRole('button', { name: 'Check this position', exact: true }).click()
  await expect(twoFlows.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(page, 'derived-two-methods-compact')
  await page.locator('[data-now-back]').click()
  await primary(page)
  await expect(
    work.getByRole('radio', { name: /Keep two method-labeled result sets/ }),
  ).toBeChecked()
  await primary(page)
  await primary(page)
  await answer(page, /No; an irregular rhythm and spontaneous effort/)
  const transfer = page.locator('[data-surface="derived-transfer"]')
  await expect(transfer.getByRole('region', { name: /^Evaluated · / })).toHaveCount(0)
  await transfer.getByRole('radio', { name: /Report the coherent episode’s values/ }).check()
  await transfer.getByRole('button', { name: 'Check this position', exact: true }).click()
  await expect(transfer.locator('fieldset [data-verdict]')).toHaveAttribute(
    'data-verdict',
    'defensible',
  )
  // Checking a position opens the evaluated comparison of the two episodes.
  await expect(transfer.getByRole('region', { name: /^Evaluated · / })).toHaveCount(2)
  await primary(page)
  await primary(page)
  await skipCase(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})

/** Open one of the capstone's tool groups; one may already be open when the catheter needs it. */
async function openTools(page: Page, name: string) {
  const group = page.locator('details').filter({
    has: page.locator('summary').getByText(name, { exact: true }),
  })
  if ((await group.getAttribute('open')) === null)
    await group.locator('summary').getByText(name, { exact: true }).click()
}
test('integration restores actual line, catheter and trial evidence before reassessment', async ({
  page,
}) => {
  await open(page, 'pac-signal-validation')
  await expect(page.getByRole('region', { name: 'Patient brief' })).toContainText(
    'bedside perfusion appears unchanged',
  )
  await primary(page)
  await answer(page, /Set every number aside as unconfirmed/)
  await openTools(page, 'Pressure measurement')
  await page.locator('#hemodynamics-control-level').fill('0')
  await page.locator('#hemodynamics-control-zero').click()
  await expect(page.locator('#hemodynamics-control-flush')).toBeDisabled()
  await openTools(page, 'Catheter and balloon')
  await page.locator('#hemodynamics-control-withdraw').click()
  await expect(page.locator('#hemodynamics-control-flush')).toBeEnabled({ timeout: 15000 })
  await flush(page, 'underdamped')
  await openTools(page, 'Cardiac-output acquisition')
  for (let i = 0; i < 3; i++) await inject(page)
  await decideTrials(page)
  await goalsMet(page)
  await primary(page)
  await page.locator('[data-reassess] button').click()
  await goalsMet(page)
  await primary(page)
  await capture(page, 'integration-retained-response-debrief')
  await primary(page)
  await answer(page, /Run a fast flush first/)
  await flush(page, 'overdamped')
  await goalsMet(page)
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})

test('a section ends on its case: Start the case, Exit case, and back to the section finished', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, 'pressure-system')
  const flow = page.locator('[data-lesson-shell][data-stage]')
  // The last task, opened from the task list: the case, run inside the section.
  await page.getByText('Tasks in this section · open any task', { exact: true }).click()
  await page.locator('[data-step-list] li').last().getByRole('button').click()
  await expect(flow).toHaveAttribute('data-stage', /^pressure-system-\d+-transfer$/)
  const caseStep = await flow.getAttribute('data-stage')
  await expect(
    page.getByRole('heading', { name: 'Apply it: The numbers do not fit the patient' }),
  ).toBeVisible()
  // The section's own patient is not on the page while the case is its task.
  await expect(page.locator('[data-focused-monitor], [data-dock]')).toHaveCount(0)
  await primary(page)
  await expect(page.locator('[data-now-card] [data-case-strip]')).toHaveText(
    'Case · The numbers do not fit the patient · the last task of Section 2',
  )
  await expect(page.locator('[data-now-card] [data-now-primary]')).toHaveCount(0)
  await capture(page, 'section-2-case-open')
  await page.getByRole('button', { name: 'Exit case', exact: true }).click()
  // Back on section 2, still on its last task, with the completion card up.
  await expect(page).toHaveURL(/activity=pressure-system/)
  await expect(flow).toHaveAttribute('data-stage', caseStep!)
  await expect(page.locator('[data-case-flow]')).toHaveCount(0)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
  await expect(
    page.locator('[data-stage-completion] [data-next-section="waveform-interpretation"]'),
  ).toBeVisible()
})

async function openCase(page: Page, route: string) {
  await page.goto(route)
  await page.bringToFront()
  await expect(
    page.getByRole('button', { name: 'Orient to the patient and signals', exact: true }),
  ).toBeVisible()
}
async function caseInterpretation(page: Page, mechanism: string, priority: string) {
  await page.getByRole('button', { name: 'Orient to the patient and signals', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Suspected mechanism', exact: true })
    .selectOption(mechanism)
  await page
    .getByRole('combobox', { name: 'Immediate priority', exact: true })
    .selectOption(priority)
  await page.getByRole('button', { name: 'Record mechanism and priority', exact: true }).click()
}
/** The case's pressure workspace; its panel may already be open from an earlier phase. */
async function openPressureWorkspace(page: Page) {
  const summary = page.getByText('Pressure measurement · level, zero and response', {
    exact: true,
  })
  const panel = page.locator('details').filter({ has: summary })
  if ((await panel.getAttribute('open')) === null) await summary.click()
}
async function caseSignal(page: Page) {
  await openPressureWorkspace(page)
  await page.getByRole('button', { name: 'Open to air + zero', exact: true }).click()
  await page.getByRole('button', { name: /fast-flush response check/i }).click()
}
async function debriefAndTransfer(page: Page, name: string, feedback?: 'immediate' | 'deferred') {
  await page.getByRole('button', { name: 'Observe the modeled response', exact: true }).click()
  await page.getByRole('button', { name: 'Observe 15 model seconds', exact: true }).click()
  await capture(page, `${name}-response`)
  if (feedback === 'deferred') await expect(page.locator('[data-feedback-timing]')).toHaveCount(0)
  if (feedback === 'immediate')
    await expect(page.locator('[data-feedback-timing]')).not.toHaveCount(0)
  await page.getByRole('button', { name: 'Reassess and open the debrief', exact: true }).click()
  await page
    .getByLabel('My working frame', { exact: true })
    .fill(
      'I compared the acquisition context, pressure pattern and the response to the modeled action.',
    )
  await page
    .getByRole('button', { name: 'Capture this frame and reveal the trace', exact: true })
    .click()
  await capture(page, `${name}-debrief`)
  await page.getByRole('radio', { name: 'Which cue I trusted', exact: true }).check()
  await page.getByRole('button', { name: /Continue to the signal-transfer variant/ }).click()
  await page
    .getByLabel('An off-level, overdamped measurement chain that requires revalidation', {
      exact: true,
    })
    .check()
  await expect(page.locator('[data-transfer-feedback]')).toContainText(
    'Best-supported interpretation',
  )
  // The answer alone does not revalidate the line: the line is re-levelled and its response read.
  const confirm = page.getByRole('button', { name: 'Confirm the line is revalidated', exact: true })
  await expect(confirm).toBeDisabled()
  await openPressureWorkspace(page)
  await page.getByLabel(/Transducer relative to phlebostatic axis/).fill('0')
  await page.getByRole('button', { name: /fast-flush response check/i }).click()
  await page.getByRole('radio', { name: /Overdamped.*Sluggish return/i }).check()
  await page.getByRole('button', { name: 'Check classification', exact: true }).click()
  await page
    .getByRole('button', { name: 'Resolve the pressure-system response', exact: true })
    .click()
  await confirm.click()
  await expect(page.locator('[data-transfer-complete]')).toBeVisible()
}

test('Practice preserves all interventions, retained response, debrief, transfer and the way back to the cases', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openCase(page, '/en/icu-hemodynamics/practice?case=HD-01')
  await caseInterpretation(page, 'underfilled', 'validate-preload')
  await expect(page.getByRole('region', { name: 'Case debrief' })).toHaveCount(0)
  await caseSignal(page)
  const actions = page.getByLabel('Bounded simulated interventions')
  await expect(actions.getByRole('button')).toHaveCount(5)
  await actions.getByRole('button', { name: /^PLR/ }).click()
  await actions.getByRole('button', { name: /^Fluid \+250/ }).click()
  await debriefAndTransfer(page, 'practice-hd01')
  // On its own page a case ends back at the case list; it no longer carries a next section.
  await expect(page.getByRole('link', { name: 'Back to all cases', exact: true })).toHaveAttribute(
    'href',
    /\/icu-hemodynamics\/practice$/,
  )
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Orient to the patient and signals', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Suspected mechanism', { exact: true })).toHaveCount(0)
})
// Teaching-first (2026-10-08): the applied case gives feedback as the learner acts by default, and
// holding it until the debrief is the learner's choice. Safety interrupts appear either way.
for (const feedback of ['deferred', 'immediate'] as const) {
  test(`Challenge keeps safety interrupts with ${feedback} teaching feedback`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openCase(page, '/en/icu-hemodynamics/assess?start=1')
    await expect(
      page.getByText('Model reference: internal physiology and anatomy', { exact: true }),
    ).toHaveCount(0)
    const caseFlow = page.locator('[data-case-flow]')
    const hold = page.getByRole('checkbox', { name: /Hold teaching feedback until the debrief/ })
    await expect(hold).not.toBeChecked()
    await expect(caseFlow).toHaveAttribute('data-feedback-mode', 'immediate')
    if (feedback === 'deferred') await hold.check()
    await expect(caseFlow).toHaveAttribute('data-feedback-mode', feedback)
    await caseInterpretation(page, 'tamponade', 'relieve-constraint')
    await expect(hold).toHaveCount(0)
    await caseSignal(page)
    const actions = page.getByLabel('Bounded simulated interventions')
    await expect(actions.getByRole('button')).toHaveCount(4)
    await actions.getByRole('button', { name: /^PEEP ↑/ }).click()
    await expect(page.getByText('Action paused for safety', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Patient brief' })).toContainText('PEEP 5')
    await capture(page, `challenge-${feedback}-safety-interrupt`)
    await page
      .getByRole('button', {
        name: 'Rewind to before this action',
      })
      .click()
    await expect(page.getByText('Action paused for safety', { exact: true })).toHaveCount(0)
    await expect(actions.getByRole('button', { name: /^PEEP ↑/ })).toBeEnabled()
    await actions.getByRole('button', { name: /^Pericardial drainage/ }).click()
    await debriefAndTransfer(page, `challenge-${feedback}`, feedback)
  })
}
test('all eight existing Practice case briefs remain available', async ({ page }) => {
  for (let i = 1; i <= 8; i++) {
    const id = `HD-0${i}`
    await openCase(page, `/en/icu-hemodynamics/practice?case=${id}`)
    await expect(page.locator('[data-case-workspace]')).toHaveCount(1)
    await capture(page, `${id}-brief`)
  }
})
