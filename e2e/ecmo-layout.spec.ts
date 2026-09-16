import { test, expect, type Page } from '@playwright/test'
import { build } from 'esbuild'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

interface InventoryStep {
  id: string
  title: string
  phase: string
  layout: 'FLOWING' | 'FIXED'
  presentation?: { kind: string }
}
interface InventoryEntry {
  id: string
  title: string
  track: 'vv' | 'va'
  steps: InventoryStep[]
}

// Load the live registry in an isolated TS process. Importing the entire clinical registry into
// Playwright's type graph changes Three.js augmentation order in the repository-wide type-check.
const registryCode = execFileSync(
  path.resolve('node_modules/.bin/esbuild'),
  [
    'scripts/critical-care/ecmo-layout-inventory.mts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--log-level=error',
  ],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
)
const inventory: InventoryEntry[] = JSON.parse(
  execFileSync(process.execPath, ['-'], {
    input: registryCode,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  }),
)
const entries = inventory.map((entry) => ({ ...entry, lesson: { steps: entry.steps } }))
const shellSelector = '[data-ecmo-shell="learn"]'

async function openLesson(page: Page, id: string, track = 'vv') {
  const entry = entries.find((entry) => entry.id === id && entry.track === track)!
  await page.goto(`/en/cardiohelp-ecmo/learn?track=${track}&lesson=${id}`)
  await expect(page.locator(shellSelector)).toHaveAttribute('data-stage', entry.lesson.steps[0].id)
  await expect(page.locator('[data-now-card]')).toBeVisible()
  // Entry focus and circuit sizing settle after React's effects.
  await page.waitForTimeout(150)
}

async function scrollGeometry(page: Page) {
  return page.evaluate(() => {
    const selectors: Record<string, string> = {
      document: 'html',
      body: 'body',
      main: '#main-content',
      module: 'main[data-activity-mode]',
      frame: '[data-activity-frame]',
      frameBody: '[data-activity-frame] > div',
      shell: '[data-ecmo-shell]',
      header: '[data-ecmo-shell] > div:first-child',
      strip: '[data-ecmo-context-strip]',
      shellBody: '[data-ecmo-shell] > div:nth-child(3)',
      workspace: '[data-ecmo-stage-frame]',
      steps: '[aria-label="Steps panel"]',
      teaching: '[aria-label="Teaching panel"]',
      simulator: '[aria-label="Simulator panel"]',
    }
    return {
      width: innerWidth,
      height: innerHeight,
      siteHeader: document.querySelector('body header')!.getBoundingClientRect().toJSON(),
      rootToken: getComputedStyle(document.documentElement).getPropertyValue(
        '--site-header-height',
      ),
      ecmoToken: getComputedStyle(
        document.querySelector('main[data-activity-mode]')!,
      ).getPropertyValue('--site-header-height'),
      nodes: Object.fromEntries(
        Object.entries(selectors).map(([name, selector]) => {
          const node = document.querySelector<HTMLElement>(selector)
          return [
            name,
            node
              ? {
                  rect: node.getBoundingClientRect().toJSON(),
                  clientHeight: node.clientHeight,
                  scrollHeight: node.scrollHeight,
                  scrollTop: node.scrollTop,
                  overflow: getComputedStyle(node).overflow,
                  overflowY: getComputedStyle(node).overflowY,
                }
              : null,
          ]
        }),
      ),
    }
  })
}

async function headerVisible(page: Page) {
  const geometry = await page.evaluate(() => {
    const site = document.querySelector('body header')!.getBoundingClientRect()
    const shell = document.querySelector('[data-ecmo-shell]')!
    const header = shell.firstElementChild!.getBoundingClientRect()
    return {
      siteBottom: site.bottom,
      headerTop: header.top,
      headerBottom: header.bottom,
      height: innerHeight,
      pageWidth: document.documentElement.scrollWidth,
      width: innerWidth,
    }
  })
  expect(geometry.headerTop).toBeGreaterThanOrEqual(geometry.siteBottom - 1)
  expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.height)
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.width)
}

async function readingScroll(page: Page, desktop: boolean) {
  const owner = desktop ? page.locator(shellSelector) : page.locator('html')
  await owner.evaluate((node) => node.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(100)
  if (desktop) {
    expect(await owner.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto')
    expect(await owner.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    )
  }
  const extent = await owner.evaluate((node) => node.scrollHeight - node.clientHeight)
  if (extent <= 1) return
  const before = await owner.evaluate((node) => node.scrollTop)
  await page.mouse.move(page.viewportSize()!.width / 2, page.viewportSize()!.height - 120)
  await page.mouse.wheel(0, 450)
  await page.waitForTimeout(250)
  await expect.poll(() => owner.evaluate((node) => node.scrollTop)).toBeGreaterThan(before)
  await page
    .locator(shellSelector)
    .evaluate((node) => (node as HTMLElement).focus({ preventScroll: true }))
  const wheelTop = await owner.evaluate((node) => node.scrollTop)
  await page.keyboard.press('PageDown')
  await page.waitForTimeout(250)
  await expect.poll(() => owner.evaluate((node) => node.scrollTop)).toBeGreaterThanOrEqual(wheelTop)
  await owner.evaluate((node) => {
    node.scrollTo({ top: node.scrollHeight, behavior: 'instant' })
  })
  await expect
    .poll(() => owner.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop))
    .toBeLessThan(2)
  const shellBottom = await page
    .locator(shellSelector)
    .evaluate((node) => node.getBoundingClientRect().bottom)
  if (desktop) {
    expect(shellBottom).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  }
  await owner.evaluate((node) => {
    node.scrollTo({ top: 0, behavior: 'instant' })
  })
  await page.waitForTimeout(250)
  await headerVisible(page)
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ json: { ok: true, accountId: null, modules: [] } })
    return route.continue()
  })
})

for (const [width, height] of [
  [1920, 1080],
  [1600, 900],
  [1440, 900],
  [1024, 768],
  [390, 844],
  [320, 844],
]) {
  test(`every Learn section has reachable reading and headers at ${width}x${height}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width, height })
    for (const entry of entries) {
      await test.step(`${entry.track}: ${entry.id}`, async () => {
        expect(
          entry.lesson.steps.every(
            (step) => step.layout === 'FLOWING' && Boolean(step.presentation),
          ),
        ).toBe(true)
        await openLesson(page, entry.id, entry.track)
        await expect(page.locator(shellSelector)).toHaveAttribute('data-flowing', 'true')
        await headerVisible(page)
        await testInfo.attach(`${entry.track}-${entry.id}-geometry`, {
          body: JSON.stringify(await scrollGeometry(page), null, 2),
          contentType: 'application/json',
        })
        await readingScroll(page, width >= 1024 && height >= 700)
      })
    }
  })
}

for (const width of [1600, 1440, 1024, 390, 320]) {
  test(`both foundation disclosures, keyboard slider, tasks and reload at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await openLesson(page, 'why-extracorporeal-support')
    const arithmetic = page
      .locator('summary')
      .filter({ hasText: 'Explore the delivery arithmetic' })
    const model = page.locator('summary').filter({ hasText: 'Current components and model detail' })
    await arithmetic.click()
    for (const slider of await page.locator('[data-now-card] input[type="range"]').all()) {
      await slider.focus()
      await page.waitForTimeout(250)
      const before = await slider.inputValue()
      await page.keyboard.press('ArrowRight')
      if ((await slider.inputValue()) === before) await page.keyboard.press('ArrowLeft')
      expect(await slider.inputValue()).not.toBe(before)
      const rect = await slider.boundingBox()
      expect(rect!.y).toBeGreaterThanOrEqual(0)
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(901)
    }
    await model.click()
    await readingScroll(page, width >= 1024)
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
    await continueButton.focus()
    await expect(continueButton).toBeInViewport()
    await model.click()
    await arithmetic.click()
    await continueButton.click()
    await expect(page.locator(shellSelector)).toHaveAttribute(
      'data-stage',
      'why-extracorporeal-support-worked-example',
    )
    await headerVisible(page)
    await page.getByText('Tasks in this section', { exact: true }).click()
    await page.locator('[data-step-id="why-extracorporeal-support-recognize"] button').click()
    await headerVisible(page)
    await page.reload()
    await expect(page.locator(shellSelector)).toHaveAttribute(
      'data-stage',
      'why-extracorporeal-support-recognize',
    )
    await headerVisible(page)
  })
}

test('200% CSS text enlargement preserves reading, focus, and header geometry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const id of [
    'why-extracorporeal-support',
    'circuit-flow-path',
    'vv-recirculation',
    'va-lv-loading',
    'startup-sensor-orientation',
  ]) {
    await openLesson(page, id, id.startsWith('va-') ? 'va' : 'vv')
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await page.waitForTimeout(150)
    await headerVisible(page)
    await readingScroll(page, true)
  }
})

let fixtureDirectory: string
let fixtureJs: string
let fixtureCss: string
test.beforeAll(async () => {
  fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'ecmo-layout-fixture-'))
  const outfile = path.join(fixtureDirectory, 'fixture.js')
  await build({
    entryPoints: ['e2e/fixtures/ecmo-layout.tsx'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile,
    loader: { '.module.css': 'local-css' },
  })
  fixtureJs = await readFile(outfile, 'utf8')
  fixtureCss = await readFile(outfile.replace(/js$/, 'css'), 'utf8')
})
test.afterAll(async () => {
  if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true })
})

for (const width of [1600, 1024, 390]) {
  test(`actual fixed StageLayout fallback scrolls independently at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openLesson(page, 'why-extracorporeal-support')
    const fixture = await page.evaluate(() => {
      const inline =
        '<style>' +
        [...document.styleSheets]
          .map((sheet) => {
            try {
              return [...sheet.cssRules].map((rule) => rule.cssText).join('\n')
            } catch {
              return ''
            }
          })
          .join('\n') +
        '</style>'
      const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map(
        (node) => (node as HTMLLinkElement).href,
      )
      const body = document.body.cloneNode(true) as HTMLElement
      body.querySelectorAll('script, nextjs-portal').forEach((node) => node.remove())
      body.querySelector('[data-ecmo-shell]')!.outerHTML =
        '<div id="ecmo-layout-fixture" style="height:100%;min-height:0"></div>'
      return { styles, inline, body: body.innerHTML }
    })
    await page.goto('about:blank')
    await page.setContent(
      `<!doctype html><html><head>${fixture.inline}${fixture.styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body>${fixture.body}</body></html>`,
    )
    await page.addStyleTag({ content: fixtureCss })
    await page.addScriptTag({ content: fixtureJs })
    await expect(page.locator(shellSelector)).toHaveAttribute('data-stage', 'fixed-fixture')
    await headerVisible(page)
    for (const label of ['Steps', 'Teaching', 'Simulator']) {
      const tab = page.getByRole('tab', { name: label, exact: true })
      if (await tab.isVisible()) await tab.click()
      const pane = page.getByRole('region', { name: `${label} panel`, exact: true })
      await expect(pane).toBeVisible()
      if (width >= 1024) {
        expect(await pane.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
        await pane.hover()
        await page.mouse.wheel(0, 400)
        await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
        await pane.focus()
        const before = await pane.evaluate((node) => node.scrollTop)
        await page.keyboard.press('PageDown')
        await page.waitForTimeout(250)
        await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBeGreaterThan(before)
        await pane.evaluate((node) => {
          node.scrollTo({ top: node.scrollHeight, behavior: 'instant' })
        })
        await expect(pane.getByRole('button', { name: `Return to ${label}` })).toBeInViewport()
        await pane.getByRole('button', { name: `Return to ${label}` }).click()
        expect(await pane.evaluate((node) => node.scrollTop)).toBe(0)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
        await headerVisible(page)
      } else {
        await pane.getByRole('button', { name: `Return to ${label}` }).focus()
        await expect(pane.getByRole('button', { name: `Return to ${label}` })).toBeInViewport()
      }
    }
  })
}

test('every authored task change restores the header and keeps content reachable', async ({
  page,
}) => {
  test.setTimeout(480_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const entry of entries) {
    await openLesson(page, entry.id, entry.track)
    for (const step of entry.lesson.steps.slice(1)) {
      await test.step(`${entry.track}/${entry.id}/${step.id}`, async () => {
        const button = page.locator(`[data-step-id="${step.id}"] button`)
        if (!(await button.isVisible()))
          await page.getByText('Tasks in this section', { exact: true }).click()
        await button.click()
        await expect(page.locator(shellSelector)).toHaveAttribute('data-stage', step.id)
        await page.waitForTimeout(150)
        await headerVisible(page)
        const shell = page.locator(shellSelector)
        await shell.evaluate((node) => {
          node.scrollTo({ top: node.scrollHeight, behavior: 'instant' })
        })
        expect(
          await shell.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop),
        ).toBeLessThan(2)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
      })
    }
  }
})

test('circuit walk and guided control focus stay in the reading surface', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLesson(page, 'circuit-flow-path')
  const walk = page.locator('[data-circuit-walk]')
  const firstStop = await walk.getAttribute('data-walk-stop')
  await page.getByRole('button', { name: 'Follow blood to the next stop', exact: true }).click()
  await expect(walk).not.toHaveAttribute('data-walk-stop', firstStop!)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.locator(shellSelector).evaluate((node) => {
    node.scrollTo({ top: 0, behavior: 'instant' })
  })
  await headerVisible(page)
  await openLesson(page, 'startup-sensor-orientation')
  await page.getByText('Tasks in this section', { exact: true }).click()
  await page.locator('[data-step-id="startup-screen-parameters"] button').click()
  await page.getByRole('button', { name: 'Show me where', exact: true }).click()
  await page.waitForTimeout(250)
  const focus = await page.evaluate(() => {
    const rect = document.activeElement!.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      scrollY,
      inside: Boolean(document.activeElement!.closest('[data-ecmo-shell]')),
    }
  })
  expect(focus.inside).toBe(true)
  expect(focus.top).toBeGreaterThanOrEqual(81)
  expect(focus.bottom).toBeLessThanOrEqual(900)
  expect(focus.scrollY).toBe(0)
  await page.locator(shellSelector).evaluate((node) => {
    node.scrollTo({ top: 0, behavior: 'instant' })
  })
  await headerVisible(page)
})
