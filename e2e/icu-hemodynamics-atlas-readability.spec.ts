import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.use({ channel: 'chromium' })

test.beforeEach(async ({ context, page }) => {
  if (process.env.ICU_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.ICU_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/icu-hemodynamics/learn`)
      .catch((error: unknown) => {
        throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function openAtlas(page: Page) {
  await page.goto('/en/icu-hemodynamics/learn?activity=waveform-components')
  await expect(page.locator('[data-lesson-shell]')).toBeVisible()
  const atlas = page.locator('section[class*="atlasPanel"]').first()
  // Follow the self-paced lesson using Continue; do not seed progress or answer a question.
  for (let step = 0; step < 12 && !(await atlas.isVisible()); step += 1) {
    await page.locator('[data-now-card] [data-now-primary]').click()
  }
  await expect(atlas).toBeVisible()
  return atlas
}

async function proseContrast(atlas: Locator) {
  return atlas.evaluate((panel) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number)
    const luminance = (color: number[]) => {
      const channels = color.slice(0, 3).map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    return [
      ...panel.querySelectorAll(
        'h3, h4, p[class*="atlasSummary"], [class*="atlasDetailGrid"] li, ' +
          '[class*="atlasPitfall"] p, p[class*="atlasBoundary"], [role="tab"]',
      ),
    ].map((element) => {
      let backdrop: Element | null = element
      while (backdrop && rgb(getComputedStyle(backdrop).backgroundColor)[3] === 0) {
        backdrop = backdrop.parentElement
      }
      const foreground = luminance(rgb(getComputedStyle(element).color))
      const background = luminance(rgb(getComputedStyle(backdrop!).backgroundColor))
      return {
        text: element.textContent,
        ratio:
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      }
    })
  })
}

async function selectedView(page: Page, atlas: Locator) {
  return {
    stage: await page.locator('[data-lesson-shell]').getAttribute('data-stage'),
    selected: await atlas.getByRole('tab', { selected: true }).textContent(),
    summary: await atlas.locator('p[class*="atlasSummary"]').textContent(),
    paths: await atlas
      .locator('svg path')
      .evaluateAll((paths) => paths.map((path) => path.getAttribute('d'))),
  }
}

for (const condition of [
  { width: 1204, height: 987, theme: 'dark', rootText: 100 },
  { width: 1440, height: 900, theme: 'light', rootText: 100 },
  { width: 1024, height: 768, theme: 'dark', rootText: 200 },
  { width: 390, height: 844, theme: 'light', rootText: 100 },
  { width: 390, height: 844, theme: 'dark', rootText: 200 },
  { width: 320, height: 740, theme: 'light', rootText: 200 },
] as const) {
  test(`atlas prose and keyboard return at ${condition.width}, ${condition.theme}, ${condition.rootText}% root text`, async ({
    page,
  }) => {
    // The site theme toggle is available in the desktop header. Choose it there before
    // resizing, so mobile coverage does not depend on an absent desktop-only control.
    await page.setViewportSize({ width: 1440, height: 900 })
    const atlas = await openAtlas(page)
    await page.waitForFunction(() => /\b(dark|light)\b/.test(document.documentElement.className))
    if (!(await page.locator('html').getAttribute('class'))?.split(' ').includes(condition.theme)) {
      await page.getByRole('button', { name: /Toggle dark mode/i }).click()
    }
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${condition.theme}\\b`))
    await page.setViewportSize(condition)
    if (condition.rootText === 200) {
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
    }

    // Each reference can be opened with the keyboard, without submitting a prediction.
    for (const tab of await atlas.getByRole('tab').all()) {
      await tab.focus()
      await page.keyboard.press('Space')
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      for (const text of await proseContrast(atlas)) {
        expect(text.ratio, `contrast of ${JSON.stringify(text.text)}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    await atlas.getByRole('tab', { name: 'TR', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await expect(atlas.getByRole('tab', { name: 'Cannon a', exact: true })).toBeFocused()
    const before = await selectedView(page, atlas)

    const help = page.getByRole('button', { name: 'What do I do now?', exact: true })
    await help.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(help).toBeFocused()
    expect(await selectedView(page, atlas)).toEqual(before)

    const sources = page.locator('[data-stage-sources]')
    const sourceControl = sources.locator('summary')
    await sourceControl.focus()
    await page.keyboard.press('Enter')
    await expect(sources).toHaveAttribute('open', '')
    await page.keyboard.press('Escape')
    await expect(sources).not.toHaveAttribute('open', '')
    await expect(sourceControl).toBeFocused()
    expect(await selectedView(page, atlas)).toEqual(before)

    const bounds = await atlas.evaluate((panel) => ({
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(bounds.panelOverflow).toBeLessThanOrEqual(1)
    // Page-level reflow belongs to the shared shell and the other teaching surfaces.
    // Record it separately rather than claiming this atlas color repair fixes it.
    await test.info().attach('layout-bounds', {
      body: JSON.stringify(bounds, null, 2),
      contentType: 'application/json',
    })
    await atlas.screenshot({ path: test.info().outputPath('atlas-readable.png') })
    await test.info().attach('prose-contrast', {
      body: JSON.stringify(await proseContrast(atlas), null, 2),
      contentType: 'application/json',
    })
  })
}
