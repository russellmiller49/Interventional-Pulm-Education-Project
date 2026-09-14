import { expect, type Page } from '@playwright/test'
import type { Lab } from '../../src/features/ebus-guided/content/types'
import type { LessonActivity } from '../../src/features/ebus-guided/content/stage'
import { linkedObservation } from './browser-linked-actions'

export async function performRecorded(page: Page, lab: Lab) {
  const frame = page.frameLocator('iframe[title="EBUS workbench"]')
  await expect
    .poll(async () => (await linkedObservation(page))?.recorded?.taskId, { timeout: 60000 })
    .toBe(lab.goal)
  expect(await frame.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(
    true,
  )
  const prior = await frame
    .locator('[data-recorded-baseline]')
    .getAttribute('src')
    .catch(() => null)
  const click = (name: string) => frame.getByRole('button', { name, exact: true }).click()
  if (lab.goal === 'depth') {
    await frame.getByLabel('Image depth').fill('1')
    await expect
      .poll(async () => (await linkedObservation(page))?.recorded?.settings.depthMm)
      .toBe(30)
    await frame.getByLabel('Image depth').fill('2')
  }
  if (lab.goal === 'gain') {
    await frame.getByLabel('Image gain').fill('3')
    await expect.poll(async () => (await linkedObservation(page))?.recorded?.settings.gain).toBe(43)
    await frame.getByLabel('Image contrast').fill('4')
    await expect
      .poll(async () => (await linkedObservation(page))?.recorded?.settings.contrast)
      .toBe(57)
    await frame.getByLabel('Image gain').fill('4')
  }
  if (lab.goal === 'doppler') await click('Color Doppler')
  if (lab.goal === 'capture') {
    await click('Freeze image')
    await click('Measure')
    await click('Left')
    await click('Set first caliper')
    await click('Right')
    await click('Right')
    await click('Save image')
    await expect(
      frame.getByAltText('Saved teaching image with the calipers you placed'),
    ).toBeVisible()
  }
  await expect(page.locator('[data-now-primary]')).toBeEnabled({ timeout: 30000 })
  if (prior) expect(await frame.locator('[data-recorded-baseline]').getAttribute('src')).toBe(prior)
}

export async function performRecord(page: Page, activity: LessonActivity) {
  const task = activity.recordTask!,
    caseData = activity.caseData!
  const field = (name: string, value: string) =>
    page.getByLabel(name, { exact: true }).selectOption(value)
  if (task === 'station-window') {
    await field('Visualization supported by this image', 'described')
    await field('Basis for station identity', 'landmarks')
    await field('Extent supported by this acquisition', 'window-only')
  }
  if (task === 'node-description') {
    await field('Description supported by the vignette', 'appearance-only')
    await field('Measurement context', 'not-supplied')
  }
  if (task === 'plan') {
    for (const station of caseData.stations) {
      await page.getByLabel('Plan assessment of ' + station.id, { exact: true }).check()
      await field('N category for ' + station.id + ' if malignant', station.category!)
    }
    await field('How many anatomical stations do the two 4R nodes represent?', 'one')
  }
  if (task === 'adequacy') {
    await field('What does the on-site communication establish?', 'provisional')
    await field('Next specimen decision', 'reconcile-safety')
    await field('If ROSE is unavailable for a later procedure', 'planned-handling')
  }
  if (task === 'allocation') {
    for (const specimen of caseData.specimens)
      for (const test of specimen.requestedTests)
        await field(
          'Handling plan: ' + specimen.label + ' — ' + test.name,
          test.protocol ? 'protocol' : 'clarify-laboratory',
        )
    await field('Identity at specimen handoff', 'separate')
  }
  if (task === 'report') {
    for (const node of caseData.nodes) {
      await field(node.label + ': visualization', node.visualization)
      await field(node.label + ': sampling', node.sampling)
      if (node.samplingReason) await field(node.label + ': reason not sampled', node.samplingReason)
    }
    await field('Overall examination conclusion', 'incomplete')
    await field('Responsibility for closing the loop', 'responsible-team')
    for (const option of caseData.reportOptions)
      await page.getByLabel(option.text, { exact: true }).check()
  }
  await page.getByRole('button', { name: 'Check and save record', exact: true }).click()
  await expect(page.getByText('Record task checked.', { exact: false })).toBeVisible()
}
