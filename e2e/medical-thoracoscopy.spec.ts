import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test'

import { flaggedLearnerCopyTerms } from '../src/features/learning-module/activity/clinicalLearningItem'
import { toolContact } from '../src/features/medical-thoracoscopy/content/anatomy'
import { THORACOSCOPY_PROGRESS_STORAGE_KEY } from '../src/features/medical-thoracoscopy/engine/selfPacedProgress'

/**
 * The prototype in a real browser (plan, section 7; slice 14): the fresh learner's path, storage
 * that is blocked or corrupt, the scene drawn in both views, the keyboard-only survey, touch and the
 * wheel, reduced motion, every way the 3D can fail, the layouts, 200 % zoom and 320 px reflow, the
 * words a learner reads or hears, axe on every page, the contact spike, and the first measurements
 * on this machine. Against the module's local dev server only.
 *
 * The module opens only for a site admin (owner decision OD-15). The run signs in with the site's
 * existing local-development cookie, which only a non-production server on localhost honours: start
 * the server with LOCAL_DEV_AUTH_ENABLED=1 and a LOCAL_DEV_AUTH_TOKEN, and give the same token here as
 * MT_LOCAL_DEV_AUTH_TOKEN. Authentication itself is not changed for the test, and one check makes sure
 * that without it the module does not open.
 */
test.skip(!process.env.MT_BASE_URL, 'Use the dedicated config and a local server.')
test.skip(
  !process.env.MT_LOCAL_DEV_AUTH_TOKEN,
  'The module is admin-gated: give the local development token (MT_LOCAL_DEV_AUTH_TOKEN).',
)
test.setTimeout(240_000)

const base = '/en/medical-thoracoscopy'
const learn = (id: string) => `${base}/learn?section=${id}`
const SPACE_PROTOTYPE = `${base}/prototype/space`
const TOOL_CONTACT = `${base}/prototype/tool-contact`
const OUT = path.join(process.cwd(), 'test-results/medical-thoracoscopy')

const pane = (page: Page) => page.getByRole('region', { name: 'The pleural space', exact: true })
const refusal = (page: Page) => pane(page).locator('[aria-live="polite"]')
const dock = (page: Page, key: string) => page.locator(`[id="mt-space-${key}"]`)

/** Where the scope camera is and looks, from the development probe; null without the 3D scene. */
async function scopeCamera(page: Page) {
  return page.evaluate(() => {
    const hook = (
      window as unknown as {
        __thoracoscopySpace?: {
          scopeCamera: () => { position: number[]; direction: number[] } | null
        }
      }
    ).__thoracoscopySpace
    const camera = hook?.scopeCamera()
    return camera
      ? [...camera.position, ...camera.direction].map((v) => v.toFixed(4)).join(' ')
      : null
  })
}

/** The telescope in the cut, from the port to its tip. */
async function cutTelescope(page: Page) {
  const line = pane(page).locator('svg line[data-part="telescope"]')
  return [
    await line.getAttribute('x2'),
    await line.getAttribute('y2'),
    await line.getAttribute('x1'),
    await line.getAttribute('y1'),
  ].join(' ')
}

/** The site's local-development sign-in, for a local server only. */
async function authorise(context: BrowserContext) {
  const url = new URL(process.env.MT_BASE_URL as string)
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MT_LOCAL_DEV_AUTH_TOKEN as string,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

async function authorisedContext(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options)
  await authorise(context)
  return context
}

async function paneReady(page: Page) {
  await expect(pane(page)).toHaveAttribute('data-readiness', 'ready', { timeout: 90_000 })
}

async function sceneReady(page: Page) {
  const scene = page.locator('[data-three-state]')
  await scene.scrollIntoViewIfNeeded()
  await expect(scene).toHaveAttribute('data-three-state', 'ready', { timeout: 90_000 })
}

async function openActivity(page: Page, id: string) {
  await page.goto(learn(id))
  await page.locator('[data-part-link="activity"]').click()
  await expect(page.locator('[data-lesson-part="activity"]')).toBeVisible()
  await paneReady(page)
}

/** Draw one frame and read what the canvas drew, through the development probe. */
async function probe(page: Page) {
  return page.evaluate(() => {
    const hook = (
      window as unknown as {
        __thoracoscopySpace?: {
          frame: () => void
          probe: () => {
            chest: { drawnShare: number } | null
            scope: { drawnShare: number } | null
          }
        }
      }
    ).__thoracoscopySpace
    if (!hook) return null
    hook.frame()
    return hook.probe()
  })
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

/** Everything a learner can read or hear on the page: the text, and the accessible names and descriptions. */
async function readableText(page: Page) {
  return page.evaluate(() => {
    const parts = [document.body.innerText]
    for (const element of Array.from(document.querySelectorAll('*'))) {
      for (const name of ['aria-label', 'aria-description', 'title', 'alt', 'placeholder'])
        if (element.getAttribute(name)) parts.push(element.getAttribute(name) as string)
    }
    parts.push(
      ...Array.from(document.querySelectorAll('title, desc')).map((node) => node.textContent ?? ''),
    )
    return parts.join('\n')
  })
}

test.beforeEach(async ({ page }) => {
  const url = process.env.MT_BASE_URL as string
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('A local server is required')
  // the site's analytics endpoint is not the module's; keep it out of the run
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await authorise(page.context())
})

test('without an admin session the module does not open: hub, lessons and prototypes (OD-15)', async ({
  browser,
}) => {
  const anonymous = await browser.newContext()
  const page = await anonymous.newPage()
  for (const path of [base, learn('systematic-survey'), SPACE_PROTOTYPE, TOOL_CONTACT]) {
    const response = await page.goto(path)
    expect(new URL(page.url()).pathname).toMatch(/\/login$/)
    expect(response?.status()).toBeLessThan(500)
    await expect(
      page.getByRole('heading', { name: 'The pleural space: engineering prototype' }),
    ).toHaveCount(0)
  }
  await anonymous.close()
})

test('a fresh learner goes from the hub’s one door into section six and through its parts', async ({
  page,
}) => {
  const response = await page.goto(base)
  expect(response?.status()).toBe(200)
  const door = page.locator('[data-continue]')
  await expect(door).toHaveCount(1)
  await expect(door).toHaveText(/^Start: A normal hemithorax from inside/)
  await door.click()
  await expect(page).toHaveURL(/section=normal-pleural-space/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A normal hemithorax from inside',
  )
  await expect(page.locator('article [role="note"]')).toContainText(
    'have not yet been clinically reviewed',
  )

  // Continue reveals the next part; Back returns
  const current = () => page.locator('[data-lesson-part][data-current]')
  await expect(current()).toHaveAttribute('data-lesson-part', 'orientation')
  await page.locator('[data-course-bar] [data-continue]').click()
  await expect(current()).toHaveAttribute('data-lesson-part', 'teaching-example')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(current()).toHaveAttribute('data-lesson-part', 'orientation')

  // the question: the explanation can be read first; moving past is recorded as moved past, not done
  await page.locator('[data-part-link="question"]').click()
  await expect(current()).toHaveAttribute('data-lesson-part', 'question')
  await page.locator('[data-lesson-part="question"] [data-explain]').click()
  await expect(page.locator('[data-lesson-part="question"]')).toContainText('Explanation')
  await page.locator('[data-move-on]').click()
  await expect(page.locator('[data-part-link="question"]')).toContainText('moved past')
  await expect(page.locator('[data-part-link="question"]')).not.toContainText('done')

  // the teaching example is put back without a simulated action, and the pane stays usable
  await page.locator('[data-part-link="teaching-example"]').click()
  await page.locator('[data-part-link="activity"]').click()
  await paneReady(page)
  await page.locator('[data-part-link="teaching-example"]').click()
  await page.locator('[data-load-example]').click()
  await paneReady(page)

  // the record holds the place and the visit, nothing else; a reload keeps the place
  const stored = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    THORACOSCOPY_PROGRESS_STORAGE_KEY,
  )
  const record = JSON.parse(stored ?? '{}') as Record<string, unknown>
  expect(Object.keys(record).sort()).toEqual(
    expect.arrayContaining(['reviewedSectionIds', 'visitedSectionIds']),
  )
  expect(JSON.stringify(record)).not.toMatch(/answer|note|pose|ledger|score/i)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A normal hemithorax from inside',
  )
  await page.goto(base)
  await expect(page.locator('[data-continue]')).toHaveText(/A normal hemithorax from inside/)
})

test('a deep link opens a section at its start, and the outline opens any part at any time', async ({
  page,
}) => {
  await page.goto(learn('systematic-survey'))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Look everywhere, in order')
  await expect(page.locator('[data-lesson-part][data-current]')).toHaveAttribute(
    'data-lesson-part',
    'orientation',
  )
  await page.locator('[data-part-link="transfer"]').click()
  await expect(page.locator('[data-lesson-part][data-current]')).toHaveAttribute(
    'data-lesson-part',
    'transfer',
  )
})

test('storage that is blocked, or holds what cannot be read: the lesson says so, works, and leaves it alone', async ({
  browser,
}) => {
  // First the course's own record alone; the whole of storage refused is the next check.
  const blocked = await authorisedContext(browser)
  await blocked.addInitScript((key) => {
    const read = Storage.prototype.getItem
    const write = Storage.prototype.setItem
    Storage.prototype.getItem = function (this: Storage, name: string) {
      if (name === key) throw new Error('denied')
      return read.call(this, name)
    }
    Storage.prototype.setItem = function (this: Storage, name: string, value: string) {
      if (name === key) throw new Error('denied')
      return write.call(this, name, value)
    }
  }, THORACOSCOPY_PROGRESS_STORAGE_KEY)
  const page = await blocked.newPage()
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await page.goto(learn('four-controls'))
  await expect(page.locator('article [role="alert"]')).toContainText('not saving')
  await page.locator('[data-course-bar] [data-continue]').click()
  await expect(page.locator('[data-lesson-part][data-current]')).not.toHaveAttribute(
    'data-lesson-part',
    'orientation',
  )
  await blocked.close()

  const corrupt = await authorisedContext(browser)
  await corrupt.addInitScript((key) => {
    if (!window.sessionStorage.getItem('seeded')) {
      window.localStorage.setItem(key, '{not json')
      window.sessionStorage.setItem('seeded', 'yes')
    }
  }, THORACOSCOPY_PROGRESS_STORAGE_KEY)
  const second = await corrupt.newPage()
  await second.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await second.goto(learn('four-controls'))
  await expect(second.locator('article [role="alert"]')).toContainText('not saving')
  await second.locator('[data-course-bar] [data-continue]').click()
  expect(
    await second.evaluate(
      (key) => window.localStorage.getItem(key),
      THORACOSCOPY_PROGRESS_STORAGE_KEY,
    ),
  ).toBe('{not json')
  await corrupt.close()
})

test('storage refused altogether: the lesson and the prototype render, read and move on, saving nothing', async ({
  browser,
}) => {
  // Every kind of browser storage refused, as a browser that blocks site data does. This needs the
  // site's theme provider to survive it (the separate site pull request, R6); without that guard
  // every page of the site is blank before this module is reached.
  const context = await authorisedContext(browser)
  await context.addInitScript(() => {
    const refuse = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    for (const name of ['localStorage', 'sessionStorage'] as const)
      Object.defineProperty(window, name, { configurable: true, get: refuse })
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get: () => ({ open: refuse, deleteDatabase: refuse, databases: refuse }),
    })
  })
  const page = await context.newPage()
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await page.goto(learn('four-controls'))
  await expect(page.locator('article [role="alert"]')).toContainText('not saving')
  await expect(page.locator('h1').first()).toBeVisible()
  await page.locator('[data-course-bar] [data-continue]').click()
  await expect(page.locator('[data-lesson-part][data-current]')).not.toHaveAttribute(
    'data-lesson-part',
    'orientation',
  )
  await page.goto(SPACE_PROTOTYPE)
  await paneReady(page)
  await context.close()
})

/** The independent landmark table (R3), written by `scripts/medical-thoracoscopy/landmark_table.py`. */
const LANDMARK_TABLE = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'src/features/medical-thoracoscopy/test-support/landmark-table.json'),
    'utf8',
  ),
) as {
  landmarks: Record<string, [number, number, number]>
  poses: {
    pose: string
    scopePose: {
      tiltAcrossRibsDeg: number
      tiltAlongRibsDeg: number
      depthMm: number
      rollDeg: number
    }
    camera: { origin: number[]; forward: number[] }
    landmarks: Record<string, { ndc: [number, number] }>
  }[]
}

test('the independent landmark table in real pixels: each landmark where the table puts it (R3)', async ({
  page,
}) => {
  // The pane's keys from the prototype's start (tilts 0, depth 12, roll 0), with the lung fallen
  // away for room: a step is 2 degrees of tilt, 2 mm of depth, 5 degrees of roll.
  const presses = (pose: (typeof LANDMARK_TABLE.poses)[number]['scopePose']) => [
    ...Array<string>(Math.round((pose.depthMm - 12) / 2)).fill('w'),
    ...Array<string>(Math.abs(Math.round(pose.tiltAcrossRibsDeg / 2))).fill(
      pose.tiltAcrossRibsDeg > 0 ? 'ArrowLeft' : 'ArrowRight',
    ),
    ...Array<string>(Math.abs(Math.round(pose.tiltAlongRibsDeg / 2))).fill(
      pose.tiltAlongRibsDeg > 0 ? 'ArrowDown' : 'ArrowUp',
    ),
    ...Array<string>(Math.round(pose.rollDeg / 5)).fill('e'),
  ]
  const MAGENTA = (rgb: number[] | null) =>
    rgb !== null && rgb[0] > 190 && rgb[1] < 90 && rgb[2] > 190
  for (const entry of LANDMARK_TABLE.poses) {
    await page.goto(SPACE_PROTOTYPE)
    await paneReady(page)
    await sceneReady(page)
    await page.getByRole('button', { name: 'Play the authored lung change' }).click()
    await expect(page.locator('[data-lung-step]')).toHaveAttribute('data-lung-step', '8', {
      timeout: 30_000,
    })
    await pane(page).focus()
    for (const key of presses(entry.scopePose)) await page.keyboard.press(key)
    // the scope camera reached the table's pose
    const expected = [...entry.camera.origin, ...entry.camera.forward]
    await expect
      .poll(async () => {
        const camera = await page.evaluate(() => {
          const hook = (
            window as unknown as {
              __thoracoscopySpace?: {
                scopeCamera: () => { position: number[]; direction: number[] } | null
              }
            }
          ).__thoracoscopySpace
          const c = hook?.scopeCamera()
          return c ? [...c.position, ...c.direction] : null
        })
        return camera ? Math.max(...camera.map((v, i) => Math.abs(v - expected[i]))) : Infinity
      })
      .toBeLessThan(1e-3)
    // markers at the landmarks in the round field, drawn over everything, then each pixel read
    const inField = Object.entries(entry.landmarks).filter(
      ([, l]) => Math.hypot(l.ndc[0], l.ndc[1]) < 0.85,
    )
    expect(inField.length).toBeGreaterThanOrEqual(3)
    await page.locator('[data-view="scope"]').scrollIntoViewIfNeeded()
    const found = await page.evaluate(
      ({ points, spots }) => {
        const hook = (
          window as unknown as {
            __thoracoscopySpace?: {
              markers: (p: number[][] | null) => void
              frame: () => void
              sample: (view: 'scope', u: number, v: number) => number[] | null
            }
          }
        ).__thoracoscopySpace
        if (!hook) return null
        hook.markers(points)
        hook.frame()
        hook.frame()
        const read = spots.map(([x, y]) => ({
          at: hook.sample('scope', (x + 1) / 2, (1 - y) / 2),
          mirrored: hook.sample('scope', (1 - x) / 2, (1 - y) / 2),
        }))
        hook.markers(null)
        hook.frame()
        return read
      },
      {
        points: inField.map(([key]) => LANDMARK_TABLE.landmarks[key]),
        spots: inField.map(([, l]) => l.ndc),
      },
    )
    expect(found).not.toBeNull()
    inField.forEach(([key, l], i) => {
      expect({ pose: entry.pose, key, drawn: MAGENTA(found![i].at) }).toEqual({
        pose: entry.pose,
        key,
        drawn: true,
      })
      // the mirror image across the picture's vertical is not a marker, unless another landmark is
      // there: a flipped hand or a mirrored side would draw it there instead
      const mirrorTaken = inField.some(
        ([, other]) => Math.hypot(other.ndc[0] + l.ndc[0], other.ndc[1] - l.ndc[1]) < 0.12,
      )
      if (!mirrorTaken && Math.abs(l.ndc[0]) > 0.12)
        expect({ pose: entry.pose, key, mirrored: MAGENTA(found![i].mirrored) }).toEqual({
          pose: entry.pose,
          key,
          mirrored: false,
        })
    })
  }
})

test('the scene draws tissue in both views, on the real canvas', async ({ page }) => {
  await page.goto(SPACE_PROTOTYPE)
  await paneReady(page)
  await sceneReady(page)
  await page.locator('[data-view="chest"]').scrollIntoViewIfNeeded()
  const chest = await probe(page)
  expect(chest?.chest?.drawnShare ?? 0).toBeGreaterThan(0.2)
  await page.locator('[data-view="scope"]').scrollIntoViewIfNeeded()
  const scope = await probe(page)
  expect(scope?.scope?.drawnShare ?? 0).toBeGreaterThan(0.5)
})

test('keyboard only: the survey, from its outline through the space to the comparison', async ({
  page,
}) => {
  await page.goto(learn('systematic-survey'))
  const outline = page.locator('[data-part-link="orientation"]')
  await outline.focus()
  // down the outline to the activity, by Tab alone
  for (let n = 0; n < 20; n += 1) {
    if (
      await page
        .locator('[data-part-link="activity"]')
        .evaluate((el) => el === document.activeElement)
    )
      break
    await page.keyboard.press('Tab')
  }
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-lesson-part="activity"]')).toBeVisible()
  await paneReady(page)
  // into the pane, by Tab, and move the telescope with its keys
  for (let n = 0; n < 80; n += 1) {
    if (await pane(page).evaluate((el) => el === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(pane(page)).toBeFocused()
  await sceneReady(page)
  await pane(page).focus()
  const before = await scopeCamera(page)
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'w', 'w', 'ArrowDown', 'ArrowDown'])
    await page.keyboard.press(key)
  await expect.poll(() => scopeCamera(page)).not.toBe(before)
  // the note, region by region, each choice by its first letter
  const rows = page.locator('[data-note-zone]')
  const count = await rows.count()
  for (let row = 0; row < count; row += 1) {
    await rows.nth(row).locator('select').first().focus()
    await page.keyboard.press('p')
    await page.keyboard.press('Tab')
    await page.keyboard.press('h')
  }
  await page.locator('[data-survey-compare]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-survey-comparison]')).toBeVisible()
})

test('touch: a tap moves the telescope one step, and the wheel over the views scrolls the page', async ({
  browser,
}) => {
  const phone = await authorisedContext(browser, {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  })
  const page = await phone.newPage()
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await page.goto(SPACE_PROTOTYPE)
  await paneReady(page)
  await sceneReady(page)
  const before = await scopeCamera(page)
  await dock(page, 'depth-in').tap()
  await expect.poll(() => scopeCamera(page)).not.toBe(before)
  await noSidewaysScroll(page)
  await phone.close()

  const desk = await authorisedContext(browser, { viewport: { width: 1440, height: 900 } })
  const wheel = await desk.newPage()
  await wheel.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await wheel.goto(SPACE_PROTOTYPE)
  await paneReady(wheel)
  const view = wheel.locator('[data-view="scope"]')
  await view.scrollIntoViewIfNeeded()
  const box = await view.boundingBox()
  if (!box) throw new Error('No scope view')
  const top = await wheel.evaluate(() => window.scrollY)
  await wheel.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await wheel.mouse.wheel(0, 400)
  await expect.poll(() => wheel.evaluate(() => window.scrollY)).toBeGreaterThan(top)
  await desk.close()
})

test('reduced motion: the lung waits for Step, one step at a time', async ({ browser }) => {
  const context = await authorisedContext(browser, { reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await page.goto(SPACE_PROTOTYPE)
  await paneReady(page)
  const step = page.locator('[data-lung-step]')
  const first = Number(await step.getAttribute('data-lung-step'))
  await expect(page.getByRole('group', { name: 'Authored teaching state' })).toContainText(
    'not a response to anything you do',
  )
  await page.getByRole('button', { name: 'Play the authored lung change' }).click()
  await page.waitForTimeout(1200)
  expect(Number(await step.getAttribute('data-lung-step'))).toBe(first)
  await dock(page, 'step').click()
  await expect(step).toHaveAttribute('data-lung-step', String(first + 1))
  await context.close()
})

test('without WebGL: the cut is drawn, said so, and the controls work', async ({ browser }) => {
  const context = await authorisedContext(browser)
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        return kind.includes('webgl') ? null : Reflect.apply(original, this, [kind, ...args])
      },
    })
  })
  const page = await context.newPage()
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await openActivity(page, 'four-controls')
  await expect(pane(page)).toContainText('cannot be drawn in three dimensions')
  await expect(pane(page).locator('svg')).toBeVisible()
  const before = await cutTelescope(page)
  for (let n = 0; n < 8; n += 1) await dock(page, 'pivot-feet').click()
  await expect.poll(() => cutTelescope(page)).not.toBe(before)
  await context.close()
})

test('a missing anatomy file, or a decoder that fails: the cut, said so, and the controls work', async ({
  page,
}) => {
  for (const pattern of ['**/anatomy/pleural-space.*.glb', '**/draco/draco_decoder.wasm']) {
    await page.route(pattern, (route) => route.fulfill({ status: 404, body: '' }))
    await page.goto(SPACE_PROTOTYPE)
    await paneReady(page)
    await expect(pane(page)).toContainText('cannot be drawn in three dimensions', {
      timeout: 60_000,
    })
    await expect(pane(page).locator('svg')).toBeVisible()
    await dock(page, 'depth-in').click()
    await expect(pane(page)).toHaveAttribute('data-readiness', 'ready')
    await page.unroute(pattern)
  }
})

test('the proxies cannot be had: the controls wait and say why; trying again marks nothing seen', async ({
  page,
}) => {
  await page.goto(SPACE_PROTOTYPE)
  await paneReady(page)
  const fresh = await pane(page).locator('tr[data-zone]').allTextContents()
  await page.route('**/anatomy/proxy-lung.*.glb', (route) => route.fulfill({ status: 500 }))
  await page.reload()
  await expect(pane(page)).toHaveAttribute('data-readiness', 'unavailable', { timeout: 60_000 })
  await expect(pane(page)).toContainText('could not be loaded')
  await expect(dock(page, 'depth-in')).toHaveAttribute('aria-disabled', 'true')
  await page.unroute('**/anatomy/proxy-lung.*.glb')
  await page.getByRole('button', { name: 'Try loading again' }).click()
  await paneReady(page)
  expect(await pane(page).locator('tr[data-zone]').allTextContents()).toEqual(fresh)
})

test('a lost context: the scene loads again and draws', async ({ page }) => {
  await page.goto(SPACE_PROTOTYPE)
  await paneReady(page)
  await sceneReady(page)
  await page.locator('canvas').first().dispatchEvent('webglcontextlost', { cancelable: true })
  await sceneReady(page)
  await page.locator('[data-view="scope"]').scrollIntoViewIfNeeded()
  expect((await probe(page))?.scope?.drawnShare ?? 0).toBeGreaterThan(0.5)
})

for (const layout of [
  { name: 'at 1440 by 900', width: 1440, height: 900, scale: 1 },
  { name: 'at 1024 by 768', width: 1024, height: 768, scale: 1 },
  { name: 'at 390 by 844', width: 390, height: 844, scale: 3 },
  { name: 'at 200 % zoom of 1440 by 900', width: 720, height: 450, scale: 2 },
  { name: 'reflowed at 320 px', width: 320, height: 640, scale: 1 },
]) {
  test(`the survey lesson and the spike ${layout.name}: no sideways scroll, the dock in reach`, async ({
    browser,
  }) => {
    const context = await authorisedContext(browser, {
      viewport: { width: layout.width, height: layout.height },
      deviceScaleFactor: layout.scale,
    })
    const page = await context.newPage()
    await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
    await openActivity(page, 'systematic-survey')
    await noSidewaysScroll(page)
    const button = dock(page, 'pivot-head')
    await button.scrollIntoViewIfNeeded()
    await expect(button).toBeInViewport()
    await button.click()
    await page.goto(TOOL_CONTACT)
    await paneReady(page)
    await noSidewaysScroll(page)
    await dock(page, 'tool-extend').scrollIntoViewIfNeeded()
    await expect(dock(page, 'tool-extend')).toBeInViewport()
    await context.close()
  })
}

test('no score, percentage, grading or correctness word anywhere a learner reads or hears', async ({
  page,
}) => {
  const pages: string[] = [base, `${base}/learn`, SPACE_PROTOTYPE, TOOL_CONTACT]
  const found: string[] = []
  for (const url of pages) {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    found.push(
      ...flaggedLearnerCopyTerms(await readableText(page)).map((term) => `${url}: ${term}`),
    )
  }
  for (const id of ['normal-pleural-space', 'four-controls', 'systematic-survey']) {
    await page.goto(learn(id))
    // every part opened, the questions' explanations too (opening one removes its button)
    for (const link of await page.locator('[data-part-link]').all()) await link.click()
    for (let n = 0; n < 4 && (await page.locator('[data-explain]').count()) > 0; n += 1)
      await page.locator('[data-explain]').first().click()
    found.push(
      ...flaggedLearnerCopyTerms(await readableText(page)).map((term) => `${learn(id)}: ${term}`),
    )
  }
  expect(found).toEqual([])
})

test('axe finds nothing on the hub, a lesson and both prototypes', async ({ page }) => {
  const require = createRequire(__filename)
  const axePath = require.resolve('axe-core/axe.min.js', {
    paths: [path.dirname(require.resolve('jest-axe/package.json'))],
  })
  const results: { url: string; violations: string[] }[] = []
  for (const url of [base, learn('systematic-survey'), SPACE_PROTOTYPE, TOOL_CONTACT]) {
    await page.goto(url)
    if (url.includes('section=')) {
      await page.locator('[data-part-link="activity"]').click()
      await paneReady(page)
    } else if (url.includes('prototype')) {
      await paneReady(page)
    }
    await page.addScriptTag({ path: axePath })
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: {
            run: (
              context: Element,
              options: object,
            ) => Promise<{ violations: { id: string; nodes: unknown[] }[] }>
          }
        }
      ).axe
      const result = await axe.run(document.querySelector('main') ?? document.body, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      })
      return result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`)
    })
    results.push({ url, violations })
  }
  expect(results.filter((entry) => entry.violations.length > 0)).toEqual([])
})

test('the contact spike: by the keys, and in the cut', async ({ page }) => {
  await page.goto(TOOL_CONTACT)
  await paneReady(page)
  await expect(page.locator('[data-nodule-on]')).toHaveAttribute(
    'data-nodule-on',
    toolContact.nodule.on,
  )
  await pane(page).focus()
  const pressUntilStopped = async (key: string, most: number) => {
    for (let n = 1; n <= most; n += 1) {
      await page.keyboard.press(key)
      if ((await refusal(page).textContent()) !== '') return n
    }
    return most
  }
  expect(await pressUntilStopped('w', 40)).toBe(toolContact.found.telescopeStopsAfterSteps)
  await expect(refusal(page)).toHaveText(/^Stopped: The telescope\. It is against the nodule/)
  for (let n = 0; n < 3; n += 1) await page.keyboard.press('s')
  await pressUntilStopped('f', 25)
  await expect(refusal(page)).toHaveText(/^Stopped: The forceps’ jaws\. They touch the nodule/)
  await expect(page.locator('tr[data-part="working-element"]')).toHaveAttribute(
    'data-rule',
    'may-touch',
  )
  // the same, drawn as the cut
  await page.getByRole('button', { name: 'Show the Chest view as a cut' }).click()
  await expect(pane(page).locator('svg [data-part="target"]').first()).toBeVisible()
  await expect(pane(page).locator('svg [data-part="forceps"]')).toBeVisible()

  await page.getByRole('button', { name: 'Beside the lung' }).click()
  await pane(page).focus()
  await pressUntilStopped('f', 25)
  const handKey = { head: 'ArrowRight', feet: 'ArrowLeft', front: 'ArrowUp', back: 'ArrowDown' }[
    toolContact.towardTheLung
  ]
  await pressUntilStopped(handKey, 6)
  await expect(refusal(page)).toHaveText(
    /^Stopped: The forceps’ (shaft|jaws)\. The lung is in the way/,
  )
  await pressUntilStopped('b', 25)
  await page.keyboard.press(handKey)
  await expect(refusal(page)).toHaveText('')
})

// ── First measurements on this machine ────────────────────────────────────────────────────────

function percentile(sorted: readonly number[], share: number) {
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]
}

async function measureLoad(browser: Browser, url: string) {
  // a new context has an empty HTTP cache: a cold load; then a reload, warm. No request is routed
  // here: routing any request turns Playwright's HTTP cache off, and the reload would be cold too.
  const context = await authorisedContext(browser, { viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const loads: Record<string, unknown>[] = []
  for (const cache of ['cold', 'warm']) {
    if (cache === 'cold') await page.goto(url)
    else await page.reload()
    await paneReady(page)
    const paneAt = await page.evaluate(() => performance.now())
    await sceneReady(page)
    const sceneAt = await page.evaluate(() => performance.now())
    const resources = await page.evaluate(() =>
      [
        ...(performance.getEntriesByType('navigation') as PerformanceResourceTiming[]),
        ...(performance.getEntriesByType('resource') as PerformanceResourceTiming[]),
      ].map((entry) => ({
        name: entry.name,
        transfer: entry.transferSize,
        decoded: entry.decodedBodySize,
      })),
    )
    const sum = (filter: (name: string) => boolean) =>
      resources.filter((entry) => filter(entry.name)).reduce((n, entry) => n + entry.transfer, 0)
    loads.push({
      cache,
      controlsReadyMs: Math.round(paneAt),
      sceneDrawnMs: Math.round(sceneAt),
      transferBytes: sum(() => true),
      anatomyTransferBytes: sum((name) => name.includes('/models/medical-thoracoscopy/')),
      scriptTransferBytes: sum((name) => name.includes('/_next/static/')),
      memoryAfterLoadBytes: await page.evaluate(
        () =>
          (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
            ?.usedJSHeapSize ?? null,
      ),
    })
  }
  await context.close()
  return loads
}

test('measurements on this machine: loading, frames while a control is held, and a command’s turn', async () => {
  // A browser of its own, asking for the machine's graphics: headless, Chromium otherwise draws
  // with SwiftShader, on the processor. The renderer it used is recorded either way.
  const browser = await chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  })
  const context = await authorisedContext(browser, { viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  // the dev server compiles a page when it is first asked for; ask once before timing anything
  await page.goto(SPACE_PROTOTYPE)
  await paneReady(page)
  await sceneReady(page)

  const renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer: info ? gl?.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
      vendor: info ? gl?.getParameter(info.UNMASKED_VENDOR_WEBGL) : null,
      devicePixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent,
    }
  })

  // frames: roll held for five seconds, both views drawing, the scope view in the viewport
  await page.locator('[data-view="scope"]').scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const frames: number[] = []
    ;(window as unknown as { __frames: number[] }).__frames = frames
    const loop = (time: number) => {
      frames.push(time)
      if (frames.length < 20000) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
  const roll = dock(page, 'roll-clockwise')
  await roll.scrollIntoViewIfNeeded()
  const box = await roll.boundingBox()
  if (!box) throw new Error('No roll button')
  const heldFrom = await page.evaluate(() => performance.now())
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(5000)
  await page.mouse.up()
  const heldTo = await page.evaluate(() => performance.now())
  const frames = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames)
  const held = frames.filter((time) => time >= heldFrom && time <= heldTo)
  const intervals = held
    .slice(1)
    .map((time, i) => time - held[i])
    .sort((a, b) => a - b)

  // a command's turn: a key on the pane until the scope camera stands where the engine put it
  const probed = await page.evaluate(
    () => 'scopeCamera' in ((window as { __thoracoscopySpace?: object }).__thoracoscopySpace ?? {}),
  )
  await pane(page).focus()
  const turns: number[] = []
  for (let n = 0; n < 40; n += 1) {
    const key = n % 2 === 0 ? 'e' : 'q'
    const took = await page.evaluate(
      (pressed) =>
        new Promise<number>((resolve) => {
          const region = document.querySelector('section[aria-label="The pleural space"]')
          const hook = (
            window as unknown as {
              __thoracoscopySpace?: { scopeCamera: () => { up: number[] } | null }
            }
          ).__thoracoscopySpace
          if (!region || !hook) return resolve(-1)
          const before = JSON.stringify(hook.scopeCamera()?.up)
          const channel = new MessageChannel()
          const started = performance.now()
          channel.port1.onmessage = () => {
            if (JSON.stringify(hook.scopeCamera()?.up) !== before)
              return resolve(performance.now() - started)
            if (performance.now() - started > 2000) return resolve(-1)
            channel.port2.postMessage(0)
          }
          region.dispatchEvent(
            new KeyboardEvent('keydown', { key: pressed, bubbles: true, cancelable: true }),
          )
          channel.port2.postMessage(0)
        }),
      key,
    )
    if (took >= 0) turns.push(took)
  }
  turns.sort((a, b) => a - b)

  const loads = {
    spacePrototype: await measureLoad(browser, SPACE_PROTOTYPE),
    toolContact: await measureLoad(browser, TOOL_CONTACT),
  }
  const manifest = readFileSync(
    path.join(process.cwd(), 'public/models/medical-thoracoscopy/v1/anatomy/manifest.json'),
  )
  const measurements = {
    date: new Date().toISOString().slice(0, 10),
    commit: execSync('git rev-parse HEAD').toString().trim(),
    anatomyManifestSha256: createHash('sha256').update(manifest).digest('hex'),
    server: `${process.env.MT_BASE_URL} (${process.env.MT_SERVER_NOTE ?? 'next dev: unminified, compiled on demand'})`,
    browser: `Playwright ${browser.browserType().name()} ${browser.version()}, headless`,
    viewport: '1440 × 900',
    renderer,
    frames: {
      scene: 'The space prototype, both views drawing, roll held for five seconds',
      count: intervals.length,
      medianMs: percentile(intervals, 0.5),
      p95Ms: percentile(intervals, 0.95),
      p99Ms: percentile(intervals, 0.99),
      worstMs: intervals.at(-1) ?? null,
    },
    commandTurn: {
      scene:
        'The space prototype: a roll key on the pane until the scope camera has turned, forty times',
      count: turns.length,
      medianMs: percentile(turns, 0.5),
      p95Ms: percentile(turns, 0.95),
      worstMs: turns.at(-1) ?? null,
    },
    loads,
  }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(
    path.join(OUT, `measurements-${process.env.MT_LABEL ?? 'dev'}.json`),
    `${JSON.stringify(measurements, null, 2)}\n`,
  )
  await browser.close()
  expect(intervals.length).toBeGreaterThan(50)
  // the development probe times a command's turn; a production build has none
  expect(turns.length).toBeGreaterThanOrEqual(probed ? 30 : 0)
})
