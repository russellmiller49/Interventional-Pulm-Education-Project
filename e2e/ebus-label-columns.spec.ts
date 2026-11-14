import { expect, test, type Page } from '@playwright/test'

/*
 * The markers over the 3D scope model are a named reference, not a lettered identification task:
 * they are drawn only while the learner has the "Names" chip on, and each one is a pill carrying
 * its structure's name. (Landmarks are identified on the ultrasound image, which other specs
 * cover.) This spec turns Names on and then holds every marker to its column and its identity
 * through scope rotation, resize and enlarged text.
 */
const NAMED_MARKERS = '.linked-structure-letter.is-named:not([hidden])'

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
  // Briefing with the worked example, an optional check, then the acquisition (third of five).
  for (let i = 0; i < 8 && !(await page.locator('[data-evidence-identity="live"]').count()); i++) {
    await page.locator('[data-now-primary]').click()
  }
  await expect(page.locator('[data-evidence-identity="live"]')).toBeVisible()
  await expect(page.locator('[data-ebus-flow]')).toHaveAttribute(
    'data-activity-id',
    'scope-orientation:acquire-sweep',
  )
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
  const frame = page.frameLocator('iframe[title="EBUS workbench"]')
  // No markers until the learner asks for them.
  const callouts = frame.locator('.linked-structure-callouts')
  const names = frame.locator('[data-structure-names]')
  await expect(names).toHaveAttribute('aria-label', 'Show structure names')
  await expect(names).toHaveAttribute('aria-pressed', 'false')
  await expect(callouts).toBeHidden()
  await names.click()
  await expect(names).toHaveAttribute('aria-label', 'Hide structure names')
  await expect(names).toHaveAttribute('aria-pressed', 'true')
  await expect(callouts).toBeVisible()
  return frame
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
    const letters = f.locator(NAMED_MARKERS)
    await expect(letters).toHaveCount(4)
    // Every marker is a named pill; none is a bare letter.
    await expect(f.locator('.linked-structure-letter:not(.is-named)')).toHaveCount(0)
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
        els.map((el) => {
          const name = el.querySelector<HTMLElement>('.linked-structure-name')!
          return {
            id: (el as HTMLElement).dataset.structure,
            letter: el.querySelector('.linked-structure-glyph')!.textContent,
            name: name.hidden ? '' : (name.textContent ?? ''),
            label: el.getAttribute('aria-label'),
            x: parseFloat((el as HTMLElement).style.left),
            y: parseFloat((el as HTMLElement).style.top),
            w: (el as HTMLElement).offsetWidth,
          }
        }),
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
    const nameOf = new Map(first.buttons.map((b) => [b.id, b.name]))
    expect(new Set(nameOf.values()).size).toBe(4)
    const startRoll = Number(
      await f.getByRole('slider', { name: 'Scope rotation' }).evaluate((el) => {
        return (el as HTMLInputElement).value
      }),
    )
    const records = [{ roll: startRoll, ...first }]
    // Extreme movements exceed the old hysteresis band. Repeat, returning to the centre each time.
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
    await expect(letters).toHaveCount(4)
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
        // The same name stays on the same structure, visibly and for assistive technology.
        expect(b.name).not.toBe('')
        expect(b.name).toBe(nameOf.get(b.id))
        expect(b.label).toBe(`Structure ${b.letter}: ${b.name}`)
        // A named pill hangs from the edge of its column: 8 px in from the canvas side.
        expect(b.w).toBeGreaterThan(34)
        const left = b.x - b.w / 2
        const right = b.x + b.w / 2
        expect(left).toBeGreaterThanOrEqual(7.5)
        expect(right).toBeLessThanOrEqual(record.size.width - 7.5)
        expect(left < record.size.width - right ? 'left' : 'right').toBe(g.side)
        if (g.side === 'left') expect(left).toBeLessThanOrEqual(8.5)
        else expect(right).toBeGreaterThanOrEqual(record.size.width - 8.5)
        expect(b.y).toBeGreaterThanOrEqual(17)
        expect(b.y).toBeLessThanOrEqual(record.size.height - 17)
      }
      for (let i = 0; i < record.buttons.length; i++)
        for (let j = i + 1; j < record.buttons.length; j++) {
          const a = record.buttons[i],
            b = record.buttons[j]
          const side = (id?: string) => record.geometry.find((point) => point.id === id)!.side
          if (side(a.id) === side(b.id)) expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(34)
        }
    }
  })
}

test('phone view retains the explicit desktop/tablet lab fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/en/ebus-guided/learn?section=scope-orientation')
  for (let i = 0; i < 8 && !(await page.locator('[data-evidence-identity="live"]').count()); i++)
    await page.locator('[data-now-primary]').click()
  await expect(
    page.getByRole('heading', { name: 'Desktop or tablet lab', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('needs a larger viewport and WebGL 2')).toBeVisible()
  // The lab was never started at this width, so there is no workbench and nothing to preserve.
  await expect(page.locator('iframe[title="EBUS workbench"]')).toHaveCount(0)
  await expect(page.getByText('paused and preserved')).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(page.getByText('Desktop or tablet lab', { exact: true })).toBeVisible()
})
