import { expect, test } from '@playwright/test'

// R05: the visible chosen case must already be reloadable, including when a
// production RSC navigation is slow. This deliberately observes the UI boundary,
// before adding a URL wait that could conceal an optimistic identity mismatch.
for (const navigationDelayMs of [0, 250]) {
  test(`F06-R05 visible case survives immediate reload (${navigationDelayMs} ms navigation)`, async ({
    page,
  }) => {
    if (navigationDelayMs) {
      await page.route('**/*', async (route) => {
        const request = route.request()
        if (request.headers()['rsc'] === '1' && request.url().includes('/baxter-crrt/practice')) {
          await new Promise((resolve) => setTimeout(resolve, navigationDelayMs))
        }
        await route.continue()
      })
    }
    await page.goto('/en/baxter-crrt/practice?case=CRRT-01')
    const picker = page.getByRole('combobox', { name: 'Cases', exact: true })
    for (const caseId of ['CRRT-18', 'CRRT-14', 'CRRT-02']) {
      const optionTitle = await picker.locator(`option[value="${caseId}"]`).textContent()
      const title = optionTitle!.replace(/^(Case|Additional) \d+ · /, '').replace(/ · visited$/, '')
      await picker.selectOption(caseId)
      await expect(page.locator('#practice-case-heading')).toHaveText(title)
      await expect(picker).toHaveValue(caseId)
      await page.reload()
      await expect(picker).toHaveValue(caseId)
      await expect(page.locator('#practice-case-heading')).toHaveText(title)
      await expect(page).toHaveURL(new RegExp(`case=${caseId}$`))
    }
    await page.goBack()
    await expect(picker).toHaveValue('CRRT-14')
    await page.goForward()
    await expect(picker).toHaveValue('CRRT-02')
  })
}

// Shipped cases hold makeup at zero. Verify their supported balance remains
// readable in the real production workbench; the nonzero fixture is exercised
// through real reducers/components in fellow06RepairB.test.tsx.
for (const [width, height] of [
  [1280, 900],
  [1440, 900],
  [1024, 768],
  [390, 844],
  [320, 740],
]) {
  for (const theme of ['light', 'dark']) {
    test(`F06-R04 zero-makeup balance surfaces ${width} ${theme}`, async ({ page }, info) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize({ width, height })
      await page.addInitScript(
        (selectedTheme) => localStorage.setItem('theme', selectedTheme),
        theme,
      )
      await page.goto('/en/baxter-crrt/practice?case=CRRT-10')
      await expect
        .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
        .toBe(theme === 'dark')
      await page.getByRole('button', { name: '+1 hr', exact: true }).click()
      await page.getByRole('button', { name: '+1 hr', exact: true }).click()
      const rail = page.locator('[data-evidence-id="delivered"]')
      await expect(rail).toContainText(/mL\/kg\/h.*mL/)
      await expect(rail).not.toContainText('Withheld')
      await page.getByRole('tab', { name: 'Patient & trends', exact: true }).click()
      const patient = page.locator('[id$="baxter-crrt-mobile-panel-patient"]')
      await expect(patient.getByText('Whole-patient balance', { exact: true })).toBeVisible()
      await expect(patient).not.toContainText('Withheld')
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      await page.screenshot({ path: info.outputPath('patient-balance.png'), fullPage: true })
      await page.getByRole('tab', { name: 'Debrief', exact: true }).click()
      await page.getByRole('button', { name: 'End run and review debrief', exact: true }).click()
      const balance = page.getByText('Whole-patient fluid balance', { exact: true }).locator('..')
      await expect(balance).toContainText(/\d+ mL/)
      await expect(balance).not.toContainText('Withheld')
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      await page.screenshot({ path: info.outputPath('debrief-balance.png'), fullPage: true })
      expect(errors).toEqual([])
    })
  }
}
