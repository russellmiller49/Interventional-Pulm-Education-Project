import { chromium, expect } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'
import { coupling } from '../../src/features/ebus-guided/content/curriculum'
async function main() {
  const base = process.env.EBUS_REVIEW_URL ?? 'http://localhost:3135',
    out = 'artifacts/ebus-guided'
  await mkdir(out, { recursive: true })
  const b = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const observations: object[] = []
  try {
    for (const width of [1500, 1024, 900, 390]) {
      const p = await b.newPage({ viewport: { width, height: 900 } })
      await p.goto(base + '/en/ebus-guided/learn?section=acoustic-contact')
      // The shared workspace publishes pixel widths after hydration and ResizeObserver measurement.
      await expect(p.locator('[aria-label="EBUS guided lesson"]')).toHaveAttribute('style', /px/)
      const tabs = p.getByRole('tablist', { name: 'Workspace panel views' })
      const compact = (await tabs.count()) > 0
      if (compact) {
        const teaching = p.getByRole('tab', { name: 'Teaching', exact: true })
        await teaching.focus()
        await p.keyboard.press('Home')
        await expect(p.getByRole('tab', { name: 'Steps', exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        )
        await p.keyboard.press('End')
        await expect(p.getByRole('tab', { name: 'Simulator', exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        )
        await p.keyboard.press('ArrowLeft')
        await expect(teaching).toHaveAttribute('aria-selected', 'true')
        await p.getByRole('button', { name: 'What do I do now?', exact: true }).click()
        await expect(p.getByRole('tab', { name: 'Steps', exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        )
        await teaching.click()
      }
      await p.screenshot({ path: out + '/responsive-' + width + '.png', fullPage: width === 390 })
      const showSteps = async () => {
        if (compact) await p.getByRole('tab', { name: 'Steps', exact: true }).click()
      }
      const next = async () => {
        await showSteps()
        await p.locator('[data-now-primary]').click()
      }
      await next()
      await next()
      await p.getByLabel(coupling.question.choices[0].text, { exact: true }).check()
      await next()
      await expect(p.getByText('Not correct.', { exact: false })).toBeVisible()
      await next()
      if (width < 768) {
        await expect(p.getByRole('heading', { name: 'Desktop or tablet lab' })).toBeVisible()
        await p.screenshot({ path: out + '/phone-workbench-gate.png', fullPage: true })
        await showSteps()
        await expect(p.locator('[data-now-primary]')).toBeDisabled()
        await p.screenshot({ path: out + '/phone-lab-gate.png', fullPage: true })
      } else {
        if (compact) await p.getByRole('tab', { name: 'Simulator', exact: true }).click()
        const input = p.frameLocator('iframe').getByLabel('Tip flexion', { exact: true })
        await expect(input).toBeEnabled({ timeout: 60000 })
        await input.fill('10')
        await showSteps()
        await expect(p.locator('[data-now-primary]')).toBeEnabled({ timeout: 30000 })
        await p.locator('[data-step-id="acoustic-contact-step-1"] button').click()
        await showSteps()
        await p.locator('[data-now-primary]').click()
        if (compact) await p.getByRole('tab', { name: 'Simulator', exact: true }).click()
        await expect(input).toHaveValue('10') // Review did not reinitialize the scope.
        await showSteps()
        await expect(p.locator('[data-now-primary]')).toBeEnabled()
      }
      await p.reload()
      await expect(p.locator('[aria-label="EBUS guided lesson"]')).toHaveAttribute('style', /px/)
      await showSteps()
      await expect(p.getByRole('heading', { name: 'Orientation', exact: true })).toBeVisible()
      const record = await p.evaluate(() => JSON.parse(localStorage.getItem('ip-ebus-guided-v1')!))
      if (
        record.completed.length ||
        record.firstAttempts['acoustic-contact:contact-predict']?.choiceId !== 'a'
      )
        throw Error('Reload contract failed')
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      if (overflow > 1) throw Error('Horizontal overflow ' + width + ': ' + overflow)
      observations.push({
        width,
        compact,
        overflow,
        keyboard: true,
        reload: true,
        lab: width < 768 ? 'blocked as intended' : 'real action and review verified',
      })
      await p.close()
    }
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } })
    for (const locale of ['es', 'zh-CN']) {
      await p.goto(base + '/' + locale + '/ebus-guided')
      await expect(p.getByText('English course content.', { exact: false })).toBeVisible()
      await expect(p.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    }
    await p.goto(base + '/en/ebus-guided/learn?section=obsolete')
    await expect(
      p.getByText('That lesson link is no longer available.', { exact: false }),
    ).toBeVisible()
    await p.goto(base + '/en/ebus-guided/practice')
    await p.getByRole('button', { name: 'A station-boundary review', exact: true }).click()
    await expect(p.locator('img[src^="blob:"]')).toBeVisible()
    await expect(p.getByText('Show annotations', { exact: true })).toHaveCount(0)
    await p.screenshot({ path: out + '/practice-decision.png' })
    await p.goto(base + '/en/ebus-guided/learn?section=preparation')
    // A 750 CSS-pixel viewport represents the reflow width of a 1500-pixel display at 200%.
    // CSS zoom is not used: it leaves media queries unchanged and is not browser zoom.
    await p.setViewportSize({ width: 750, height: 500 })
    await expect(p.locator('[aria-label="EBUS guided lesson"]')).toHaveAttribute(
      'data-compact',
      'true',
    )
    await p.waitForTimeout(600)
    const zoomOverflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    if (zoomOverflow > 1) throw Error('200% zoom overflow: ' + zoomOverflow)
    await p.screenshot({ path: out + '/zoom-200.png', fullPage: true })
    await p.setViewportSize({ width: 900, height: 900 })
    await p.emulateMedia({ reducedMotion: 'reduce' })
    await p.goto(base + '/en/ebus-guided/practice')
    await p.getByRole('button', { name: 'Choose an appropriate image depth', exact: true }).click()
    const frame = p.frameLocator('iframe[title="EBUS workbench"]')
    const depth = frame.getByLabel('Image depth', { exact: true })
    await expect(depth).toBeEnabled({ timeout: 30000 })
    await expect(frame.getByRole('button', { name: 'Play clip', exact: true })).toBeEnabled()
    await expect
      .poll(() => frame.locator('video').evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(true)
    await depth.fill('2')
    await expect(depth).toBeEnabled()
    await expect
      .poll(() => frame.locator('video').evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(true)
    await expect(p.getByRole('button', { name: 'Review acquisition', exact: true })).toBeEnabled()
    await frame.getByRole('button', { name: 'Play clip', exact: true }).click()
    await expect
      .poll(() => frame.locator('video').evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(false)
    await frame.getByRole('button', { name: 'Pause clip', exact: true }).click()
    await expect
      .poll(() => frame.locator('video').evaluate((v: HTMLVideoElement) => v.paused))
      .toBe(true)
    await p.screenshot({ path: out + '/reduced-motion-knobology.png', fullPage: true })
    await writeFile(
      out + '/browser-review.json',
      JSON.stringify(
        {
          observations,
          localeFallback: true,
          noindex: true,
          staleLink: true,
          practiceImage: true,
          reducedMotion: true,
          zoomOverflow,
        },
        null,
        2,
      ),
    )
    console.log('Responsive, keyboard, reload, review, locale and practice-image checks passed')
  } finally {
    await b.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
