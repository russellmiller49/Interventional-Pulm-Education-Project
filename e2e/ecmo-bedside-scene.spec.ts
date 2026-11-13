import { expect, test, type Page } from '@playwright/test'

/**
 * The bedside 3D scene fills its pane, and its labels are off the model.
 *
 * Measured on the rendered page, because jsdom draws nothing: the scene with its view tabs above
 * it and its status row under it fits between the pinned lesson chrome and the pinned Continue
 * row, and every label pill sits in the rail along the top or the bottom of the canvas with a
 * leader to its object. WebGL runs in software here (`--use-angle=swiftshader`).
 */

const RAIL_PX = 62

async function openBedsideScene(page: Page, lesson: string, track: 'vv' | 'va') {
  await page.goto(`/en/cardiohelp-ecmo/learn?track=${track}&lesson=${lesson}`)
  await expect(page.locator('[data-now-card]')).toBeVisible()
  const tab = page.getByRole('tab', { name: 'Bedside 3D circuit' })
  await expect(tab).toBeVisible()
  // A click before React attaches is lost on a dev server.
  await expect
    .poll(() =>
      tab.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps'))),
    )
    .toBe(true)
  await tab.click()
  // A slow device is offered the scene behind a button; take it.
  const gate = page.getByRole('button', { name: 'Continue on this device', exact: true })
  if (await gate.isVisible().catch(() => false)) await gate.click()
  await expect(page.locator('[data-scene-viewport] canvas')).toBeVisible({ timeout: 30_000 })
  // The labels are placed by the scene's own frame loop once the models have loaded, which takes
  // several seconds in software rendering. Wait until every label has been placed or left out.
  await expect
    .poll(
      () =>
        page.locator('[data-scene-label-id]').evaluateAll((pills) => ({
          total: pills.length,
          placed: pills.filter(
            (pill) => (pill as HTMLElement).dataset.placementVisible !== undefined,
          ).length,
        })),
      { timeout: 45_000 },
    )
    .toEqual({ total: track === 'va' ? 9 : 8, placed: track === 'va' ? 9 : 8 })
  await page.waitForTimeout(500)
}

async function sceneGeometry(page: Page) {
  return page.evaluate(() => {
    const rect = (node: Element) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    }
    const shell = document.querySelector<HTMLElement>('[data-ecmo-shell]')!
    const viewport = document.querySelector<HTMLElement>('[data-scene-viewport]')!
    const surface = viewport.closest<HTMLElement>('[data-surface="circuit"]')!
    const tabs = surface.querySelector<HTMLElement>('[role="tablist"]')!
    const status = surface.querySelector<HTMLElement>('[data-scene-status]')!
    const bar = shell.firstElementChild as HTMLElement
    const strip = shell.querySelector<HTMLElement>('[data-ecmo-context-strip]')!
    const footer = shell.querySelector<HTMLElement>('[data-now-footer]')
    const pinned = (node: HTMLElement | null) =>
      Boolean(node) && getComputedStyle(node as HTMLElement).position === 'sticky'
    // Bring the tab row to the top of the reading area, the way a learner scrolls to the scene.
    tabs.scrollIntoView({ block: 'start', behavior: 'instant' })
    const shellRect = rect(shell)
    let clearTop = Math.max(0, shellRect.top)
    for (const node of [bar, strip]) {
      const box = rect(node)
      if (pinned(node) && box.top <= clearTop + 1 && box.bottom > clearTop) clearTop = box.bottom
    }
    let clearBottom = Math.min(innerHeight, shellRect.bottom)
    if (footer && pinned(footer)) clearBottom = Math.min(clearBottom, rect(footer).top)
    const pills = [...document.querySelectorAll<HTMLElement>('[data-scene-label-id]')]
      .filter((pill) => pill.dataset.placementVisible === 'true')
      .map((pill) => ({
        id: pill.dataset.sceneLabelId!,
        rail: pill.dataset.rail ?? null,
        row: Number(pill.dataset.railRow ?? 1),
        ...rect(pill),
      }))
    const anchors = [...document.querySelectorAll<HTMLElement>('[data-scene-label-anchor]')]
      .filter((dot) => dot.style.visibility !== 'hidden')
      .map((dot) => ({ id: dot.dataset.sceneLabelAnchor!, ...rect(dot) }))
    return {
      clearTop,
      clearBottom,
      tabs: rect(tabs),
      viewport: rect(viewport),
      status: rect(status),
      pills,
      anchors,
      labelCount: document.querySelectorAll('[data-scene-label-id]').length,
      pageWidth: document.documentElement.scrollWidth,
      width: innerWidth,
    }
  })
}

for (const viewport of [
  { width: 1600, height: 852 },
  { width: 1440, height: 800 },
  { width: 1280, height: 720 },
]) {
  for (const [lesson, track] of [
    ['circuit-flow-path', 'vv'],
    ['circuit-flow-path', 'va'],
  ] as const) {
    test(`bedside scene and its labels: ${track.toUpperCase()} at ${viewport.width}×${viewport.height}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport)
      await openBedsideScene(page, lesson, track)
      const g = await sceneGeometry(page)
      await page.waitForTimeout(300)
      await page.screenshot({ path: info.outputPath('bedside-scene.png') })
      await info.attach('geometry', {
        body: JSON.stringify(g, null, 2),
        contentType: 'application/json',
      })

      // Tabs, scene and status row are on screen together, clear of everything pinned.
      expect(g.tabs.top).toBeGreaterThanOrEqual(g.clearTop - 1)
      expect(g.viewport.bottom).toBeLessThanOrEqual(g.clearBottom + 1)
      expect(g.status.bottom).toBeLessThanOrEqual(g.clearBottom + 1)
      expect(g.viewport.bottom - g.viewport.top).toBeGreaterThanOrEqual(320)
      expect(g.pageWidth).toBeLessThanOrEqual(g.width)

      // Every label is shown, each in a rail and off the model, and the rails do not collide.
      // On the narrowest pane a full rail starts a second row inside the first for a name or two.
      expect(g.pills.length).toBe(g.labelCount)
      expect(g.pills.filter((pill) => pill.row === 2).length).toBeLessThanOrEqual(2)
      for (const [index, pill] of g.pills.entries()) {
        expect(pill.rail === 'top' || pill.rail === 'bottom').toBe(true)
        const band = RAIL_PX * pill.row
        if (pill.rail === 'top') expect(pill.bottom).toBeLessThanOrEqual(g.viewport.top + band + 1)
        else expect(pill.top).toBeGreaterThanOrEqual(g.viewport.bottom - band - 1)
        expect(pill.left).toBeGreaterThanOrEqual(g.viewport.left)
        expect(pill.right).toBeLessThanOrEqual(g.viewport.right)
        for (const other of g.pills.slice(index + 1)) {
          const apart =
            pill.right <= other.left ||
            other.right <= pill.left ||
            pill.bottom <= other.top ||
            other.bottom <= pill.top
          expect(apart).toBe(true)
        }
      }
      // Each leader ends on an object inside the scene, between the rails.
      for (const anchor of g.anchors) {
        const centre = (anchor.top + anchor.bottom) / 2
        expect(centre).toBeGreaterThan(g.viewport.top + RAIL_PX - 8)
        expect(centre).toBeLessThan(g.viewport.bottom - RAIL_PX + 8)
      }
    })
  }
}
