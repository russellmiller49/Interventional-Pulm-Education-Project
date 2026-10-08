import { expect, test, type FrameLocator, type Page, type TestInfo } from '@playwright/test'

type Point = { id: string; letter: string; side: string; ax: number; ay: number }
type Box = {
  id: string
  label: string | null
  x: number
  y: number
  w: number
  h: number
  font: string
}
type Snapshot = {
  name: string
  geometry: Point[]
  boxes: Box[]
  canvas: { w: number; h: number }
  overlaps: { a: string; b: string; dx: number; dy: number }[]
}

async function enterLive(page: Page) {
  for (let i = 0; i < 8 && !(await page.locator('[data-evidence-identity="live"]').count()); i++)
    await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-evidence-identity="live"]')).toBeVisible()
  return page.frameLocator('iframe[title="EBUS workbench"]')
}

async function scopeReady(page: Page, frame: FrameLocator) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const o = (
            window as unknown as {
              spacingObservation?: { frameReady: boolean; linked?: { assetsReady: boolean } }
            }
          ).spacingObservation
          return !!o?.frameReady && !!o.linked?.assetsReady
        }),
      { timeout: 60000 },
    )
    .toBe(true)
  await expect(frame.locator('.linked-structure-letter:not([hidden])')).toHaveCount(4)
}

async function measure(frame: FrameLocator, selector: string, name: string): Promise<Snapshot> {
  const view = frame.locator(selector)
  await view.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  // Reentry can restore the iframe before its ResizeObserver projects into the new width.
  // Wait for rendered edge positions to agree with the current canvas, then measure endpoints.
  await expect
    .poll(
      () =>
        view.evaluate((el) => {
          const points = JSON.parse(
            el.querySelector('.linked-structure-callouts')!.getAttribute('data-callout-geometry')!,
          ) as Point[]
          return (
            points.length > 0 &&
            points.every((point) => {
              const button = Array.from(
                el.querySelectorAll<HTMLElement>('.linked-structure-letter'),
              ).find((b) => b.dataset.structure === point.id)!
              const expected =
                point.side === 'left'
                  ? 8 + button.offsetWidth / 2
                  : el.clientWidth - 8 - button.offsetWidth / 2
              return Math.abs(parseFloat(button.style.left) - expected) < 0.25
            })
          )
        }),
      { timeout: 5000 },
    )
    .toBe(true)
  return view.evaluate((el, name) => {
    const cr = el.getBoundingClientRect()
    const geometry = JSON.parse(
      el.querySelector('.linked-structure-callouts')!.getAttribute('data-callout-geometry')!,
    ) as Point[]
    const boxes = Array.from(
      el.querySelectorAll<HTMLElement>('.linked-structure-letter:not([hidden])'),
    ).map((b) => {
      const r = b.getBoundingClientRect()
      return {
        id: b.dataset.structure!,
        label: b.getAttribute('aria-label'),
        x: r.x - cr.x,
        y: r.y - cr.y,
        w: r.width,
        h: r.height,
        font: getComputedStyle(b).fontSize,
      }
    })
    const overlaps: Snapshot['overlaps'] = []
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j]
        const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (dx > 0.5 && dy > 0.5) overlaps.push({ a: a.id, b: b.id, dx, dy })
      }
    return { name, geometry, boxes, canvas: { w: cr.width, h: cr.height }, overlaps }
  }, name)
}

async function verify(records: Snapshot[], frame: FrameLocator, selector: string, info: TestInfo) {
  // Keep all measurements, including baseline failures, before asserting overlap freedom.
  await info.attach('label-boxes', {
    body: JSON.stringify(records, null, 2),
    contentType: 'application/json',
  })
  await info.attach('final-labels', {
    body: await frame.locator(selector).screenshot(),
    contentType: 'image/png',
  })
  for (const record of records) {
    expect(record.boxes.length).toBeGreaterThan(0)
    expect(record.geometry.map((g) => g.id).sort()).toEqual(record.boxes.map((b) => b.id).sort())
    for (const b of record.boxes) {
      expect(b.h).toBeGreaterThanOrEqual(34)
      expect(b.x).toBeGreaterThanOrEqual(-1)
      expect(b.y).toBeGreaterThanOrEqual(-1)
      expect(b.x + b.w).toBeLessThanOrEqual(record.canvas.w + 1)
      expect(b.y + b.h).toBeLessThanOrEqual(record.canvas.h + 1)
    }
  }
  expect(records.flatMap((r) => r.overlaps.map((o) => ({ state: r.name, ...o })))).toEqual([])
}

for (const viewport of [
  { width: 1246, height: 1021, text: 1 },
  { width: 768, height: 1024, text: 1 },
  { width: 1024, height: 768, text: 2 },
]) {
  test(`scope named boxes stay separate through rotation, orbit, zoom and reentry at ${viewport.width}, text ${viewport.text}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    await page.addInitScript((text) => {
      window.addEventListener('message', (e) => {
        if (e.origin === location.origin && e.data?.type === 'observation')
          (window as unknown as { spacingObservation: unknown }).spacingObservation =
            e.data.observation
      })
      if (text === 2)
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = '200%'
        })
    }, viewport.text)
    await page.goto('/en/ebus-guided/learn?section=scope-orientation')
    let frame = await enterLive(page)
    await scopeReady(page, frame)
    const records: Snapshot[] = []
    const snap = async (name: string) => {
      records.push(await measure(frame, '.linked-canvas', name))
    }
    const names = async () => {
      await frame.getByRole('button', { name: 'Show structure names', exact: true }).click()
    }
    await snap('initial')
    const slider = frame.getByRole('slider', { name: 'Scope rotation', exact: true })
    for (const [i, key] of ['End', 'Home', 'End', 'Home'].entries()) {
      await slider.press(key)
      const value = Number(await slider.inputValue())
      await expect
        .poll(() =>
          page.evaluate((v) => {
            const o = (
              window as unknown as { spacingObservation?: { roll: number; frameReady: boolean } }
            ).spacingObservation
            return o?.roll === v && o.frameReady
          }, value),
        )
        .toBe(true)
      await snap(`rotation-${i}`)
    }
    for (let i = 0; i < 8; i++) {
      await frame.getByRole('button', { name: 'Orbit right', exact: true }).click()
      await snap(`orbit-${i}`)
    }
    await names()
    await snap('named')
    for (let i = 0; i < 4; i++) {
      await frame.getByRole('button', { name: 'Orbit left', exact: true }).click()
      await snap(`named-orbit-${i}`)
    }
    for (let i = 0; i < 3; i++)
      await frame.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await snap('zoom-in')
    await frame.getByRole('button', { name: 'Reset view', exact: true }).click()
    await snap('reset-view')
    for (const width of [900, 1246, viewport.width]) {
      await page.setViewportSize({ width, height: 900 })
      await snap(`resize-${width}`)
    }
    await frame.getByRole('button', { name: 'Show whole scope', exact: true }).click()
    await expect(frame.getByRole('button', { name: 'Show distal tip', exact: true })).toBeVisible()
    await snap('whole-scope')
    await frame.getByRole('button', { name: 'Show distal tip', exact: true }).click()
    await snap('distal-reentry')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText('Desktop or tablet lab', { exact: true })).toBeVisible()
    await page.setViewportSize(viewport)
    frame = page.frameLocator('iframe[title="EBUS workbench"]')
    await scopeReady(page, frame)
    if (await frame.getByRole('button', { name: 'Show structure names', exact: true }).count())
      await names()
    await snap('supported-reentry')
    await page.getByRole('button', { name: 'Restart lesson', exact: true }).click()
    frame = await enterLive(page)
    await scopeReady(page, frame)
    await names()
    await snap('restart-named')
    await page.reload()
    frame = await enterLive(page)
    await scopeReady(page, frame)
    await names()
    await snap('reload-named')
    const mapping = records[0].geometry
      .map(({ id, letter }) => ({ id, letter }))
      .sort((a, b) => a.id.localeCompare(b.id))
    for (const r of records)
      expect(
        r.geometry
          .map(({ id, letter }) => ({ id, letter }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ).toEqual(mapping)
    await verify(records, frame, '.linked-canvas', info)
  })
}

test('route named boxes stay separate through target, approach, orbit, zoom and returning labels', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/en/ebus-guided/learn?section=eus-b-route-model')
  const frame = await enterLive(page)
  await expect(frame.locator('.model-viewport')).toHaveAttribute('data-arrow-px', /.+/, {
    timeout: 60000,
  })
  const records: Snapshot[] = []
  const snap = async (name: string) => {
    records.push(await measure(frame, '.model-viewport', name))
  }
  for (const [station, approach] of [
    ['4L', 'airway'],
    ['7', 'airway'],
    ['7', 'esophagus'],
    ['4L', 'esophagus'],
    ['11R', 'esophagus'],
    ['4L', 'airway'],
  ]) {
    await frame.getByLabel('Target / region').selectOption(station)
    await frame.getByLabel('Approach', { exact: true }).selectOption(approach)
    await snap(`${station}-${approach}-before`)
    for (let i = 0; i < 4; i++)
      await frame.getByRole('button', { name: 'Orbit right', exact: true }).click()
    await snap(`${station}-${approach}-orbit`)
    await frame.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await snap(`${station}-${approach}-zoom`)
    await frame.getByRole('button', { name: 'Reset view', exact: true }).click()
    await snap(`${station}-${approach}-reset`)
  }
  for (const width of [768, 1246, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    await snap(`route-resize-${width}`)
  }
  await verify(records, frame, '.model-viewport', info)
})
