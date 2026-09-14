import { expect, type Page } from '@playwright/test'
import type { EbusObservation } from '../../src/lib/ebus-guided-bridge'
import { LINKED_LANDMARKS, type LinkedLesson } from '../../src/lib/ebus-linked-contract'

export async function observeLinked(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as {
      linkedMessages: { sessionId: string; observation: EbusObservation }[]
    }
    state.linkedMessages = []
    window.addEventListener('message', (event) => {
      if (event.origin === location.origin && event.data?.type === 'observation')
        state.linkedMessages.push(event.data)
    })
  })
}
export const linkedObservation = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { linkedMessages: { observation: EbusObservation }[] }
      ).linkedMessages.at(-1)?.observation,
  )
export async function identifyLandmarks(page: Page, lesson: LinkedLesson) {
  const frame = page.frameLocator('iframe[title="EBUS workbench"]')
  const selector = frame.getByLabel('Select an unnamed structure', { exact: true })
  await expect(selector).toBeVisible({ timeout: 60000 })
  // Try the visible unnamed candidates and use the activity's actual feedback. No direct state writes.
  for (let count = 0; count < LINKED_LANDMARKS[lesson].length; count++) {
    let identified = false
    const values = await selector
      .locator('option')
      .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean))
    for (const value of values) {
      await selector.selectOption(value)
      await frame.getByRole('button', { name: 'Check landmark', exact: true }).click()
      const feedback = frame.locator('.linked-landmark-task [role="status"]')
      if (
        !(await frame.locator('.linked-landmark-task').count()) ||
        (await feedback.textContent())?.startsWith('Identified:')
      ) {
        identified = true
        break
      }
      await expect(feedback).toContainText('Try another structure.')
    }
    expect(identified).toBe(true)
    await expect
      .poll(async () => (await linkedObservation(page))?.linked?.identifiedStructures?.length)
      .toBe(count + 1)
  }
}
export async function sweepLinked(page: Page) {
  const frame = page.frameLocator('iframe[title="EBUS workbench"]')
  const input = frame.getByLabel('Scope rotation', { exact: true })
  await expect(input).toBeEnabled({ timeout: 60000 })
  for (let roll = 90; roll >= -90; roll -= 10) {
    await input.fill(String(roll))
    await expect
      .poll(
        async () => {
          const observation = await linkedObservation(page)
          return (
            observation?.frameReady && observation.roll === roll && !!observation.linked?.source
          )
        },
        { timeout: 30000 },
      )
      .toBe(true)
  }
  await expect(frame.locator('.linked-sweep')).toContainText('Sweep recorded')
  await input.fill('0')
  await expect
    .poll(
      async () => {
        const observation = await linkedObservation(page)
        return observation?.frameReady && observation.roll === 0 && observation.targetVisible
      },
      { timeout: 30000 },
    )
    .toBe(true)
}
export async function performLinked(page: Page, lesson: LinkedLesson, changed = false) {
  const frame = page.frameLocator('iframe[title="EBUS workbench"]')
  await expect
    .poll(async () => (await linkedObservation(page))?.linked?.source?.variant, { timeout: 60000 })
    .toBe(changed ? 'changed-window' : 'guided')
  if (lesson === 'acoustic-contact') {
    await frame.getByLabel('Tip flexion', { exact: true }).fill('10')
    await expect
      .poll(async () => (await linkedObservation(page))?.contactQuality, { timeout: 30000 })
      .toBeGreaterThanOrEqual(0.8)
  } else {
    await identifyLandmarks(page, lesson)
    if (lesson === 'ct-map') {
      await frame.getByRole('button', { name: 'Model section', exact: true }).click()
      await frame.getByRole('button', { name: 'Coronal', exact: true }).click()
      await expect(frame.locator('.linked-image-hint')).toHaveCount(0)
    }
    await sweepLinked(page)
    if (lesson === 'station-seven' && !changed) {
      await frame.getByRole('button', { name: 'Left main bronchus', exact: true }).click()
      await expect(page.locator('[data-now-primary]')).toBeDisabled()
      await sweepLinked(page)
    }
  }
  await expect(page.locator('[data-now-primary]')).toBeEnabled({ timeout: 30000 })
}
