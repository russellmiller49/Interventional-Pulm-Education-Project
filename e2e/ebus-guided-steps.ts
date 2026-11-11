import { expect, type Page } from '@playwright/test'

/**
 * Continue through an EBUS Guided lesson until the named step is on screen.
 *
 * Five lessons hold a second content unit since 2026-11-10 (gain inside depth, and the contact,
 * phantom, route and needle models inside their parent lessons), so a unit's lab is no longer a
 * fixed number of clicks from the lesson's first screen. A lab on the way is left without an
 * image; every other step is continued past. The step id is `<unit id>:<step id>`, as the lesson
 * host publishes it in `data-activity-id`.
 */
export async function goToActivity(page: Page, activityId: string) {
  const flow = page.locator('[data-ebus-flow]')
  for (let guard = 0; guard < 20; guard++) {
    if ((await flow.getAttribute('data-activity-id')) === activityId) break
    const skip = page.locator('[data-skip-acquisition]')
    await ((await skip.count()) ? skip : page.locator('[data-now-primary]')).click()
  }
  await expect(flow).toHaveAttribute('data-activity-id', activityId)
}
