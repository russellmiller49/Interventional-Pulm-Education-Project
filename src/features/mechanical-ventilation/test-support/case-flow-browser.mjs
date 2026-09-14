/** Public-UI case journeys; npx tsx. Scores remain the original scorer's results, never seeded. */
import { chromium, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const {
  mechanicalVentilationCases,
  mechanicalVentilationCaseById,
} = require('../content/runtimeCases.ts')
const { selectVentilationAssessmentCaseId } = require('../content/lessons.ts')
const { selectVentilationTransferCaseId } = require('../content/caseTransfer.ts')
const { ventilationCasePresentationTitle } = require('../content/casePresentation.ts')
const devices = ['hamilton-c6', 'drager-evita-v800-v600', 'puritan-bennett-980', 'carefusion-avea']
const base = process.env.MV_REVIEW_URL ?? 'http://127.0.0.1:3161'
const output = path.resolve(process.env.MV_REVIEW_OUTPUT ?? 'artifacts/mv-cases')
await mkdir(output, { recursive: true })
const browser = await chromium.launch(),
  results = []
const seed = 'task-flow-challenge'
const challenge = mechanicalVentilationCaseById.get(
  selectVentilationAssessmentCaseId(
    seed,
    mechanicalVentilationCases.map((item) => item.id),
  ),
)
const scenarios = [
  ...mechanicalVentilationCases.map((definition, i) => ({
    definition,
    device: devices[i % 4],
    mode: 'practice',
  })),
  { definition: mechanicalVentilationCaseById.get('MV-01'), device: 'hamilton-c6', mode: 'guided' },
  { definition: challenge, device: 'carefusion-avea', mode: 'challenge' },
]
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
try {
  for (const { definition, device, mode } of scenarios) {
    if (process.env.MV_REVIEW_CASE && definition.id !== process.env.MV_REVIEW_CASE) continue
    const page = await browser.newPage({
      ...(process.env.MV_REVIEW_STORAGE ? { storageState: process.env.MV_REVIEW_STORAGE } : {}),
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    })
    const errors = [],
      prefix = `${definition.id}-${mode}-${device}`
    page.on('pageerror', (error) => errors.push(error.message))
    const shot = async (phase) => {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(output, `${prefix}-${phase}.png`), fullPage: true })
    }
    const stored = async () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('mechanical-ventilation-session-v1') ?? 'null'),
      )
    try {
      await page.goto(
        `${base}/en/mechanical-ventilation/${mode === 'challenge' ? `assess?case=masked-seeded&seed=${seed}&device=${device}` : `practice?case=${definition.id}&device=${device}&mode=${mode}`}`,
      )
      await expect(page.locator('[data-case-flow]')).toHaveAttribute(
        'data-case-flow',
        'recognize',
        { timeout: 30000 },
      )
      await page.clock.install()
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        ventilationCasePresentationTitle(definition.id),
      )
      await expect(
        page.locator('[data-case-flow]').getByRole('combobox', { name: 'Suspected mechanism' }),
      ).toHaveCount(0)
      await shot('brief')
      await page.getByRole('button', { name: 'One breath', exact: true }).click()
      await expect(page.locator('[data-case-flow]')).toHaveAttribute('data-case-flow', 'predict')
      if (mode === 'guided') await page.getByRole('button', { name: 'Begin management' }).click()
      else {
        await page
          .getByRole('combobox', { name: 'Suspected mechanism' })
          .selectOption(definition.correctMechanismId)
        await page
          .getByRole('combobox', { name: 'Immediate safety priority' })
          .selectOption(definition.correctPriorityId)
        await page
          .getByRole('combobox', { name: 'Expected physiologic response' })
          .selectOption(definition.correctResponseId)
        await page.getByRole('button', { name: 'Commit prediction' }).click()
      }
      await expect(page.locator('[data-case-flow]')).toHaveAttribute('data-case-flow', 'act')
      await expect(
        page.locator('[data-case-flow]').getByRole('combobox', { name: 'Suspected mechanism' }),
      ).toHaveCount(0)
      const actions = [...new Set(['assess-patient', ...definition.requiredInterventionIds])]
      const performed = []
      for (const id of actions) {
        const intervention = definition.interventions.find((item) => item.id === id)
        if (!intervention) continue
        const button = page.getByRole('button', {
          name: new RegExp(`^${escape(intervention.label)}`),
        })
        if (await button.isEnabled()) {
          await button.click()
          performed.push(id)
        }
      }
      if (definition.id === 'MV-15' && mode === 'practice') {
        await expect(page.locator('[data-mv-coaching-pending]')).toBeVisible()
        await shot('pending-response')
        for (
          let breath = 0;
          breath < 90 && (await page.locator('[data-mv-coaching-pending]').count());
          breath++
        )
          await page.getByRole('button', { name: 'One breath', exact: true }).click()
        await expect(page.locator('[data-mv-post-action-coaching]')).toBeVisible()
      }
      if (mode === 'challenge') {
        await expect(
          page.getByRole('checkbox', { name: 'Show teaching notes after each action' }),
        ).not.toBeChecked()
        await expect(page.locator('[data-mv-post-action-coaching]')).toHaveCount(0)
        await page.getByRole('checkbox', { name: 'Show teaching notes after each action' }).check()
        await page
          .getByRole('checkbox', { name: 'Show teaching notes after each action' })
          .uncheck()
      }
      await shot('management')
      const beforeReview = await stored()
      await page.getByRole('button', { name: 'Review response and reassess' }).click()
      await expect(page.locator('[data-case-flow]')).toHaveAttribute('data-case-flow', 'observe')
      const afterReview = await stored()
      expect(afterReview.engineSeed).toBe(beforeReview.engineSeed)
      expect(afterReview.events).toEqual(beforeReview.events)
      for (const id of definition.requiredReassessmentIds) {
        const intervention = definition.interventions.find((item) => item.id === id)
        if (!intervention) continue
        const button = page.getByRole('button', {
          name: new RegExp(`^${escape(intervention.label)}`),
        })
        if (await button.isEnabled()) await button.click()
      }
      await page.getByRole('button', { name: 'One breath', exact: true }).click()
      await page.getByRole('button', { name: 'Commit reassessment' }).click()
      await page.getByRole('button', { name: 'Review case debrief' }).click()
      await expect(page.getByRole('region', { name: 'Working simulation' })).toBeHidden()
      await expect(page.getByRole('region', { name: 'Case debrief' })).toBeVisible()
      const width = await page
        .getByRole('region', { name: 'Case debrief' })
        .evaluate((node) => node.clientWidth)
      expect(width).toBeGreaterThan(900)
      await shot('debrief')
      await page.reload()
      await expect(page.locator('[data-case-flow]')).toHaveAttribute('data-case-flow', 'explain')
      await page.getByRole('button', { name: 'Load contrasting transfer patient' }).click()
      const transfer = mechanicalVentilationCaseById.get(
        selectVentilationTransferCaseId(definition.id),
      )
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        ventilationCasePresentationTitle(transfer.id),
      )
      await expect(page.getByRole('region', { name: 'Case debrief' })).toHaveCount(0)
      const primaryCheckpoint = await stored()
      const transferTime = page.locator('[data-transfer-time]')
      const initialTime = Number(await transferTime.getAttribute('data-transfer-time'))
      await page.getByRole('button', { name: 'Advance one transfer breath' }).click()
      const steppedTime = Number(await transferTime.getAttribute('data-transfer-time'))
      expect(steppedTime).toBeGreaterThan(initialTime)
      await page.getByRole('button', { name: 'Run transfer patient' }).click()
      await page.clock.runFor(1500)
      await page.getByRole('button', { name: 'Pause transfer patient' }).click()
      expect(Number(await transferTime.getAttribute('data-transfer-time'))).toBeGreaterThan(
        steppedTime,
      )
      const afterPlayback = await stored()
      expect(afterPlayback.events).toEqual(primaryCheckpoint.events)
      expect(afterPlayback.simulationTime).toBe(primaryCheckpoint.simulationTime)
      await page.getByRole('button', { name: 'Submit transfer review' }).click()
      await expect(page.getByRole('link', { name: 'Choose the next activity' })).toHaveCount(0)
      await page
        .getByRole('radio', {
          name: transfer.mechanismOptions.find((item) => item.id === transfer.correctMechanismId)
            .label,
          exact: true,
        })
        .check()
      await page.getByRole('button', { name: 'Record bedside review' }).click()
      await page.getByRole('button', { name: 'Submit transfer review' }).click()
      await expect(page.getByRole('link', { name: 'Choose the next activity' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Document multitrace review' }).click()
      await page.getByRole('button', { name: 'Submit transfer review' }).click()
      await expect(page.getByRole('link', { name: 'Choose the next activity' })).toBeVisible()
      await shot('transfer')
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const violations = await page.evaluate(async () =>
        (await window.axe.run(document.querySelector('[data-case-flow]'))).violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      )
      await writeFile(path.join(output, `${prefix}-axe.json`), JSON.stringify(violations, null, 2))
      expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
        [],
      )
      expect(errors).toEqual([])
      results.push({
        caseId: definition.id,
        device,
        mode,
        performed,
        debriefWidth: width,
        transfer: transfer.id,
        errors,
      })
      console.log(
        `PASS ${prefix}: work, reassessment, wide debrief, replay, required transfer actions`,
      )
    } catch (error) {
      await shot('failure')
      console.error(
        await page
          .locator('[data-case-flow]')
          .innerText()
          .catch(() => page.url()),
      )
      console.error(JSON.stringify({ errors, checkpoint: await stored() }, null, 2))
      throw error
    } finally {
      await page.close()
    }
  }
} finally {
  await writeFile(path.join(output, 'case-flow-results.json'), JSON.stringify(results, null, 2))
  await browser.close()
}
