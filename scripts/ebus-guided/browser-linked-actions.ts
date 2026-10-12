import { expect, type Page } from '@playwright/test'
import type { EbusObservation } from '../../src/lib/ebus-guided-bridge'
import {
  LANDMARK_NAMES,
  LINKED_LANDMARKS,
  LINKED_SWEEP_TOLERANCES,
  type LinkedLesson,
} from '../../src/lib/ebus-linked-contract'

const WORKBENCH = 'iframe[title="EBUS workbench"]'
const SECTOR = 'section[data-sector-source="acoustic-volume"]'
/** Rotations tried, in order, when looking for a structure or the node: the whole slider range. */
const SEARCH_ROLLS = [90, 75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75, -90]

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

/** Move the Scope rotation slider and wait for the ultrasound frame rendered at that rotation. */
async function rotateTo(page: Page, roll: number) {
  const frame = page.frameLocator(WORKBENCH)
  const input = frame.getByLabel('Scope rotation', { exact: true })
  await expect(input).toBeEnabled({ timeout: 60000 })
  await input.fill(String(roll))
  let frameId = ''
  await expect
    .poll(
      async () => {
        const observation = await linkedObservation(page)
        const source = observation?.linked?.source
        frameId = observation?.linked?.frameId ?? ''
        return (
          !!observation?.frameReady &&
          observation.roll === roll &&
          source?.scope.roll === roll &&
          source.frameId === frameId
        )
      },
      { timeout: 30000 },
    )
    .toBe(true)
  // The drawn image is the reported frame before anything is read from or clicked on it.
  await expect(frame.locator(SECTOR)).toHaveAttribute('data-frame-id', frameId, { timeout: 30000 })
  return (await linkedObservation(page))!
}

/**
 * Find each requested structure on the ultrasound image the way a learner does: rotate until it
 * is in the image, then click it. The click point comes from the workbench's own label centroids
 * (`data-label-centroids`, fractions of the square image drawn inside the canvas); the lesson's
 * state is never written directly, and the workbench's own evidence decides whether it counted.
 */
export async function identifyLandmarks(page: Page, lesson: LinkedLesson) {
  const frame = page.frameLocator(WORKBENCH)
  const expected = LINKED_LANDMARKS[lesson]
  if (!expected.length) return
  const task = frame.locator('.linked-landmark-task')
  const identified = async () => (await linkedObservation(page))?.linked?.identifiedStructures ?? []
  await expect(frame.getByLabel('Scope rotation', { exact: true })).toBeEnabled({ timeout: 60000 })
  for (let count = (await identified()).length; count < expected.length; count++) {
    await expect(task).toBeVisible({ timeout: 60000 })
    const target = (await task.getAttribute('data-landmark-target'))!
    expect(expected).toContain(target)
    await expect(task.getByRole('heading')).toContainText(LANDMARK_NAMES[target])
    let found = false
    for (const roll of SEARCH_ROLLS) {
      await rotateTo(page, roll)
      const centroids = JSON.parse(
        (await frame.locator(SECTOR).getAttribute('data-label-centroids')) || '{}',
      ) as Record<string, [number, number]>
      const point = centroids[target]
      if (!point) continue
      const canvas = frame.locator('.simulator-continuous-ultrasound canvas').first()
      await canvas.scrollIntoViewIfNeeded()
      const box = (await canvas.boundingBox())!
      const side = Math.min(box.width, box.height)
      await canvas.click({
        position: {
          x: (box.width - side) / 2 + point[0] * side,
          y: (box.height - side) / 2 + point[1] * side,
        },
      })
      found = await expect
        .poll(async () => (await identified()).includes(target), { timeout: 5000 })
        .toBe(true)
        .then(
          () => true,
          () => false,
        )
      if (found) break
    }
    expect(found, 'clicked ' + target + ' on the ultrasound image').toBe(true)
    await expect.poll(async () => (await identified()).length).toBe(count + 1)
  }
  await expect(task).toHaveCount(0)
  await expect(frame.locator('[data-landmarks-identified]')).toContainText('Found on ultrasound')
  expect([...(await identified())].sort()).toEqual([...expected].sort())
}

/** Rotate to a position where the node is in the image, as the lab asks for at the end. */
async function finishOnTarget(page: Page) {
  for (const roll of [0, 15, 30, -15, 45, -30, 60, -45, 75, -60, 90, -75, -90])
    if ((await rotateTo(page, roll)).targetVisible) return roll
  throw new Error('The node was not in the image at any scope rotation.')
}

/**
 * The rotation sweep for the approach in use. The rule is the workbench's: at least
 * `minSpanDeg` of rotation sampled with the node seen at least once; no step, count or direction
 * rule. Looking for landmarks rotates the scope too, so the sweep may already be complete.
 */
export async function sweepLinked(page: Page) {
  const frame = page.frameLocator(WORKBENCH)
  const panel = frame.locator('.linked-sweep')
  await expect(panel).toBeVisible({ timeout: 60000 })
  const read = async () => ({
    complete: ((await panel.getAttribute('data-sweep-state')) ?? '').startsWith('complete'),
    span: Number(await panel.getAttribute('data-sweep-span')),
    samples: Number(await panel.getAttribute('data-sweep-samples')),
  })
  for (const roll of SEARCH_ROLLS) {
    if ((await read()).complete) break
    await rotateTo(page, roll)
    // At every position the panel follows the rule and nothing else.
    await expect
      .poll(async () => {
        const now = await read()
        return now.complete === (now.span >= LINKED_SWEEP_TOLERANCES.minSpanDeg && now.samples >= 1)
      })
      .toBe(true)
  }
  await expect(panel).toHaveAttribute('data-sweep-state', /^complete/)
  expect(Number(await panel.getAttribute('data-sweep-span'))).toBeGreaterThanOrEqual(
    LINKED_SWEEP_TOLERANCES.minSpanDeg,
  )
  expect(Number(await panel.getAttribute('data-sweep-samples'))).toBeGreaterThanOrEqual(1)
  const observation = await linkedObservation(page)
  expect(observation?.linked?.sweeps?.[observation.linked.approach]?.phase).toBe('complete')
  // The lab also wants the node in the image at the end.
  await finishOnTarget(page)
  await expect(panel).toHaveAttribute('data-sweep-state', 'complete')
}

export async function performLinked(page: Page, lesson: LinkedLesson, changed = false) {
  const frame = page.frameLocator(WORKBENCH)
  const primary = page.locator('[data-now-primary]')
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
      // This lesson asks for the model section, not a sweep, and shows no sweep panel.
      await expect(frame.locator('.linked-sweep')).toHaveCount(0)
      await expect(primary).toBeDisabled()
      await expect(page.locator('[data-requirement="linked-section"]')).toBeVisible()
      await frame.locator('[data-open-model-section]').click()
      await expect
        .poll(async () => (await linkedObservation(page))?.linked?.modelSectionViewed)
        .toBe(true)
      await expect(frame.locator('[data-landmarks-identified]')).toContainText(
        'Model section opened',
      )
      await finishOnTarget(page)
    } else {
      await sweepLinked(page)
      if (lesson === 'station-seven' && !changed) {
        // Both bronchial approaches need their own sweep.
        await frame.getByRole('button', { name: /^Left main bronchus/ }).click()
        await expect(frame.locator('.linked-sweep')).not.toHaveAttribute(
          'data-sweep-state',
          /^complete/,
        )
        await expect(primary).toBeDisabled()
        await expect(page.locator('[data-requirement="linked-sweep"]')).toBeVisible()
        await sweepLinked(page)
      }
    }
  }
  await expect(primary).toBeEnabled({ timeout: 30000 })
}
