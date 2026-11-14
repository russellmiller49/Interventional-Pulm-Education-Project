import { expect, test } from '@playwright/test'
import { goToActivity } from './ebus-guided-steps'

// Run against the built host and embedded app, with the original H.264 media.
// Request failures are deliberate; they must end loading without enabling acquisition.
for (const resource of ['Depth4.mp4', 'knobology_lookup.json']) {
  test(`a failed ${resource} ends the recording busy state`, async ({ page }) => {
    await page.route(`**/${resource}`, (route) => route.abort())
    // Gain is the second unit of the depth lesson (2026-11-10); the depth lab on the way fails to
    // load for the same reason and is left without an image.
    await page.goto('/en/ebus-guided/learn?section=image-depth')
    await goToActivity(page, 'gain-contrast:detail-comparison')

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
      page.getByRole('button', { name: 'Continue with this image', exact: true }),
    ).toBeDisabled()
    // Waiting for the image is not listed as a step of the learner's (owner feedback of
    // 2026-10-11); the list keeps the learner's own steps and the button stays off.
    await expect(page.locator('[data-requirement="frame-ready"]')).toHaveCount(0)
    await expect(page.locator('[data-acquisition-outstanding] li').first()).toBeVisible()
  })
}
