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
    for (const shape of ['sphere', 'ellipsoid', 'adjacent', 'lobulated']) {
      await frame.getByLabel('Shape', { exact: true }).selectOption(shape)
      for (let i = 0; i < 12; i++) await click('Next plane')
    }
    await frame.getByLabel('Shape', { exact: true }).selectOption('ellipsoid')
    await frame.getByLabel('Plane offset', { exact: true }).fill('0')
    await click('Freeze section')
    await click('Not adequately visualized')
    await expect(frame.getByRole('status')).toContainText('No measurement recorded')
    await frame.getByLabel('Image label', { exact: true }).selectOption('Phantom station 7')
    await click('Record phantom image')
    await expect(frame.getByRole('status')).toContainText('Place both calipers')
    const svg = frame.locator('.phantom-section')
    await svg.scrollIntoViewIfNeeded()
    const box = (await svg.boundingBox())!
    await svg.click({ position: { x: box.width / 2, y: (box.height * 14) / 46 } })
    await svg.click({ position: { x: box.width / 2, y: (box.height * 30) / 46 } })
    await frame.getByLabel('Measurement axis', { exact: true }).selectOption('long')
    await click('Record phantom image')
    await expect(frame.getByRole('status')).toContainText('short axis')
    await frame.getByLabel('Measurement axis', { exact: true }).selectOption('short')
    await click('Record phantom image')
    await expect(frame.locator('.model-record')).toContainText('16.0 phantom mm')
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
    await expect(frame.getByRole('status').first()).toContainText('not modeled')
  }
  await expect(
    frame.getByText('Required model actions recorded. Hold this acquisition in the lesson.'),
  ).toBeVisible()
}
