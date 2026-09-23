import { test, expect, type Page, type Locator } from '@playwright/test'

const practice = '/en/baxter-crrt/practice?case='
const lesson = '/en/baxter-crrt/learn?lesson='

test('sanity 03: a fractional TMP is an approximation beside the unchanged engine reading', async ({
  page,
}) => {
  await page.goto(practice + 'CRRT-15')
  await page.getByRole('tab', { name: 'Machine + circuit', exact: true }).click()
  const tmp = page.getByRole('button').filter({ hasText: 'Calculated relationshipTMP' })
  await expect(tmp).toContainText('53 mmHg')
  await tmp.click()
  const arithmetic = page.locator('[data-crrt-pressure-arithmetic="tmp"]')
  // The visible inputs give 52.5, while the existing engine tile rounds to 53.
  await expect(arithmetic.locator('[data-crrt-arithmetic-worked]')).toHaveText(
    '(70 + 31) ÷ 2 − (−20) + (−18) ≈ 53 mmHg',
  )
  await expect(arithmetic).toContainText('The TMP reading shows 53 mmHg')
})

async function fingerprint(page: Page) {
  return page.evaluate(() => ({
    url: location.href,
    storage: { ...localStorage },
    evidence: document.querySelector('[data-crrt-evidence-summary]')?.textContent,
    run: document.querySelector('#crrt-activity-viewport')?.textContent,
    inputs: [
      ...document.querySelectorAll<HTMLInputElement>('main input, main textarea, main select'),
    ].map((el) => ({ value: el.value, checked: el.checked })),
  }))
}

async function visibleFocus(target: Locator) {
  const result = await target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return {
      focused: document.activeElement === el,
      visible: el.matches(':focus-visible'),
      outline: parseFloat(getComputedStyle(el).outlineWidth),
      inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      uncovered: !!hit && (hit === el || el.contains(hit)),
    }
  })
  expect(result).toMatchObject({ focused: true, visible: true, inside: true, uncovered: true })
  expect(result.outline).toBeGreaterThan(0)
}

test('sanity 03: overflowing rail takes and relinquishes a tab stop, scrolls and releases focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(practice + 'CRRT-13')
  const rail = page.locator('[data-crrt-workbench-rail]')
  await expect(rail).toHaveAttribute('tabindex', '0')
  await rail.getByText(/^Objective and/).click()
  await rail.getByText('Device profile and safety constraints').click()
  await rail.focus()
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => rail.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  // Wheel reaches the last safety item; the rail remains a normal keyboard region.
  await rail.hover()
  const beforeWheel = await rail.evaluate((el) => el.scrollTop)
  await page.mouse.wheel(0, 3000)
  await expect.poll(() => rail.evaluate((el) => el.scrollTop)).toBeGreaterThan(beforeWheel)
  await rail.focus()
  await page.keyboard.press('End')
  await expect
    .poll(() => rail.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
    .toBeLessThan(2)
  const last = rail.getByRole('list', { name: 'Safety constraints' }).getByRole('listitem').last()
  await expect(last).toBeInViewport()
  await rail.focus()
  await page.keyboard.press('Shift+Tab')
  expect(await rail.evaluate((el) => el.contains(document.activeElement))).toBe(false)
  await rail.focus()
  // Tab through the finite set of child controls, without trapping focus in the rail.
  for (let n = 0; n < 12 && (await rail.evaluate((el) => el.contains(document.activeElement))); n++)
    await page.keyboard.press('Tab')
  expect(await rail.evaluate((el) => el.contains(document.activeElement))).toBe(false)
  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(rail).not.toHaveAttribute('tabindex')
  expect(await rail.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(rail).toHaveAttribute('tabindex', '0')
})

for (const mode of ['practice', 'assess']) {
  test(`sanity 03: ${mode} Help Space/Enter, dismissal and rerenders preserve the run`, async ({
    page,
  }) => {
    await page.goto(mode === 'practice' ? practice + 'CRRT-11' : '/en/baxter-crrt/assess')
    await page.getByRole('button', { name: 'Perform', exact: true }).first().click()
    await page.getByRole('button', { name: '+1 hr', exact: true }).click()
    const reassess = page.getByRole('group', {
      name: 'Select every reassessment you actually completed',
    })
    await reassess.getByRole('checkbox').first().check()
    await page.getByRole('button', { name: 'Commit reassessment', exact: true }).click()
    for (const activation of ['Space', 'Enter', 'mouse'] as const) {
      const before = await fingerprint(page)
      const help = page.getByRole('button', { name: 'Help', exact: true })
      await help.focus()
      if (activation === 'mouse') await help.click()
      else await page.keyboard.press(activation)
      const dialog = page.getByRole('dialog', { name: 'Help for this case' })
      await expect(dialog).toBeVisible()
      await expect(dialog).toHaveAttribute('aria-describedby', /.+/)
      await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      if (activation === 'Space')
        await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      else if (activation === 'Enter') await page.keyboard.press('Escape')
      else await page.mouse.click(2, 2)
      await expect(dialog).toBeHidden()
      await expect(help).toBeFocused()
      expect(await fingerprint(page)).toEqual(before)
      await page
        .getByRole('group', { name: 'Reading perspective' })
        .getByRole('button', { name: 'Operator' })
        .click()
      await expect(
        page
          .getByRole('group', { name: 'Reading perspective' })
          .getByRole('button', { name: 'Operator' }),
      ).toHaveAttribute('aria-pressed', 'true')
    }
    if (mode === 'practice') {
      await page.getByRole('combobox', { name: 'Cases', exact: true }).selectOption('CRRT-02')
      await expect(page).toHaveURL(/case=CRRT-02/)
      await page.getByRole('button', { name: 'Help', exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused()
    }
  })
}

test('sanity 03: every Cases option is reachable and all four group boundaries stay truthful', async ({
  page,
}) => {
  await page.goto(practice + 'CRRT-01')
  const picker = page.getByRole('combobox', { name: 'Cases', exact: true })
  const options = await picker
    .locator('option')
    .evaluateAll((es) =>
      es.map((el) => ({ id: (el as HTMLOptionElement).value, label: el.textContent! })),
    )
  expect(options).toHaveLength(17)
  expect(new Set(options.map((o) => o.id)).size).toBe(17)
  for (const option of options) {
    await picker.selectOption(option.id)
    await expect(page).toHaveURL(new RegExp(`case=${option.id}$`))
    await expect(picker).toHaveValue(option.id)
    await expect(page.locator('#practice-case-heading')).toHaveText(
      option.label.replace(/^(Case|Additional) \d+ · /, '').replace(/ · visited$/, ''),
    )
  }
  const core = options.filter((o) => o.label.startsWith('Case '))
  const additional = options.filter((o) => o.label.startsWith('Additional '))
  expect(core).toHaveLength(10)
  expect(additional).toHaveLength(7)
  for (const [item, boundary] of [
    [core[0], 'First core case'],
    [core.at(-1)!, 'Last core case · more in Cases'],
    [additional[0], 'First additional case'],
    [additional.at(-1)!, 'Last additional case'],
  ] as const) {
    await picker.selectOption(item.id)
    await expect(page.getByText(boundary, { exact: true })).toBeVisible()
  }
  await page.reload()
  await expect(picker).toHaveValue(additional.at(-1)!.id)
  await expect(picker.locator('option:checked')).toContainText('visited')
  await page.goto(practice + 'INVALID')
  await expect(
    page.getByRole('status', { name: 'Requested practice case unavailable' }),
  ).toBeVisible()
  await expect(picker).toHaveValue('CRRT-01')
})

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`sanity 03: keyboard jump reaches visible controls immediately (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto(lesson + 'crrt-circuit-pressures')
    await page.getByRole('button', { name: "Go to this task's continue controls" }).focus()
    await page.keyboard.press('Enter')
    const target = page.getByRole('group', { name: 'Continue from this task' })
    // No retry or animation wait: focus must be visible at the moment it moves.
    await visibleFocus(target)
    await page.keyboard.press('Tab')
    await expect(
      target.getByRole('button', { name: 'Continue without this exercise' }),
    ).toBeFocused()
  })
}

for (const viewport of [
  { width: 320, height: 740 },
  { width: 1280, height: 900, text200: true },
]) {
  test(`sanity 03: Reference and Evidence are distinct, scrollable, inert sheets (${viewport.width})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(practice + 'CRRT-17')
    if ('text200' in viewport)
      await page.addStyleTag({ content: 'html {font-size:200% !important}' })
    const details = page.getByRole('button', { name: 'Show task details', exact: true })
    if (await details.isVisible()) await details.click()
    for (const [buttonName, title] of [
      ['Reference', 'Reference'],
      ['Evidence', 'Evidence and model limits'],
    ]) {
      const button = page.getByRole('button', { name: buttonName, exact: true })
      const before = await fingerprint(page)
      await button.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', { name: title, exact: true })
      await expect(dialog).toBeVisible()
      if (buttonName === 'Evidence') await expect(dialog).toContainText('Limit:')
      await expect
        .poll(() =>
          dialog
            .locator('article')
            .evaluateAll((es) => es.every((el) => el.scrollWidth <= el.clientWidth + 1)),
        )
        .toBe(true)
      const article = dialog.getByRole('article').last()
      await article.evaluate((el) => el.scrollIntoView({ block: 'end', behavior: 'instant' }))
      await expect
        .poll(() =>
          article.evaluate((el) => {
            const r = el.getBoundingClientRect()
            return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1
          }),
        )
        .toBe(true)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(button).toBeFocused()
      expect(await fingerprint(page)).toEqual(before)
    }
  })
}

for (const width of [390, 320]) {
  test(`sanity 03: circuit pan and expanded sizes preserve task state (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(lesson + 'crrt-circuit-pressures')
    const scroller = page.getByRole('group', {
      name: 'CRRT circuit schematic; horizontally scrollable on narrow screens',
    })
    await scroller.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    expect(
      await scroller.evaluate((el) => el.scrollLeft + el.clientWidth >= el.scrollWidth - 1),
    ).toBe(true)
    const y = await page.evaluate(() => scrollY)
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y)
    await page.keyboard.press('Tab')
    expect(await scroller.evaluate((el) => el === document.activeElement)).toBe(false)
    const expand = page.getByRole('button', { name: 'Expand circuit' })
    const before = await page.locator('[data-crrt-task-actions]').innerText()
    await expand.click()
    const dialog = page.getByRole('dialog', { name: 'Canonical CRRT circuit · expanded' })
    for (const size of ['100%', '150%', '200%']) {
      await dialog.getByRole('button', { name: size, exact: true }).click()
      const drawing = dialog.getByRole('group', {
        name: 'Expanded circuit drawing; scrolls in both directions',
      })
      await drawing.focus()
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => drawing.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    }
    await page.keyboard.press('Escape')
    await expect(expand).toBeFocused()
    expect(await page.locator('[data-crrt-task-actions]').innerText()).toBe(before)
    await page.keyboard.press('Enter')
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(expand).toBeFocused()
  })
}

test('sanity 03: all eight Learn destinations, end controls and restart retain canonical identity', async ({
  page,
}) => {
  await page.goto(lesson + 'crrt-indications-modality')
  const picker = page.getByRole('combobox', { name: 'CRRT lesson' })
  const lessons = await picker
    .locator('option')
    .evaluateAll((es) =>
      es.map((el) => ({ id: (el as HTMLOptionElement).value, label: el.textContent! })),
    )
  expect(lessons).toHaveLength(8)
  for (const [index, item] of lessons.entries()) {
    await picker.selectOption(item.id)
    await expect(page).toHaveURL(new RegExp(`lesson=${item.id}$`))
    await expect(page.getByText(`Lesson ${index + 1} of 8`, { exact: true })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Previous and next lesson' })
    if (index > 0)
      await expect(
        nav.getByRole('button', { name: `Previous lesson: ${lessons[index - 1].label}` }),
      ).toBeVisible()
    if (index < 7)
      await expect(
        nav.getByRole('button', { name: `Next lesson: ${lessons[index + 1].label}` }),
      ).toBeVisible()
    const outline = page
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: /^Lesson tasks/ }) })
    await outline.locator('summary').click()
    await outline.getByRole('button').last().click()
    await expect(outline.getByRole('button').last()).not.toContainText('reviewed')
    const skip = page.getByRole('button', { name: 'Continue without this exercise', exact: true })
    if (await skip.count()) await skip.click()
    else await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(
      page.getByRole('button', {
        name: index < 7 ? new RegExp(`^Continue to lesson ${index + 2}:`) : 'Continue to practice',
        exact: index === 7,
      }),
    ).toBeVisible()
    // The header control; the end card offers the same operation under the same words (F-25).
    await page.getByRole('button', { name: 'Restart lesson', exact: true }).first().click()
    await expect(page.getByText(/^Lesson tasks · 1 of/)).toBeVisible()
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('baxter-crrt-progress-v3')!).completedLessonIds,
      ),
    ).toEqual([])
  }
})

test('sanity 03: long task outline visits do not complete tasks; Save and exit preserves the next-topic recommendation', async ({
  page,
}) => {
  await page.goto(lesson + 'crrt-alarms-troubleshooting')
  const outline = page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: /^Lesson tasks/ }) })
  await outline.locator('summary').click()
  await expect(outline.getByRole('button')).toHaveCount(10)
  const labels = await outline.getByRole('button').allTextContents()
  expect(new Set(labels).size).toBe(10)
  for (let i = 0; i < 10; i++) {
    await outline.getByRole('button').nth(i).click()
    await outline.getByRole('button').nth(i).click()
    await expect(outline).not.toContainText('· reviewed')
  }
  await page.getByRole('button', { name: 'Save & exit', exact: true }).click()
  await expect(page).toHaveURL(/\/en\/baxter-crrt$/)
  const resume = page.getByRole('link', { name: /Continue to the next topic/ })
  await expect(resume).toContainText('Lesson 1:')
  await resume.click()
  await expect(page.getByText('Lesson 1 of 8')).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('baxter-crrt-progress-v3')!).completedLessonIds,
    ),
  ).toEqual([])
})
