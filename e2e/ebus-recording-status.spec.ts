import { expect, test } from '@playwright/test'

// Run against the built host and embedded app, with the original H.264 media.
// Request failures are deliberate; they must end loading without enabling acquisition.
for (const resource of ['Depth4.mp4', 'knobology_lookup.json']) {
  test(`a failed ${resource} ends the recording busy state`, async ({ page }) => {
    await page.route(`**/${resource}`, (route) => route.abort())
    await page.goto('/en/ebus-guided/learn?section=gain-contrast')
    for (let step = 0; step < 2; step++) await page.locator('[data-now-primary]').click()

    const workbench = page.frameLocator('iframe')
    await expect(workbench.getByRole('alert')).toContainText('could not load')
    await expect(workbench.locator('.recorded-controls > [role="status"]')).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await expect(workbench.locator('fieldset')).toHaveAttribute('aria-busy', 'false')
    await expect(workbench.locator('.recorded-controls > [role="status"]')).toContainText(
      'Recording unavailable',
    )
    await expect(workbench.locator('[data-recorded-busy]')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Hold this acquisition', exact: true }),
    ).toBeDisabled()
    await expect(page.locator('[data-requirement="frame-ready"]')).toBeVisible()
  })
}
