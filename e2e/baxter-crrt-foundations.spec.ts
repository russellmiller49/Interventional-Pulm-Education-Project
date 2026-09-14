import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test'

type SavedProgress = {
  completedLessonIds: string[]
  selfPaced: { visitedLessonIds: string[] }
  learnTaskHistory?: {
    taskId: string
    attemptId: string
    response: string
    correct: boolean | null
    feedbackDisplayed: boolean
    reviewed: boolean
    inputs?: Record<string, number>
  }[]
  bestSafeScores: Record<string, number>
}
const progress = (page: Page): Promise<SavedProgress> =>
  page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('baxter-crrt-progress-v3') ||
        '{"completedLessonIds":[],"bestSafeScores":{}}',
    ),
  )
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' })
const keyboardPages = new WeakSet<Page>()
async function activate(page: Page, target: Locator) {
  if (!keyboardPages.has(page)) {
    if ((await target.getAttribute('type')) === 'radio') await target.locator('..').click()
    else await target.click()
    return
  }
  await expect(target).toBeAttached()
  for (let n = 0; n < 180; n++) {
    if (await target.evaluate((el) => document.activeElement === el)) {
      await page.keyboard.press((await target.getAttribute('type')) === 'radio' ? 'Space' : 'Enter')
      return
    }
    if (
      await target.evaluate(
        (el) =>
          el instanceof HTMLInputElement &&
          el.type === 'radio' &&
          document.activeElement instanceof HTMLInputElement &&
          document.activeElement.type === 'radio' &&
          document.activeElement.name === el.name,
      )
    )
      await page.keyboard.press('ArrowRight')
    else await page.keyboard.press('Tab')
  }
  throw new Error(
    `Keyboard could not reach ${(await target.getAttribute('name')) ?? (await target.textContent())}`,
  )
}
const click = (page: Page, name: string | RegExp) => activate(page, button(page, name))
async function enterDowntime(page: Page, value: string) {
  const input = page.getByRole('spinbutton', { name: /^Time not running/ })
  if (!keyboardPages.has(page)) return input.fill(value)
  for (let n = 0; n < 180; n++) {
    if (await input.evaluate((el) => document.activeElement === el)) {
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.press('Backspace')
      if (value) await page.keyboard.type(value)
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error('Keyboard could not reach downtime')
}
const next = (page: Page) => click(page, 'Continue')
const review = (page: Page) => click(page, 'Review feedback and continue')
async function selectAll(page: Page, names: string[]) {
  for (const name of names) await click(page, name)
}
async function modalityWalk(page: Page) {
  await selectAll(page, ['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'])
  await click(page, 'Review observations and continue')
}
async function answer(page: Page, name: RegExp) {
  await activate(page, page.getByRole('radio', { name }))
  await click(page, 'Check reasoning')
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
  if (name.startsWith('06-') || name.startsWith('09-'))
    await page.screenshot({ path: info.outputPath(`${name}-viewport.png`) })
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}
async function toLesson(page: Page, id: string) {
  await page.getByRole('combobox', { name: 'CRRT lesson' }).selectOption(id)
}

for (const keyboardOnly of [false, true]) {
  test(`clean four-lesson walkthrough: ${keyboardOnly ? 'compact keyboard reduced motion' : 'laptop pointer'}`, async ({
    page,
  }, info) => {
    if (keyboardOnly) {
      keyboardPages.add(page)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
    }
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/en/baxter-crrt')
    await activate(page, page.getByRole('link', { name: /Start the core path/ }))
    await expect(
      page.getByRole('heading', { name: 'Two treatment goals, one blood circuit' }),
    ).toBeVisible()
    await screenshot(page, info, '01-orientation-desktop')
    await next(page)
    await next(page)
    await modalityWalk(page)
    await answer(page, /Use the modality with the most mechanisms/)
    await expect(page.getByRole('heading', { name: 'Reasoning feedback' })).toBeVisible()
    expect((await progress(page)).completedLessonIds).toEqual([])
    await screenshot(page, info, '02-wrong-feedback')
    await review(page)
    await answer(page, /Solute support and zero net CRRT removal/)
    await review(page)
    expect((await progress(page)).learnTaskHistory).toBeUndefined()
    await click(page, /Continue to Circuit anatomy/)
    await selectAll(page, [
      'Patient access',
      'Pre-pump segment',
      'Blood pump',
      'Filter',
      'Return segment',
      'Patient return',
    ])
    await click(page, 'Review observations and continue')
    await selectAll(page, [
      'Dialysate',
      'Pre-filter replacement',
      'Post-filter replacement',
      'PBP',
      'Effluent',
    ])
    await click(page, 'Review observations and continue')
    await selectAll(page, [
      'Access pressure',
      'Filter pressure',
      'Return pressure',
      'Effluent pressure',
      'TMP',
      'Filter pressure drop',
    ])
    await click(page, 'Compare return-side resistance')
    await screenshot(page, info, '03-sites-and-return-comparison')
    await click(page, 'Review observations and continue')
    for (const signal of [
      'Access pressure',
      'Filter pressure',
      'Return pressure',
      'Effluent pressure',
      'TMP',
      'Filter pressure drop',
    ])
      await activate(
        page,
        page
          .getByRole('group', { name: signal, exact: true })
          .getByRole('radio', { name: 'Unchanged', exact: true }),
      )
    await click(page, 'Commit prediction')
    await click(page, 'Reveal pressure pattern')
    expect((await progress(page)).learnTaskHistory).toBeUndefined()
    await screenshot(page, info, '04-known-pressure-feedback')
    await click(page, 'Review pressure comparison and continue')
    await expect(
      page.getByText(
        'The access pressure became more negative while the downstream readings stayed the same.',
        { exact: false },
      ),
    ).toHaveCount(0)
    await answer(page, /An access-side problem is supported/)
    await review(page)
    await answer(page, /Assess the patient and inspect the return path/)
    await review(page)
    await click(page, /Continue to Solute and water transport/)
    await selectAll(page, ['Diffusion', 'Convection', 'Ultrafiltration'])
    await screenshot(page, info, '05-filter-inset')
    await click(page, 'Review observations and continue')
    await modalityWalk(page)
    await selectAll(page, [
      'Dialysate +500 mL/h',
      'Post-filter replacement +500 mL/h',
      'Net CRRT removal +100 mL/h',
    ])
    await screenshot(page, info, '06-fluid-comparison')
    await click(page, 'Review observations and continue')
    await answer(page, /Dialysate-supported transport and total effluent/)
    await review(page)
    await answer(page, /More water crosses the membrane with convective/)
    await review(page)
    await click(page, /Continue to Prescription and delivered dose/)
    await expect(page.getByText('21.875 mL/kg/h', { exact: true })).toBeVisible()
    await screenshot(page, info, '07-worked-dose')
    await next(page)
    await click(page, /Continue to Construction/)
    await enterDowntime(page, '')
    await click(page, /Continue to Predicted consequences/)
    await expect(page.getByText(/Every predicted consequence is unavailable until/)).toBeVisible()
    expect((await progress(page)).learnTaskHistory).toBeUndefined()
    await screenshot(page, info, '08-invalid-downtime-no-credit')
    await click(page, /Back to Construction/)
    await enterDowntime(page, '6')
    await click(page, /Continue to Predicted consequences/)
    await activate(page, page.getByRole('radio', { name: /projected average dose fell/ }))
    await click(page, 'Check comparison')
    expect((await progress(page)).learnTaskHistory).toBeUndefined()
    await screenshot(page, info, '09-valid-projected-comparison')
    await click(page, 'Review comparison and continue')
    await next(page)
    await answer(page, /^12.5 mL\/kg\/h/)
    await review(page)
    await answer(page, /^\+600 mL/)
    await review(page)
    const saved = await progress(page)
    expect(saved.selfPaced.visitedLessonIds).toEqual(
      expect.arrayContaining([
        'crrt-indications-modality',
        'crrt-circuit-pressures',
        'crrt-solute-transport',
        'crrt-prescription-dosing',
      ]),
    )
    expect(saved.selfPaced.visitedLessonIds).toHaveLength(4)
    expect(saved.completedLessonIds).toEqual([])
    expect(saved.bestSafeScores).toEqual({})
    await screenshot(page, info, '10-batch-a-completion')
    await noOverflow(page)
    expect(errors).toEqual([])
  })
}

test('Back/Forward, direct links, reload and repeat restart transient work and preserve ungraded visits', async ({
  page,
}, info) => {
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-indications-modality')
  await expect(page.getByText(/Each visit starts a fresh simulation/)).toBeVisible()
  await next(page)
  await next(page)
  await modalityWalk(page)
  await answer(page, /Fluid removal alone/)
  expect((await progress(page)).learnTaskHistory).toBeUndefined()
  await toLesson(page, 'crrt-prescription-dosing')
  await next(page)
  await click(page, /Continue to Construction/)
  await enterDowntime(page, '6')
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Two treatment goals, one blood circuit' }),
  ).toBeVisible()
  expect((await progress(page)).learnTaskHistory).toBeUndefined()
  await page.goForward()
  await expect(
    page.getByRole('heading', { name: 'One example, one denominator, one interval' }),
  ).toBeVisible()
  await next(page)
  await click(page, /Continue to Construction/)
  await expect(page.getByRole('spinbutton', { name: /^Time not running/ })).toHaveValue('3')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'One example, one denominator, one interval' }),
  ).toBeVisible()
  await click(page, 'Restart lesson')
  expect((await progress(page)).learnTaskHistory).toBeUndefined()
  await screenshot(page, info, 'history-restored-boundary')
})

test('compact reduced-motion keyboard-only introductory journey and reflow', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-indications-modality')
  async function keyboardActivate(name: string | RegExp, role: 'button' | 'radio' = 'button') {
    const target = page.getByRole(role, { name, exact: typeof name === 'string' })
    await expect(target).toBeVisible()
    for (let n = 0; n < 90; n++) {
      if (await target.evaluate((el) => document.activeElement === el)) {
        await page.keyboard.press(role === 'radio' ? 'Space' : 'Enter')
        return
      }
      if (
        role === 'radio' &&
        (await target.evaluate(
          (el) =>
            document.activeElement instanceof HTMLInputElement &&
            document.activeElement.type === 'radio' &&
            document.activeElement.name === (el as HTMLInputElement).name,
        ))
      )
        await page.keyboard.press('ArrowRight')
      else await page.keyboard.press('Tab')
    }
    throw new Error(`Keyboard could not reach ${name}`)
  }
  await screenshot(page, info, 'phone-orientation')
  await keyboardActivate('Continue')
  await keyboardActivate('Continue')
  for (const name of ['SCUF', 'CVVH', 'CVVHD', 'CVVHDF']) await keyboardActivate(name)
  await screenshot(page, info, 'phone-modality-selection')
  await keyboardActivate('Review observations and continue')
  await keyboardActivate(/Solute\/acid-base support and fluid management/, 'radio')
  await keyboardActivate('Check reasoning')
  await screenshot(page, info, 'phone-feedback')
  await keyboardActivate('Review feedback and continue')
  await keyboardActivate(/Solute support and zero net CRRT removal/, 'radio')
  await keyboardActivate('Check reasoning')
  await keyboardActivate('Review feedback and continue')
  expect((await progress(page)).selfPaced.visitedLessonIds).toEqual(['crrt-indications-modality'])
  expect((await progress(page)).completedLessonIds).toEqual([])
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 900, height: 800 },
    { width: 720, height: 450 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await noOverflow(page)
    await screenshot(page, info, `completion-${viewport.width}x${viewport.height}`)
  }
})
