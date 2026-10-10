import { expect, test, type Page } from '@playwright/test'

/**
 * Bronchial Branch Tracing: the navigation bench.
 *
 *   BRANCH_TRACING_BASE_URL=http://localhost:3127 \
 *     npx playwright test -c playwright.branch-tracing.config.ts
 *
 * The routes are public-unlisted, so no sign-in is needed. Every test drives the real bench:
 * the scope, the CT and the task card.
 */
const BASE = '/en/learn/anatomy/branch-tracing'
const BANNED = /\b(score|scored|points|grade|graded|mastery|correct|incorrect|wrong|synthetic)\b/i

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

/** Lets the bench do every step until the stage matches, or the trip is over. */
async function showUntil(page: Page, until: RegExp, limit = 200) {
  for (let i = 0; i < limit; i++) {
    const current = (await stage(page)) ?? ''
    if (until.test(current)) return current
    if (/arrived|done/.test(current)) return current
    if (current.endsWith('drive')) {
      await expect(shell(page)).not.toHaveAttribute('data-stage', current, { timeout: 15000 })
      continue
    }
    const drive = nowButton(page, 'Drive on')
    if (await drive.count()) await drive.click()
    else await nowButton(page, /^Show/).first().click()
    await expect(shell(page)).not.toHaveAttribute('data-stage', current)
  }
  throw new Error(`The bench did not reach ${until}`)
}
/** Clicks the CT image at a fraction of its width and height. */
async function clickCt(page: Page, fx: number, fy: number) {
  const box = (await ct(page).boundingBox())!
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
}

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
    await expect(page.locator('[data-course-overview] ol li')).toHaveCount(8)
    await expect(page.locator('[data-teaching-simulator-statement]')).toContainText(
      'teaching simulator',
    )
    expect(await page.locator('[data-course-overview]').innerText()).not.toMatch(BANNED)
    await page
      .getByRole('link', { name: /Start lesson 1|Why the CT looks backwards/ })
      .first()
      .click()
    await expect(page).toHaveURL(/lesson=carina-orientation/)
    await expectStage(page, '0:match')
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
    await expect(dialog).toContainText('Match')
    await expect(dialog).toContainText('Identify')
    await expect(dialog).toContainText('Choose')
    await expect(dialog).toContainText('Drive')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-bench-help]')).toBeFocused()
  })
})

test.describe('lesson 1: match and identify at the carina', () => {
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

test.describe('lesson 2: choose and drive', () => {
  test.beforeEach(async ({ page }) => {
    await openBench(page, '/learn?lesson=two-levels')
    await page.locator('[data-bench-restart]').click()
    await expectStage(page, '0:match')
  })

  test('an opening that leads away is refused at the fork; the right one drives on', async ({
    page,
  }) => {
    await showUntil(page, /^0:choose$/)
    const pose = await scope(page).getAttribute('data-scope-pose')
    await expect(page.locator('[data-choice]')).toHaveCount(2)
    await page.locator('[data-choice="1"]').click()
    await expectStage(page, '0:choose')
    await expect(feedback(page)).toContainText('leads away from the lesion')
    await expect(feedback(page)).toContainText('back to the fork')
    await expect(page.locator('[data-choice="1"]')).toBeDisabled()
    expect(await scope(page).getAttribute('data-scope-pose')).toBe(pose)
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
    await page.evaluate(() => localStorage.setItem('branch-tracing.nav-v1', '{not json'))
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

test.describe('whole routes', () => {
  test('Practice offers thirteen lesions and drives one from the trachea to the lesion', async ({
    page,
  }) => {
    test.setTimeout(180000)
    await primerSeen(page)
    await page.goto(`${BASE}/practice`)
    await expect(page.locator('[data-lesion]')).toHaveCount(13)
    await expect(page.locator('[data-lesion-picker]')).toContainText('teaching simulator')
    await page.locator('[data-lesion="r-anterior-basal"]').click()
    await expect(page).toHaveURL(/lesion=r-anterior-basal/)
    await expect(page.locator('[data-bench]')).toBeVisible()
    await page.locator('[data-bench-restart]').click()
    // The trachea and main bronchus are chosen, not marked.
    await expectStage(page, '0:match')
    await nowButton(page, 'Show me').click()
    await expectStage(page, '0:choose')
    // The last fork of this route divides three ways.
    await showUntil(page, /^7:choose$/)
    await expect(page.locator('[data-choice]')).toHaveCount(3)
    await expect(scope(page).locator('[data-scope-opening]')).toHaveCount(3)
    const labels = await page.locator('[data-choice] strong').allInnerTexts()
    expect(new Set(labels).size).toBe(3)
    await showUntil(page, /arrived/)
    await expect(now(page)).toContainText('You have reached the lesion')
    await expect(ct(page).locator('[data-ct-nodule]')).toHaveCount(1)
    await expect(ct(page).locator('[data-ct-lesion-ring]')).toHaveCount(1)
    const closing = await page.locator('[data-bench-closing]').innerText()
    expect(closing).toContain('teaching simulator')
    expect(closing).toMatch(/first try: \d+ of \d+/)
    expect(closing).not.toMatch(BANNED)
  })

  test('the closing set withholds names and directions until the learner has chosen', async ({
    page,
  }) => {
    await primerSeen(page)
    await page.goto(`${BASE}/assess`)
    await expect(page.locator('[data-lesion]')).toHaveCount(3)
    await page.locator('[data-lesion="l-inferior-lingula"]').click()
    await expect(page.locator('[data-bench]')).toBeVisible()
    await page.locator('[data-bench-restart]').click()
    await nowButton(page, 'Check the match').click()
    // Told what is off, not how to fix it.
    await expect(feedback(page)).toContainText('Mirrored')
    await expect(feedback(page)).not.toContainText('Flip')
    await nowButton(page, 'Show me').click()
    await expectStage(page, '0:choose')
    await expect(page.locator('[data-choice] strong').first()).toHaveText('Opening 1')
    await expect(page.locator('[data-fork-card]')).not.toContainText('LMSB')
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
    { width: 1707, height: 900 },
  ])
    test(`the scope, the CT and every control fit ${viewport.width}×${viewport.height}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport)
      await openBench(page, '/learn?lesson=two-levels')
      await page.locator('[data-bench-restart]').click()
      await expect(scope(page)).toHaveAttribute('data-scope-ready', 'true', { timeout: 30000 })
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
      const check = async (state: string) => {
        // Nothing but the detail column scrolls: the page itself does not.
        const page_ = await page.evaluate(() => ({
          h: document.documentElement.scrollHeight,
          w: document.documentElement.scrollWidth,
          ih: window.innerHeight,
          iw: window.innerWidth,
        }))
        expect(page_.h, `${state}: page height`).toBeLessThanOrEqual(page_.ih + 1)
        expect(page_.w, `${state}: page width`).toBeLessThanOrEqual(page_.iw + 1)
        await inside(`${state}: scope`, scope(page))
        await inside(`${state}: CT`, ct(page))
        await inside(`${state}: turn controls`, page.locator('[data-ct-turn]'))
        await inside(`${state}: slice slider`, page.getByLabel('CT slice'))
        await inside(`${state}: instruction`, now(page).locator('h2'))
        await inside(`${state}: task buttons`, now(page).getByRole('button'))
        const ctBox = (await ct(page).boundingBox())!
        const scopeBox = (await scope(page).boundingBox())!
        expect(Math.abs(ctBox.width - ctBox.height), `${state}: CT is square`).toBeLessThan(2)
        expect(ctBox.width, `${state}: CT size`).toBeGreaterThanOrEqual(440)
        expect(scopeBox.width, `${state}: scope size`).toBeGreaterThanOrEqual(440)
        await info.attach(`${viewport.width}x${viewport.height}-${state}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
      }
      await check('match')
      await nowButton(page, 'Check the match').click()
      await check('match-feedback')
      await showUntil(page, /^0:identify:0$/)
      await check('identify')
      await showUntil(page, /^0:choose$/)
      await inside('choose: openings', page.locator('[data-choice]'))
      await check('choose')
      await page.locator('[data-choice="1"]').click()
      await inside('choose-feedback: openings', page.locator('[data-choice]'))
      await check('choose-feedback')
      await showUntil(page, /^0:ready$/)
      await check('drive')
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
