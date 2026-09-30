import { expect, test, type Page } from '@playwright/test'

// Observe real host/embedded messages; drive the existing range input, never seed evidence.
async function openScope(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('message', (event) => {
      if (event.origin === location.origin && event.data?.type === 'observation')
        (window as unknown as { labelObservation: unknown }).labelObservation =
          event.data.observation
    })
  })
  await page.goto('/en/ebus-guided/learn?section=scope-orientation')
  for (let i = 0; i < 8 && !(await page.locator('[data-evidence-identity="live"]').count()); i++) {
    await page.locator('[data-now-primary]').click()
  }
  await expect(page.locator('[data-evidence-identity="live"]')).toBeVisible()
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const o = (
            window as unknown as {
              labelObservation?: { frameReady: boolean; linked?: { assetsReady: boolean } }
            }
          ).labelObservation
          return !!o?.frameReady && !!o.linked?.assetsReady
        }),
      { timeout: 90000 },
    )
    .toBe(true)
  return page.frameLocator('iframe[title="EBUS workbench"]')
}

for (const viewport of [
  { width: 1246, height: 1021, text: 1 },
  { width: 768, height: 1024, text: 1 },
  { width: 1024, height: 768, text: 2 },
]) {
  test(`marker columns and identities survive repeated rotation and resize at ${viewport.width}, text ${viewport.text}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    if (viewport.text === 2)
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = '200%'
        })
      })
    const f = await openScope(page)
    const callouts = f.locator('.linked-structure-callouts')
    const letters = f.locator('.linked-structure-letter:not([hidden])')
    await expect(letters).toHaveCount(4)
    const snapshot = async () => {
      // Fonts and ResizeObserver can settle after the acquisition-ready message. Measure the
      // rendered callouts after layout, rather than pairing a new canvas size with old projections.
      await f.locator('.linked-canvas').evaluate(async () => {
        await document.fonts.ready
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      })
      const geometry = JSON.parse((await callouts.getAttribute('data-callout-geometry'))!) as {
        id: string
        letter: string
        side: string
        x: number
        y: number
        ax: number
        ay: number
      }[]
      const buttons = await letters.evaluateAll((els) =>
        els.map((el) => ({
          id: (el as HTMLElement).dataset.structure,
          letter: el.querySelector('.linked-structure-glyph')!.textContent,
          x: parseFloat((el as HTMLElement).style.left),
          y: parseFloat((el as HTMLElement).style.top),
        })),
      )
      const size = await f
        .locator('.linked-canvas')
        .evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }))
      return { geometry, buttons, size }
    }
    const first = await snapshot()
    expect(
      first.geometry
        .map(({ id, letter }) => ({ id, letter }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([
      { id: 'channel_outlet', letter: 'A' },
      { id: 'legacy_distal_body', letter: 'B' },
      { id: 'optical_lens', letter: 'C' },
      { id: 'transducer_face', letter: 'D' },
    ])
    const records = [{ roll: 0, ...first }]
    // Extreme movements exceed the old hysteresis band. Repeat and return to the starting pose.
    for (const roll of [40, 0, -40, -85, 0, 40, 0, -40, -85, 0]) {
      await f.getByRole('slider', { name: 'Scope rotation' }).evaluate((el, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          el,
          String(value),
        )
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }, roll)
      await expect
        .poll(() =>
          page.evaluate((value) => {
            const o = (
              window as unknown as { labelObservation?: { roll: number; frameReady: boolean } }
            ).labelObservation
            return o?.roll === value && o.frameReady
          }, roll),
        )
        .toBe(true)
      records.push({ roll, ...(await snapshot()) })
    }
    await page.setViewportSize({ width: viewport.width === 1024 ? 900 : 1024, height: 740 })
    await expect.poll(async () => (await snapshot()).size.width !== first.size.width).toBe(true)
    records.push({ roll: 0, ...(await snapshot()) })
    await testInfo.attach('rotation-geometry', {
      body: JSON.stringify(records, null, 2),
      contentType: 'application/json',
    })
    await testInfo.attach('final-markers', {
      body: await f.locator('.linked-canvas').screenshot(),
      contentType: 'image/png',
    })
    const identities = first.geometry
      .map(({ id, letter, side }) => ({ id, letter, side }))
      .sort((a, b) => a.id.localeCompare(b.id))
    for (const record of records) {
      expect(
        record.geometry
          .map(({ id, letter, side }) => ({ id, letter, side }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ).toEqual(identities)
      for (const b of record.buttons) {
        const g = record.geometry.find((point) => point.id === b.id)!
        expect(b.letter).toBe(g.letter)
        expect(b.x < record.size.width / 2 ? 'left' : 'right').toBe(g.side)
        expect(b.x).toBeGreaterThanOrEqual(17)
        expect(b.x).toBeLessThanOrEqual(record.size.width - 17)
        expect(b.y).toBeGreaterThanOrEqual(17)
        expect(b.y).toBeLessThanOrEqual(record.size.height - 17)
      }
      for (let i = 0; i < record.buttons.length; i++)
        for (let j = i + 1; j < record.buttons.length; j++) {
          const a = record.buttons[i],
            b = record.buttons[j]
          if (a.x < record.size.width / 2 === b.x < record.size.width / 2)
            expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(34)
        }
    }
  })
}

test('phone view retains the explicit desktop/tablet lab fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/en/ebus-guided/learn?section=scope-orientation')
  for (let i = 0; i < 8 && !(await page.locator('[data-evidence-identity="live"]').count()); i++)
    await page.locator('[data-now-primary]').click()
  await expect(page.getByText('Desktop or tablet lab', { exact: true })).toBeVisible()
  await expect(page.locator('iframe[title="EBUS workbench"]')).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(page.getByText('Desktop or tablet lab', { exact: true })).toBeVisible()
})
