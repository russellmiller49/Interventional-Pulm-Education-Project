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
async function flush(page: Page, response: string) {
  await page.locator('#hemodynamics-control-flush').click()
  await page.locator(`[data-flush-classification] input[value="${response}"]`).check()
  await page.getByRole('button', { name: 'Say what it is', exact: true }).click()
  if (response !== 'acceptable') {
    await page
      .getByRole('button', { name: 'Apply the simulated line correction', exact: true })
      .click()
    await expect(page.locator('[data-flush-stale]')).toBeVisible()
    if (
      (await page.locator('[data-stage]').getAttribute('data-stage'))?.startsWith('pressure-system')
    )
      await expect(page.locator('[data-now-primary]')).toHaveCount(0)
    await flush(page, 'acceptable')
  }
}

test('pressure flow preserves independent baselines, complete repair and transfer', async ({
  page,
}) => {
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
  await page
    .locator('[data-prediction-choices]')
    .getByRole('radio', { name: /off level, not zeroed, and underdamped/ })
    .check()
  await primary(page)
  await primary(page)
  await page.locator('#hemodynamics-control-level').fill('0')
  await page.locator('#hemodynamics-control-zero').click()
  await primary(page)
  await flush(page, 'underdamped')
  await primary(page)
  await expect(page.locator('[data-before-after] tbody tr')).toHaveCount(4)
  await capture(page, 'pressure-repaired-comparison')
  await primary(page)
  await page.locator('[data-prediction-choices] input').first().check()
  await primary(page)
  await primary(page)
  await page.locator('#hemodynamics-control-level').fill('0')
  if (await page.locator('#hemodynamics-control-zero').isEnabled())
    await page.locator('#hemodynamics-control-zero').click()
  await flush(page, 'overdamped')
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
  await page.reload()
  await expect(flow).toHaveAttribute('data-stage', 'pressure-system-1-recognize')
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('icu-hemodynamics-learn-v1') || '{}').completedSectionIds,
    ),
  ).toContain('pressure-system')
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
async function answer(page: Page, label?: RegExp) {
  const choices = page.locator('[data-prediction-choices]')
  await (
    label ? choices.getByRole('radio', { name: label }) : choices.getByRole('radio').first()
  ).check()
  await primary(page)
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
  await primary(page)
  await primary(page)
  const drill = page.locator('[data-surface="recognition"]')
  for (const name of [
    'Right ventricle',
    'Pulmonary artery',
    'Pulmonary capillary wedge',
    'Right atrium / CVP',
    'Pulmonary artery',
  ]) {
    await drill.getByRole('radio', { name, exact: true }).check()
    await drill.getByRole('button', { name: 'Check answer', exact: true }).click()
    if (!(await drill.getByText(/5 of 5 correct/).count()))
      await drill.getByRole('button', { name: 'Next tracing', exact: true }).click()
  }
  await page.locator('[data-now-back]').click()
  await primary(page)
  await expect(drill).toContainText('5 of 5 correct')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(drill).toContainText('5 of 5 correct')
  await capture(page, 'waveform-completed-record-compact')
  await primary(page)
  await primary(page)
  await page.locator('[data-catheter-map-answer]').getByText(/wedge/i).first().click()
  await primary(page)
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})
test('advancement uses actual transit, confirmation, repair and transfer controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, 'catheter-advancement')
  await primary(page)
  await answer(page)
  for (const name of ['The right atrium', 'The right ventricle', 'The pulmonary artery']) {
    if (name !== 'The right atrium') await page.locator('#hemodynamics-control-advance').click()
    await expect(page.locator('#hemodynamics-control-withdraw')).toBeEnabled({ timeout: 15000 })
    await expect(async () => {
      await page.locator('[data-catheter-map-answer]').getByText(name, { exact: true }).click()
      await expect(page.locator('[data-place-note]')).toContainText('Confirmed:')
    }).toPass({ timeout: 15000 })
  }
  await capture(page, 'advancement-confirmed-pa')
  await primary(page)
  await primary(page)
  await primary(page)
  await answer(page)
  await flush(page, 'underdamped')
  await page.locator('#hemodynamics-control-advance').click()
  await expect(page.locator('#hemodynamics-control-withdraw')).toBeEnabled({ timeout: 15000 })
  await page
    .locator('[data-catheter-map-answer]')
    .getByText('The right ventricle', { exact: true })
    .click()
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})
async function acquireWedge(page: Page) {
  await page.locator('#hemodynamics-control-inflate').click()
  await expect(page.locator('[data-now-back]')).toHaveCount(0)
  await page.locator('#hemodynamics-control-cursor').click()
  await page.locator('#hemodynamics-control-store').click()
  await expect(page.locator('[data-now-primary]')).toHaveCount(0)
  await page.locator('#hemodynamics-control-deflate').click()
}
test('wedge requires capture, learner deflation and PA return on both acquisitions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, 'pawp-capture')
  await primary(page)
  await answer(page, /Place the cursor at end expiration/)
  await acquireWedge(page)
  await primary(page)
  for (const block of await page.locator('[data-commitment]').all()) {
    await block.getByRole('radio').first().check()
    await block.getByRole('button', { name: 'Commit this answer', exact: true }).click()
  }
  await page.getByRole('button', { name: 'The artery is back', exact: true }).click()
  await capture(page, 'wedge-stored-and-pa-return-verified')
  await primary(page)
  await primary(page)
  await answer(page)
  await acquireWedge(page)
  await page.getByRole('button', { name: 'The artery is back', exact: true }).click()
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})
test('thermodilution ledger precedes Fick and keeps disagreement decisions separate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, 'thermodilution-series')
  await readings(page)
  await primary(page)
  await answer(page)
  await decideTrials(page)
  await inject(page)
  await decideTrials(page)
  await capture(page, 'accepted-trial-ledger')
  await primary(page)
  await readings(page)
  await page
    .getByRole('radio', { name: /Only the result whose oxygen uptake was measured/ })
    .check()
  await page.getByRole('button', { name: 'Commit this answer', exact: true }).click()
  await primary(page)
  await primary(page)
  await answer(page)
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
    await lab.getByRole('button', { name: 'Commit this position', exact: true }).click()
    await expect(lab.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  }
  await capture(page, 'methods-remain-separate')
  await lab.getByLabel('Measurement comparison').selectOption('0')
  await expect(lab.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'defensible')
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})

test('clinical question and all seven attribution decisions lead to transfer', async ({ page }) => {
  await open(page, 'why-measure')
  await expect(
    page.locator('[data-focused-monitor], [data-catheter-map], [data-dock]'),
  ).toHaveCount(0)
  await primary(page)
  await answer(page, /arterial pressure is low at the measurement site/)
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
  await primary(page)
  await expect(
    page.locator('[data-sort-row="cardiac-output"] [data-sort-verdict]'),
  ).toHaveAttribute('data-sort-verdict', 'not-correct')
  await capture(page, 'clinical-question-attribution-feedback')
  await primary(page)
  await primary(page)
  await answer(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})

test('derived inputs withhold only dependent results and retain the first answer on retry', async ({
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
  await drill.getByRole('button', { name: 'Commit these classifications', exact: true }).click()
  await primary(page)
  await answer(page)
  const work = page.locator('[data-surface="derived-workbench"]')
  for (const label of ['Mean pulmonary artery pressure', 'Mean PAWP', 'Cardiac output'])
    await work.getByRole('checkbox', { name: label, exact: true }).check()
  await work.getByRole('button', { name: 'Commit the dependency chain', exact: true }).click()
  await work.getByRole('radio', { name: 'Bolus thermodilution', exact: true }).check()
  await work.getByRole('button', { name: 'Commit the method', exact: true }).click()
  await work.getByRole('radio', { name: /As a universal rule/ }).check()
  await work.getByRole('button', { name: 'Commit this position', exact: true }).click()
  await work.getByRole('button', { name: 'Reconsider and commit again', exact: true }).click()
  await work.getByRole('radio', { name: /As a cohort finding from acute inferior MI/ }).check()
  await work.getByRole('button', { name: 'Commit this position', exact: true }).click()
  await expect(work.locator('[data-first-commitment]')).toContainText('As a universal rule')
  await work
    .getByRole('tab', { name: 'The stored wedge is not interpretable', exact: true })
    .click()
  await work.getByLabel(/PVR = \(mPAP − mean PAWP\) \/ CO/).selectOption('withhold')
  await work
    .getByLabel('Withholding reason for PVR', { exact: true })
    .selectOption('required-input-invalid-pawp')
  for (const label of [/SVR = 80/, /PAPi = \(PASP/, /CI = CO/])
    await work.getByLabel(label).selectOption('calculate')
  await work.getByRole('button', { name: 'Commit these decisions', exact: true }).click()
  await capture(page, 'derived-invalid-wedge-selective-withholding')
  await work
    .getByRole('tab', { name: 'Two defensible flows, two result sets', exact: true })
    .click()
  await work.getByRole('radio', { name: /Keep two method-labeled result sets/ }).check()
  await work.getByRole('button', { name: 'Commit this position', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(page, 'derived-two-methods-compact')
  await page.locator('[data-now-back]').click()
  await primary(page)
  await expect(
    work.getByRole('radio', { name: /Keep two method-labeled result sets/ }),
  ).toBeChecked()
  await primary(page)
  await primary(page)
  await answer(page)
  const transfer = page.locator('[data-surface="derived-transfer"]')
  await transfer.getByRole('radio', { name: /Report the coherent episode’s values/ }).check()
  await transfer.getByRole('button', { name: 'Commit this position', exact: true }).click()
  await transfer
    .getByRole('button', { name: 'I have chosen and read the comparison', exact: true })
    .click()
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
})

test('integration restores actual line, catheter and trial evidence before reassessment', async ({
  page,
}) => {
  await open(page, 'pac-signal-validation')
  await expect(page.getByRole('region', { name: 'Patient brief' })).toContainText(
    'bedside perfusion appears unchanged',
  )
  await primary(page)
  await answer(page, /Set every number aside as unconfirmed/)
  await page.getByText('Pressure measurement', { exact: true }).click()
  await page.locator('#hemodynamics-control-level').fill('0')
  await page.locator('#hemodynamics-control-zero').click()
  await expect(page.locator('#hemodynamics-control-flush')).toBeDisabled()
  await page.getByText('Catheter and balloon', { exact: true }).click()
  await page.locator('#hemodynamics-control-withdraw').click()
  await expect(page.locator('#hemodynamics-control-flush')).toBeEnabled({ timeout: 15000 })
  await flush(page, 'underdamped')
  await page.getByText('Cardiac-output acquisition', { exact: true }).click()
  for (let i = 0; i < 3; i++) await inject(page)
  await decideTrials(page)
  await primary(page)
  await page.locator('[data-reassess] button').click()
  await primary(page)
  await capture(page, 'integration-retained-response-debrief')
  await primary(page)
  await answer(page, /Run a fast flush and read how the line settles/)
  await flush(page, 'overdamped')
  await primary(page)
  await primary(page)
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
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
  await page.getByRole('button', { name: 'Commit mechanism and priority', exact: true }).click()
}
async function caseSignal(page: Page) {
  await page.getByText('Pressure measurement · level, zero and response', { exact: true }).click()
  await page.getByRole('button', { name: 'Open to air + zero', exact: true }).click()
  await page.getByRole('button', { name: /fast-flush response check/i }).click()
}
async function debriefAndTransfer(page: Page, name: string) {
  await page.getByRole('button', { name: 'Observe the modeled response', exact: true }).click()
  await page.getByRole('button', { name: 'Observe 15 model seconds', exact: true }).click()
  await capture(page, `${name}-response`)
  if (name === 'challenge-false')
    await expect(page.locator('[data-feedback-timing]')).toHaveCount(0)
  if (name === 'challenge-true')
    await expect(page.locator('[data-feedback-timing]')).not.toHaveCount(0)
  await page.getByRole('button', { name: 'Commit final reassessment', exact: true }).click()
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
  await page.getByText('Pressure measurement · level, zero and response', { exact: true }).click()
  await page.getByLabel(/Transducer relative to phlebostatic axis/).fill('0')
  await page.getByRole('button', { name: /fast-flush response check/i }).click()
  await page.getByRole('radio', { name: /Overdamped.*Sluggish return/i }).check()
  await page.getByRole('button', { name: 'Check classification', exact: true }).click()
  await page
    .getByRole('button', { name: 'Resolve the pressure-system response', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Complete transfer and keep the reasoning feedback', exact: true })
    .click()
}

test('Practice preserves all interventions, retained response, debrief, transfer and next Learn', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openCase(page, '/en/icu-hemodynamics/practice?case=HD-01&nextLearn=waveform-interpretation')
  await caseInterpretation(page, 'underfilled', 'validate-preload')
  await expect(page.getByRole('region', { name: 'Case debrief' })).toHaveCount(0)
  await caseSignal(page)
  const actions = page.getByLabel('Bounded simulated interventions')
  await expect(actions.getByRole('button')).toHaveCount(5)
  await actions.getByRole('button', { name: /^PLR/ }).click()
  await actions.getByRole('button', { name: /^Fluid \+250/ }).click()
  await debriefAndTransfer(page, 'practice-hd01')
  await expect(page.getByRole('link', { name: 'Continue learning', exact: true })).toHaveAttribute(
    'href',
    /activity=waveform-interpretation/,
  )
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Orient to the patient and signals', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Suspected mechanism', { exact: true })).toHaveCount(0)
})
for (const immediate of [false, true]) {
  test(`Challenge keeps safety interrupts with ${immediate ? 'immediate' : 'deferred'} teaching feedback`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openCase(page, '/en/icu-hemodynamics/assess?start=1')
    await expect(
      page.getByText('Model reference: internal physiology and anatomy', { exact: true }),
    ).toHaveCount(0)
    const preference = page.getByRole('checkbox', { name: /Show teaching feedback as I work/ })
    await expect(preference).not.toBeChecked()
    if (immediate) await preference.check()
    await caseInterpretation(page, 'tamponade', 'relieve-constraint')
    await expect(preference).toHaveCount(0)
    await caseSignal(page)
    const actions = page.getByLabel('Bounded simulated interventions')
    await expect(actions.getByRole('button')).toHaveCount(4)
    await actions.getByRole('button', { name: /^PEEP ↑/ }).click()
    await expect(page.getByText('Action paused for safety', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Patient brief' })).toContainText('PEEP 5')
    await capture(page, `challenge-${immediate}-safety-interrupt`)
    await page
      .getByRole('button', {
        name: 'Rewind to before this action',
      })
      .click()
    await actions.getByRole('button', { name: /^Drainage pathway/ }).click()
    await debriefAndTransfer(page, `challenge-${immediate}`)
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
