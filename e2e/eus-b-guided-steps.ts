import { expect, type Page } from '@playwright/test'

/**
 * Continue through an EUS-B Guided lesson until the named task is on screen.
 *
 * A scope task on the way is left without an image; every other task is continued past. The id is
 * `<lesson id>:<task id>`, as the lesson host publishes it in `data-activity-id`.
 */
export async function goToActivity(page: Page, activityId: string) {
  const flow = page.locator('[data-eusb-flow]')
  for (let guard = 0; guard < 20; guard++) {
    if ((await flow.getAttribute('data-activity-id')) === activityId) break
    const skip = page.locator('[data-skip-lab]')
    await ((await skip.count()) ? skip : page.locator('[data-now-primary]')).click()
  }
  await expect(flow).toHaveAttribute('data-activity-id', activityId)
}

/** The lab frame of the lesson on screen. */
export function lab(page: Page) {
  return page.frameLocator('iframe[title="EUS-B lab"]')
}
