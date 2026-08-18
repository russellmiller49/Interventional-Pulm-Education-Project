import { render } from '@testing-library/react'

import {
  ECMO_MINIMAP_COMPACT_BELOW_PX,
  EcmoCircuitMinimap,
  ecmoMinimapLayoutForWidth,
  type EcmoCircuitMinimapLayoutId,
} from '../components/teaching/EcmoCircuitMinimap'
import {
  ecmoCircuitMapTextEquivalent,
  ecmoMapSensorSiteIds,
  type EcmoCircuitPresentation,
} from '../content/circuitPresentation'
import { ecmoCircuitSegmentIds } from '../content/circuitSegments'
import { ecmoLocalizationRow, ecmoLocalizationRowIds } from '../content/localizationCards'

/**
 * Two geometries, one circuit.
 *
 * The landscape drawing rendered its labels at 5.7 CSS pixels at the 280px pane floor, measured in
 * a browser — legible only in the caption and the text equivalent, which is not what a map is for.
 * The fix is a second geometry rather than a second drawing, and the risk a second geometry carries
 * is drift: two pictures that gradually stop describing the same circuit.
 *
 * So everything below is about coupling. Screen-space type size and overlap are measured in a real
 * browser and recorded in the implementation record; jsdom reports every box as zero and cannot
 * prove either. What it *can* prove is that the two layouts resolve the same registries, the same
 * sensor sites, the same implicated set, the same accessible name and the same words.
 */

const LAYOUTS: readonly EcmoCircuitMinimapLayoutId[] = ['regular', 'compact']

const PRESENTATIONS: readonly EcmoCircuitPresentation[] = [
  { kind: 'neutral' },
  { kind: 'scaffold', emphasis: 'path-order' },
  { kind: 'scaffold', emphasis: 'sensor-sites' },
  { kind: 'scaffold', emphasis: 'pressure-zones' },
  ...ecmoLocalizationRowIds.map((rowId) => ({ kind: 'implicated', rowId }) as const),
]

function attrs(container: HTMLElement, selector: string, attribute: string): string[] {
  return [...container.querySelectorAll(selector)].map((node) => node.getAttribute(attribute) ?? '')
}

describe('circuit minimap layout selection', () => {
  it('chooses the compact geometry at the supported teaching-pane floor', () => {
    /*
     * The pane floor is 280px and the panel spends 34 of that on padding and border, so the drawing
     * gets about 246px. The landscape geometry cannot hold twelve-pixel type until roughly 436px,
     * and the width compared here is the drawing's, not the panel's — measuring the panel added its
     * padding to every reading and chose landscape for drawings too narrow to carry it.
     */
    expect(ecmoMinimapLayoutForWidth(246)).toBe('compact')
    expect(ecmoMinimapLayoutForWidth(280)).toBe('compact')
    expect(ecmoMinimapLayoutForWidth(400)).toBe('compact')
    expect(ecmoMinimapLayoutForWidth(ECMO_MINIMAP_COMPACT_BELOW_PX - 1)).toBe('compact')
    expect(ecmoMinimapLayoutForWidth(ECMO_MINIMAP_COMPACT_BELOW_PX)).toBe('regular')
    expect(ecmoMinimapLayoutForWidth(700)).toBe('regular')
  })

  it('falls back to the landscape geometry when nothing has been measured yet', () => {
    // Server rendering and jsdom both reach here: a zero width is "unknown", not "narrow".
    expect(ecmoMinimapLayoutForWidth(0)).toBe('regular')
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={{ kind: 'neutral' }} />,
    )
    expect(container.querySelector('[data-map-layout]')?.getAttribute('data-map-layout')).toBe(
      'regular',
    )
  })

  it.each(LAYOUTS)('renders %s when the layout is named', (layout) => {
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={{ kind: 'neutral' }} layout={layout} />,
    )
    expect(container.querySelector('[data-circuit-minimap]')?.getAttribute('data-map-layout')).toBe(
      layout,
    )
  })
})

describe('circuit minimap variants stay coupled', () => {
  it.each(PRESENTATIONS.map((p) => [JSON.stringify(p), p] as const))(
    'draws the same circuit in both geometries for %s',
    (_label, presentation) => {
      const views = LAYOUTS.map((layout) => {
        const { container } = render(
          <EcmoCircuitMinimap supportMode="vv" presentation={presentation} layout={layout} />,
        )
        return { layout, container }
      })

      const [regular, compact] = views

      // Every segment the registry declares, once, in both.
      for (const view of views) {
        const drawn = attrs(view.container, '[data-map-segment]', 'data-map-segment')
        expect([...drawn].sort()).toEqual([...ecmoCircuitSegmentIds].sort())
        expect(new Set(drawn).size).toBe(drawn.length)
      }

      // The same sensor sites, in the same order, and the order the presentation asked for.
      const expectedSites = [...ecmoMapSensorSiteIds(presentation)]
      for (const view of views) {
        expect(attrs(view.container, '[data-map-sensor-site]', 'data-map-sensor-site')).toEqual(
          expectedSites,
        )
      }

      // The same implicated set.
      const implicatedOf = (c: HTMLElement) =>
        attrs(c, '[data-circuit-implicated="true"]', 'data-map-segment')
      expect(implicatedOf(compact.container)).toEqual(implicatedOf(regular.container))

      // The same words, and the same accessible name.
      const equivalent = ecmoCircuitMapTextEquivalent('vv', presentation)
      for (const view of views) {
        expect(view.container.querySelector('[data-text-equivalent]')?.textContent).toBe(equivalent)
      }
      expect(compact.container.querySelector('title')?.textContent).toBe(
        regular.container.querySelector('title')?.textContent,
      )

      // The same state, declared the same way.
      for (const view of views) {
        const root = view.container.querySelector('[data-circuit-minimap]')
        expect(root?.getAttribute('data-presentation')).toBe(presentation.kind)
        expect(root?.getAttribute('data-implicated-row')).toBe(
          presentation.kind === 'implicated' ? presentation.rowId : null,
        )
      }
    },
  )

  it.each(LAYOUTS)('%s marks exactly the segments the revealed row implicates', (layout) => {
    for (const rowId of ecmoLocalizationRowIds) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap
          supportMode="vv"
          presentation={{ kind: 'implicated', rowId }}
          layout={layout}
        />,
      )
      expect(attrs(container, '[data-circuit-implicated="true"]', 'data-map-segment')).toEqual([
        ...ecmoLocalizationRow(rowId).implicatedSegmentIds,
      ])
      unmount()
    }
  })

  it.each(LAYOUTS)('%s stays neutral until a row is revealed', (layout) => {
    for (const presentation of PRESENTATIONS.filter((p) => p.kind !== 'implicated')) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode="vv" presentation={presentation} layout={layout} />,
      )
      expect(container.querySelector('[data-circuit-implicated]')).toBeNull()
      expect(container.querySelector('[data-implicated-caption]')).toBeNull()
      expect(container.querySelector('[data-implicated-marker]')).toBeNull()
      unmount()
    }
  })

  it.each(LAYOUTS)('%s renders the track its own registry names', (layout) => {
    for (const [mode, expected] of [
      ['vv', 'Venous return'],
      ['va', 'Arterial return'],
    ] as const) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap
          supportMode={mode}
          presentation={{ kind: 'neutral' }}
          layout={layout}
        />,
      )
      expect(container.textContent).toContain(expected)
      unmount()
    }
  })
})

describe('circuit minimap geometry stays inside its own canvas', () => {
  /*
   * jsdom lays nothing out, so bounds are checked against the declared viewBox arithmetic rather
   * than rendered boxes. The browser measurements that prove the rendered result are in the
   * implementation record; this is the check that fails the moment a coordinate is edited past the
   * edge — which is how the sweep-gas chip's implicated outline was lost the first time.
   */
  it.each(LAYOUTS)('%s keeps every shape and label within the viewBox', (layout) => {
    for (const rowId of ecmoLocalizationRowIds) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap
          supportMode="vv"
          presentation={{ kind: 'implicated', rowId }}
          layout={layout}
        />,
      )
      const svg = container.querySelector('svg')
      const [, , vbW, vbH] = (svg?.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number)
      expect(vbW).toBeGreaterThan(0)

      for (const rect of svg?.querySelectorAll('rect') ?? []) {
        const x = Number(rect.getAttribute('x'))
        const y = Number(rect.getAttribute('y'))
        const w = Number(rect.getAttribute('width'))
        const h = Number(rect.getAttribute('height'))
        if ([x, y, w, h].some(Number.isNaN)) continue
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(vbW)
        expect(y + h).toBeLessThanOrEqual(vbH)
      }

      for (const text of svg?.querySelectorAll('text') ?? []) {
        const x = Number(text.getAttribute('x'))
        const y = Number(text.getAttribute('y'))
        if (Number.isNaN(x) || Number.isNaN(y)) continue
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(vbW)
        expect(y).toBeLessThanOrEqual(vbH)
      }
      unmount()
    }
  })

  it.each(LAYOUTS)('%s names each segment and site once, with no duplicate ids', (layout) => {
    const { container } = render(
      <EcmoCircuitMinimap
        supportMode="vv"
        presentation={{ kind: 'scaffold', emphasis: 'sensor-sites' }}
        layout={layout}
      />,
    )
    const segments = attrs(container, '[data-map-segment]', 'data-map-segment')
    const sites = attrs(container, '[data-map-sensor-site]', 'data-map-sensor-site')
    expect(new Set(segments).size).toBe(segments.length)
    expect(new Set(sites).size).toBe(sites.length)

    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)

    // A label drawn twice would read as two places on one circuit.
    const labels = [...(container.querySelector('svg')?.querySelectorAll('text') ?? [])].map((t) =>
      t.textContent?.trim(),
    )
    expect(new Set(labels).size).toBe(labels.length)
  })

  it.each(LAYOUTS)('%s reads as sentences in its accessible name', (layout) => {
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={{ kind: 'neutral' }} layout={layout} />,
    )
    const svg = container.querySelector('svg')
    const title = svg?.querySelector('title')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-labelledby')).toBe(title?.getAttribute('id'))
    const text = title?.textContent ?? ''
    // A full stop immediately followed by a word is the join bug this caught once already.
    expect(text).not.toMatch(/\.\S/)
    expect(text).toMatch(/Venovenous circuit map\. The blood path/)
  })

  it.each(LAYOUTS)('%s adds no scroller and no keyboard stop', (layout) => {
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={{ kind: 'neutral' }} layout={layout} />,
    )
    expect(container.querySelector('.overflow-x-auto')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
    expect(container.querySelector('button, a, input, select')).toBeNull()
    expect(container.querySelectorAll('animate, animateTransform, animateMotion')).toHaveLength(0)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('w-full')
    expect(svg?.getAttribute('class')).not.toContain('min-w')
  })

  it.each(LAYOUTS)('%s paints nothing with a colour of its own', (layout) => {
    const { container } = render(
      <EcmoCircuitMinimap
        supportMode="va"
        presentation={{ kind: 'implicated', rowId: 'gas-path-failure' }}
        layout={layout}
      />,
    )
    const svg = container.querySelector('svg')
    for (const node of svg?.querySelectorAll('*') ?? []) {
      for (const attribute of ['stroke', 'fill']) {
        const value = node.getAttribute(attribute)
        if (value === null) continue
        expect(['currentColor', 'none']).toContain(value)
      }
    }
    expect(svg?.innerHTML).not.toMatch(/style=/)
  })

  it.each(LAYOUTS)('%s carries the implication in weight, texture and a marker', (layout) => {
    const { container } = render(
      <EcmoCircuitMinimap
        supportMode="vv"
        presentation={{ kind: 'implicated', rowId: 'drainage-limitation' }}
        layout={layout}
      />,
    )
    const marked = container.querySelector('[data-map-segment="drainage"]')
    expect(marked?.querySelector('[data-implicated-texture]')).not.toBeNull()
    expect(marked?.querySelector('[data-implicated-marker]')).not.toBeNull()
    const heavy = Number(marked?.querySelector('path')?.getAttribute('stroke-width'))
    const plain = Number(
      container.querySelector('[data-map-segment="pump"] circle')?.getAttribute('stroke-width'),
    )
    expect(heavy).toBeGreaterThan(plain)
  })
})
