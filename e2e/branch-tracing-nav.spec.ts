import { expect, test, type Page } from '@playwright/test'

/**
 * Bronchial Branch Tracing: planning, the map and the navigation bench.
 *
 *   BRANCH_TRACING_BASE_URL=http://localhost:3120 \
 *     npx playwright test -c playwright.branch-tracing.config.ts
 *
 * The routes are public-unlisted, so no sign-in is needed. Every test drives the real benches:
 * the map, the scope, the CT and the task card.
 */
const BASE = '/en/learn/anatomy/branch-tracing'
const BANNED = /\b(score|scored|points|grade|graded|mastery|correct|incorrect|wrong|synthetic)\b/i
const NAV_KEY = 'branch-tracing.nav-v2'

const shell = (page: Page) => page.locator('[data-lesson-shell]')
const stage = (page: Page) => shell(page).getAttribute('data-stage')
const ct = (page: Page) => page.locator('[data-ct-image]')
const scope = (page: Page) => page.locator('[data-scope-view]')
const now = (page: Page) => page.locator('[data-now-card]')
const feedback = (page: Page) => page.locator('[data-bench-feedback]')

/** Marks the primer as already seen, so it does not open over the bench. */
const primerSeen = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('branch-tracing.primer-seen-v1', '1'))

async function openBench(page: Page, path: string) {
  await primerSeen(page)
  await page.goto(`${BASE}${path}`)
  await expect(page.locator('[data-bench]')).toBeVisible()
  await expect(ct(page)).toHaveAttribute('data-ct-ready', 'true')
}
async function expectStage(page: Page, value: string | RegExp) {
  await expect(shell(page)).toHaveAttribute('data-stage', value)
}
const nowButton = (page: Page, name: string | RegExp) => now(page).getByRole('button', { name })

/** The task card's way on from a stage that waits for the learner but checks nothing. */
const ONWARD = [
  'Drive on',
  'Back out to the fork',
  'On to the ostium',
  'Drive to the lesion',
  'Finish',
]

/** Lets the bench do every step until the stage matches, or the trip is over. */
async function showUntil(page: Page, until: RegExp, limit = 200) {
  for (let i = 0; i < limit; i++) {
    const current = (await stage(page)) ?? ''
    if (until.test(current)) return current
    if (/arrived|done/.test(current)) return current
    if (/(drive|astray-in|astray-out)$/.test(current)) {
      await expect(shell(page)).not.toHaveAttribute('data-stage', current, { timeout: 15000 })
      continue
    }
    let moved = false
    for (const name of ONWARD) {
      const button = nowButton(page, name)
      if (await button.count()) {
        await button.click()
        moved = true
        break
      }
    }
    if (!moved) await nowButton(page, /^Show/).first().click()
    await expect(shell(page)).not.toHaveAttribute('data-stage', current)
  }
  throw new Error(`The bench did not reach ${until}`)
}
/** Clicks the CT image at a fraction of its width and height. */
async function clickCt(page: Page, fx: number, fy: number) {
  const box = (await ct(page).boundingBox())!
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
}

/** Clicks the CT at a pixel of the source image, whatever way the CT is turned or zoomed. */
async function clickSourcePixel(page: Page, x: number, y: number) {
  const at = await ct(page).evaluate(
    (element, [px, py]) => {
      const image = element.querySelector('image') as SVGImageElement
      const point = new DOMPoint(px + 0.5, py + 0.5).matrixTransform(image.getScreenCTM()!)
      return { x: point.x, y: point.y }
    },
    [x, y],
  )
  await page.mouse.click(at.x, at.y)
}
/** Moves the CT slider to a slice. */
async function goToSlice(page: Page, slice: number) {
  await page.getByLabel('CT slice').evaluate((input, value) => {
    const element = input as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      element,
      String(value),
    )
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, slice)
  await expect(ct(page)).toHaveAttribute('data-slice', String(slice))
}
/** Labels the ostium circle: top, right, bottom, left. */
async function labelCircle(page: Page, words: [string, string, string, string]) {
  const rims = ['top', 'right', 'bottom', 'left']
  for (let i = 0; i < 4; i++)
    await page.locator(`[data-rim-picker="${rims[i]}"]`).selectOption(words[i])
}
/** A device set to choose at every fork: nothing is flown through. */
const everyFork = (page: Page) =>
  page.addInitScript(() =>
    localStorage.setItem(
      'branch-tracing.prefs-v1',
      JSON.stringify({ version: 1, everyFork: true }),
    ),
  )
/** A device that has already finished lesion 1: turning the CT is optional. */
const orientationShown = (page: Page) =>
  page.addInitScript((key) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 2,
          entries: {},
          orientation: { firstTryMatches: 0, lessonOneDone: true },
        }),
      )
  }, NAV_KEY)

test.describe('course', () => {
  test('the hub and every section open without an account and are not indexed', async ({
    page,
  }) => {
    for (const path of ['', '/learn', '/practice', '/assess']) {
      const response = await page.goto(`${BASE}${path}`)
      expect(response?.status(), path).toBe(200)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    }
    await page.goto(BASE)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bronchial branch tracing')
    // The optional check, the seven lessons of the course, and the two refreshers.
    await expect(page.locator('[data-lesson-group] ol li')).toHaveCount(10)
    await expect(page.locator('[data-course-overview]')).toContainText(
      '7 lessons, about 61 minutes',
    )
    await expect(page.locator('[data-method-steps] li')).toHaveCount(5)
    await expect(page.locator('[data-course-overview]')).toContainText('Mortimer & Saghaie')
    await expect(page.locator('[data-course-overview]')).not.toContainText('Pattern:')
    await expect(page.locator('[data-teaching-simulator-statement]')).toContainText(
      'teaching simulator',
    )
    expect(await page.locator('[data-course-overview]').innerText()).not.toMatch(BANNED)
    // The lesion pictured on the hub is one a lesson asks the learner to name: lobe only.
    const pictured = page.locator('figure figcaption').first()
    await expect(pictured).toContainText('A lesion in the right middle lobe')
    await expect(pictured).not.toContainText(/RS5|medial segment/i)
    // Opening the sections above left a place on this device; a first visit has none.
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    // A first visit starts at the optional orientation check, with planning one link away.
    await expect(page.getByRole('link', { name: 'Skip to planning: lesson 1' })).toHaveAttribute(
      'href',
      /lesson=start-at-the-lesion/,
    )
    await page.getByRole('link', { name: 'Start with the orientation check' }).click()
    await expect(page).toHaveURL(/lesson=orientation-check/)
    await expectStage(page, '0:match')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orientation check')
  })

  test('the primer opens by itself the first time, then from its button', async ({ page }) => {
    await page.goto(`${BASE}/learn?lesson=carina-orientation`)
    const dialog = page.locator('[data-stage-help-dialog]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('What we are doing, and why')
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    await page.reload()
    await expect(page.locator('[data-bench]')).toBeVisible()
    await expect(dialog).toBeHidden()
    await page.locator('[data-bench-help]').click()
    await expect(dialog).toContainText('Plan:')
    await expect(dialog).toContainText('Map:')
    await expect(dialog).toContainText('Navigate:')
    await expect(dialog).toContainText('Mortimer and Saghaie')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-bench-help]')).toBeFocused()
  })
})

test.describe('refresher 1: match and identify at the carina', () => {
  test.beforeEach(async ({ page }) => {
    await openBench(page, '/learn?lesson=carina-orientation')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, '0:match')
  })

  test('the scope shows the patient directions and both openings', async ({ page }) => {
    await expect(scope(page)).toHaveAttribute('data-scope-ready', 'true', { timeout: 30000 })
    // Looking down the trachea with anterior up: the patient's right is on the right.
    await expect(scope(page).locator('[data-compass="R"]')).toHaveAttribute(
      'data-compass-side',
      'on the right',
    )
    await expect(scope(page).locator('[data-compass="A"]')).toHaveAttribute(
      'data-compass-side',
      'at the top',
    )
    await expect(scope(page).locator('[data-compass="Head"]')).toHaveCount(0)
    await expect(scope(page).locator('[data-scope-opening]')).toHaveCount(2)
    // The CT starts as the radiologist displays it: the patient's right on the left.
    await expect(ct(page)).toHaveAttribute('data-orientation', '0')
    await expect(ct(page).locator('[data-ct-edge="left"]')).toHaveText('R')
  })

  test('a CT that does not match is told why and does not advance; a flip does', async ({
    page,
  }) => {
    await nowButton(page, 'Check the match').click()
    await expectStage(page, '0:match')
    await expect(feedback(page)).toContainText('Mirrored')
    await expect(feedback(page)).toContainText('Flip')
    const buttonBox = await nowButton(page, 'Check the match').boundingBox()
    await page.locator('[data-ct-turn="left"]').click()
    // Turning clears the old result, and the button has not moved under the pointer.
    await expect(feedback(page)).toBeEmpty()
    expect((await nowButton(page, 'Check the match').boundingBox())?.y).toBe(buttonBox?.y)
    await nowButton(page, 'Check the match').click()
    await expect(feedback(page)).toContainText(/Rotated/)
    await page.locator('[data-ct-turn="reset"]').click()
    await page.locator('[data-ct-turn="flip"]').click()
    await expect(ct(page)).toHaveAttribute('data-orientation', '0r')
    await expect(ct(page).locator('[data-ct-edge="right"]')).toHaveText('R')
    await nowButton(page, 'Check the match').click()
    await expectStage(page, '0:identify:0')
  })

  test('a mark is told which lumen it is in; the right lumen names the opening', async ({
    page,
  }) => {
    await page.locator('[data-ct-turn="flip"]').click()
    await nowButton(page, 'Check the match').click()
    await expectStage(page, '0:identify:0')
    // A click away from the opening's own slice places nothing.
    await clickCt(page, 0.7, 0.44)
    await expect(page.locator('[data-ct-mark]')).toHaveCount(0)
    await nowButton(page, /Go to slice 372/).click()
    await expect(ct(page)).toHaveAttribute('data-slice', '372')
    await expect(ct(page)).toHaveAttribute('data-can-mark', 'true')
    // The carina, between the two lumens: not an airway.
    await clickCt(page, 0.5, 0.2)
    await expect(feedback(page)).toContainText('Not in an airway')
    // The other main bronchus: named as the other opening, with the way to move.
    await clickCt(page, 0.3, 0.44)
    await expect(feedback(page)).toContainText('opening 2')
    await expect(feedback(page)).toContainText('mm')
    await expectStage(page, '0:identify:0')
    // Opening 1 is the right opening in the scope, and on the matched CT.
    await clickCt(page, 0.7, 0.44)
    await expectStage(page, '0:identify:1')
    await expect(page.locator('[data-ct-mark="1 · RMSB"]')).toHaveCount(1)
    await clickCt(page, 0.3, 0.44)
    await expectStage(page, '0:done')
    expect(await page.locator('[data-bench]').innerText()).not.toMatch(BANNED)
    // The second trip looks up RB1: a quarter turn, no flip.
    await nowButton(page, 'Next trip').click()
    await expectStage(page, '0:match')
    await expect(scope(page).locator('[data-compass="R"]')).toHaveAttribute(
      'data-compass-side',
      'at the bottom',
    )
    await page.locator('[data-ct-turn="left"]').click()
    await nowButton(page, 'Check the match').click()
    await expectStage(page, '0:done')
    await expect(now(page)).toContainText('End of the lesson')
  })

  test('the CT is marked from the keyboard', async ({ page }) => {
    await nowButton(page, 'Show me').click()
    await expectStage(page, '0:identify:0')
    await nowButton(page, /Go to slice 372/).click()
    await expect(ct(page)).toHaveAttribute('data-can-mark', 'true')
    await ct(page).locator('svg').focus()
    // From the centre of the image, twenty steps to the right is inside the right-hand lumen.
    await page.keyboard.down('Shift')
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.up('Shift')
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-ct-mark]')).toHaveCount(1)
    await page.keyboard.press('PageDown')
    await expect(ct(page)).toHaveAttribute('data-requested-slice', '371')
  })
})

test.describe('refresher 2: choose and drive', () => {
  test.beforeEach(async ({ page }) => {
    await openBench(page, '/learn?lesson=two-levels')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, '0:match')
  })

  test('an opening that leads away is driven into, backed out of, then greyed', async ({
    page,
  }) => {
    await showUntil(page, /^0:choose$/)
    const pose = await scope(page).getAttribute('data-scope-pose')
    await expect(page.locator('[data-choice]')).toHaveCount(2)
    await page.locator('[data-choice="1"]').click()
    // The scope goes into the branch, one generation, and stops looking at what comes next.
    await expectStage(page, '0:astray')
    expect(await scope(page).getAttribute('data-scope-pose')).not.toBe(pose)
    await expect(now(page)).toContainText('leads away from the lesion')
    await expect(page.locator('[data-choice]')).toHaveCount(0)
    await nowButton(page, 'Back out to the fork').click()
    await expectStage(page, '0:choose')
    // Back exactly where it waited, with that opening greyed and the reason under the card.
    await expect(scope(page)).toHaveAttribute('data-scope-pose', pose!)
    await expect(page.locator('[data-choice="1"]')).toBeDisabled()
    await expect(feedback(page)).toContainText('leads away from the lesion')
    await expect(feedback(page)).toContainText('take the other opening')
    await page.locator('[data-choice="2"]').click()
    await expectStage(page, '0:ready')
    await expect(feedback(page)).toContainText('leads toward the lesion')
    const slice = await ct(page).getAttribute('data-slice')
    await nowButton(page, 'Drive on').click()
    await expectStage(page, /^1:/)
    expect(await scope(page).getAttribute('data-scope-pose')).not.toBe(pose)
    expect(await ct(page).getAttribute('data-slice')).not.toBe(slice)
    // Still mirrored down the bronchus intermedius, so the match is not asked again.
    await expectStage(page, '1:identify:0')
    await expect(page.locator('[data-match-note="kept"]')).toBeVisible()
    await expect(page.locator('[data-route-chip="current"]')).toHaveText('BI')
  })

  test('the place in a trip survives a reload; an unreadable record starts fresh', async ({
    page,
  }) => {
    await showUntil(page, /^1:identify:0$/)
    await page.reload()
    await expect(page.locator('[data-bench]')).toBeVisible()
    await expectStage(page, '1:identify:0')
    await expect(ct(page)).toHaveAttribute('data-orientation', '0r')
    await page.evaluate(() => localStorage.setItem('branch-tracing.nav-v2', '{not json'))
    await page.reload()
    await expectStage(page, '0:match')
  })

  test('a fork is explained in writing: a note before its openings are marked, the rest after', async ({
    page,
  }) => {
    const note = page.locator('[data-fork-entry-note]')
    const more = page.locator('[data-fork-more]')
    // While the match is asked, nothing names the openings.
    await expect(note).toHaveCount(0)
    await expect(more).toHaveCount(0)
    await showUntil(page, /^0:identify:0$/)
    // What the upper-lobe bronchus looks like on its slice, said before the learner marks it.
    await expect(note).toContainText('slice 374')
    await expect(note).toContainText('one dark channel')
    await expect(more).toHaveCount(0)
    await showUntil(page, /^0:choose$/)
    await expect(note).toHaveCount(0)
    await more.locator('summary').click()
    await expect(more).toContainText('The right main bronchus divides at about slice 365')
    await expect(more).toContainText('Slices to step through')
    await expect(more).toContainText('From the airway model')
    await expect(more).toContainText('The names')
    const text = await more.innerText()
    expect(text).not.toMatch(BANNED)
    expect(text).not.toMatch(/\bDaughter [A-C]\b/)
    // Open, it scrolls inside the task column: the page itself still does not scroll.
    const page_ = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      client: document.documentElement.clientHeight,
    }))
    expect(page_.scroll).toBeLessThanOrEqual(page_.client)
    // The next fork down, the bronchus intermedius, has its own.
    await page.locator('[data-choice="2"]').click()
    await nowButton(page, 'Drive on').click()
    await expectStage(page, '1:identify:0')
    await expect(note).toContainText('slice 313')
    await showUntil(page, /^1:choose$/)
    await expect(more).toContainText('The bronchus intermedius divides at about slice 315')
  })

  test('with reduced motion the drive does not animate', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    const problems: string[] = []
    page.on('pageerror', (error) => problems.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' && /NaN|attribute/.test(message.text()))
        problems.push(message.text())
    })
    await openBench(page, '/learn?lesson=two-levels')
    await page.locator('[data-bench-restart]').click()
    await showUntil(page, /^0:ready$/)
    const started = Date.now()
    await nowButton(page, 'Drive on').click()
    await expectStage(page, /^1:/)
    expect(Date.now() - started).toBeLessThan(1500)
    // Every fork of the trip, driven without animation, draws a valid picture.
    await showUntil(page, /done/)
    expect(problems).toEqual([])
    await context.close()
  })
})

test.describe('turning the CT is optional once it has been shown', () => {
  test('no fork waits for the match; a check is answered on request', async ({ page }) => {
    await orientationShown(page)
    await openBench(page, '/learn?lesson=two-levels')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, '0:identify:0')
    await expect(page.locator('[data-match-note="optional"]')).toBeVisible()
    await expect(page.locator('[data-loop-step="match"]')).toHaveAttribute(
      'data-loop-state',
      'optional',
    )
    await expect(ct(page)).toHaveAttribute('data-orientation', '0')
    await page.locator('[data-ct-check-turn]').click()
    await expect(feedback(page)).toContainText('Mirrored')
    await expectStage(page, '0:identify:0')
    await page.locator('[data-ct-turn="flip"]').click()
    await page.locator('[data-ct-check-turn]').click()
    await expect(feedback(page)).toContainText('The CT matches the scope')
  })

  test('the first refresher still asks for the match', async ({ page }) => {
    await orientationShown(page)
    await openBench(page, '/learn?lesson=carina-orientation')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, '0:match')
  })
})

test.describe('planning from the lesion', () => {
  test('a lesson that only plans draws no circle: its words are the next lesson’s to find', async ({
    page,
  }) => {
    await openBench(page, '/learn?lesson=start-at-the-lesion')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, 'plan:lesion')
    await expect(page.locator('[data-arc-rim]')).toHaveCount(0)
    await expect(page.locator('[data-map-waiting]')).toBeVisible()
    await showUntil(page, /^plan:done/)
    await expect(page.locator('[data-arc-rim]')).toHaveCount(0)
    await expect(page.locator('[data-map-waiting="named"]')).toContainText('RB1 ostium')
  })

  test('the segment stays unnamed until the learner names it', async ({ page }) => {
    await openBench(page, '/practice?lesion=l-superior')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, 'plan:lesion')
    const bench = page.locator('[data-lesson-shell]')
    expect(await bench.innerText()).not.toMatch(/LS6|LB6|superior segment/)
    await expect(page.locator('[data-map-waiting]')).toBeVisible()
    await expect(page.locator('[data-route-chip="lesion"]')).toHaveText('Lesion · Left lower lobe')
    // A click on lung beside the airway is not it, and help says which way the airway lies.
    await goToSlice(page, 369)
    await clickSourcePixel(page, 345, 382)
    await expectStage(page, 'plan:lesion')
    await expect(feedback(page)).toContainText('Not the airway that runs into the lesion')
    await expect(feedback(page)).toContainText('toward the patient’s right')
    // The airway itself, on the slice where it runs toward the lesion.
    await clickSourcePixel(page, 325.45, 382.32)
    await expectStage(page, 'plan:segment')
    await expect(feedback(page)).toContainText('That is the airway into the lesion')
    await page.locator('[data-segment-choice="LB9"]').click()
    await expect(feedback(page)).toContainText('Not LB9')
    await page.locator('[data-segment-choice="LB6"]').click()
    // Outside the lessons the views are not a step of their own: the circle comes next, with the
    // views offered beside it.
    await expectStage(page, 'plan:frame')
    await expect(page.locator('[data-route-chip="lesion"]')).toHaveText('Lesion · LS6')
    await expect(page.locator('[data-arc-map]')).toBeVisible()
    await expect(page.locator('[data-views-note]')).toContainText('Nothing here is checked')
    await page.locator('[data-views-note] [data-open-view="coronal"]').click()
    await expect(page.locator('[data-ref-view]')).toHaveAttribute('data-ref-plane', 'coronal')
    await page.locator('[data-side-tab="map"]').click()
    await expect(page.locator('[data-arc-map]')).toBeVisible()
    expect(await bench.innerText()).not.toMatch(BANNED)
  })

  test('the ostium circle is accepted in any roll and refused as a mirror image', async ({
    page,
  }) => {
    await openBench(page, '/learn?lesson=stand-at-the-ostium')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, 'plan:frame')
    // RB1, looking up: medial, posterior, lateral, anterior (Mortimer & Saghaie, Fig. 1E).
    await expect(nowButton(page, 'Check the circle')).toBeDisabled()
    await labelCircle(page, ['medial', 'anterior', 'lateral', 'posterior'])
    await nowButton(page, 'Check the circle').click()
    await expectStage(page, 'plan:frame')
    await expect(feedback(page)).toContainText('mirror image')
    // The same arrangement a quarter turn round.
    await labelCircle(page, ['anterior', 'medial', 'posterior', 'lateral'])
    await nowButton(page, 'Check the circle').click()
    await expectStage(page, 'plan:done:closed')
    await expect(page.locator('[data-arc-rim="top"]')).toHaveText('Anterior')
    await nowButton(page, 'Next trip').click()
    await expectStage(page, 'plan:frame')
  })

  test('the map is drawn one division at a time and checked against the airway', async ({
    page,
  }) => {
    await openBench(page, '/learn?lesson=nested-arcs')
    await page.locator('[data-bench-restart]').click()
    await nowButton(page, 'Show me').click()
    await expectStage(page, 'plan:arcs:0')
    // RB1 divides into RB1b, toward the front, and RB1a, toward the back.
    await page.locator('[data-sector-button="6"]').click()
    await page.locator('[data-sector-button="2"]').click()
    await expect(page.locator('[data-arc-pending]')).toHaveCount(2)
    await expect(nowButton(page, 'Check the branches')).toBeDisabled()
    await page.locator('[data-leads-on="1"]').click()
    await nowButton(page, 'Check the branches').click()
    await expectStage(page, 'plan:arcs:1')
    await expect(feedback(page)).toContainText('Drawn.')
    // The next division: drawn on the wrong sides, it is held and told so.
    await page.locator('[data-sector-button="2"]').click()
    await page.locator('[data-sector-button="6"]').click()
    await page.locator('[data-leads-on="1"]').click()
    await nowButton(page, 'Check the branches').click()
    await expectStage(page, 'plan:arcs:1')
    await expect(feedback(page)).toContainText('drawn where it leaves')
    await page.locator('[data-remove-branch="1"]').click()
    await expect(page.locator('[data-placed-branch]')).toHaveCount(1)
    await showUntil(page, /^plan:review$/)
    await expect(page.locator('[data-map-pair] [data-arc-map]')).toHaveCount(2)
    await expect(page.locator('[data-map-pair] [data-arc-star]')).toHaveCount(2)
    await expect(now(page)).toContainText('3 divisions')
    expect(await page.locator('[data-lesson-shell]').innerText()).not.toMatch(BANNED)
  })
})

test.describe('coronal and sagittal views', () => {
  test('planning offers the paper’s pairing, and a click on the reconstruction moves the axial CT', async ({
    page,
  }) => {
    await openBench(page, '/learn?lesson=views-that-help')
    await page.locator('[data-bench-restart]').click()
    await showUntil(page, /^plan:views$/)
    // RB3 runs forward: axial plus coronal (Mortimer & Saghaie, Figure 2).
    await expect(now(page)).toContainText('suggest axial plus coronal')
    await page.locator('[data-open-view="coronal"]').click()
    const view = page.locator('[data-ref-view]')
    await expect(view).toHaveAttribute('data-ref-plane', 'coronal')
    await expect(page.locator('[data-ref-image]')).toHaveAttribute('data-ref-ready', 'true')
    await expect(page.locator('[data-ref-follow]')).toHaveAttribute('data-ref-follow', 'on')
    const before = await ct(page).getAttribute('data-slice')
    // The picture keeps its true proportions inside its box: its centre is always on it.
    const box = (await page.locator('[data-ref-image]').boundingBox())!
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await expect(ct(page)).not.toHaveAttribute('data-slice', before!)
    const after = await ct(page).getAttribute('data-slice')
    await expect(page.locator('[data-ref-axial-line]')).toHaveAttribute(
      'data-ref-axial-line',
      after!,
    )
    // The axial CT and the reconstruction stay side by side, and the page does not scroll.
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight),
    ).toBeLessThanOrEqual(1)
    await page.locator('[data-side-tab="sagittal"]').click()
    await expect(view).toHaveAttribute('data-ref-plane', 'sagittal')
    await page.locator('[data-side-tab="map"]').click()
    await expect(page.locator('[data-ref-view]')).toHaveCount(0)
  })

  test('while driving, a reconstruction follows the scope tip and a click opens the axial CT there', async ({
    page,
  }) => {
    await openBench(page, '/learn?lesson=two-levels')
    await page.locator('[data-bench-restart]').click()
    await page.locator('[data-centre-tab="coronal"]').click()
    await expect(page.locator('[data-centre-pane="coronal"]')).toBeVisible()
    await expect(page.locator('[data-ref-image]')).toHaveAttribute('data-ref-ready', 'true')
    await expect(page.locator('[data-ref-focus]')).toHaveAttribute('data-ref-focus', 'on-plane')
    const box = (await page.locator('[data-ref-image]').boundingBox())!
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await expect(page.locator('[data-centre-pane="ct"]')).toBeVisible()
    await expect(ct(page)).toBeVisible()
  })
})

test.describe('driving with the map', () => {
  test('past the ostium the map sits beside the scope, and a turn that leads away is backed out of', async ({
    page,
  }) => {
    test.setTimeout(180000)
    await openBench(page, '/learn?lesson=drive-with-the-map')
    await page.locator('[data-bench-restart]').click()
    // Lesson 4 is about the drive: its map is on the bench already, as one picture.
    await expectStage(page, 'plan:review')
    await expect(now(page)).toContainText('The map, drawn for you')
    await expect(page.locator('[data-map-pair]')).toHaveCount(0)
    await expect(page.locator('[data-arc-map] [data-arc-star]')).toHaveCount(1)
    await expect(nowButton(page, 'Draw it myself')).toBeVisible()
    await nowButton(page, 'Drive to the lesion').click()
    // The scope flies through the central airways and stops at the fork that gives off RB1,
    // with nothing asked on the way and the CT never waited for.
    await expectStage(page, /^[0-2]:drive$/)
    await expect(now(page)).toContainText('Flying through to')
    await expect(now(page)).toContainText('Passing: Trachea')
    await expectStage(page, '3:choose')
    await expect(page.locator('[data-route-chip="current"]')).toHaveText('RB1/B2')
    // This fork gives off the bronchus the learner named in planning, so its openings are
    // numbered and not named until one is chosen: the name would be the answer.
    await expect(page.locator('[data-choice] strong')).toHaveText(['Opening 1', 'Opening 2'])
    await expect(page.locator('[data-fork-card] tbody')).not.toContainText('RB1')
    await expect(page.locator('[data-centre-pane="ct"]')).toBeVisible()
    await expect(page.locator('[data-stage-step="navigate"]')).toHaveAttribute(
      'data-stage-state',
      'now',
    )
    await showUntil(page, /^5:choose$/)
    await expect(page.locator('[data-centre-pane="map"]')).toBeVisible()
    await expect(scope(page).locator('[data-compass="Med"]')).toHaveCount(1)
    await expect(now(page)).toContainText('the arc that holds the star')
    // Past the ostium the way is the map's to give: the card says where the lesion is, not which
    // way it lies from this fork.
    await expect(now(page)).toContainText('ringed on slice')
    await expect(now(page)).not.toContainText('mm away')
    const pose = await scope(page).getAttribute('data-scope-pose')
    await page.locator('[data-choice="2"]').click()
    await expectStage(page, '5:astray')
    await expect(now(page)).toContainText('The division ahead is not one your map draws')
    await nowButton(page, 'Back out to the fork').click()
    await expectStage(page, '5:choose')
    await expect(scope(page)).toHaveAttribute('data-scope-pose', pose!)
    // The CT is a tab away.
    await page.locator('[data-centre-tab="ct"]').click()
    await expect(ct(page)).toBeVisible()
    await page.locator('[data-centre-tab="map"]').click()
    await page.locator('[data-map-turn]').check()
    await expect(page.locator('[data-arc-map]')).toBeVisible()
    await showUntil(page, /arrived/)
    const closing = await page.locator('[data-bench-closing]').innerText()
    expect(closing).toContain('Branches that led away, driven into: 1; backed out of: 1.')
    expect(closing).not.toMatch(BANNED)
    // The summary runs past the bottom of the window; the way on to the next lesson stays in it.
    const onward = (await now(page).locator('[data-now-footer="pinned"]').boundingBox())!
    expect(onward.y + onward.height).toBeLessThanOrEqual(page.viewportSize()!.height + 0.5)
  })
})

test.describe('the fly-through of the central airways', () => {
  test('it can be stopped at the next fork, an opening is chosen on the scope, and it goes on', async ({
    page,
  }) => {
    test.setTimeout(120000)
    await openBench(page, '/practice?lesion=r-apical-anterior')
    await page.locator('[data-bench-restart]').click()
    await showUntil(page, /^plan:review$/)
    await nowButton(page, 'Drive to the lesion').click()
    await expectStage(page, '0:drive')
    await expect(now(page)).toContainText('Flying through to RB1/B2')
    await nowButton(page, 'Stop at the next fork').click()
    await expect(now(page)).toContainText('Stopping at the next fork')
    // The next fork is then an ordinary one: the right main bronchus, chosen at.
    await expectStage(page, '1:choose')
    await expect(page.locator('[data-route-chip="current"]')).toHaveText('RMSB')
    await expect(scope(page)).toHaveAttribute('data-scope-ready', 'true', { timeout: 30000 })
    // A click on an opening's number in the scope takes it: the upper lobe bronchus, opening 1.
    await expect(scope(page).locator('[data-opening-pick]')).toHaveCount(2)
    await scope(page).locator('[data-scope-opening="1"]').click()
    await expectStage(page, '1:ready')
    await nowButton(page, 'Drive on').click()
    // From there the fly-through goes on, to the fork that gives off RB1.
    await expectStage(page, '3:choose')
    await expect(page.locator('[data-route-chip="current"]')).toHaveText('RB1/B2')
    // Only the forks chosen at are counted at the end.
    await showUntil(page, /arrived/)
    await expect(page.locator('[data-bench-closing]')).toContainText(
      // Five forks were chosen at, of seven: the one taken on the scope, and four shown.
      'Opening toward the lesion chosen first try: 1 of 5.',
    )
  })

  test('asked for on the lesion list, every fork from the trachea is chosen at', async ({
    page,
  }) => {
    test.setTimeout(120000)
    await primerSeen(page)
    await page.goto(`${BASE}/practice`)
    const choice = page.locator('[data-cruise-choice] input')
    await expect(choice).not.toBeChecked()
    await choice.check()
    expect(await page.evaluate(() => localStorage.getItem('branch-tracing.prefs-v1'))).toBe(
      '{"version":1,"everyFork":true}',
    )
    await page.locator('[data-lesion="r-apical-anterior"]').click()
    await expect(page.locator('[data-bench]')).toBeVisible()
    await page.locator('[data-bench-restart]').click()
    await showUntil(page, /^plan:review$/)
    await nowButton(page, 'Drive to the lesion').click()
    await expectStage(page, '0:choose')
    await expect(page.locator('[data-route-chip="current"]')).toHaveText('Trachea')
  })
})

test.describe('the orientation check and the refreshers', () => {
  test('three forks matched at the first check lead on to planning; a miss leads to the refresher', async ({
    page,
  }) => {
    await openBench(page, '/learn?lesson=orientation-check')
    await page.locator('[data-bench-restart]').click()
    const turnAndCheck = async (turn: string) => {
      await expectStage(page, '0:match')
      await page.locator(`[data-ct-turn="${turn}"]`).click()
      await nowButton(page, 'Check the match').click()
      await expectStage(page, '0:done')
    }
    // The carina is a mirror; the right upper lobe one quarter turn; the left the other.
    await turnAndCheck('flip')
    await now(page).getByRole('button', { name: 'Next trip' }).click()
    await turnAndCheck('left')
    await now(page).getByRole('button', { name: 'Next trip' }).click()
    await turnAndCheck('right')
    const closing = page.locator('[data-bench-closing]')
    await expect(closing).toContainText('All three matched at the first check')
    await expect(
      now(page).getByRole('link', { name: 'Lesson 1: Start at the lesion' }),
    ).toHaveAttribute('href', /lesson=start-at-the-lesion/)
    expect(await shell(page).innerText()).not.toMatch(BANNED)

    // Again, with the first fork checked before it is turned: told what is off, not how to fix it.
    await page.reload()
    await expect(page.locator('[data-bench]')).toBeVisible()
    await expectStage(page, '0:match')
    await nowButton(page, 'Check the match').click()
    await expect(feedback(page)).toContainText('Mirrored')
    await expect(feedback(page)).not.toContainText('Flip')
    await page.locator('[data-ct-turn="flip"]').click()
    await nowButton(page, 'Check the match').click()
    await now(page).getByRole('button', { name: 'Next trip' }).click()
    await turnAndCheck('left')
    await now(page).getByRole('button', { name: 'Next trip' }).click()
    await turnAndCheck('right')
    await expect(closing).toContainText('At least one fork did not match at the first check')
    await expect(
      now(page).getByRole('link', { name: 'Refresher: Why the CT looks backwards' }),
    ).toHaveAttribute('href', /lesson=carina-orientation/)
  })

  test('the two earlier lessons stay open as refreshers, one leading to the next and then to planning', async ({
    page,
  }) => {
    await openBench(page, '/learn?lesson=carina-orientation')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Refresher · Why the CT looks backwards',
    )
    await openBench(page, '/learn?lesson=start-at-the-lesion')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Lesson 1 · Start at the lesion',
    )
    // With no lesson named, the course opens on planning.
    await openBench(page, '/learn')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Lesson 1 · Start at the lesion',
    )
  })
})

test.describe('whole lesions', () => {
  test('Practice plans, maps and drives a lesion from the trachea', async ({ page }) => {
    test.setTimeout(180000)
    await primerSeen(page)
    await page.goto(`${BASE}/practice`)
    await expect(page.locator('[data-lesion]')).toHaveCount(13)
    await expect(page.locator('[data-lesion-picker]')).toContainText('teaching simulator')
    expect(await page.locator('[data-lesion-picker]').innerText()).not.toMatch(/RS8|RB8/)
    await page.locator('[data-lesion="r-anterior-basal"]').click()
    await expect(page).toHaveURL(/lesion=r-anterior-basal/)
    await expect(page.locator('[data-bench]')).toBeVisible()
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, 'plan:lesion')
    await showUntil(page, /^plan:review$/)
    await nowButton(page, 'Drive to the lesion').click()
    // The central airways are flown through: the first choice is the fork that gives off RB8.
    await showUntil(page, /choose$/)
    await expectStage(page, '5:choose')
    // Above the ostium, with help on, the card says which way the lesion lies from the fork.
    await expect(now(page)).toContainText('mm away')
    // No fork asks for its openings to be marked: the map was read off the CT in planning.
    await showUntil(page, /^7:choose$/)
    await expect(page.locator('[data-choice]')).toHaveCount(3)
    await expect(scope(page).locator('[data-scope-opening]')).toHaveCount(3)
    await showUntil(page, /arrived/)
    await expect(now(page)).toContainText('You have reached the lesion')
    const closing = await page.locator('[data-bench-closing]').innerText()
    expect(closing).toContain('RS8')
    expect(closing).toContain('teaching simulator')
    expect(closing).toMatch(/Divisions drawn right at the first check: \d+ of 2/)
    expect(closing).not.toMatch(BANNED)
  })

  test('the closing set gives no hints and withholds names until the learner has chosen', async ({
    page,
  }) => {
    test.setTimeout(120000)
    await primerSeen(page)
    // Asked to choose at every fork from the trachea, so the first fork is the carina.
    await everyFork(page)
    await page.goto(`${BASE}/assess`)
    await expect(page.locator('[data-cruise-choice] input')).toBeChecked()
    await expect(page.locator('[data-lesion]')).toHaveCount(3)
    await page.locator('[data-lesion="l-inferior-lingula"]').click()
    await expect(page.locator('[data-bench]')).toBeVisible()
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, 'plan:lesion')
    await clickCt(page, 0.1, 0.1)
    await expect(feedback(page)).toContainText('Not the airway that runs into the lesion')
    await expect(feedback(page)).not.toContainText('mm')
    await showUntil(page, /^plan:review$/)
    await nowButton(page, 'Drive to the lesion').click()
    // No fork waits for the CT to be turned. A check on request says what is off, not how to
    // fix it.
    await expectStage(page, '0:choose')
    await page.locator('[data-ct-check-turn]').click()
    await expect(feedback(page)).toContainText('Mirrored')
    await expect(feedback(page)).not.toContainText('Flip')
    // The card places the lesion and says nothing of which way it lies from the fork.
    await expect(now(page)).toContainText('ringed on slice')
    await expect(now(page)).not.toContainText('mm away')
    await expect(page.locator('[data-choice] strong').first()).toHaveText('Opening 1')
    await expect(page.locator('[data-fork-card]')).not.toContainText('LMSB')
    // A branch that leads away is told as that, with nothing of where the lesion lies.
    await page.locator('[data-choice="1"]').click()
    await expectStage(page, '0:astray')
    await nowButton(page, 'Back out to the fork').click()
    await expectStage(page, '0:choose')
    await expect(feedback(page)).toContainText('leads away from the lesion')
    await expect(feedback(page)).not.toContainText('The lesion lies')
    await nowButton(page, 'Show me').click()
    await expectStage(page, '0:ready')
    await expect(page.locator('[data-fork-card]')).toContainText('LMSB')
    // The written explanations are teaching: the closing set shows none of them.
    await expect(page.locator('[data-fork-more]')).toHaveCount(0)
    await expect(page.locator('[data-fork-entry-note]')).toHaveCount(0)
  })
})

test.describe('resilience', () => {
  test('when the 3D view is lost the CT and the task still work', async ({ page }) => {
    await openBench(page, '/learn?lesson=carina-orientation')
    await page.locator('[data-bench-restart]').click()
    await expect(scope(page)).toHaveAttribute('data-scope-ready', 'true', { timeout: 30000 })
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-scope-view] canvas') as HTMLCanvasElement
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    })
    await expect(scope(page).getByRole('alert')).toContainText('The CT and the task still work')
    await page.locator('[data-ct-turn="flip"]').click()
    await nowButton(page, 'Check the match').click()
    await expectStage(page, '0:identify:0')
  })
})

test.describe('one screen', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    // The beta reviewers' window, and what the beta frame leaves the module inside it.
    { width: 1600, height: 905 },
    { width: 1600, height: 852 },
    { width: 1707, height: 900 },
  ])
    test(`the pictures and every control fit ${viewport.width}×${viewport.height}`, async ({
      page,
    }, info) => {
      test.setTimeout(180000)
      await page.setViewportSize(viewport)
      const inside = async (label: string, locator: ReturnType<Page['locator']>) => {
        const count = await locator.count()
        expect(count, label).toBeGreaterThan(0)
        for (let i = 0; i < count; i++) {
          const box = await locator.nth(i).boundingBox()
          expect(box, label).not.toBeNull()
          expect(box!.x, `${label} left`).toBeGreaterThanOrEqual(0)
          expect(box!.y, `${label} top`).toBeGreaterThanOrEqual(0)
          expect(box!.x + box!.width, `${label} right`).toBeLessThanOrEqual(viewport.width + 0.5)
          expect(box!.y + box!.height, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 0.5)
        }
      }
      const square = async (state: string, label: string, locator: ReturnType<Page['locator']>) => {
        const box = (await locator.boundingBox())!
        expect(Math.abs(box.width - box.height), `${state}: ${label} is square`).toBeLessThan(2)
        expect(box.width, `${state}: ${label} size`).toBeGreaterThanOrEqual(440)
      }
      const pageFits = async (state: string) => {
        // Nothing but the detail column scrolls: the page itself does not.
        const page_ = await page.evaluate(() => ({
          h: document.documentElement.scrollHeight,
          w: document.documentElement.scrollWidth,
          ih: window.innerHeight,
          iw: window.innerWidth,
        }))
        expect(page_.h, `${state}: page height`).toBeLessThanOrEqual(page_.ih + 1)
        expect(page_.w, `${state}: page width`).toBeLessThanOrEqual(page_.iw + 1)
        // The bench reaches the bottom of the window, whatever the task column holds.
        const bench = (await page.locator('[data-bench]').boundingBox())!
        expect(bench.y + bench.height, `${state}: bench reaches the bottom`).toBeGreaterThan(
          page_.ih - 4,
        )
        await inside(`${state}: instruction`, now(page).locator('h2'))
        await inside(`${state}: task buttons`, now(page).getByRole('button'))
        await info.attach(`${viewport.width}x${viewport.height}-${state}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
      }
      const ctFits = async (state: string) => {
        await inside(`${state}: CT`, ct(page))
        await inside(`${state}: turn controls`, page.locator('[data-ct-turn]'))
        await inside(`${state}: slice slider`, page.getByLabel('CT slice'))
        await square(state, 'CT', ct(page))
      }
      const check = async (state: string) => {
        await pageFits(state)
        await ctFits(state)
        await inside(`${state}: scope`, scope(page))
        await square(state, 'scope', scope(page))
      }

      // The drive bench, one fork through its moves.
      await openBench(page, '/learn?lesson=two-levels')
      await page.locator('[data-bench-restart]').click()
      await expect(scope(page)).toHaveAttribute('data-scope-ready', 'true', { timeout: 30000 })
      await check('match')
      await nowButton(page, 'Check the match').click()
      await check('match-feedback')
      await showUntil(page, /^0:identify:0$/)
      await check('identify')
      await showUntil(page, /^0:choose$/)
      await inside('choose: openings', page.locator('[data-choice]'))
      await check('choose')
      await page.locator('[data-choice="1"]').click()
      await expectStage(page, '0:astray')
      await check('astray')
      await nowButton(page, 'Back out to the fork').click()
      await expectStage(page, '0:choose')
      await inside('choose-feedback: openings', page.locator('[data-choice]'))
      await check('choose-feedback')
      await showUntil(page, /^0:ready$/)
      await check('drive')

      // The planning bench: the map, the CT and the task.
      await page.goto(`${BASE}/learn?lesson=nested-arcs`)
      await page.locator('[data-bench-restart]').click()
      await expectStage(page, 'plan:frame')
      const map = page.locator('[data-arc-map]')
      const planCheck = async (state: string) => {
        await pageFits(state)
        await ctFits(state)
        await inside(`${state}: map`, map)
        await square(state, 'map', map)
      }
      await planCheck('frame')
      await inside('frame: pickers', page.locator('[data-rim-picker]'))
      await nowButton(page, 'Show me').click()
      await planCheck('arcs')
      await inside('arcs: directions', page.locator('[data-sector-button]'))
      await page.locator('[data-sector-button="6"]').click()
      await page.locator('[data-sector-button="2"]').click()
      await planCheck('arcs-drawn')
      await inside('arcs-drawn: branch list', page.locator('[data-leads-on]'))
      await showUntil(page, /^plan:review$/)
      await pageFits('review')

      // Driving past the ostium: the scope and the map side by side.
      await page.goto(`${BASE}/learn?lesson=drive-with-the-map`)
      await page.locator('[data-bench-restart]').click()
      await showUntil(page, /^plan:review$/)
      await nowButton(page, 'Drive to the lesion').click()
      await showUntil(page, /^5:choose$/)
      await pageFits('map-drive')
      await inside('map-drive: scope', scope(page))
      await inside('map-drive: map', map)
      await square('map-drive', 'scope', scope(page))
      await square('map-drive', 'map', map)
      await inside('map-drive: openings', page.locator('[data-choice]'))
    })

  test('a bench has the whole window: no site menu or section tabs above it', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 852 })
    await page.goto(BASE)
    await expect(page.locator('#site-header')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Branch tracing sections' })).toBeVisible()
    await openBench(page, '/learn?lesson=drive-with-the-map')
    await expect(page.locator('#site-header')).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Branch tracing sections' })).toBeHidden()
    const shellTop = (await shell(page).boundingBox())!.y
    expect(shellTop).toBeLessThan(2)
    // The bench's own bar is the way out.
    await page.getByRole('link', { name: 'Course overview' }).click()
    await expect(page.locator('#site-header')).toBeVisible()
  })

  test('a narrow screen stacks the instruction above the two pictures', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 })
    await openBench(page, '/learn?lesson=carina-orientation')
    const nowBox = (await now(page).boundingBox())!
    const scopeBox = (await scope(page).boundingBox())!
    const ctBox = (await ct(page).boundingBox())!
    expect(nowBox.y).toBeLessThan(scopeBox.y)
    expect(Math.abs(scopeBox.y - ctBox.y)).toBeLessThan(80)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1)
  })
})
