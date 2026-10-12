import { expect, type FrameLocator } from '@playwright/test'
import type { ModelPackage } from '../../src/lib/ebus-model-contract'
export async function performModel(frame: FrameLocator, pkg: ModelPackage) {
  const click = (name: string) => frame.getByRole('button', { name, exact: true }).click()
  await expect(frame.locator('[data-model-frame]')).toHaveAttribute(
    'data-model-frame',
    /additional-models-v1/,
    { timeout: 60000 },
  )
  if (pkg === 'needle') {
    await frame.getByLabel('Sheath position', { exact: true }).selectOption('1')
    await click('Lock sheath')
    await click('Advance needle one increment')
    await click('Remove assembly')
    await expect(frame.getByRole('status')).toContainText('Do not remove')
    await click('Freeze reference image')
    await click('Advance needle one increment')
    await expect(frame.getByRole('status')).toContainText('blocked')
    await click('Return to live image')
    await click('Change imaging plane')
    await click('Advance needle one increment')
    await expect(frame.getByRole('status')).toContainText('blocked')
    await click('Stop and reassess')
    await click('Restore demonstration window')
    await click('Introduce resistance')
    await click('Advance needle one increment')
    await expect(frame.getByRole('status')).toContainText('blocked')
    await click('Stop and reassess')
    await click('Retract needle fully')
    await click('Remove assembly')
  }
  if (pkg === 'contact') {
    await frame.getByLabel('Gain · illustrative', { exact: false }).fill('90')
    await click('Inspect acoustic path')
    await expect(frame.getByRole('status')).toContainText('has not restored')
    for (const mode of ['direct', 'balloon', 'bubble', 'shadow']) {
      await frame.getByLabel('Contact condition', { exact: true }).selectOption(mode)
      await click('Inspect acoustic path')
    }
  }
  if (pkg === 'measurement') {
    // Two steps, both on the elongated shape the activity opens on: one sweep, one measurement.
    const steps = frame.locator('.model-steps')
    const status = frame.locator('.model-feedback')
    await expect(frame.getByLabel('Shape', { exact: true })).toHaveValue('ellipsoid')
    await expect(steps).toContainText('Steps: 0 of 2 done')
    // Recording before anything is placed explains what to do instead of saving.
    await click('Record measurement')
    await expect(status).toContainText('Freeze the section')
    // The sweep: the plane carried from one end of its range to the other.
    await frame.getByLabel('Plane offset', { exact: true }).fill('12')
    await expect(steps).toContainText('Steps: 1 of 2 done')
    // An off-center section is refused.
    await click('Freeze section')
    const svg = frame.locator('.phantom-section')
    await svg.scrollIntoViewIfNeeded()
    const box = (await svg.boundingBox())!
    // The section is drawn in phantom millimetres: x -30..30, y 0..46.
    const at = (x: number, y: number) => ({
      x: (box.width * (x + 30)) / 60,
      y: (box.height * y) / 46,
    })
    await svg.click({ position: at(0, 14) })
    await svg.click({ position: at(0, 30) })
    await click('Record measurement')
    await expect(status).toContainText('central section')
    await click('Unfreeze section')
    await click('Go to the central section')
    await click('Freeze section')
    // Calipers along the long axis are refused, with where they should go.
    await svg.click({ position: at(-16, 22) })
    await svg.click({ position: at(16, 22) })
    await click('Record measurement')
    await expect(status).toContainText('top border')
    await expect(steps).toContainText('Steps: 1 of 2 done')
    // Top and bottom borders of the central section: the short axis.
    await svg.click({ position: at(0, 14) })
    await svg.click({ position: at(0, 30) })
    await click('Record measurement')
    await expect(frame.locator('.model-record')).toContainText('Short axis: 16.0 mm')
    await expect(steps).toContainText('Steps: 2 of 2 done')
  }
  if (pkg === 'routes') {
    for (const station of ['4L', '7']) {
      await frame.getByLabel('Target / region', { exact: true }).selectOption(station)
      for (const route of ['airway', 'esophagus']) {
        await frame.getByLabel('Approach', { exact: true }).selectOption(route)
        await click('Record comparison / limitation')
      }
    }
    await frame.getByLabel('Target / region', { exact: true }).selectOption('8')
    await click('Record comparison / limitation')
    await frame.getByLabel('Target / region', { exact: true }).selectOption('11R')
    await click('Record comparison / limitation')
    await expect(frame.getByRole('status').first()).toContainText('not included in the model')
  }
  await expect(
    frame.getByText('All steps done. Select “Continue with this image” in the lesson.'),
  ).toBeVisible()
}
