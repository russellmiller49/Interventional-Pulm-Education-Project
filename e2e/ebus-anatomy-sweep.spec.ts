import { expect, test, type FrameLocator, type Page } from '@playwright/test'
import type { EbusLinkedEvidence, EbusObservation } from '../src/lib/ebus-guided-bridge'
import {
  LANDMARK_HINTS,
  LANDMARK_NAMES,
  LINKED_LANDMARKS,
  LINKED_SWEEP_TOLERANCES,
} from '../src/lib/ebus-linked-contract'

/**
 * The linked EBUS labs, driven through the real host and embedded app: the named reference
 * markers on the 3D model, the find-on-ultrasound task, the observer camera and the rotation
 * sweep. Bridge events are read from the host window; nothing is seeded. Run against the built
 * site (`EBUS_E2E_BASE_URL` or the config's baseURL).
 */
const base = process.env.EBUS_E2E_BASE_URL ?? ''
const SECTOR = 'section[data-sector-source="acoustic-volume"]'
/** Rotations tried, in order, when looking for a structure: the whole slider range. */
const SEARCH_ROLLS = [90, 75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75, -90]
const MIN_SPAN = LINKED_SWEEP_TOLERANCES.minSpanDeg
async function openLesson(page: Page, id: string, until: 'live' | 'demonstration') {
  await page.addInitScript(() => {
    ;(window as unknown as { __ebusEvents: unknown[] }).__ebusEvents = []
    window.addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data?.type === 'observation')
        (window as unknown as { __ebusEvents: unknown[] }).__ebusEvents.push(e.data)
    })
  })
  await page.goto(`${base}/en/ebus-guided/learn?section=${id}`)
  for (let i = 0; i < 8; i++) {
    if ((await page.locator(`[data-evidence-identity="${until}"]`).count()) > 0) break
    await page.locator('[data-now-primary]').click()
    await page.waitForTimeout(300)
  }
  await expect(page.locator(`[data-evidence-identity="${until}"]`)).toBeVisible()
  return page.frameLocator('iframe[title="EBUS workbench"]')
}
type ObservationEvent = {
  sessionId: string
  observation: Pick<EbusObservation, 'roll' | 'frameReady' | 'targetVisible' | 'actionCount'> & {
    linked?: Partial<EbusLinkedEvidence>
  }
}
const latestEvent = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __ebusEvents: ObservationEvent[] }).__ebusEvents.at(-1),
  )
const latest = async (page: Page) => (await latestEvent(page))?.observation
const isReadyResetEvent = (event: ObservationEvent | undefined, previousSessionId: string) =>
  !!event?.sessionId &&
  event.sessionId !== previousSessionId &&
  event.observation.actionCount === 0 &&
  event.observation.frameReady &&
  !!event.observation.linked?.assetsReady

test('reset readiness rejects stale sessions and uncleared or unready new events', () => {
  const event: ObservationEvent = {
    sessionId: 'old-session',
    observation: {
      roll: 85,
      frameReady: true,
      targetVisible: false,
      actionCount: 0,
      linked: { assetsReady: true, approach: 'rms', sweeps: {} },
    },
  }
  // Even a cleared, ready observation is insufficient if reset did not replace the session.
  expect(isReadyResetEvent(event, 'old-session')).toBe(false)
  expect(isReadyResetEvent(undefined, 'old-session')).toBe(false)
  const fresh = { ...event, sessionId: 'new-session' }
  expect(isReadyResetEvent(fresh, 'old-session')).toBe(true)
  expect(
    isReadyResetEvent(
      { ...fresh, observation: { ...fresh.observation, actionCount: 1 } },
      'old-session',
    ),
  ).toBe(false)
  expect(
    isReadyResetEvent(
      { ...fresh, observation: { ...fresh.observation, frameReady: false } },
      'old-session',
    ),
  ).toBe(false)
  expect(
    isReadyResetEvent(
      {
        ...fresh,
        observation: { ...fresh.observation, linked: { assetsReady: false, approach: 'rms' } },
      },
      'old-session',
    ),
  ).toBe(false)
})
/**
 * The workbench on screen has rendered a frame and loaded its models. A lesson can show an
 * example before the acquisition, and the example reports observations too, so readiness is read
 * from the session that is on screen (`…-demonstration-<n>` for an example) and never from the one
 * before it.
 */
async function ready(page: Page, kind: 'live' | 'demonstration' = 'live') {
  await expect
    .poll(
      async () => {
        const event = await latestEvent(page)
        return (
          !!event &&
          event.sessionId.includes('-demonstration-') === (kind === 'demonstration') &&
          event.observation.frameReady &&
          !!event.observation.linked?.assetsReady
        )
      },
      { timeout: 90000 },
    )
    .toBe(true)
}
/** Move the Scope rotation slider and wait for the ultrasound frame rendered at that rotation. */
async function setRoll(page: Page, f: FrameLocator, roll: number) {
  const slider = f.getByRole('slider', { name: 'Scope rotation' })
  await expect(slider).toBeEnabled({ timeout: 60000 })
  await slider.fill(String(roll))
  let frameId = ''
  await expect
    .poll(
      async () => {
        const o = await latest(page)
        const source = o?.linked?.source
        frameId = o?.linked?.frameId ?? ''
        return (
          !!o?.frameReady &&
          o.roll === roll &&
          source?.scope.roll === roll &&
          !!frameId &&
          source.frameId === frameId
        )
      },
      { timeout: 30000 },
    )
    .toBe(true)
  // The drawn image is the reported frame before anything is read from or clicked on it.
  await expect(f.locator(SECTOR)).toHaveAttribute('data-frame-id', frameId, { timeout: 30000 })
  return (await latest(page))!
}
/** Where each structure sits in the ultrasound image now: the workbench's own test hook. */
const centroids = async (f: FrameLocator) =>
  JSON.parse((await f.locator(SECTOR).getAttribute('data-label-centroids')) || '{}') as Record<
    string,
    [number, number]
  >
/** Click the ultrasound image at a fraction of the square image drawn inside its canvas. */
async function clickImage(f: FrameLocator, [x, y]: [number, number]) {
  const canvas = f.locator(SECTOR).locator('canvas').first()
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  const side = Math.min(box.width, box.height)
  await canvas.click({
    position: { x: (box.width - side) / 2 + x * side, y: (box.height - side) / 2 + y * side },
  })
}
const identified = async (page: Page) => (await latest(page))?.linked?.identifiedStructures ?? []

test.describe('structure names on the model', () => {
  test('lesson 3 names appear only on request, markers keep their column across rotation, hover and focus identify one structure', async ({
    page,
  }) => {
    const f = await openLesson(page, 'scope-orientation', 'live')
    await ready(page)
    const callouts = f.locator('.linked-structure-callouts')
    const letters = f.locator('.linked-structure-letter:not([hidden])')
    // The markers are a reference the learner asks for; they never appear on their own.
    await expect(callouts).toBeHidden()
    const names = f.locator('[data-structure-names]')
    await expect(names).toHaveAttribute('aria-pressed', 'false')
    await names.click()
    await expect(names).toHaveAttribute('aria-pressed', 'true')
    await expect(callouts).toBeVisible()
    await expect(letters).toHaveCount(4)
    // Every marker carries a real structure name; there is no unnamed lettered quiz.
    for (const marker of await letters.all()) {
      await expect(marker).toHaveAttribute('aria-label', /^Structure [A-D]: .+/)
      await expect(marker.locator('.linked-structure-name')).not.toBeEmpty()
    }
    await expect(
      f.locator(
        '.linked-structure-letter[data-structure="transducer_face"] .linked-structure-name',
      ),
    ).toHaveText(LANDMARK_NAMES.transducer_face)
    const sideOf = async () =>
      letters.evaluateAll(
        (els, width) =>
          els.map((b) => [
            (b as HTMLElement).dataset.structure,
            parseFloat((b as HTMLElement).style.left) < width / 2 ? 'left' : 'right',
          ]),
        await f.locator('.linked-canvas').evaluate((c) => c.clientWidth),
      )
    const before = await sideOf()
    for (const roll of [40, 0, -40, -85]) await setRoll(page, f, roll)
    expect(await sideOf()).toEqual(before)
    // Hover a marker: its structure is highlighted (marker and leader carry the same state).
    const a = letters.first()
    await a.hover()
    await expect(a).toHaveClass(/is-hovered/)
    await expect(f.locator('.linked-structure-letter.is-hovered')).toHaveCount(1)
    await expect(f.locator('.linked-structure-callouts circle.is-hovered')).toHaveCount(1)
    await a.focus()
    await expect(a).toHaveClass(/is-hovered/)
    await page.keyboard.press('Enter')
    await expect(a).toHaveAttribute('aria-pressed', 'true')
    await expect(f.locator('.linked-selection')).toContainText(/Selected: .+/)
    const structure = await a.getAttribute('data-structure')
    await expect.poll(async () => (await latest(page))?.linked?.selectedStructure).toBe(structure)
    // Looking at names is not an answer to anything.
    expect(await identified(page)).toEqual([])
    await names.click()
    await expect(callouts).toBeHidden()
  })
  test('keyboard marker focus wins over a stationary pointer on another model structure', async ({
    page,
  }) => {
    // The lesson's first briefing embeds the live example, where the model itself can be hovered.
    const f = await openLesson(page, 'scope-orientation', 'demonstration')
    await ready(page, 'demonstration')
    await expect(f.locator('.linked-demo')).toBeVisible()
    await f.locator('[data-structure-names]').click()
    const canvas = f.locator('.linked-canvas')
    await canvas.scrollIntoViewIfNeeded()
    const box = (await canvas.boundingBox())!
    const callouts = f.locator('.linked-structure-callouts')
    await expect(callouts).toHaveAttribute('data-callout-geometry', /./)
    const points = JSON.parse((await callouts.getAttribute('data-callout-geometry'))!) as {
      id: string
      ax: number
      ay: number
    }[]
    expect(points.length).toBe(4)
    const hot = f.locator('.linked-structure-letter.is-hovered')
    // Rest the pointer on a part of the model whose surface is in front at its marker's anchor.
    let under = ''
    for (const point of points) {
      await page.mouse.move(box.x + point.ax, box.y + point.ay)
      const hit = await expect(hot)
        .toHaveAttribute('data-structure', point.id, { timeout: 1500 })
        .then(
          () => true,
          () => false,
        )
      if (hit) {
        under = point.id
        break
      }
    }
    expect(under, 'a model structure highlights its marker under the pointer').not.toBe('')
    const other = points.find((point) => point.id !== under)!.id
    const b = f.locator(`.linked-structure-letter[data-structure="${other}"]`)
    await b.focus()
    // Allow the queued model hover/raycast to run after React commits the focus highlight.
    await b.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await expect(b).toHaveClass(/is-hovered/)
    await expect(hot).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(b).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Tab')
    await expect(b).not.toHaveClass(/is-hovered/)
    // A selection made in an example is not the learner's evidence.
    expect((await latest(page))?.linked?.selectedStructure ?? '').toBe('')
  })
  test('lesson 4 has no landmark task, no sweep and shows no markers', async ({ page }) => {
    expect(LINKED_LANDMARKS['acoustic-contact']).toEqual([])
    const f = await openLesson(page, 'acoustic-contact', 'live')
    await ready(page)
    await expect(f.locator('.linked-structure-callouts')).toBeHidden()
    await expect(f.locator('.linked-landmark-task')).toHaveCount(0)
    await expect(f.locator('[data-landmarks-identified]')).toHaveCount(0)
    await expect(f.locator('.linked-sweep')).toHaveCount(0)
    // The host asks for what this lab is about, not for a landmark or a sweep.
    await expect(page.locator('[data-acquisition-outstanding]')).toBeVisible()
    await expect(page.locator('[data-requirement="linked-landmarks"]')).toHaveCount(0)
    await expect(page.locator('[data-requirement="linked-sweep"]')).toHaveCount(0)
    await expect(f.locator('.linked-contact-comparison .linked-contact-legend')).toContainText(
      'bright = airway wall',
    )
    const sections = f.locator('.linked-contact-comparison canvas[data-contact-label-layout]')
    await expect(sections).toHaveCount(2)
    for (const section of await sections.all()) {
      const layout = JSON.parse((await section.getAttribute('data-contact-label-layout'))!) as {
        kind: string
        rect: number[]
      }[]
      const anchors = JSON.parse((await section.getAttribute('data-contact-labels'))!) as Record<
        string,
        number[] | null
      >
      expect(layout.map((label) => label.kind)).toEqual([
        ...['air', 'wall', 'soft'].filter((kind) => anchors[kind] !== null),
        'transducer',
      ])
      expect(layout.map((label) => label.kind)).toContain('air')
      expect(layout.map((label) => label.kind)).toContain('soft')
      for (let i = 0; i < layout.length; i++) {
        const [x, y, w, h] = layout[i].rect
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(192)
        expect(y + h).toBeLessThanOrEqual(112)
        for (let j = 0; j < i; j++) {
          const [xx, yy, ww, hh] = layout[j].rect
          expect(x + w <= xx || xx + ww <= x || y + h <= yy || yy + hh <= y).toBe(true)
        }
      }
    }
  })
})

test.describe('find on ultrasound', () => {
  test('the task names its target, a wrong click names what was clicked, and each right click moves to the next target', async ({
    page,
  }) => {
    const lesson = 'station-seven'
    const expected = LINKED_LANDMARKS[lesson]
    expect(expected.length).toBeGreaterThan(1)
    const f = await openLesson(page, lesson, 'live')
    await ready(page)
    const task = f.locator('.linked-landmark-task')
    const feedback = f.locator('[data-landmark-feedback]')
    const first = expected[0]
    await expect(task).toHaveAttribute('data-landmark-target', first)
    await expect(task.getByRole('heading')).toHaveText(
      `Find the ${LANDMARK_NAMES[first]} on the ultrasound`,
    )
    await expect(feedback).toHaveCount(0)
    await expect(page.locator('[data-requirement="linked-landmarks"]')).toBeVisible()
    await expect(page.locator('[data-now-primary]')).toBeDisabled()
    // A wrong click: another named structure, in an image the target is not in at all.
    let wrong = ''
    for (const roll of SEARCH_ROLLS) {
      const observation = await setRoll(page, f, roll)
      const here = await centroids(f)
      const key = Object.keys(here).find((candidate) => candidate !== first)
      // The first target is the node the lab is aimed at, so `targetVisible` speaks for it.
      if (observation.targetVisible || first in here || !key) continue
      await clickImage(f, here[key])
      wrong = key
      break
    }
    expect(wrong, 'an image with another structure and without the target').not.toBe('')
    await expect(feedback).toContainText(/^That is the .+, not the /)
    await expect(feedback).toContainText(
      `not the ${LANDMARK_NAMES[first]}. ${LANDMARK_HINTS[first]}`,
    )
    if (LANDMARK_NAMES[wrong])
      await expect(feedback).toContainText(`That is the ${LANDMARK_NAMES[wrong]}, not the `)
    await expect(task).toHaveAttribute('data-landmark-target', first)
    expect(await identified(page)).toEqual([])
    // Each right click is recorded and the task moves on, in the lesson's order.
    for (let count = 0; count < expected.length; count++) {
      const target = expected[count]
      await expect(task).toHaveAttribute('data-landmark-target', target)
      await expect(task.getByRole('heading')).toContainText(LANDMARK_NAMES[target])
      let found = false
      for (const roll of SEARCH_ROLLS) {
        await setRoll(page, f, roll)
        const point = (await centroids(f))[target]
        if (!point) continue
        await clickImage(f, point)
        found = await expect
          .poll(async () => (await identified(page)).includes(target), { timeout: 5000 })
          .toBe(true)
          .then(
            () => true,
            () => false,
          )
        if (found) break
      }
      expect(found, 'clicked ' + target + ' on the ultrasound image').toBe(true)
      expect(await identified(page)).toEqual(expected.slice(0, count + 1))
      if (count < expected.length - 1)
        await expect(feedback).toHaveText(`Correct: that is the ${LANDMARK_NAMES[target]}.`)
    }
    await expect(task).toHaveCount(0)
    await expect(f.locator('[data-landmarks-identified]')).toContainText(
      'Found on ultrasound: ' + expected.map((id) => LANDMARK_NAMES[id]).join(' · '),
    )
    await expect(page.locator('[data-requirement="linked-landmarks"]')).toHaveCount(0)
  })
})

test.describe('camera and scrolling', () => {
  test('the wheel scrolls the page until the model is engaged, and Escape releases it', async ({
    page,
  }) => {
    const f = await openLesson(page, 'scope-orientation', 'live')
    await ready(page)
    const canvas = f.locator('.linked-canvas canvas')
    await expect(canvas).toHaveAttribute('data-engaged', 'false')
    expect(await canvas.evaluate((c) => getComputedStyle(c).touchAction)).toBe('pan-y')
    await canvas.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -160))
    const box = (await canvas.boundingBox())!
    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 240)
    await expect.poll(() => page.evaluate(() => window.scrollY)).not.toBe(before)
    const box2 = (await canvas.boundingBox())!
    await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2)
    await expect(canvas).toHaveAttribute('data-engaged', 'true')
    expect(await canvas.evaluate((c) => getComputedStyle(c).touchAction)).toBe('none')
    const engagedBefore = await page.evaluate(() => window.scrollY)
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.scrollY)).toBe(engagedBefore)
    await page.keyboard.press('Escape')
    await expect(canvas).toHaveAttribute('data-engaged', 'false')
    await expect(f.getByRole('button', { name: 'Zoom in' })).toBeVisible()
    await expect(f.locator('[data-observer-caption]')).not.toContainText('scroll to zoom')
  })
  test('browser zoom shortcuts and modified wheel gestures do not control the observer', async ({
    page,
  }) => {
    const f = await openLesson(page, 'scope-orientation', 'live')
    await ready(page)
    const canvas = f.locator('.linked-canvas canvas')
    // The named markers are projected through the observer camera, so they show whether it moved.
    await f.locator('[data-structure-names]').click()
    await expect(f.locator('.linked-structure-callouts')).toBeVisible()
    await canvas.focus()
    const geometry = () =>
      f.locator('.linked-structure-callouts').getAttribute('data-callout-geometry')
    const before = await geometry()
    expect(before).toBeTruthy()
    const prevented = await canvas.evaluate((element) => {
      const results: boolean[] = []
      for (const modifier of ['ctrlKey', 'metaKey'] as const) {
        for (const key of ['+', '=', '-', '0']) {
          const event = new KeyboardEvent('keydown', {
            key,
            [modifier]: true,
            bubbles: true,
            cancelable: true,
          })
          element.dispatchEvent(event)
          results.push(event.defaultPrevented)
        }
        const wheel = new WheelEvent('wheel', {
          deltaY: 80,
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        })
        element.dispatchEvent(wheel)
        results.push(wheel.defaultPrevented)
      }
      return results
    })
    expect(prevented).toEqual(Array(10).fill(false))
    expect(await geometry()).toBe(before)
    // Plain keyboard zoom still changes the projected model; Tab and Escape provide an exit.
    await page.keyboard.press('+')
    await expect.poll(geometry).not.toBe(before)
    await page.keyboard.press('Escape')
    await expect(canvas).toHaveAttribute('data-engaged', 'false')
    await page.keyboard.press('Tab')
    expect(await canvas.evaluate((el) => document.activeElement === el)).toBe(false)
  })
  test('lesson 19 arrows are legible and the model is labelled', async ({ page }) => {
    const f = await openLesson(page, 'eus-b-route-model', 'live')
    const viewport = f.locator('.model-viewport')
    await expect(viewport).toHaveAttribute('data-arrow-px', /.+/, { timeout: 60000 })
    for (const [station, route] of [
      ['4L', 'airway'],
      ['7', 'airway'],
      ['7', 'esophagus'],
      ['4L', 'esophagus'],
    ] as const) {
      await f.getByLabel('Target / region').selectOption(station)
      await f.getByLabel('Approach').selectOption(route)
      await expect
        .poll(async () => Number(await viewport.getAttribute('data-arrow-px')))
        .toBeGreaterThan(40)
    }
    await expect(
      f.locator('.model-viewport .linked-structure-name').filter({ hasText: /esophagus/i }),
    ).toHaveCount(1)
    await expect(
      f.locator('.model-viewport .linked-structure-name').filter({ hasText: /aorta/i }),
    ).toHaveCount(1)
    await expect(f.locator('.model-image .model-caption').first()).toContainText(
      'shows viewing direction only',
    )
    await expect(f.getByLabel('Find a structure in the model')).toBeVisible()
    // Camera help is one disclosure away; the model is not buried under it.
    const help = f.locator('details.model-caption')
    await expect(help.locator('summary')).toHaveText('How to move the model')
    await expect(help.locator('[data-observer-caption]')).toBeHidden()
    await help.locator('summary').click()
    await expect(help.locator('[data-observer-caption]')).toBeVisible()
  })
})

test.describe('sweep state', () => {
  /** Every linked lab opens at this rotation (`linkedSetup(...).initialRoll` for the guided variant). */
  const START_ROLL = 85
  type Panel = { state: string; span: number; samples: number; inPlane: string }
  const readPanel = async (f: FrameLocator): Promise<Panel> => {
    const panel = f.locator('.linked-sweep')
    return {
      state: (await panel.getAttribute('data-sweep-state')) ?? '',
      span: Number(await panel.getAttribute('data-sweep-span')),
      samples: Number(await panel.getAttribute('data-sweep-samples')),
      inPlane: (await panel.getAttribute('data-sweep-in-plane')) ?? '',
    }
  }
  /**
   * The rule, kept beside the workbench and compared with it at every position: the range of
   * rotation covered from the starting position, how many sampled frames showed the node, and
   * nothing else. The start itself counts toward the range but is not a sampled frame. Once complete
   * the sweep stops counting, and the panel only says whether the node is in the current image.
   */
  function sweepModel(start: number) {
    let low = start
    let high = start
    let samples = 0
    let complete = false
    return {
      sample(roll: number, visible: boolean): Panel {
        if (!complete) {
          low = Math.min(low, roll)
          high = Math.max(high, roll)
          samples += visible ? 1 : 0
          complete = high - low >= MIN_SPAN && samples > 0
        }
        return {
          state: complete ? (visible ? 'complete' : 'complete-off-target') : 'sweeping',
          span: high - low,
          samples,
          inPlane: String(visible),
        }
      },
    }
  }
  test('the sweep is done after 20° of sampled rotation with the node seen, and not before', async ({
    page,
  }) => {
    const f = await openLesson(page, 'station-seven', 'live')
    await ready(page)
    const panel = f.locator('.linked-sweep')
    const next = panel.locator('[data-sweep-next]')
    const progress = panel.locator('[data-sweep-progress]')
    const requirement = page.locator('[data-requirement="linked-sweep"]')
    // The rule has no direction, step, frame-count or reset clause to report.
    await expect(panel.locator('[data-sweep-reset-reason]')).toHaveCount(0)
    const rotate = async (model: ReturnType<typeof sweepModel>, roll: number) => {
      const observation = await setRoll(page, f, roll)
      const expected = model.sample(roll, observation.targetVisible)
      await expect.poll(() => readPanel(f)).toEqual(expected)
      return observation
    }
    const sweepOf = async (approach: 'rms' | 'lms') =>
      (await latest(page))!.linked!.sweeps?.[approach]

    // Right main bronchus. Start: nothing sampled, and the instruction states the whole rule.
    expect((await latest(page))!.linked!.approach).toBe('rms')
    expect(await readPanel(f)).toMatchObject({ state: 'start', span: 0, samples: 0 })
    await expect(next).toContainText(`Sweep through at least ${MIN_SPAN}°`)
    await expect(progress).toHaveText(`Rotation covered: 0° of ${MIN_SPAN}°`)
    expect((await latest(page))!.linked!.sweeps).toEqual({})
    await expect(requirement).toBeVisible()
    // More than the required rotation, none of it showing the node: the sweep stays open.
    const rms = sweepModel(START_ROLL)
    for (const roll of [80, 70, 55]) expect((await rotate(rms, roll)).targetVisible).toBe(false)
    expect(await readPanel(f)).toMatchObject({ state: 'sweeping', span: 30, samples: 0 })
    await expect(next).toContainText('Keep rotating until the node comes into the image.')
    await expect(progress).toHaveText(`Rotation covered: ${MIN_SPAN}° of ${MIN_SPAN}°`)
    expect((await sweepOf('rms'))!.phase).not.toBe('complete')
    await expect(requirement).toBeVisible()
    // The first frame that shows the node completes it.
    expect((await rotate(rms, 30)).targetVisible).toBe(true)
    await expect(panel).toHaveAttribute('data-sweep-state', 'complete')
    await expect(next).toContainText('Continue with this image')
    await expect(progress).toHaveCount(0)
    expect(await sweepOf('rms')).toMatchObject({ phase: 'complete', span: 55, samples: 1 })
    // Done stays done: rotating off the node only asks the learner to come back to it.
    expect((await rotate(rms, -85)).targetVisible).toBe(false)
    await expect(panel).toHaveAttribute('data-sweep-state', 'complete-off-target')
    await expect(next).toContainText('Rotate back until the node is in the image')
    expect((await rotate(rms, 30)).targetVisible).toBe(true)
    await expect(panel).toHaveAttribute('data-sweep-state', 'complete')
    expect(await sweepOf('rms')).toMatchObject({ phase: 'complete', span: 55, samples: 1 })

    // Left main bronchus: its own sweep, starting empty; the first one is kept.
    await f.getByRole('button', { name: /^Left main bronchus/ }).click()
    await expect.poll(async () => (await latest(page))?.linked?.approach).toBe('lms')
    await expect.poll(() => readPanel(f)).toMatchObject({ state: 'start', span: 0, samples: 0 })
    await expect(f.getByRole('button', { name: /^Right main bronchus/ })).toContainText('scanned')
    await expect(requirement).toBeVisible()
    // The node is in view from the start here, so what is left is counted down in degrees.
    const lms = sweepModel(START_ROLL)
    expect((await rotate(lms, 80)).targetVisible).toBe(true)
    await expect(panel).toHaveAttribute('data-sweep-state', 'sweeping')
    await expect(next).toHaveText(`Keep rotating: ${MIN_SPAN - 5}° more to finish the sweep.`)
    expect((await rotate(lms, 70)).targetVisible).toBe(true)
    await expect(panel).toHaveAttribute('data-sweep-state', 'sweeping')
    await expect(next).toHaveText(`Keep rotating: ${MIN_SPAN - 15}° more to finish the sweep.`)
    await expect(progress).toHaveText(`Rotation covered: 15° of ${MIN_SPAN}°`)
    expect((await rotate(lms, 60)).targetVisible).toBe(true)
    await expect(panel).toHaveAttribute('data-sweep-state', 'complete')
    expect(await sweepOf('lms')).toMatchObject({ phase: 'complete', span: 25 })
    expect(await sweepOf('rms')).toMatchObject({ phase: 'complete', span: 55 })
    expect([...(await latest(page))!.linked!.scannedApproaches!].sort()).toEqual(['lms', 'rms'])
    // Both sweeps are done; what the host still asks for is something else.
    await expect(requirement).toHaveCount(0)
  })
  test('one continuous drag of the slider through the node completes the sweep', async ({
    page,
  }) => {
    const f = await openLesson(page, 'station-seven', 'live')
    await ready(page)
    const panel = f.locator('.linked-sweep')
    await expect(panel).toHaveAttribute('data-sweep-state', 'start')
    const slider = f.getByRole('slider', { name: 'Scope rotation' })
    await slider.scrollIntoViewIfNeeded()
    const start = Number(await slider.inputValue())
    const box = (await slider.boundingBox())!
    // Chromium's range thumb is 16 px wide, so its centre travels the track less one thumb.
    const xAt = (value: number) => box.x + 8 + ((value + 90) / 180) * (box.width - 16)
    const y = box.y + box.height / 2
    // One press, one unhurried pull of about two seconds toward the node, one release.
    const travel = 65
    await page.mouse.move(xAt(start), y)
    await page.mouse.down()
    for (let i = 1; i <= travel; i++) {
      await page.mouse.move(xAt(start - i), y)
      await page.waitForTimeout(30)
    }
    await page.mouse.up()
    await expect
      .poll(async () => Math.abs((await latest(page))!.roll - start))
      .toBeGreaterThanOrEqual(MIN_SPAN)
    await expect(panel).toHaveAttribute('data-sweep-state', /^complete/, { timeout: 15000 })
    expect(Number(await panel.getAttribute('data-sweep-span'))).toBeGreaterThanOrEqual(MIN_SPAN)
    expect(Number(await panel.getAttribute('data-sweep-samples'))).toBeGreaterThanOrEqual(1)
    const linked = (await latest(page))!.linked!
    expect(linked.sweeps?.[linked.approach!]?.phase).toBe('complete')
  })
  test('Reset acquisition starts a new session with nothing carried over, and continuing without an image holds nothing', async ({
    page,
  }) => {
    const f = await openLesson(page, 'station-seven', 'live')
    await ready(page)
    for (const roll of [80, 30]) await setRoll(page, f, roll)
    await expect(f.locator('.linked-sweep')).toHaveAttribute('data-sweep-state', 'complete')
    expect((await latest(page))!.actionCount).toBeGreaterThan(0)
    // A ready, cleared event must belong to a different session after reset. Neither the old
    // ready event nor a same-session counter reset proves an iframe reboot.
    const previousSessionId = (await latestEvent(page))!.sessionId
    expect(previousSessionId).toBeTruthy()
    await f.getByRole('button', { name: 'Reset acquisition' }).click()
    await expect
      .poll(async () => isReadyResetEvent(await latestEvent(page), previousSessionId), {
        timeout: 90000,
      })
      .toBe(true)
    expect((await latest(page))!.actionCount).toBe(0)
    expect((await latest(page))!.linked!.sweeps).toEqual({})
    expect(await identified(page)).toEqual([])
    await expect(f.locator('.linked-sweep')).toHaveAttribute('data-sweep-state', 'start')
    // Continuing without an image holds nothing.
    await page.locator('[data-skip-acquisition]').click()
    await expect(page.locator('[data-evidence-identity="held-missing"]')).toBeVisible()
  })
  test('a demonstration has no task and collects no learner samples, and the real attempt starts empty', async ({
    page,
  }) => {
    const f = await openLesson(page, 'station-seven', 'demonstration')
    await ready(page, 'demonstration')
    // An example is for trying the controls: no sweep, no find task, no clickable image.
    await expect(f.locator('.linked-sweep')).toHaveCount(0)
    await expect(f.locator('.linked-landmark-task')).toHaveCount(0)
    await expect(f.locator('[data-landmarks-identified]')).toHaveCount(0)
    await expect(f.locator(SECTOR)).not.toHaveAttribute('data-label-centroids')
    await expect(f.locator('.linked-demo').getByRole('button')).toHaveText([
      'Rotate the scope',
      'Flex the tip',
      'Reset',
    ])
    await expect(f.getByRole('button', { name: 'Reset acquisition' })).toHaveCount(0)
    const slider = f.getByRole('slider', { name: 'Scope rotation' })
    await expect(slider).toBeVisible({ timeout: 60000 })
    for (const v of [60, 30, 0]) {
      await slider.fill(String(v))
      await expect.poll(async () => (await latest(page))?.roll).toBe(v)
    }
    await clickImage(f, [0.5, 0.5])
    await expect(f.locator('[data-landmark-feedback]')).toHaveCount(0)
    const example = (await latest(page))!.linked!
    expect(example.sweeps ?? {}).toEqual({})
    expect(example.identifiedStructures ?? []).toEqual([])
    for (
      let i = 0;
      i < 4 && (await page.locator('[data-evidence-identity="live"]').count()) === 0;
      i++
    ) {
      await page.locator('[data-now-primary]').click()
      await page.waitForTimeout(300)
    }
    await ready(page)
    const first = (await latest(page))!
    expect(first.actionCount).toBe(0)
    expect(first.linked!.sweeps).toEqual({})
    expect(first.linked!.identifiedStructures ?? []).toEqual([])
    await expect(f.locator('.linked-sweep')).toHaveAttribute('data-sweep-state', 'start')
    await expect(f.locator('.linked-landmark-task')).toHaveAttribute(
      'data-landmark-target',
      LINKED_LANDMARKS['station-seven'][0],
    )
  })
})
