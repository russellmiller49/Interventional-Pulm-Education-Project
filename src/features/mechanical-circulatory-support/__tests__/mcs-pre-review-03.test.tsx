/**
 * MCS-PRE-REVIEW-03 — visual workbench and accessibility, the repaired contracts.
 *
 * Every import here exists on the authorized base (`41a34608`), so this file runs there and each
 * repaired mechanism fails by name rather than by a missing module. Contracts are about what a
 * learner can read and reach — a value's units, where a label sits, whether a trace is inside its
 * plot, whether the thing a step points at is open — not about pixels. Layout that only a browser
 * can measure (overlap, reflow, focus under chrome) is held by `e2e/mcs-pre-review-03.spec.ts`.
 *
 * Nothing here is clinical approval, and no model value is asserted to have changed.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { CirculationMap } from '../components/circulation-map/CirculationMap'
import {
  CIRCULATION_MAP_PATHWAYS,
  circulationMapSegment,
} from '../components/circulation-map/circulationMapGeometry'
import { McsCaseWorkflow } from '../components/McsCaseWorkflow'
import { McsMonitor } from '../components/McsMonitor'
import { McsCirculationSketch } from '../components/stage/McsPathwayTour'
import { McsPumpCutaway } from '../components/stage/McsPumpCutaway'
import { McsUnloadingComparison } from '../components/stage/McsUnloadingComparison'
import { IabpEfficacyLimitsPanel } from '../components/teaching/IabpEfficacyLimitsPanel'
import { mcsComparisonPathways } from '../components/teaching/selectors'
import { PathwayGraphic } from '../components/teaching/shared'
import { allMcsScenarios, mcsScenarioById } from '../content/scenarios'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { createInitialMcsState, mcsReducer } from '../engine'
import type { McsSimulationState, McsTrendSample } from '../engine/types'
import {
  currentStepId,
  mountSection,
  nowCard,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

const featureRoot = join(__dirname, '..')
const css = (path: string) => readFileSync(join(featureRoot, path), 'utf8')

function settle(state: McsSimulationState, seconds = 8): McsSimulationState {
  let next = state
  for (let step = 0; step < seconds * 5; step += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  }
  return next
}

/** Every coordinate pair in an SVG path written with M/L commands, comma- or space-separated. */
function pathPoints(d: string | null): { x: number; y: number }[] {
  return [...(d ?? '').matchAll(/[ML]\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }))
}

function viewBoxHeight(svg: Element): number {
  return Number((svg.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/)[3])
}

function luminance(hex: string): number {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(foreground: string, background: string): number {
  const [a, b] = [luminance(foreground), luminance(background)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** The body of the first rule in a stylesheet whose selector matches exactly. */
function ruleBody(sheet: string, selector: string): string {
  const start = sheet.indexOf(`${selector} {`)
  if (start < 0) return ''
  return sheet.slice(start, sheet.indexOf('}', start))
}

/* ------------------------------------------------------------------ *
 * F03 — task, control, evidence
 * ------------------------------------------------------------------ */

describe('F03 · what a step asks, where its control is, and where its evidence is', () => {
  it('puts a Continue ahead of the step body, doing what the Continue at its foot does', () => {
    mountSection('mcs-foundations-signals')
    const heading = within(nowCard()).getAllByRole('heading')[0]
    const continues = screen
      .getAllByRole('button')
      .filter((button) => /^Continue\b/.test(button.textContent ?? ''))
    expect(continues.length).toBeGreaterThanOrEqual(2)
    const first = continues[0]
    // The first Continue in reading order is above the step's own heading, not under its body.
    expect(first.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const before = currentStepId()
    fireEvent.click(first)
    expect(currentStepId()).not.toBe(before)
  })

  it('keeps the run identity and simulated time in view and moves the seed into a disclosure', () => {
    mountSection('mcs-foundations-signals')
    const identity = document.querySelector('[data-session-identity]')?.textContent ?? ''
    expect(identity).toMatch(/Guided reference/)
    expect(identity).toMatch(/simulated seconds/)
    expect(identity).not.toMatch(/seed \d+/i)
    const seedHolder = [...document.querySelectorAll('details')].find((details) =>
      /Seed \d+/.test(details.textContent ?? ''),
    )
    expect(seedHolder).toBeDefined()
    expect(seedHolder?.open).toBe(false)
  })

  it.each([
    ['iabp-efficacy-limits', 'predict'],
    ['lvad-alarms-emergencies', 'recognize'],
    ['mcs-device-selection-integration', 'recognize'],
  ] as const)(
    '%s at %s: the step says "Look here" at the monitor, and the monitor is open',
    (sectionId, phase) => {
      mountSection(sectionId, phase)
      const lookHere = [...document.querySelectorAll('p')].filter((p) =>
        /^Look here:/.test(p.textContent ?? ''),
      )
      expect(lookHere.length).toBeGreaterThan(0)
      const monitor = screen.getByRole('region', {
        name: /Synchronized mechanical-support bedside monitor/,
      })
      const disclosure = monitor.closest('details')
      // Either the monitor is not behind a disclosure at all, or that disclosure is open.
      expect(disclosure === null || disclosure.open).toBe(true)
    },
  )

  it('keeps the monitor closed on a step whose words point elsewhere', () => {
    mountSection('mcs-foundations-signals')
    const monitor = screen.getByRole('region', {
      name: /Synchronized mechanical-support bedside monitor/,
    })
    expect(monitor.closest('details')?.open).toBe(false)
  })

  it('draws one circulation, not two, on the step read beside the circulation map', () => {
    mountSection('mcs-foundations-signals')
    const card = nowCard()
    expect(card.querySelector('[data-circulation-map]')).not.toBeNull()
    const sketches = [...card.querySelectorAll('svg[role="img"]')].filter((svg) =>
      /^Conceptual circulation/.test(svg.getAttribute('aria-label') ?? ''),
    )
    expect(sketches).toHaveLength(0)
  })

  it('numbers the places a section lights, in words and on the map', () => {
    mountSection('mcs-foundations-signals')
    const caption = document.querySelector('[data-map-emphasis-caption]')?.textContent ?? ''
    expect(caption).toMatch(/1\. The descending aorta and the body/)
    expect(caption).toMatch(/2\. Venous return and the right atrium/)
    expect(document.querySelectorAll('[data-map-stop-marker]')).toHaveLength(2)
  })
})

/* ------------------------------------------------------------------ *
 * F04 / F34 — the monitor
 * ------------------------------------------------------------------ */

describe('F04 / F34 · the monitor draws its values where they can be read', () => {
  const impella = settle(createInitialMcsState('practice', 'impella'))

  it('never multiplies a flow to fit a pressure axis, and keeps every trend line inside its plot', () => {
    const view = render(<McsMonitor state={impella} />)
    expect(view.container.textContent).not.toMatch(/×\s?16/)
    const trend = screen.getByRole('img', { name: /Trend of MAP/i })
    const height = viewBoxHeight(trend)
    const points = [...trend.querySelectorAll('[data-series]')].flatMap((path) =>
      pathPoints(path.getAttribute('d')),
    )
    expect(points.length).toBeGreaterThan(0)
    // The right pump is off here, a flow of zero; it was drawn below the plot and over the
    // caption under it (F34). Every point must be inside the drawing.
    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(height)
    }
  })

  it('keeps the shared accessibility contract for its trend lines and has no axe violations', async () => {
    // The same assertions the shared critical-care accessibility suite makes of this monitor; that
    // suite stops earlier on a pre-existing CRRT failure and never reaches them, so they are held
    // here too.
    const view = render(<McsMonitor state={createInitialMcsState('practice', 'impella')} />)
    const trend = screen.getByRole('img', {
      name: /Trend of MAP, effective systemic flow, left pump flow, and right pump flow/i,
    })
    expect(trend.querySelector('[data-series="map"]')).not.toHaveAttribute('stroke-dasharray')
    expect(trend.querySelector('[data-series="effective-flow"]')).toHaveAttribute(
      'stroke-dasharray',
      '12 3',
    )
    expect(trend.querySelector('[data-series="left-pump"]')).toHaveAttribute(
      'stroke-dasharray',
      '6 5',
    )
    expect(trend.querySelector('[data-series="right-pump"]')).toHaveAttribute(
      'stroke-dasharray',
      '3 4',
    )
    expect(await axe(view.container)).toHaveNoViolations()
  })

  it('labels the PV display’s axes with their units and says what the loop is', () => {
    render(<McsMonitor state={impella} />)
    const pv = screen.getByRole('img', { name: /pressure-volume loop/i })
    expect(pv.getAttribute('aria-label')).toMatch(/not a calibrated clinical PV loop/)
    expect(pv.textContent).toMatch(/LV volume \(mL\)/)
    expect(pv.textContent).toMatch(/LV pressure \(mm Hg\)/)
  })

  it('draws every modeled QRS at one height — the model varies none of them', () => {
    render(<McsMonitor state={settle(createInitialMcsState('learn', 'iabp'))} />)
    const ecg = screen.getByRole('img', { name: /ECG II waveform/i })
    const trace = [...ecg.querySelectorAll('path')].at(-1)
    const points = pathPoints(trace?.getAttribute('d') ?? null)
    // 0.6 mV on the strip's fixed −0.3 to 1.3 mV scale, in the 92-unit-high viewBox.
    const threshold = 92 - ((0.6 + 0.3) / 1.6) * 92
    const peaks: number[] = []
    let current: number | null = null
    for (const point of points) {
      if (point.y < threshold) current = current === null ? point.y : Math.min(current, point.y)
      else if (current !== null) {
        peaks.push(current)
        current = null
      }
    }
    expect(peaks.length).toBeGreaterThanOrEqual(4)
    // Sample-to-sample drawing put the 50 Hz samples at a different point on each 9 ms spike.
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeLessThan(1)
  })

  it('keeps the strip captions and the guide notes at 4.5:1 on the monitor', () => {
    const sheet = css('components/mechanical-circulatory-support.module.css')
    const strip = ruleBody(sheet, '.waveStrip span small').match(/color: (#[0-9a-f]{6})/i)?.[1]
    const guide = ruleBody(sheet, '.derivedValueGuide small').match(/color: (#[0-9a-f]{6})/i)?.[1]
    expect(contrast(strip ?? '#000000', '#06191f')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(guide ?? '#000000', '#0d3038')).toBeGreaterThanOrEqual(4.5)
  })
})

/* ------------------------------------------------------------------ *
 * F20 — pressure and flow on one time axis
 * ------------------------------------------------------------------ */

describe('F20 · pressure and flow are drawn on scales that do not exaggerate', () => {
  function withTrend(map: (index: number) => number, flow: (index: number) => number) {
    const base = settle(createInitialMcsState('learn', 'iabp'))
    const trends: McsTrendSample[] = Array.from({ length: 80 }, (_, index) => ({
      ...base.trends[base.trends.length - 1],
      time: base.timeSeconds - 20 + index * 0.25,
      mapMmHg: map(index),
      effectiveFlowLMin: flow(index),
    }))
    return { ...base, trends }
  }

  function trendSvg(container: HTMLElement): SVGSVGElement {
    const host = container.querySelector('[data-response-trend]')
    if (!host) throw new Error('No response trend')
    return (host.tagName.toLowerCase() === 'svg'
      ? host
      : host.querySelector('svg[role="img"]')) as unknown as SVGSVGElement
  }

  const contract = mcsSectionLearningContractById.get('iabp-efficacy-limits')!

  it('draws a 7 mm Hg wobble as a small wobble, not as swings across the figure', () => {
    const state = withTrend(
      (index) => 71 + (index % 8 < 4 ? 7 : 0),
      () => 4.5,
    )
    const view = render(
      <IabpEfficacyLimitsPanel
        contract={contract}
        state={state}
        reveal="mechanism"
        beforeMetrics={null}
      />,
    )
    const svg = trendSvg(view.container)
    const map = svg.querySelector('[data-series="map"], [data-trend-line="map"]')
    const ys = pathPoints(map?.getAttribute('d') ?? null).map((point) => point.y)
    expect(ys.length).toBeGreaterThan(10)
    expect((Math.max(...ys) - Math.min(...ys)) / viewBoxHeight(svg)).toBeLessThan(0.25)
  })

  it('names each axis with its unit, separately, with values on it', () => {
    const view = render(
      <IabpEfficacyLimitsPanel
        contract={contract}
        state={withTrend(
          () => 76,
          () => 4.5,
        )}
        reveal="mechanism"
        beforeMetrics={null}
      />,
    )
    const texts = [...trendSvg(view.container).querySelectorAll('text')].map(
      (text) => text.textContent ?? '',
    )
    expect(texts.some((text) => /Pressure.*mm Hg/.test(text) && !/L\/min/.test(text))).toBe(true)
    expect(texts.some((text) => /Flow.*L\/min/.test(text) && !/mm Hg/.test(text))).toBe(true)
    expect(texts.filter((text) => /^\d+$/.test(text.trim())).length).toBeGreaterThanOrEqual(6)
  })

  it('draws a flat flow inside its plot, clear of the bottom edge, and prints its true value', () => {
    const view = render(
      <IabpEfficacyLimitsPanel
        contract={contract}
        state={withTrend(
          () => 76,
          () => 4.5,
        )}
        reveal="mechanism"
        beforeMetrics={null}
      />,
    )
    const svg = trendSvg(view.container)
    const flow = svg.querySelector(
      '[data-series="effective-flow"], [data-trend-line="effective-flow"]',
    )
    const ys = pathPoints(flow?.getAttribute('d') ?? null).map((point) => point.y)
    const frames = [...svg.querySelectorAll('rect')].map((rect) => ({
      top: Number(rect.getAttribute('y')),
      bottom: Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')),
    }))
    const panel = frames.find((frame) => ys[0] >= frame.top && ys[0] <= frame.bottom)
    expect(panel).toBeDefined()
    expect(panel!.bottom - ys[0]).toBeGreaterThan(4)
    expect(view.container.textContent).toMatch(/Effective systemic flow.*now 4\.5 L\/min/)
  })
})

/* ------------------------------------------------------------------ *
 * F05 — the circulation map
 * ------------------------------------------------------------------ */

describe('F05 · the circulation map draws no accidental shapes and no colliding labels', () => {
  it('lights a vessel with its outline only — an open polyline filled is a phantom wedge', () => {
    const { container } = render(
      <CirculationMap
        state={createInitialMcsState('learn', 'iabp')}
        emphasis={{
          segmentIds: ['pulmonary-artery', 'lungs'],
          caption: 'You are here: The right ventricle and the lung.',
          tone: 'you-are-here',
        }}
      />,
    )
    const vesselHalo = container.querySelector<SVGElement>(
      '[data-map-emphasis-target="pulmonary-artery"] > *',
    )
    const organHalo = container.querySelector<SVGElement>('[data-map-emphasis-target="lungs"] > *')
    expect(vesselHalo?.style.fill).toBe('none')
    expect(organHalo?.style.fill).not.toBe('none')
  })

  it.each([
    ['iabp', (state: McsSimulationState) => state],
    [
      'impella with the right pump',
      (state: McsSimulationState) =>
        mcsReducer(state, {
          type: 'SET_IMPELLA_CONFIGURATION',
          control: 'rightEnabled',
          value: true,
        }),
    ],
    ['lvad', (state: McsSimulationState) => state],
  ] as const)('%s: pathway words are in a key, not squeezed beside the loop', (name, build) => {
    const device = name.startsWith('impella') ? 'impella' : (name as 'iabp' | 'lvad')
    const { container } = render(
      <CirculationMap state={build(createInitialMcsState('learn', device))} />,
    )
    const svgText = [...container.querySelectorAll('svg text')]
      .map((text) => text.textContent)
      .join(' ')
    const drawn = [...container.querySelectorAll('[data-map-pathway]')].map((node) =>
      node.getAttribute('data-map-pathway'),
    )
    for (const id of drawn) {
      const label = CIRCULATION_MAP_PATHWAYS.find((pathway) => pathway.id === id)!.label
      const name = label.split(':')[0]
      expect(svgText).not.toContain(name)
      const outside = [...container.querySelectorAll('li')].find((item) =>
        (item.textContent ?? '').includes(name),
      )
      expect(outside).toBeDefined()
    }
  })

  it('keeps the "Descending aorta" label clear of the balloon it used to run into', () => {
    const label = circulationMapSegment('descending-aorta').labelAt
    const balloon = CIRCULATION_MAP_PATHWAYS.find((pathway) => pathway.id === 'iabp-balloon')!
    const balloonTop = balloon.componentAt.y - 36
    const balloonBottom = balloon.componentAt.y + 36
    const beside = label.y > balloonTop - 24 && label.y < balloonBottom + 24
    expect(beside).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * F12 / F22 / F23 — pathway drawings
 * ------------------------------------------------------------------ */

describe('F12 · the transvalvular and the durable pathways are drawn differently', () => {
  function paths(device: 'impella' | 'lvad') {
    const view = render(<McsCirculationSketch device={device} />)
    const svg = view.container.querySelector('svg[role="img"]')!
    const result = {
      d: new Set([...svg.querySelectorAll('path')].map((path) => path.getAttribute('d'))),
      label: svg.getAttribute('aria-label') ?? '',
    }
    view.unmount()
    return result
  }

  it('draws different geometry and says the same thing in words', () => {
    const impella = paths('impella')
    const lvad = paths('lvad')
    const onlyImpella = [...impella.d].filter((d) => !lvad.d.has(d))
    const onlyLvad = [...lvad.d].filter((d) => !impella.d.has(d))
    expect(onlyImpella.length).toBeGreaterThan(0)
    expect(onlyLvad.length).toBeGreaterThan(0)
    expect(impella.label).toMatch(/across the aortic valve/)
    expect(lvad.label).toMatch(/around the aortic valve/)
  })

  it('routes the durable pump beneath the boxes and the microaxial pump across the valve', () => {
    const lvad = render(<McsCirculationSketch device="lvad" />)
    const graft = lvad.container.querySelector('[data-sketch-part="durable-pump"] path')
    expect(pathPoints(graft?.getAttribute('d') ?? null).length + 1).toBeGreaterThan(1)
    expect(graft?.getAttribute('d')).toMatch(/V1[89]\d/)
    lvad.unmount()
    const impella = render(<McsCirculationSketch device="impella" />)
    const bar = impella.container.querySelector('[data-sketch-part="transvalvular-pump"] path')
    const [x1, x2] = (bar?.getAttribute('d')?.match(/M(\d+) \d+ H(\d+)/) ?? []).slice(1).map(Number)
    // The valve bars are at x 469–476: the pump starts inside the LV box and ends inside the aorta.
    expect(x1).toBeLessThan(465)
    expect(x2).toBeGreaterThan(480)
  })
})

describe('F22 · source, active component and destination are written in their boxes', () => {
  it.each(Object.entries(mcsComparisonPathways))('%s', (_name, pathway) => {
    const { container } = render(<PathwayGraphic pathway={pathway} />)
    for (const [role, text] of [
      ['source', pathway.source],
      ['active component', pathway.activeComponent],
      ['destination', pathway.destination],
    ] as const) {
      const roleLabel = [...container.querySelectorAll('*')].find(
        (element) =>
          element.children.length === 0 &&
          element.tagName.toLowerCase() !== 'dt' &&
          (element.textContent ?? '').trim().toLowerCase() === role,
      )
      expect(roleLabel).toBeDefined()
      expect(roleLabel!.parentElement!.textContent).toContain(text)
    }
  })
})

describe('F23 · the pump cutaway ties its labels to its parts and keeps its legend apart', () => {
  it('has no legend in a label slot, and a legend that names every line in words', () => {
    const { container } = render(<McsPumpCutaway />)
    const svgText = [...container.querySelectorAll('svg[role="img"] text')].map(
      (text) => text.textContent ?? '',
    )
    expect(svgText.some((text) => /Dashed:/.test(text))).toBe(false)
    const legend = [...container.querySelectorAll('ul li, dl div')].map(
      (item) => item.textContent ?? '',
    )
    expect(legend.some((text) => /pump/i.test(text))).toBe(true)
    expect(legend.some((text) => /blood flow/i.test(text))).toBe(true)
    expect(legend.some((text) => /inserted|insertion/i.test(text))).toBe(true)
  })

  it.each([
    ['inlet', { x: 250, y: 224 }],
    ['outlet', { x: 321, y: 51 }],
    ['valve', { x: 238, y: 119 }],
  ] as const)('the %s label has a leader line that ends on the part', (part, at) => {
    const { container } = render(<McsPumpCutaway />)
    const leader = container.querySelector(`[data-leader="${part}"]`)
    const end = pathPoints(leader?.getAttribute('d') ?? null).at(-1)
    expect(end).toBeDefined()
    expect(Math.hypot(end!.x - at.x, end!.y - at.y)).toBeLessThan(12)
  })
})

/* ------------------------------------------------------------------ *
 * F24 — unloading presentation (the numbers are Prompt 02's and do not move)
 * ------------------------------------------------------------------ */

describe('F24 · the unloading comparison keeps every value labelled when it stacks', () => {
  it('labels each value cell with its column and keeps the table semantics explicit', () => {
    const { container } = render(<McsUnloadingComparison />)
    const cells = [...container.querySelectorAll('tbody td')]
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) expect(cell.getAttribute('data-column-label')).toBeTruthy()
    for (const table of container.querySelectorAll('table'))
      expect(table.getAttribute('role')).toBe('table')
  })

  it('still says "No resolvable displayed change" for the P6 wedge and prints the P8 fall', () => {
    const { container } = render(<McsUnloadingComparison />)
    const filled = container.querySelector('[data-unloading-condition="filled"]')!
    expect(filled.querySelector('[data-unloading-delta="pcwpMmHg"]')?.textContent).toBe(
      'No resolvable displayed change',
    )
    fireEvent.click(screen.getByRole('button', { name: 'P8' }))
    expect(
      container.querySelector(
        '[data-unloading-condition="filled"] [data-unloading-delta="pcwpMmHg"]',
      )?.textContent,
    ).toBe('−1 mm Hg')
  })
})

/* ------------------------------------------------------------------ *
 * F31 / F33 — the case page
 * ------------------------------------------------------------------ */

function caseState(id: string): McsSimulationState {
  const scenario = mcsScenarioById.get(id)!
  return createInitialMcsState('practice', scenario.device, scenario, 417)
}

describe('F31 · the case page’s jump links are links, not orphan words', () => {
  it('names the group and each part, in a list', () => {
    render(<McsCaseWorkflow state={caseState('IABP-01')} dispatch={jest.fn()} />)
    const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#mcs-case-"]')]
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link.textContent?.[0]).toMatch(/[A-Z]/)
      expect(link.closest('li')).not.toBeNull()
    }
    const nav = links[0].closest('nav')
    expect(nav?.getAttribute('aria-label')).toBeTruthy()
  })
})

describe('F33 · the worked explanation uses the card’s width', () => {
  it.each(allMcsScenarios.map((scenario) => scenario.id))(
    '%s: teaching, conditions and this run sit in one grid of blocks',
    (id) => {
      const state = mcsReducer(caseState(id), { type: 'COMPLETE' })
      const { container } = render(<McsCaseWorkflow state={state} dispatch={jest.fn()} />)
      const panel = container.querySelector<HTMLElement>('[data-worked-explanation]')!
      const blocks = ['teaching', 'conditions', 'run'].map((block) =>
        panel.querySelector(`[data-debrief-${block}]`),
      )
      expect(blocks.every(Boolean)).toBe(true)
      const parent = blocks[0]!.parentElement
      expect(blocks.every((block) => block!.parentElement === parent)).toBe(true)
      // The model-condition contract and every condition's class are still printed (F33/01).
      expect(panel.querySelector('[data-condition-contract]')).not.toBeNull()
      expect(panel.querySelectorAll('[data-condition-class]').length).toBe(
        mcsScenarioById.get(id)!.successCriteria.length,
      )
    },
  )

  it('is no longer a two-column grid whose first 105 px column held a removed score ring', () => {
    const body = ruleBody(
      css('components/mechanical-circulatory-support.module.css'),
      '.debriefCard',
    )
    expect(body).not.toMatch(/105px/)
  })
})

/* ------------------------------------------------------------------ *
 * Stylesheet contracts for what jsdom cannot paint (F32, F37, F38, F41)
 * ------------------------------------------------------------------ */

describe('F32 · every prediction radio is native and painted to read as its state', () => {
  it('stage choices: empty ring unchecked, filled centre checked, dashed disabled, focus ring', () => {
    const sheet = css('components/stage/mcs-flow.module.css')
    const selector = ".flow fieldset:not([data-map-answer]) input[type='radio']"
    expect(ruleBody(sheet, selector)).toMatch(/appearance: none/)
    expect(ruleBody(sheet, `${selector}::before`)).toMatch(/transform: scale\(0\)/)
    expect(ruleBody(sheet, `${selector}:checked::before`)).toMatch(/transform: scale\(1\)/)
    expect(ruleBody(sheet, `${selector}:disabled`)).toMatch(/border-style: dashed/)
    expect(ruleBody(sheet, `${selector}:focus-visible`)).toMatch(/outline: 3px/)
    expect(sheet).toMatch(/@media \(forced-colors: active\)/)
  })

  it('case prediction: the same states, on the light card', () => {
    const sheet = css('components/mechanical-circulatory-support.module.css')
    const selector = ".predictionFieldset input[type='radio']"
    expect(ruleBody(sheet, selector)).toMatch(/appearance: none/)
    expect(ruleBody(sheet, `${selector}:checked::before`)).toMatch(/transform: scale\(1\)/)
    expect(ruleBody(sheet, `${selector}:disabled`)).toMatch(/border-style: dashed/)
  })

  it('every prediction surface is a native radio group with a name', () => {
    mountSection('iabp-efficacy-limits', 'predict')
    const fieldset = document.querySelector('fieldset[data-prediction-choices]')!
    expect(fieldset.getAttribute('aria-labelledby')).toBeTruthy()
    const radios = fieldset.querySelectorAll('input[type="radio"]')
    expect(radios.length).toBeGreaterThan(1)
    for (const radio of radios) expect(radio.closest('label')).not.toBeNull()
    cleanup()
    render(<McsCaseWorkflow state={caseState('IABP-01')} dispatch={jest.fn()} />)
    const caseGroup = screen.getByRole('group', { name: /Optional prediction/ })
    expect(within(caseGroup).getAllByRole('radio').length).toBeGreaterThan(1)
  })
})

describe('F37 · the Sections drawer is a list of all nine', () => {
  it('lays the shared rail out as a vertical list with whole words, inside this module only', () => {
    const sheet = css('components/stage/mcs-flow.module.css')
    expect(ruleBody(sheet, '.flow [data-sections-drawer]')).toMatch(/overflow-wrap: normal/)
    expect(ruleBody(sheet, '.flow [data-sections-drawer] ol')).toMatch(/display: grid/)
    expect(ruleBody(sheet, '.flow [data-sections-drawer] li button small')).toMatch(
      /display: block/,
    )
    expect(ruleBody(sheet, '.flow [data-sections-drawer] > div')).toMatch(/overflow-y: auto/)
  })
})

describe('F38 · the case page’s shared chrome is arranged for a phone, in this module', () => {
  it('places Current task in flow, wraps the stepper and releases the sticky footer', () => {
    const sheet = css('components/mechanical-circulatory-support.module.css')
    expect(sheet).toMatch(
      /div:has\(> section\[aria-label='Simulation viewport'\]\)\s*> details \{[^}]*position: static/,
    )
    expect(sheet).toMatch(/\[data-critical-care-activity-shell\] > footer \{\s*position: static/)
    expect(sheet).toMatch(/> header ol \{\s*display: grid/)
  })
})

describe('F41 · the module’s light surfaces keep 4.5:1 in either browser theme', () => {
  const sheet = css('components/mechanical-circulatory-support.module.css')

  it('pins the site colour tokens inside the light frame, so a dark browser cannot invert them', () => {
    const pin = ruleBody(
      sheet,
      ".moduleShell [data-learning-module-v2-theme-root][data-theme='light']",
    )
    for (const token of ['--background', '--foreground', '--muted-foreground', '--card'])
      expect(pin).toContain(`${token}:`)
  })

  it('gives muted text 4.5:1 on every tinted light card it sits on', () => {
    const muted = ruleBody(sheet, '.moduleShell').match(/--muted: (#[0-9a-f]{6})/i)?.[1]
    for (const card of ['#f5f8f5', '#e4f4f1', '#eef2f1', '#f6faf9', '#ffffff'])
      expect(contrast(muted ?? '#ffffff', card)).toBeGreaterThanOrEqual(4.5)
  })
})
