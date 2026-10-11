import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { writeFileSync } from 'node:fs'

/**
 * HD-PRE-REVIEW-03 — waveforms and the visual workbench, in real Chromium.
 *
 * These journeys use the lesson's own controls: the task list, Continue, the docks. Nothing seeds
 * progress or simulation state. Geometry is read from the rendered page — bounding boxes, computed
 * sizes, path data — because a label can look fine in a screenshot and still sit on the trace.
 *
 * "Root text" below is CSS `font-size` on the root element. It is not native browser zoom, which
 * these tests do not exercise.
 */

test.use({ channel: 'chromium' })

/*
 * Every journey also has to run without a console error or an uncaught exception. One message is
 * excused: this checkout has no analytics database configured, so `/api/analytics` answers 500 and
 * the browser reports the failed request. That is this environment, on the base as well.
 */
const consoleErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  consoleErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
      errors.push(message.text().replace(/\s+/g, ' ').slice(0, 400))
    }
  })
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 400)))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page) ?? [], 'console errors during the journey').toEqual([])
})

interface Condition {
  readonly width: number
  readonly height: number
  readonly theme: 'dark' | 'light'
  readonly rootText: 100 | 200
}

const MATRIX: readonly Condition[] = [
  { width: 1204, height: 987, theme: 'dark', rootText: 100 },
  { width: 1440, height: 900, theme: 'light', rootText: 100 },
  { width: 1024, height: 768, theme: 'dark', rootText: 100 },
  { width: 390, height: 844, theme: 'light', rootText: 100 },
  { width: 320, height: 740, theme: 'dark', rootText: 100 },
  { width: 1204, height: 987, theme: 'light', rootText: 200 },
  { width: 390, height: 844, theme: 'dark', rootText: 200 },
]
const tag = (c: Condition) => `${c.width}×${c.height}, ${c.theme}, ${c.rootText}% root text`

async function prepare(page: Page, condition: Condition, section: string) {
  // The theme toggle lives in the desktop header: choose the theme there, then resize.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/en/icu-hemodynamics/learn?activity=${section}`)
  await expect(page.locator('[data-lesson-shell]')).toBeVisible({ timeout: 90_000 })
  await page.waitForFunction(() => /\b(dark|light)\b/.test(document.documentElement.className))
  if (!(await page.locator('html').getAttribute('class'))?.split(' ').includes(condition.theme)) {
    await page.getByRole('button', { name: /Toggle dark mode/i }).click()
  }
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${condition.theme}\\b`))
  await page.setViewportSize({ width: condition.width, height: condition.height })
  if (condition.rootText === 200) {
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
  }
}

async function openTask(page: Page, ordinal: number) {
  if (ordinal > 1) {
    const list = page.locator('[data-step-list]')
    await list.evaluate((element) => {
      const details = element.closest('details')
      if (details) details.open = true
    })
    await list
      .locator('button')
      .nth(ordinal - 1)
      .click()
    await page.waitForFunction(
      (n) =>
        document
          .querySelector('[data-lesson-shell]')
          ?.getAttribute('data-stage')
          ?.includes(`-${n}-`),
      ordinal,
    )
  }
  await page.waitForTimeout(700)
}

/** The measured geometry, kept as a file beside the screenshots and attached to the report. */
async function record(info: TestInfo, name: string, data: unknown) {
  const file = info.outputPath(`${name}.json`)
  writeFileSync(file, JSON.stringify(data, null, 2))
  await info.attach(name, { path: file, contentType: 'application/json' })
}

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/** Overflow of one element's own box: the changed surface, apart from the shared shell. */
const ownOverflow = (locator: Locator) =>
  locator.evaluate((element) => element.scrollWidth - element.clientWidth)

/** WCAG contrast of every text-bearing element under a root, against its nearest opaque backdrop. */
async function lowestContrast(root: Locator) {
  return root.evaluate((scope) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number)
    const luminance = (color: number[]) => {
      const [r, g, b] = color.slice(0, 3).map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return r * 0.2126 + g * 0.7152 + b * 0.0722
    }
    let lowest = { ratio: Number.POSITIVE_INFINITY, text: '' }
    for (const element of scope.querySelectorAll<HTMLElement>('*')) {
      const own = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 1,
      )
      if (!own || element.closest('svg') || element.offsetParent === null) continue
      if (element.closest('[aria-hidden="true"]') && element.closest('[data-strip-plot]')) continue
      let backdrop: Element | null = element
      while (backdrop && (rgb(getComputedStyle(backdrop).backgroundColor)[3] ?? 1) === 0) {
        backdrop = backdrop.parentElement
      }
      if (!backdrop) continue
      const foreground = luminance(rgb(getComputedStyle(element).color))
      const background = luminance(rgb(getComputedStyle(backdrop).backgroundColor))
      const ratio =
        (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      if (ratio < lowest.ratio) lowest = { ratio, text: (element.textContent ?? '').slice(0, 60) }
    }
    return lowest
  })
}

/* ------------------------------------------------------------------ *
 * The live monitor: labels in gutters, one axis for a pure offset
 * ------------------------------------------------------------------ */

for (const condition of MATRIX) {
  test(`live strip labels stay off the trace and a pure offset keeps one axis — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'pressure-system')
    await openTask(page, 2)
    const strip = page.locator('[data-waveform-strip="papMmHg"]').first()
    await expect(strip).toBeVisible()

    const geometry = () =>
      strip.evaluate((figure) => {
        const box = (element: Element) => {
          const r = element.getBoundingClientRect()
          return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }
        }
        const plot = box(figure.querySelector('[data-strip-plot]')!)
        const labels = [
          ...figure.querySelectorAll(
            '[data-strip-axis] span, [data-strip-tag], [data-strip-marker]',
          ),
        ].map((element) => ({
          text: element.textContent,
          fontPx: Number.parseFloat(getComputedStyle(element).fontSize),
          ...box(element),
        }))
        const inside = (label: (typeof labels)[number]) =>
          label.l < plot.r - 0.5 &&
          label.r > plot.l + 0.5 &&
          label.t < plot.b - 0.5 &&
          label.b > plot.t + 0.5
        return {
          plot,
          labels,
          labelsInsidePlot: labels.filter(inside).map((label) => label.text),
          textInSvg: figure.querySelectorAll('svg text').length,
          ticks: [...figure.querySelectorAll('[data-strip-axis] span')].map((n) => n.textContent),
          traces: [...figure.querySelectorAll('polyline[data-strip-trace]')].map((n) =>
            n.getAttribute('data-strip-trace'),
          ),
        }
      })

    const before = await geometry()
    expect(before.textInSvg).toBe(0)
    expect(before.labelsInsidePlot).toEqual([])
    const stripBox = await strip.boundingBox()
    expect(before.plot.r - before.plot.l).toBeGreaterThan(stripBox!.width * 0.45)
    // Labels follow the reader's text size: about 11 px at 100 %, about 22 px at 200 %.
    for (const label of before.labels) {
      expect(label.fontPx).toBeGreaterThanOrEqual(condition.rootText === 200 ? 21 : 10.9)
    }
    await strip.screenshot({ path: info.outputPath('strip-before.png') })

    // Lower the transducer ten centimetres with the keyboard.
    const level = page.locator('#hemodynamics-control-level')
    await level.focus()
    await expect(level).toBeFocused()
    for (let step = 0; step < 10; step += 1) await page.keyboard.press('ArrowLeft')
    await expect(page.locator('[data-level-readout]')).toHaveText('-10 cm')
    await page.waitForTimeout(1500)

    const after = await geometry()
    // The axis did not move, so the shift is the only thing that changed…
    expect(after.ticks).toEqual(before.ticks)
    await expect(page.locator('[data-scale-change-note]')).toHaveCount(0)
    await expect(page.locator('[data-pinned-axis]')).toContainText('for this comparison')
    // …the two halves of the sweep are told apart instead of joined into a step…
    expect(after.traces).toEqual(['earlier', 'current'])
    await expect(strip.locator('[data-strip-seam]')).toHaveCount(1)
    await expect(strip.locator('[data-strip-marker="seam"]')).toHaveText(
      'transducer height changed',
    )
    // …and nothing was clipped to make it so.
    await expect(strip).not.toHaveAttribute('data-out-of-range', 'true')
    expect(after.labelsInsidePlot).toEqual([])

    // The card beside it reports the channel on the monitor, in the same figures as the table.
    const card = page.locator('[data-leveling-visual="pac"]')
    await expect(card.locator('[data-leveling-current]')).toContainText(
      (await page.locator('[data-demo-current]').innerText()).trim(),
    )
    await expect(card.locator('[data-leveling-direction]')).toHaveText('Reads high')
    expect(await card.innerText()).not.toContain('MmHg')

    const drawing = await card.evaluate((element) => {
      const y = (selector: string) => {
        const r = element.querySelector(selector)!.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, middle: (r.top + r.bottom) / 2 }
      }
      const depth = y('[data-leveling-chest-depth]')
      return {
        point: y('[data-leveling-axis-point]').middle,
        anterior: depth.top,
        posterior: depth.bottom,
        labelPx: [...element.querySelectorAll('[data-leveling-label]')].map((label) =>
          Number.parseFloat(getComputedStyle(label).fontSize),
        ),
        labelBoxes: [...element.querySelectorAll('[data-leveling-label]')].map(
          (label) => label.getBoundingClientRect().height,
        ),
      }
    })
    // The reference point is rendered midway between the front and the back of the chest.
    expect(drawing.point).toBeGreaterThan(
      drawing.anterior + (drawing.posterior - drawing.anterior) * 0.4,
    )
    expect(drawing.point).toBeLessThan(
      drawing.anterior + (drawing.posterior - drawing.anterior) * 0.6,
    )
    for (const size of drawing.labelPx) {
      expect(size).toBeGreaterThanOrEqual(condition.rootText === 200 ? 25 : 12.8)
    }
    const contrast = await lowestContrast(card)
    expect(contrast.ratio, `contrast of ${JSON.stringify(contrast.text)}`).toBeGreaterThanOrEqual(
      4.5,
    )

    expect(await ownOverflow(card)).toBeLessThanOrEqual(1)
    expect(await ownOverflow(page.locator('[data-focused-monitor]').first())).toBeLessThanOrEqual(1)
    if (condition.rootText === 100) expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'geometry', {
      before,
      after,
      drawing,
      contrast,
      pageOverflow: await pageOverflow(page),
    })
    await strip.screenshot({ path: info.outputPath('strip-after.png') })
    await card.screenshot({ path: info.outputPath('leveling-card.png') })

    // Raised instead, the arterial reading falls and its alarm sounds. This monitor draws no
    // arterial tracing, so the alarm is reported with the line it is about.
    for (let step = 0; step < 20; step += 1) await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-level-readout]')).toHaveText('+10 cm')
    const otherChannel = page.locator('[data-focused-monitor] [data-alarm-other-channel]')
    await expect(otherChannel).toContainText('On the arterial line')
    await expect(otherChannel).toContainText('ART MAP LOW')
    await expect(
      page.locator('[data-focused-monitor] [data-waveform-strip="artMmHg"]'),
    ).toHaveCount(0)
  })
}

/* ------------------------------------------------------------------ *
 * Dynamic response: aligned comparison, coherent flush workbench
 * ------------------------------------------------------------------ */

for (const condition of MATRIX) {
  test(`dynamic-response examples compare on one axis — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'pressure-system')
    await openTask(page, 5)
    const comparison = page.locator('[data-dynamic-response-comparison]')
    await expect(comparison).toBeVisible()
    await expect(comparison.getByRole('heading', { level: 3 })).toContainText('the fast-flush test')

    const layout = await comparison.evaluate((element) => {
      const rect = (node: Element) => {
        const r = node.getBoundingClientRect()
        return {
          l: r.left,
          t: r.top + scrollY,
          w: r.width,
          h: r.height,
          r: r.right,
          b: r.bottom + scrollY,
        }
      }
      return [...element.querySelectorAll('article[data-response]')].map((article) => ({
        response: article.getAttribute('data-response'),
        article: rect(article),
        whole: rect(article.querySelector('[data-window="whole"] [data-flush-plot]')!),
        release: rect(article.querySelector('[data-window="release"] [data-flush-plot]')!),
        drawn: article.querySelector('[data-response-displayed]')?.textContent,
        tickPx: Number.parseFloat(
          getComputedStyle(article.querySelector('[data-fast-flush-trace] [class*="tick"]')!)
            .fontSize,
        ),
        labelInPlot: [...article.querySelectorAll('[data-flush-off-scale-label]')].some((label) => {
          const l = label.getBoundingClientRect()
          const p = label
            .closest('figure')!
            .querySelector('[data-flush-plot]')!
            .getBoundingClientRect()
          return l.bottom > p.top + 0.5 && l.top < p.bottom - 0.5
        }),
        textInSvg: article.querySelectorAll('svg text').length,
      }))
    })
    expect(layout.map((panel) => panel.response)).toEqual([
      'acceptable',
      'overdamped',
      'underdamped',
    ])
    expect(layout.map((panel) => panel.drawn)).toEqual([
      '25/10 mmHg · mean 15',
      '21/12 mmHg · mean 15',
      '28/7 mmHg · mean 15',
    ])
    for (const panel of layout) {
      expect(panel.textInSvg).toBe(0)
      expect(panel.labelInPlot).toBe(false)
      expect(panel.tickPx).toBeGreaterThanOrEqual(condition.rootText === 200 ? 23 : 11.9)
      // A plot tall enough to read the settling in.
      expect(panel.release.h).toBeGreaterThanOrEqual(120)
    }
    const sideBySide = layout[1].article.l > layout[0].article.r - 1
    if (condition.width >= 1204 && condition.rootText === 100) {
      // One row: the whole tests share a line, the enlarged releases share the next, at one width.
      expect(sideBySide).toBe(true)
      for (const panel of layout) {
        expect(Math.abs(panel.whole.t - layout[0].whole.t)).toBeLessThanOrEqual(1)
        expect(Math.abs(panel.release.t - layout[0].release.t)).toBeLessThanOrEqual(1)
        expect(Math.abs(panel.whole.w - layout[0].whole.w)).toBeLessThanOrEqual(1)
        expect(Math.abs(panel.whole.h - layout[0].whole.h)).toBeLessThanOrEqual(1)
      }
      // The three whole tests and their enlarged releases fit one screen, with room for its header.
      const top = Math.min(...layout.map((panel) => panel.whole.t))
      const bottom = Math.max(...layout.map((panel) => panel.release.b))
      expect(bottom - top).toBeLessThan(condition.height - 150)
    } else if (condition.width <= 390) {
      expect(sideBySide).toBe(false)
    }
    expect(await ownOverflow(comparison)).toBeLessThanOrEqual(1)
    if (condition.rootText === 100) expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'layout', { layout, sideBySide, pageOverflow: await pageOverflow(page) })
    await comparison.screenshot({ path: info.outputPath('dynamic-response.png') })
  })
}

for (const condition of MATRIX.filter((c) => c.rootText === 100)) {
  test(`flush task keeps the monitor beside its controls and results — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'pressure-system')
    await openTask(page, 8)
    // No control without a visible target: this task's monitor shows the catheter channel only.
    await expect(page.locator('[data-waveform-strip="artMmHg"]')).toHaveCount(0)
    await expect(page.locator('#hemodynamics-control-scale')).toHaveCount(0)
    await expect(page.locator('[data-scale-unavailable]')).toBeVisible()

    const flush = page.locator('#hemodynamics-control-flush')
    await flush.focus()
    await page.keyboard.press('Enter')
    const trace = page.locator('fieldset[data-dock="flush"] [data-fast-flush-trace]')
    await expect(trace).toBeVisible()
    const choices = page.locator('[data-flush-classification]')
    await choices.scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)

    const view = await page.evaluate(() => {
      const visible = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const r = element.getBoundingClientRect()
        // Seen, not merely inside the window: the element at its own centre is itself, so the
        // site's fixed header is not lying over it.
        const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)
        return {
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          inView: r.bottom > 0 && r.top < innerHeight,
          wholeInView: r.top >= 0 && r.bottom <= innerHeight,
          uncovered: top !== null && (element === top || element.contains(top)),
        }
      }
      const goals = document.querySelector('[data-step-goals]')
      return {
        monitor: visible('[data-focused-monitor]'),
        monitorPlot: visible(
          '[data-focused-monitor] [data-waveform-strip="papMmHg"] [data-strip-plot]',
        ),
        trace: visible('fieldset[data-dock="flush"] [data-fast-flush-trace] [data-flush-plot]'),
        choices: visible('[data-flush-classification]'),
        innerHeight,
        goalCircles: goals?.querySelectorAll('svg circle, svg.lucide-circle').length ?? -1,
        goalBorders: [...(goals?.querySelectorAll('li') ?? [])].map(
          (item) => getComputedStyle(item).borderTopWidth,
        ),
        goalWords: [...(goals?.querySelectorAll('li small') ?? [])].map((n) => n.textContent),
        tickPx: Number.parseFloat(
          getComputedStyle(
            document.querySelector(
              'fieldset[data-dock="flush"] [data-fast-flush-trace] [class*="tick"]',
            )!,
          ).fontSize,
        ),
      }
    })
    expect(view.tickPx).toBeGreaterThanOrEqual(11.9)
    if (condition.width >= 1024) {
      // Two columns: with the choices scrolled into view, the monitor's tracing — where the flush
      // was just drawn — is whole, on screen and not under the site header, beside them.
      expect(view.choices?.inView).toBe(true)
      expect(view.monitorPlot?.wholeInView).toBe(true)
      expect(view.monitorPlot?.uncovered).toBe(true)
      expect(view.monitor!.right).toBeLessThanOrEqual(view.choices!.left + 1)
    }
    // The goals are a progress list: no circle that reads as a radio input, no boxed rows.
    expect(view.goalCircles).toBe(0)
    expect(view.goalBorders.every((width) => width === '0px')).toBe(true)
    expect(view.goalWords).toContain('done')
    expect(view.goalWords).toContain('not yet done')
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'view', view)
    await page.screenshot({ path: info.outputPath('flush-workbench.png') })
  })
}

/* ------------------------------------------------------------------ *
 * Reference figures: label layout, comparison, rhythm patterns
 * ------------------------------------------------------------------ */

async function figureLabels(figure: Locator) {
  return figure.evaluate((element) => {
    const frame = element.querySelector('[data-atlas-frame]')!
    const svg = frame.querySelector('svg')!
    const [, , viewWidth, viewHeight] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    const s = svg.getBoundingClientRect()
    const lane = svg.querySelector('g[data-atlas-lane="pressure"]')!
    const shift = Number(/translate\(0 (-?[\d.]+)\)/.exec(lane.getAttribute('transform')!)![1])
    const toPx = (x: number, y: number) => ({
      x: s.left + (x / viewWidth) * s.width,
      y: s.top + (y / viewHeight) * s.height,
    })
    const plot = { top: toPx(0, 66 + shift).y, bottom: toPx(0, 192 + shift).y }
    const labels = [...frame.querySelectorAll<HTMLElement>('[data-atlas-label]')].map((label) => {
      const id = label.getAttribute('data-atlas-label')!
      const r = label.getBoundingClientRect()
      const leader = svg.querySelector(`line[data-atlas-leader="${id}"]`)!
      const mark = svg.querySelector(`circle[data-atlas-landmark="${id}"]`)!
      const markBox = mark.getBoundingClientRect()
      const end = toPx(Number(leader.getAttribute('x2')), Number(leader.getAttribute('y2')))
      const start = toPx(Number(leader.getAttribute('x1')), Number(leader.getAttribute('y1')))
      return {
        id,
        text: label.textContent,
        fontPx: Number.parseFloat(getComputedStyle(label).fontSize),
        l: r.left,
        r: r.right,
        t: r.top,
        b: r.bottom,
        leaderStartsOnMark:
          Math.hypot(
            start.x - (markBox.left + markBox.right) / 2,
            start.y - (markBox.top + markBox.bottom) / 2,
          ) < 2,
        leaderEndsAtLabel:
          end.x >= r.left - 2 &&
          end.x <= r.right + 2 &&
          end.y >= r.top - 3 &&
          end.y <= r.bottom + 3,
      }
    })
    const collisions: string[][] = []
    const all = [...frame.querySelectorAll<HTMLElement>('[class*="atlasLabels"] > span')].map(
      (node) => ({
        text: node.textContent ?? '',
        box: node.getBoundingClientRect(),
      }),
    )
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i].box
        const b = all[j].box
        if (
          a.left < b.right - 0.5 &&
          b.left < a.right - 0.5 &&
          a.top < b.bottom - 0.5 &&
          b.top < a.bottom - 0.5
        ) {
          collisions.push([all[i].text, all[j].text])
        }
      }
    }
    return {
      title: element.querySelector('figcaption strong')?.textContent,
      plot,
      plotHeight: plot.bottom - plot.top,
      figureHeight: element.getBoundingClientRect().height,
      labels,
      collisions,
      insidePlot: labels
        .filter((label) => label.b > plot.top + 1 && label.t < plot.bottom - 1)
        .map((l) => l.text),
      textInSvg: svg.querySelectorAll('text').length,
      overflow: element.scrollWidth - element.clientWidth,
    }
  })
}

for (const condition of MATRIX) {
  test(`reference figure labels are readable, separate and on their landmarks — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'waveform-interpretation')
    await openTask(page, 1)
    // While the walk chooses the chamber the reference shows an indicator, not disabled tabs.
    await expect(page.locator('[data-reference-progress]')).toBeVisible()
    await expect(page.locator('[data-reference-progress] button')).toHaveCount(0)
    await expect(page.getByRole('tab')).toHaveCount(0)

    const evidence: Record<string, unknown> = {}
    for (const chamber of ['Right atrium / CVP', 'Right ventricle', 'Pulmonary artery']) {
      const figure = page
        .locator('figure[class*="atlasFigure"]')
        .filter({ has: page.locator('figcaption strong', { hasText: chamber }) })
        .first()
      await expect(figure).toBeVisible()
      await page.waitForTimeout(400)
      const result = await figureLabels(figure)
      evidence[chamber] = result
      expect(result.textInSvg).toBe(0)
      expect(result.collisions, `label collisions on ${chamber}`).toEqual([])
      expect(result.insidePlot, `labels over the plot on ${chamber}`).toEqual([])
      for (const label of result.labels) {
        expect(label.leaderStartsOnMark, `${label.text} leader starts on its landmark`).toBe(true)
        expect(label.leaderEndsAtLabel, `${label.text} leader ends at its label`).toBe(true)
        // 13.6 px at 100 %: far from the reported 41–43 px, and it doubles with the root text.
        const expected = condition.rootText === 200 ? 27.2 : 13.6
        expect(Math.abs(label.fontPx - expected)).toBeLessThan(0.6)
      }
      // The trace has room: the plot is not a sliver beneath a wall of labels.
      expect(result.plotHeight).toBeGreaterThanOrEqual(90)
      expect(result.overflow).toBeLessThanOrEqual(1)
      if (chamber === 'Right atrium / CVP') {
        expect(result.labels.map((label) => label.text)).toContain('read here')
      }
      await figure.screenshot({ path: info.outputPath(`${chamber.split(' ')[1] ?? 'ra'}.png`) })
      if (chamber !== 'Pulmonary artery') {
        await page.getByRole('button', { name: 'Next stop', exact: true }).click()
      }
    }
    if (condition.rootText === 100) expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'figures', { evidence, pageOverflow: await pageOverflow(page) })
  })
}

for (const condition of MATRIX) {
  test(`RV and PA are compared on one axis without scrolling between them — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'waveform-interpretation')
    await openTask(page, 2)
    const comparison = page.locator('[data-ventricle-artery-comparison]')
    await expect(comparison).toBeVisible()
    const figures = comparison.locator('figure[class*="atlasFigure"]')
    await expect(figures).toHaveCount(2)
    await page.waitForTimeout(400)
    const [ventricle, artery] = [
      await figureLabels(figures.nth(0)),
      await figureLabels(figures.nth(1)),
    ]
    const boxes = await figures.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect()
        const ticks = [...node.querySelectorAll('[class*="atlasTick"]')].map((n) => n.textContent)
        return { l: r.left, r: r.right, t: r.top, h: r.height, w: r.width, ticks }
      }),
    )
    // One axis.
    expect(boxes[0].ticks).toEqual(['0', '10', '20', '30', '40'])
    expect(boxes[1].ticks).toEqual(boxes[0].ticks)
    for (const figure of [ventricle, artery]) {
      expect(figure.collisions).toEqual([])
      expect(figure.insidePlot).toEqual([])
      expect(figure.plotHeight).toBeGreaterThanOrEqual(90)
    }
    const sideBySide = boxes[1].l >= boxes[0].r - 1
    if (condition.width >= 1024 && condition.rootText === 100) {
      expect(sideBySide).toBe(true)
      // Same row, same size, plots at the same height: a level on one is the same pressure on the other.
      expect(Math.abs(boxes[0].t - boxes[1].t)).toBeLessThanOrEqual(1)
      expect(Math.abs(boxes[0].w - boxes[1].w)).toBeLessThanOrEqual(1)
      expect(Math.abs(ventricle.plot.top - artery.plot.top)).toBeLessThanOrEqual(1)
      expect(Math.abs(ventricle.plot.bottom - artery.plot.bottom)).toBeLessThanOrEqual(1)
      // Both whole figures fit the window together (the report's pair ran to 1,839 px).
      expect(boxes[0].h).toBeLessThan(condition.height - 150)
    } else if (condition.width <= 390) {
      expect(sideBySide).toBe(false)
      // Stacked, each whole figure fits one screen at ordinary text size.
      if (condition.rootText === 100) {
        for (const box of boxes) expect(box.h).toBeLessThan(condition.height)
      }
    }
    await expect(comparison.locator('[data-comparison-key]')).toBeVisible()
    await expect(comparison.locator('[data-model-drawing-note]')).toContainText('not a notch')
    await expect(comparison.locator('[data-model-drawing-note]')).toContainText('schematic')
    expect(await ownOverflow(comparison)).toBeLessThanOrEqual(1)
    if (condition.rootText === 100) expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'comparison', {
      boxes,
      ventricle,
      artery,
      sideBySide,
      pageOverflow: await pageOverflow(page),
    })
    await comparison.screenshot({ path: info.outputPath('rv-pa.png') })
  })
}

for (const condition of MATRIX.filter((c) => c.rootText === 100)) {
  test(`rhythm patterns state their limits and the TR example draws one wave — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'waveform-components')
    await openTask(page, 3)
    await expect(page.locator('[data-now-card]')).not.toContainText(
      'Use the ECG and the affected wave',
    )
    await expect(page.locator('[data-now-card]')).toContainText('are not modeled here')
    for (const pattern of ['Cannon a waves', 'Atrial fibrillation']) {
      const figure = page
        .locator('figure[class*="atlasFigure"]')
        .filter({ has: page.locator('figcaption strong', { hasText: pattern }) })
        .first()
      await expect(figure).toBeVisible()
      // No ECG lane is reserved, so there is no empty band where a strip would be.
      await expect(figure.locator('[data-atlas-lane="ecg"]')).toHaveCount(0)
      // Above the plot there is room for its labels and its unit, and not for a lane as well: the
      // ECG lane, with its gaps, is about three rem tall at this size.
      const band = await figure.evaluate((element) => {
        const frame = element.querySelector('[data-atlas-frame]')!
        const lane = frame.querySelector('g[data-atlas-lane="pressure"]')!.getBoundingClientRect()
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
        const tracks = new Set(
          [...frame.querySelectorAll('[data-atlas-label][data-placement="above"]')].map((label) =>
            Math.round(label.getBoundingClientRect().bottom),
          ),
        ).size
        return { abovePlot: lane.top - frame.getBoundingClientRect().top, rem, tracks }
      })
      expect(band.abovePlot).toBeLessThan((2.6 + 1.5 * Math.max(1, band.tracks)) * band.rem)
      await expect(figure.locator('[data-waveform-rendering-limit]')).toContainText(
        'no rhythm strip',
      )
      // A term never prints across its own definition.
      const legend = await figure.locator('dl > div').evaluateAll((rows) =>
        rows.map((row) => {
          const dt = row.querySelector('dt')!
          const dd = row.querySelector('dd')!
          const a = dt.getBoundingClientRect()
          const b = dd.getBoundingClientRect()
          return {
            term: dt.textContent,
            spills: dt.scrollWidth > dt.clientWidth + 1,
            overlaps:
              a.left < b.right - 0.5 &&
              b.left < a.right - 0.5 &&
              a.top < b.bottom - 0.5 &&
              b.top < a.bottom - 0.5,
          }
        }),
      )
      expect(legend.filter((row) => row.spills || row.overlaps)).toEqual([])
      const contrast = await lowestContrast(figure)
      expect(contrast.ratio, `contrast of ${JSON.stringify(contrast.text)}`).toBeGreaterThanOrEqual(
        4.5,
      )
      await figure.screenshot({ path: info.outputPath(`${pattern.split(' ')[0]}.png`) })
    }

    await openTask(page, 4)
    const explain = page.getByRole('button', { name: /Show explanation/i }).first()
    if (await explain.count()) await explain.click()
    const tr = page
      .locator('figure[class*="atlasFigure"]')
      .filter({ has: page.locator('[data-atlas-label="x"]') })
      .first()
    await expect(tr).toBeVisible()
    const wave = await tr.evaluate((element) => {
      const d = [...element.querySelectorAll('path')]
        .find((path) => /atlasTrace(?!Fill)/.test(path.getAttribute('class') ?? ''))!
        .getAttribute('d')!
      const points = [...d.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((m) => ({
        x: Number(m[1]),
        y: Number(m[2]),
      }))
      const x = (id: string) =>
        Number(element.querySelector(`circle[data-atlas-landmark="${id}"]`)!.getAttribute('cx'))
      const y = (id: string) =>
        Number(element.querySelector(`circle[data-atlas-landmark="${id}"]`)!.getAttribute('cy'))
      // From the "x lost" landmark to the "c-v" landmark the trace only rises (smaller y is higher).
      const between = points.filter((point) => point.x >= x('x') && point.x <= x('cv'))
      let falls = 0
      for (let index = 1; index < between.length; index += 1) {
        if (between[index].y > between[index - 1].y + 0.05) falls += 1
      }
      return { falls, samples: between.length, xLostY: y('x'), cvY: y('cv') }
    })
    expect(wave.samples).toBeGreaterThan(10)
    expect(wave.falls).toBe(0)
    expect(wave.cvY).toBeLessThan(wave.xLostY)
    await expect(tr.locator('[data-waveform-rendering-limit]')).toContainText('It is an example')
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'tr', wave)
    await tr.screenshot({ path: info.outputPath('tr.png') })
  })
}

/* ------------------------------------------------------------------ *
 * Help, Sources, held view, keyboard
 * ------------------------------------------------------------------ */

for (const condition of MATRIX.filter((c) => c.rootText === 100 && c.width !== 1024)) {
  test(`Help and Sources open and close by keyboard without changing the lesson — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'pressure-system')
    await openTask(page, 2)
    // A state that is not the opening one: the transducer moved, and a still copy held.
    const level = page.locator('#hemodynamics-control-level')
    await level.focus()
    for (let step = 0; step < 7; step += 1) await page.keyboard.press('ArrowLeft')
    const hold = page.locator('[data-hold-view]')
    await hold.focus()
    await expect(hold).toBeFocused()
    await expect(hold).toHaveCSS('outline-style', 'solid')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-held-view]')).toBeVisible()
    await expect(hold).toHaveAttribute('aria-pressed', 'true')

    const fingerprint = () =>
      page.evaluate(() => ({
        stage: document.querySelector('[data-lesson-shell]')?.getAttribute('data-stage'),
        level: document.querySelector('[data-level-readout]')?.textContent,
        reference: document.querySelector('[data-demo-before]')?.textContent,
        current: document.querySelector('[data-demo-current]')?.textContent,
        offset: document.querySelector('[data-demo-offset]')?.textContent,
        held: document.querySelector('[data-held-view-note]')?.textContent,
        heldTrace: document
          .querySelector('[data-held-view] polyline[data-strip-trace]')
          ?.getAttribute('points'),
        axis: [
          ...document.querySelectorAll('[data-waveform-strip="papMmHg"] [data-strip-axis] span'),
        ]
          .map((node) => node.textContent)
          .join(','),
        seams: document.querySelectorAll(
          '[data-focused-monitor] > [data-waveform-strip] [data-strip-seam]',
        ).length,
      }))
    const before = await fingerprint()
    expect(before.level).toBe('-7 cm')
    expect(before.held).toContain('Held copy')

    const help = page.getByRole('button', { name: 'What do I do now?', exact: true })
    await help.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(condition.width + 1)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(help).toBeFocused()
    expect({ ...(await fingerprint()), seams: 0 }).toEqual({ ...before, seams: 0 })

    const sources = page.locator('[data-stage-sources]')
    const summary = sources.locator('summary')
    await summary.focus()
    await expect(summary).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(sources).toHaveAttribute('open', '')
    const placement = await page.evaluate(() => {
      const panel = document.querySelector('[data-stage-sources] > div')!
      const p = panel.getBoundingClientRect()
      const tasks = document
        .querySelector('[data-step-list]')!
        .closest('details')!
        .getBoundingClientRect()
      return {
        position: getComputedStyle(panel).position,
        left: p.left,
        right: p.right,
        overlapsTasks:
          p.left < tasks.right &&
          tasks.left < p.right &&
          p.top < tasks.bottom &&
          tasks.top < p.bottom,
        innerWidth,
        sources: panel.querySelectorAll('li').length,
      }
    })
    // Opened in the page, beneath the lesson: it covers no task and stays inside the window.
    expect(placement.position).toBe('static')
    expect(placement.overlapsTasks).toBe(false)
    expect(placement.left).toBeGreaterThanOrEqual(0)
    expect(placement.right).toBeLessThanOrEqual(placement.innerWidth + 1)
    expect(placement.sources).toBeGreaterThan(0)
    // The task list can still be used with the sources open.
    await expect(page.locator('[data-step-list]').locator('button').first()).toBeVisible()
    const contrast = await lowestContrast(sources)
    expect(contrast.ratio, `contrast of ${JSON.stringify(contrast.text)}`).toBeGreaterThanOrEqual(
      4.5,
    )
    await page.screenshot({ path: info.outputPath('sources-open.png') })
    await summary.focus()
    await page.keyboard.press('Escape')
    await expect(sources).not.toHaveAttribute('open', '')
    await expect(summary).toBeFocused()
    expect({ ...(await fingerprint()), seams: 0 }).toEqual({ ...before, seams: 0 })
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'state', { before, placement, contrast })
  })
}

for (const condition of MATRIX.filter((c) => c.rootText === 100)) {
  test(`the right-atrial tracing can be held and read wave by wave — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'catheter-advancement')
    await openTask(page, 2)
    const monitor = page.locator('[data-focused-monitor="pac"]')
    await expect(monitor.locator('[data-waveform-strip="cvpMmHg"]').first()).toBeVisible()
    const live = await monitor
      .locator('[data-waveform-strip="cvpMmHg"] [data-strip-plot]')
      .first()
      .boundingBox()
    const hold = monitor.locator('[data-hold-view]')
    await hold.focus()
    await page.keyboard.press('Space')
    const held = monitor.locator('[data-held-view]')
    await expect(held).toBeVisible()
    await expect(held.locator('[data-held-view-note]')).toContainText('Held copy · not live')
    await expect(held.locator('[data-held-view-note]')).toContainText('s of model time')
    const names = await held
      .locator('[data-strip-landmark]')
      .evaluateAll((nodes) =>
        [...new Set(nodes.map((node) => node.getAttribute('data-strip-landmark')))].sort(),
      )
    expect(names).toEqual(['a', 'c', 'v', 'x', 'y'])
    const heldPlot = await held.locator('[data-strip-plot]').boundingBox()
    // Larger in both senses: a taller plot, and two beats across it instead of a whole sweep.
    expect(heldPlot!.height).toBeGreaterThan(live!.height)
    // And the plot has the width: a gutter is never left reserved for a tag that moved beneath it.
    const heldBox = await held.boundingBox()
    expect(heldPlot!.width).toBeGreaterThan(heldBox!.width * 0.5)
    const detail = await held.evaluate((element) => {
      const points = element
        .querySelector('polyline[data-strip-trace]')!
        .getAttribute('points')!
        .split(' ')
      const ys = points.map((pair) => Number(pair.split(',')[1]))
      const labels = [...element.querySelectorAll<HTMLElement>('[data-strip-landmark] b')].map(
        (b) => b.getBoundingClientRect(),
      )
      let collisions = 0
      for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
          const a = labels[i]
          const b = labels[j]
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
            collisions += 1
        }
      }
      return {
        samples: points.length,
        span: Math.max(...ys) - Math.min(...ys),
        collisions,
        outOfRange: element.querySelector('[data-out-of-range]') !== null,
      }
    })
    // The fitted axis spreads the atrial waves over most of the plot (it was a ~40 px ripple).
    expect(detail.span).toBeGreaterThan(45)
    expect(detail.collisions).toBe(0)
    expect(detail.outOfRange).toBe(false)
    // The live strip above is still running.
    const a = await monitor
      .locator('[data-waveform-strip="cvpMmHg"] polyline')
      .first()
      .getAttribute('points')
    await page.waitForTimeout(700)
    const b = await monitor
      .locator('[data-waveform-strip="cvpMmHg"] polyline')
      .first()
      .getAttribute('points')
    expect(a).not.toBe(b)
    await page.keyboard.press('Space')
    await expect(held).toHaveCount(0)
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'held', { detail, live, heldPlot })
  })
}

/* ------------------------------------------------------------------ *
 * Catheter and anatomy visuals; the Learn atlas
 * ------------------------------------------------------------------ */

for (const condition of MATRIX.filter(
  (c) => c.width <= 390 || c.rootText === 200 || c.width === 1204,
)) {
  test(`schematic labels stay readable — ${tag(condition)}`, async ({ page }, info) => {
    await prepare(page, condition, 'pressure-system')
    await openTask(page, 1)
    const map = page.locator('[data-catheter-map]').first()
    await expect(map).toBeVisible()
    const mapLabels = await map.locator('[data-map-labels] > span').evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          text: (node as HTMLElement).innerText.trim(),
          fontPx: Number.parseFloat(getComputedStyle(node).fontSize),
          box: node.getBoundingClientRect(),
        }))
        .map((label) => ({
          text: label.text,
          fontPx: label.fontPx,
          l: label.box.left,
          r: label.box.right,
          t: label.box.top,
          b: label.box.bottom,
        })),
    )
    for (const label of mapLabels) {
      // 12.8 px at 100 % root text (the report measured about 7.5 px on a phone).
      expect(label.fontPx).toBeGreaterThanOrEqual(condition.rootText === 200 ? 25 : 12.7)
    }
    const collisions: string[][] = []
    for (let i = 0; i < mapLabels.length; i += 1) {
      for (let j = i + 1; j < mapLabels.length; j += 1) {
        const a = mapLabels[i]
        const b = mapLabels[j]
        if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5)
          collisions.push([a.text, b.text])
      }
    }
    if (condition.rootText === 100) expect(collisions).toEqual([])
    await expect(map.locator('[data-map-abbreviations]')).toContainText('SVC, superior vena cava')
    expect(await ownOverflow(map)).toBeLessThanOrEqual(1)
    await map.screenshot({ path: info.outputPath('catheter-map.png') })

    await page.goto('/en/icu-hemodynamics/learn?activity=why-measure')
    const schematic = page.locator('[data-pac-component-schematic]')
    await expect(schematic).toBeVisible()
    if (condition.rootText === 200)
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
    const marks = await schematic.locator('[data-pac-part-mark]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect()
        return {
          l: r.left,
          r: r.right,
          t: r.top,
          b: r.bottom,
          fontPx: Number.parseFloat(getComputedStyle(node).fontSize),
        }
      }),
    )
    expect(marks).toHaveLength(4)
    if (condition.rootText === 100) {
      for (let i = 0; i < marks.length; i += 1) {
        for (let j = i + 1; j < marks.length; j += 1) {
          const a = marks[i]
          const b = marks[j]
          expect(
            a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b,
            `part marks ${i + 1} and ${j + 1} overlap`,
          ).toBe(false)
        }
      }
    }
    await expect(page.locator('[data-now-card], [data-teaching-panel]').first()).toContainText(
      'pulmonary artery catheter (PAC)',
    )
    await expect(schematic).toContainText('gives no distances')
    const contrast = await lowestContrast(schematic)
    expect(contrast.ratio, `contrast of ${JSON.stringify(contrast.text)}`).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(await ownOverflow(schematic)).toBeLessThanOrEqual(1)
    await record(info, 'labels', { mapLabels, collisions, marks, contrast })
    await schematic.screenshot({ path: info.outputPath('pac-schematic.png') })
  })
}

for (const theme of ['dark', 'light'] as const) {
  test(`the troubleshooting atlas is reachable from Learn and readable — 1204×987, ${theme}`, async ({
    page,
  }, info) => {
    await prepare(page, { width: 1204, height: 987, theme, rootText: 100 }, 'pressure-system')
    await openTask(page, 9)
    const atlas = page.locator('[data-learn-troubleshooting-atlas]').first()
    await atlas.scrollIntoViewIfNeeded()
    const summary = atlas.locator('summary')
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(atlas.getByRole('tablist', { name: 'PA catheter signal problems' })).toBeVisible()
    // A reference here, not a control: it cannot change this lesson's patient.
    await expect(atlas.getByRole('button', { name: /live monitor/i })).toHaveCount(0)
    await atlas.getByRole('tab', { name: 'Underdamped' }).click()
    await expect(atlas.getByText('Falsely high').first()).toBeVisible()
    const figures = atlas.locator('[data-artifact-figure]')
    await expect(figures).toHaveCount(2)
    const check = await figures.evaluateAll((nodes) =>
      nodes.map((node) => ({
        textInSvg: node.querySelectorAll('svg text').length,
        tickPx: Number.parseFloat(
          getComputedStyle(node.querySelector('[class*="tick"]')!).fontSize,
        ),
        clipped: node.querySelector('path[clip-path]') !== null,
      })),
    )
    for (const figure of check) {
      expect(figure.textInSvg).toBe(0)
      expect(figure.tickPx).toBeGreaterThanOrEqual(11.9)
      expect(figure.clipped).toBe(true)
    }
    const contrast = await lowestContrast(atlas)
    expect(contrast.ratio, `contrast of ${JSON.stringify(contrast.text)}`).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(await ownOverflow(atlas)).toBeLessThanOrEqual(1)
    await record(info, 'atlas', { check, contrast })
    await atlas.screenshot({ path: info.outputPath('learn-atlas.png') })
  })
}

test('the 3D course names its convention and offers chamber names by keyboard — 1204×987, dark', async ({
  page,
}, info) => {
  await prepare(
    page,
    { width: 1204, height: 987, theme: 'dark', rootText: 100 },
    'catheter-advancement',
  )
  await openTask(page, 2)
  const figure = page.locator('[data-heart-figure]').first()
  await expect(figure).toBeVisible()
  await expect(figure.locator('[data-heart-legend]')).toContainText(
    'see-through drawing convention',
  )
  await expect(figure.locator('[data-heart-legend]')).toContainText('bright dot at the tip')
  // The status is page text beneath the view, at a size that can be read.
  const status = figure.locator('[data-heart-status]')
  const statusPx = await status
    .locator('span')
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))
  expect(statusPx).toBeGreaterThanOrEqual(13)
  const canvas = figure.locator('canvas')
  if (await canvas.count()) {
    const canvasBox = await canvas.boundingBox()
    const statusBox = await status.boundingBox()
    expect(statusBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height - 1)
    const toggle = figure.locator('[data-heart-names-toggle]')
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(figure.locator('[data-heart-stop-name]')).toHaveCount(4)
    const names = await figure.locator('[data-heart-stop-name]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: node.textContent,
        width: node.getBoundingClientRect().width,
      })),
    )
    // Not collapsed to a letter per line.
    for (const name of names) expect(name.width).toBeGreaterThan(60)
    await record(info, 'names', names)
  }
  await figure.screenshot({ path: info.outputPath('heart.png') })
})

/* ------------------------------------------------------------------ *
 * The capstone monitor and Practice
 * ------------------------------------------------------------------ */

for (const condition of MATRIX.filter((c) => c.rootText === 100)) {
  test(`capstone monitor keeps its tags off the traces and its channels aligned — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await prepare(page, condition, 'pac-signal-validation')
    await openTask(page, 1)
    const monitor = page.locator(
      'section[aria-label="Vendor-neutral simulated ICU bedside monitor"]',
    )
    await expect(monitor).toBeVisible()
    await page.waitForTimeout(1200)
    const strips = await monitor.locator('[data-waveform-strip]').evaluateAll((figures) =>
      figures.map((figure) => {
        const plot = figure.querySelector('[data-strip-plot]')!.getBoundingClientRect()
        const labels = [
          ...figure.querySelectorAll(
            '[data-strip-axis] span, [data-strip-tag], [data-strip-marker]',
          ),
        ]
          .filter((node) => (node as HTMLElement).offsetParent !== null)
          .map((node) => ({ text: node.textContent, box: node.getBoundingClientRect() }))
        return {
          channel: figure.getAttribute('data-waveform-strip'),
          left: plot.left,
          right: plot.right,
          insidePlot: labels
            .filter(
              ({ box }) =>
                box.left < plot.right - 0.5 &&
                box.right > plot.left + 0.5 &&
                box.top < plot.bottom - 0.5 &&
                box.bottom > plot.top + 0.5,
            )
            .map((label) => label.text),
          textInSvg: figure.querySelectorAll('svg text').length,
        }
      }),
    )
    expect(strips.map((strip) => strip.channel)).toEqual([
      'ecgMv',
      'artMmHg',
      'cvpMmHg',
      'pcwpMmHg',
      'pleth',
    ])
    for (const strip of strips) {
      expect(strip.textInSvg).toBe(0)
      expect(strip.insidePlot, `labels over the ${strip.channel} trace`).toEqual([])
      // Every channel's plot starts and ends at the same place: one instant is one vertical line.
      expect(Math.abs(strip.left - strips[0].left)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(strip.right - strips[0].right)).toBeLessThanOrEqual(0.5)
    }
    const rail = page.getByRole('group', { name: 'Mixed venous oxygen saturation' })
    await expect(rail).toContainText('tip in an occluding position')
    await expect(rail).not.toContainText('before PA')
    await expect(rail.locator('strong')).toHaveText('—')
    expect(await monitor.innerText()).not.toMatch(/(^|[^\d.])-0(?![.\d])/)
    expect(await ownOverflow(monitor)).toBeLessThanOrEqual(1)
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'strips', strips)
    await monitor.screenshot({ path: info.outputPath('capstone-monitor.png') })
  })
}

for (const condition of MATRIX.filter(
  (c) => c.rootText === 100 && (c.width === 1204 || c.width === 390),
)) {
  test(`Practice returns to its actions without resetting the case — ${tag(condition)}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/en/icu-hemodynamics/practice')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eight practice cases')
    expect(await page.locator('main').count()).toBe(1)
    expect(await page.locator('main main').count()).toBe(0)
    await page.setViewportSize({ width: condition.width, height: condition.height })
    await page.goto('/en/icu-hemodynamics/practice?case=HD-01')
    const smallScreen = page.getByRole('button', { name: /Continue on this device/i })
    if (await smallScreen.count()) await smallScreen.click()
    const checkpoints = page.getByRole('navigation', { name: 'Case checkpoints' })
    await expect(checkpoints).toBeVisible({ timeout: 90_000 })
    expect(await page.locator('main main').count()).toBe(0)
    // In view without opening anything.
    expect(await checkpoints.evaluate((nav) => nav.closest('details') === null)).toBe(true)
    await expect(checkpoints.getByRole('button')).toHaveCount(6)
    await expect(page.locator('[data-zero-expectation]')).toContainText('ZERO REQUIRED')

    await checkpoints.getByRole('button', { name: /Choose an action/ }).click()
    const legRaise = page.locator('[data-intervention]').filter({ hasText: 'PLR' }).first()
    await legRaise.click()
    await expect(legRaise).toBeDisabled()
    await page.getByRole('button', { name: 'Observe the modeled response' }).click()
    await expect(checkpoints.getByRole('button', { name: /Compare the response/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await page.getByRole('button', { name: 'Observe 15 model seconds' }).click()
    const clock = async () =>
      Number.parseFloat((await page.locator('header time').first().innerText()).replace(' s', ''))
    const observedAt = await clock()

    const back = page.locator('[data-return-to-actions]')
    await back.focus()
    await expect(back).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(checkpoints.getByRole('button', { name: /Choose an action/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    // The same patient: the spent action is still spent and the model clock never went back.
    await expect(
      page.locator('[data-intervention]').filter({ hasText: 'PLR' }).first(),
    ).toBeDisabled()
    expect(await clock()).toBeGreaterThanOrEqual(observedAt)
    await expect(
      page.locator('[data-intervention]').filter({ hasText: 'Fluid' }).first(),
    ).toBeEnabled()
    expect(await page.locator('body').innerText()).not.toMatch(/(^|[^\d.])-0(?![.\d])/)
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath('practice-actions.png'), fullPage: true })
  })
}

/* ------------------------------------------------------------------ *
 * Light cards inside the dark stage (the HD-02 contrast carry-forward)
 * ------------------------------------------------------------------ */

/** Contrast of one control's own text against its own field, with any opacity applied. */
async function controlContrast(control: Locator) {
  return control.evaluate((element) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number)
    const luminance = (color: number[]) => {
      const [r, g, b] = color.slice(0, 3).map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return r * 0.2126 + g * 0.7152 + b * 0.0722
    }
    const mix = (front: number[], back: number[], alpha: number) =>
      front.slice(0, 3).map((channel, index) => channel * alpha + back[index] * (1 - alpha))
    const opaque = (start: Element | null) => {
      let node = start
      while (node && (rgb(getComputedStyle(node).backgroundColor)[3] ?? 1) === 0) {
        node = node.parentElement
      }
      return rgb(getComputedStyle(node ?? document.body).backgroundColor)
    }
    const style = getComputedStyle(element)
    const opacity = Number(style.opacity)
    const field = mix(opaque(element), opaque(element.parentElement), opacity)
    const text = mix(rgb(style.color), field, opacity)
    return (
      (Math.max(luminance(text), luminance(field)) + 0.05) /
      (Math.min(luminance(text), luminance(field)) + 0.05)
    )
  })
}

for (const theme of ['dark', 'light'] as const) {
  test(`thermodilution review controls can be read before and after they are available — 1204×987, ${theme}`, async ({
    page,
  }, info) => {
    await prepare(page, { width: 1204, height: 987, theme, rootText: 100 }, 'thermodilution-series')
    await openTask(page, 3)
    const card = page.locator('[class*="thermoTrialCard"]').first()
    await expect(card).toBeVisible()
    const reason = card.getByLabel('Technical reason for excluding this trial')
    const accept = card.getByRole('button', { name: 'Accept into the series' })
    const exclude = card.getByRole('button', { name: 'Exclude with this reason' })
    // Not yet available: still legible. It was 1.1:1 (the reason list) and 2.4:1 (the buttons).
    await expect(reason).toBeDisabled()
    const before = {
      reason: await controlContrast(reason),
      accept: await controlContrast(accept),
      exclude: await controlContrast(exclude),
    }
    for (const ratio of Object.values(before)) expect(ratio).toBeGreaterThanOrEqual(4.5)
    await card.screenshot({ path: info.outputPath('trial-before-review.png') })

    await card.getByRole('button', { name: /Review this curve/ }).click()
    await expect(accept).toBeEnabled()
    const after = { accept: await controlContrast(accept), reason: await controlContrast(reason) }
    for (const ratio of Object.values(after)) expect(ratio).toBeGreaterThanOrEqual(4.5)
    const contrast = await lowestContrast(card)
    expect(contrast.ratio, `contrast of ${JSON.stringify(contrast.text)}`).toBeGreaterThanOrEqual(
      4.5,
    )

    // The prolonged-injection trial says what its curve does not draw; the others say nothing.
    const notes = page.locator('[data-trial-curve-model-note]')
    await expect(notes).toHaveCount(1)
    await expect(notes).toContainText('does not add a second peak or a notch')
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    await record(info, 'contrast', { before, after, lowest: contrast })
    await card.screenshot({ path: info.outputPath('trial-after-review.png') })
  })
}
