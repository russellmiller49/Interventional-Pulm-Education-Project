import { expect, test, type Locator } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.use({ channel: 'chromium' })

test.beforeEach(async ({ context, page }) => {
  if (process.env.ICU_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.ICU_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(
        `/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/icu-hemodynamics/learn`,
        {
          timeout: 30_000,
        },
      )
      .catch((error: unknown) => {
        throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function geometry(figure: Locator) {
  return figure.evaluate((element) => {
    const path = [...element.querySelectorAll('path')].find(
      (candidate) =>
        candidate.classList.value.includes('atlasTrace') &&
        !candidate.classList.value.includes('atlasTraceFill'),
    )!
    const ys = [...path.getAttribute('d')!.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((match) =>
      Number(match[2]),
    )
    const clipReference = path.getAttribute('clip-path')
    const clipId = clipReference?.slice(5, -1)
    const clipRect = clipId ? document.getElementById(clipId)?.querySelector('rect') : null
    return {
      minimumY: Math.min(...ys),
      topBoundaryPoints: ys.filter((y) => y === 66).length,
      clipReference,
      clipTop: clipRect?.getAttribute('y'),
      clipHeight: clipRect?.getAttribute('height'),
      outsideLandmarks: [...element.querySelectorAll('[class*="atlasAnnotation"] circle')].filter(
        (circle) =>
          Number(circle.getAttribute('cy')) < 66 || Number(circle.getAttribute('cy')) > 192,
      ).length,
      horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
    }
  })
}

for (const condition of [
  { width: 1204, height: 987, theme: 'dark', rootText: 100 },
  { width: 1440, height: 900, theme: 'light', rootText: 100 },
  { width: 390, height: 844, theme: 'light', rootText: 100 },
  { width: 1024, height: 768, theme: 'dark', rootText: 200 },
] as const) {
  test(`RA detail to RV/PA preserves plot coordinates at ${condition.width}, ${condition.theme}, ${condition.rootText}% root text`, async ({
    page,
  }) => {
    await page.setViewportSize(condition)
    await page.goto('/en/icu-hemodynamics/learn?activity=waveform-interpretation')
    const root = page.locator('html')
    // The theme class is set once the page has hydrated. Read before that, it is empty, and the
    // toggle is then pressed on a page that is about to choose the wanted theme by itself
    // (seen on a freshly started server during HD-PRE-REVIEW-03's base comparison).
    await page.waitForFunction(() => /\b(dark|light)\b/.test(document.documentElement.className))
    if (!(await root.getAttribute('class'))?.split(' ').includes(condition.theme)) {
      await page.getByRole('button', { name: /Toggle dark mode/i }).click()
    }
    await expect(root).toHaveClass(new RegExp(`\\b${condition.theme}\\b`))
    if (condition.rootText === 200) {
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
    }
    // Use the existing walk and axis controls; do not seed progress or simulation state.
    await page.getByRole('radio', { name: /Low-pressure detail/ }).check()
    for (const chamber of ['Right ventricle', 'Pulmonary artery']) {
      await page.getByRole('button', { name: 'Next stop', exact: true }).click()
      const figure = page
        .locator('figure[class*="atlasFigure"]')
        .filter({ has: page.locator('figcaption strong', { hasText: chamber }) })
        .first()
      await expect(figure).toBeVisible()
      await expect(figure.getByText(/Trace exceeds the displayed 0–20 mmHg axis/)).toBeVisible()
      // HD-PRE-REVIEW-03: the visible notice is the image's accessible description
      // (`aria-describedby`), so the image's name stays the canonical waveform description.
      await expect(figure.locator('svg')).toHaveAccessibleDescription(
        /out-of-range portions are clipped/,
      )
      await expect(figure.locator('svg')).not.toHaveAttribute('aria-label', /Trace exceeds/)
      const evidence = await geometry(figure)
      expect(evidence.minimumY).toBeLessThan(66)
      expect(evidence.topBoundaryPoints).toBeLessThan(3)
      expect(evidence.clipReference).toMatch(/^url\(#.+\)$/)
      expect(evidence.clipTop).toBe('66')
      expect(evidence.clipHeight).toBe('126')
      expect(evidence.outsideLandmarks).toBe(0)
      expect(evidence.horizontalOverflow).toBe(false)
      await test.info().attach(`${chamber}-geometry`, {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      })
      await figure.screenshot({ path: test.info().outputPath(`${chamber}-narrow.png`) })
      if (chamber === 'Right ventricle' && condition.width === 1204) {
        // A full-page capture from the document top keeps the fixed site header out of the plot.
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
        await page.screenshot({
          path: test.info().outputPath('rv-narrow-page.png'),
          fullPage: true,
        })
      }
    }
    await page.getByRole('radio', { name: /Shared 0–40/ }).check()
    const figure = page.locator('figure[class*="atlasFigure"]').first()
    await expect(figure.getByText(/Trace exceeds the displayed/)).toHaveCount(0)
    expect((await geometry(figure)).minimumY).toBeGreaterThan(66)
  })
}
