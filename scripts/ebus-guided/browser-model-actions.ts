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
    // One pass by the learner's own hand: each control is named after the handle part it moves.
    const slide = async (name: string, value: number) => {
      const slider = frame.getByRole('slider', { name, exact: true })
      await slider.fill(String(value))
      return slider
    }
    const notice = frame.locator('[data-needle-notice]')
    // The needle does not leave an unlocked sheath, or move before the stop is set.
    await expect(await slide('Needle slider', 5)).toHaveValue('0')
    await expect(notice).toContainText('Bring the sheath out and lock it')
    await slide('Sheath adjuster', 1)
    await click('Lock sheath')
    await expect(await slide('Needle slider', 5)).toHaveValue('0')
    await expect(notice).toContainText('Set the needle stop')
    // A stop set too long is named and not credited; the far side of the node is.
    await slide('Needle stop', 22)
    await expect(notice).toContainText('can pass the far side of the node')
    await slide('Needle stop', 19)
    await expect(await slide('Needle slider', 22)).toHaveValue('19')
    await expect(frame.locator('[data-needle-tip]')).toHaveAttribute('data-needle-tip', 'seen')
    await click('Remove the assembly')
    await expect(notice).toContainText('Do not remove')
    // Turning the scope takes the tip out of the image; the needle is then held.
    await slide('Scope rotation', 6)
    await expect(frame.locator('[data-needle-tip]')).toHaveAttribute('data-needle-tip', 'lost')
    await slide('Needle slider', 15)
    await expect(await slide('Needle slider', 19)).toHaveValue('15')
    await expect(notice).toContainText('Do not advance')
    await slide('Scope rotation', 0)
    await expect(notice).toContainText('The tip is back in the image')
    await slide('Needle slider', 19)
    for (let movement = 0; movement < 5; movement += 1) {
      await slide('Needle slider', 14)
      await slide('Needle slider', 19)
    }
    await expect(frame.locator('[data-needle-movements]')).toHaveAttribute(
      'data-needle-movements',
      '5',
    )
    await slide('Needle slider', 0)
    await click('Remove the assembly')
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
