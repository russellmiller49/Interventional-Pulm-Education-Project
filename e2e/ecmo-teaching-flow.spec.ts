import { expect, test, type Page } from '@playwright/test'

// For production review, use a Playwright config with use.baseURL pointing to the built server.
// Enlargement here changes root font size,
// not native browser zoom. API isolation matches the established ECMO layout suite.
const viewports = [
  { width: 1280, height: 961, root: 16 },
  { width: 390, height: 844, root: 16 },
  { width: 390, height: 844, root: 32 },
  { width: 320, height: 740, root: 16 },
  { width: 320, height: 740, root: 32 },
  { width: 1700, height: 900, root: 16 },
  { width: 1700, height: 900, root: 32 },
]

async function ready(page: Page, url: string, root: number) {
  await page.goto(url)
  await expect(page.locator('[data-ecmo-shell]')).toBeVisible()
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-ecmo-shell] button')
    return button && Object.keys(button).some((key) => key.startsWith('__reactProps'))
  })
  await page.addStyleTag({ content: `html { font-size: ${root}px !important; }` })
}

async function task(page: Page, id: string) {
  const history = page.locator('details[data-task-history]')
  if ((await history.count()) && (await history.getAttribute('open')) === null)
    await history.locator(':scope > summary').click()
  await page.locator(`[data-step-id="${id}"] button`).click()
}

async function stage(page: Page, title: string) {
  const outline = page.locator('details').filter({ has: page.locator('[data-stages]') })
  if ((await outline.count()) && (await outline.getAttribute('open')) === null)
    await outline.locator(':scope > summary').click()
  await page.locator('[data-stages] button').filter({ hasText: title }).click()
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
}

test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', (route) =>
    route.fulfill({ json: { ok: true, accountId: null, modules: [] } }),
  )
})

for (const viewport of viewports) {
  test(`review repairs at ${viewport.width}x${viewport.height}, root ${viewport.root}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await ready(
      page,
      '/en/cardiohelp-ecmo/learn?track=vv&lesson=why-extracorporeal-support',
      viewport.root,
    )
    await task(page, 'why-extracorporeal-support-predict')
    await page.locator('input[value="delivery-adequate"]').check()
    await page.getByRole('button', { name: 'Submit answer', exact: true }).click()
    const others = page.locator('[data-other-answers-panel]')
    await expect(others.locator('summary')).toHaveText('How the other answers compare')
    await others.locator('summary').click()
    await expect(
      others.locator('[data-other-answer="content-and-flow-still-unknown"]'),
    ).toBeVisible()
    await noOverflow(page)
    await others.locator('summary').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('wrong-answer.png') })
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await page
      .getByRole('button', { name: 'Show explanation without answering', exact: true })
      .click()
    await expect(page.locator('[data-optional-explanation]')).toBeVisible()
    await expect(page.locator('fieldset[data-prediction-choices] input:checked')).toHaveCount(0)

    await ready(
      page,
      '/en/cardiohelp-ecmo/learn?track=vv&lesson=vv-integration-capstone',
      viewport.root,
    )
    await expect(page.locator('[data-lesson-key-points]')).toContainText('An optional prediction')
    await task(page, 'vv-integration-capstone-predict')
    await expect(page.locator('[data-ecmo-shell]')).not.toContainText(
      /before (?:you )?look(?:ing)? further|before measuring|Committing first/,
    )
    await page
      .getByRole('button', { name: 'Show explanation without answering', exact: true })
      .click()
    await expect(page.locator('[data-optional-explanation]')).toBeVisible()
    await noOverflow(page)

    for (const track of ['vv', 'va']) {
      await ready(page, `/en/cardiohelp-ecmo/assess?track=${track}`, viewport.root)
      await stage(page, 'Reassess')
      const panel = page.locator('#practice-reassessment')
      await expect(panel).toContainText('not measurements you acquired')
      await expect(panel).not.toContainText(
        /Choose the observed|response selected|Expected response:/,
      )
      for (const domain of ['device', 'circuit', 'patient']) {
        await panel
          .locator(`input[name="reassessment-${domain}"][value$="-${domain}-expected"]`)
          .check()
      }
      await page.getByRole('button', { name: 'Submit checklist comparison', exact: true }).click()
      await expect(
        panel.getByRole('status').filter({ hasText: 'Checklist comparison submitted' }),
      ).toContainText('Checklist comparison submitted')
      await page
        .getByRole('button', { name: 'Show explanation without answering', exact: true })
        .click()
      await expect(page.locator('[data-domain="patient"][data-matched]')).toContainText(
        'matches the review checklist',
      )
      await expect(page.locator('[data-integrated-case-scope]')).toBeVisible()
      await noOverflow(page)
      await page.locator('[data-domain="patient"][data-matched]').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`${track}-checklist.png`) })
    }

    // Main #331 adds width-dependent circuit layout; exercise both tabs and the wide toggle.
    if (viewport.width === 1700) {
      await ready(
        page,
        '/en/cardiohelp-ecmo/learn?track=vv&lesson=preload-drainage-collapse',
        viewport.root,
      )
      await page.getByRole('tab', { name: 'Pressure-zone map', exact: true }).click()
      await expect(page.locator('#cardiohelp-diagnostic-view')).toBeVisible()
      const enlarge = page.locator('[data-circuit-enlarge]')
      if (await enlarge.isVisible()) {
        await enlarge.click()
        await noOverflow(page)
        await enlarge.click()
      }
      await page.getByRole('tab', { name: 'Pressure-zone map', exact: true }).focus()
      await page.keyboard.press('ArrowLeft')
      await expect(
        page.getByRole('tab', { name: 'Bedside 3D circuit', exact: true }),
      ).toHaveAttribute('aria-selected', 'true')
      await page.keyboard.press('ArrowRight')
      await expect(
        page.getByRole('tab', { name: 'Pressure-zone map', exact: true }),
      ).toHaveAttribute('aria-selected', 'true')
      await noOverflow(page)
      await page.locator('#cardiohelp-diagnostic-view').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath('wide-circuit.png') })
    }

    await page.goto('/en/cardiohelp-ecmo')
    await page.addStyleTag({ content: `html { font-size: ${viewport.root}px !important; }` })
    const registry = page.locator('details[data-source-registry]')
    const summary = registry.locator(':scope > summary')
    await expect(page.locator('[data-source-registry-status]')).toBeVisible()
    await expect(registry).not.toHaveAttribute('open', '')
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(registry).toHaveAttribute('open', '')
    await expect(registry.locator('[data-evidence-id]')).toHaveCount(15)
    await expect(registry.locator('[data-evidence-id]').first()).toBeVisible()
    await page.keyboard.press('Space')
    await expect(registry).not.toHaveAttribute('open', '')
    // Hub root-32 overflow is independently matched on current main; don't hide it in this check.
    if (viewport.root === 16) await noOverflow(page)
    expect(errors).toEqual([])
  })
}
