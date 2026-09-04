import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CircuitSchematic } from '../components/CircuitAndMonitors'
import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import {
  circuitMapEmphasisCaption,
  circuitMapEmphasisTargets,
} from '../components/circuit-map/circuitMapEmphasis'
import {
  CIRCUIT_MAP_FRAME_VIEWBOX,
  circuitMapGeometry,
} from '../components/circuit-map/circuitMapGeometry'
import {
  buildDrillStageLesson,
  resolveGuidedLesson,
} from '../components/stage/adapters/drillStageAdapter'
import {
  deriveEcmoCircuitPresentation,
  type EcmoCircuitPresentation,
} from '../content/circuitPresentation'
import { ecmoCircuitSegment, resolveEcmoModeText } from '../content/circuitSegments'
import { ecmoCircuitWalkStopsForSection, ecmoWalkStopSegmentIds } from '../content/circuitWalk'
import { ecmoDrillSpecs } from '../content/drillSpecs'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import { ecmoLocalizationRow } from '../content/localizationCards'
import { ecmoReferenceProfileForMode } from '../content/referenceProfiles'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../engine'
import type { EcmoSimulationState, SupportMode } from '../engine/types'
import {
  answerPredictionAndAdvance,
  mountDrill,
  readStep,
  resetStageHarness,
} from '../test-support/learnStageHarness'

/**
 * The pressure-zone map marks where the lesson is.
 *
 * An owner review in September 2026 looked at the circuit walk and saw the animated map — the best
 * drawing of the circuit this module has — sitting behind a tab with nothing marked on it, while
 * the teaching pane drew a small map of its own that read as hand-drawn beside it. The small map is
 * gone. What replaced it is pinned here: the walk opens the real map and lights its stop on it, a
 * drill lights its implicated places on it once and only once the learner has committed, the
 * marking is carried in words as well as in pixels, and nothing about it is a channel placement
 * the section is still asking for.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

// The one permitted mock: the 3D canvas needs WebGL. The map itself renders for real.
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

beforeEach(() => {
  resetStageHarness()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
})

function settledReference(supportMode: SupportMode, seconds = 10): EcmoSimulationState {
  let state = createReferenceSimulationState(ecmoReferenceProfileForMode(supportMode).id)
  for (let tick = 0; tick < seconds; tick += 1)
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function settledDrill(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < steps; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function afterCommitment(state: EcmoSimulationState): EcmoSimulationState {
  const prediction = requireEcmoLearnPrediction(state.scenario.scenarioId)
  const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
  if (!best) throw new Error(`No best choice for ${state.scenario.scenarioId}`)
  const commitment = prediction.commitments[best.id]
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: commitment.goalId,
    control: commitment.control,
    direction: commitment.direction,
  })
}

function walkStopPresentation(
  sectionId: 'circuit-flow-path' | 'pump-and-pressure-zones',
  stopIndex: number,
  options: { readonly readingsVisible: boolean },
): Extract<EcmoCircuitPresentation, { kind: 'walk-stop' }> {
  const stop = ecmoCircuitWalkStopsForSection(sectionId)[stopIndex]
  return {
    kind: 'walk-stop',
    stopId: stop.id,
    segmentIds: ecmoWalkStopSegmentIds(stop),
    sensorSiteIds: options.readingsVisible ? stop.sensorSiteIds : [],
  }
}

function markedSegments(root: ParentNode = document): string[] {
  return [...root.querySelectorAll('[data-map-emphasis-role="segment"]')].map(
    (node) => node.getAttribute('data-map-emphasis-target') ?? '',
  )
}

function mapTab(): HTMLElement {
  const tab = document.getElementById('cardiohelp-diagnostic-view-tab')
  if (!tab) throw new Error('no pressure-zone map tab on the stage')
  return tab
}

/* ------------------------------------------------------------------ *
 * The pure half
 * ------------------------------------------------------------------ */

describe('what the map is asked to mark', () => {
  it('marks nothing for a neutral or scaffold presentation, and nothing for none', () => {
    for (const presentation of [
      null,
      { kind: 'neutral' } as const,
      { kind: 'scaffold', emphasis: 'sensor-sites' } as const,
    ]) {
      expect(circuitMapEmphasisTargets(presentation, 'vv', { sensorFlagsDrawn: true })).toEqual([])
      expect(circuitMapEmphasisCaption(presentation, 'vv')).toBeNull()
    }
  })

  it('marks every segment of a walk stop, in the stop’s own order, each with a shape to draw', () => {
    const stops = ecmoCircuitWalkStopsForSection('pump-and-pressure-zones')
    const downstream = stops.findIndex((stop) => stop.id === 'walk-downstream-load')
    const presentation = walkStopPresentation('pump-and-pressure-zones', downstream, {
      readingsVisible: false,
    })
    const targets = circuitMapEmphasisTargets(presentation, 'vv', { sensorFlagsDrawn: true })
    expect(targets.map((target) => target.id)).toEqual([
      ...ecmoWalkStopSegmentIds(stops[downstream]),
    ])
    for (const target of targets) {
      expect(target.role).toBe('segment')
      expect(target.shapes.length).toBeGreaterThan(0)
    }
  })

  it('marks an implicated row’s segments, and only after the engine records a commitment', () => {
    const before = deriveEcmoCircuitPresentation(settledDrill('preload-drainage-collapse'), {
      kind: 'drill-reveal',
      rowId: 'drainage-limitation',
    })
    expect(circuitMapEmphasisTargets(before, 'vv', { sensorFlagsDrawn: true })).toEqual([])

    const after = deriveEcmoCircuitPresentation(
      afterCommitment(settledDrill('preload-drainage-collapse')),
      { kind: 'drill-reveal', rowId: 'drainage-limitation' },
    )
    const targets = circuitMapEmphasisTargets(after, 'vv', { sensorFlagsDrawn: true })
    expect(
      targets.filter((target) => target.role === 'segment').map((target) => target.id),
    ).toEqual([...ecmoLocalizationRow('drainage-limitation').implicatedSegmentIds])
  })

  it('rings a sensor site only when the drawing is placing its flags', () => {
    const presentation = walkStopPresentation('circuit-flow-path', 0, { readingsVisible: true })
    expect(presentation.sensorSiteIds).toEqual(['pVen'])

    const drawn = circuitMapEmphasisTargets(presentation, 'vv', { sensorFlagsDrawn: true })
    expect(drawn.filter((target) => target.role === 'sensor-site').map((t) => t.id)).toEqual([
      'pVen',
    ])

    // Withheld placements: there is no flag to ring, and ringing the space would place it.
    const withheld = circuitMapEmphasisTargets(presentation, 'vv', { sensorFlagsDrawn: false })
    expect(withheld.some((target) => target.role === 'sensor-site')).toBe(false)
  })

  it('gives no halo to a site the drawing has no marker for, but still names it', () => {
    const stops = ecmoCircuitWalkStopsForSection('circuit-flow-path')
    const membrane = stops.findIndex((stop) => stop.id === 'walk-membrane')
    const presentation = walkStopPresentation('circuit-flow-path', membrane, {
      readingsVisible: true,
    })
    // The membrane stop reports the venous-line saturation, which is measured inside the disposable.
    expect(presentation.sensorSiteIds).toContain('svo2-venous-cell')
    const rung = circuitMapEmphasisTargets(presentation, 'vv', { sensorFlagsDrawn: true })
      .filter((target) => target.role === 'sensor-site')
      .map((target) => target.id)
    expect(rung).not.toContain('svo2-venous-cell')
    expect(rung).toEqual(expect.arrayContaining(['pInt', 'deltaP']))
    // What is rung is said: the caption names each ringed reading as the console names it, and
    // only the ringed ones — the venous cell has no marker, so it is not claimed as ringed.
    const caption = circuitMapEmphasisCaption(presentation, 'vv', { sensorFlagsDrawn: true }) ?? ''
    expect(caption).toMatch(/Ringed on the map: .*pre-membrane pressure \(pInt\)/)
    expect(caption).toMatch(/the gradient across the membrane \(ΔP\)/)
    expect(caption).not.toMatch(/SvO/)
    // And not said while the placements are withheld.
    expect(circuitMapEmphasisCaption(presentation, 'vv', { sensorFlagsDrawn: false })).not.toMatch(
      /Ringed/,
    )
  })

  it('keeps both fixed frames inside the drawing', () => {
    for (const viewBox of Object.values(CIRCUIT_MAP_FRAME_VIEWBOX)) {
      const [x, y, width, height] = viewBox.split(' ').map(Number)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + width).toBeLessThanOrEqual(1120)
      expect(y + height).toBeLessThanOrEqual(590)
    }
  })

  it('says where you are in one sentence, and where the problem lives in a different one', () => {
    const stop = walkStopPresentation('circuit-flow-path', 0, { readingsVisible: false })
    expect(circuitMapEmphasisCaption(stop, 'vv')).toBe(
      `You are here: ${resolveEcmoModeText(ecmoCircuitSegment('drainage').label, 'vv')}.`,
    )
    const implicated: EcmoCircuitPresentation = { kind: 'implicated', rowId: 'gas-path-failure' }
    const caption = circuitMapEmphasisCaption(implicated, 'vv') ?? ''
    expect(caption).toMatch(/^Implicated on this map: /)
    expect(caption).not.toMatch(/You are here/)
  })
})

/* ------------------------------------------------------------------ *
 * The drawing
 * ------------------------------------------------------------------ */

describe('the drawing, marked', () => {
  const noop = () => {}

  function renderMap(
    state: EcmoSimulationState,
    props: Partial<Parameters<typeof CircuitSchematic>[0]> = {},
  ) {
    return render(
      <CircuitSchematic state={state} dispatch={noop} controlsEnabled={false} {...props} />,
    )
  }

  it('draws the halo along the very path the limb is drawn on', () => {
    const state = settledReference('vv')
    const { container } = renderMap(state, {
      circuitPresentation: walkStopPresentation('circuit-flow-path', 0, {
        readingsVisible: false,
      }),
    })
    const geometry = circuitMapGeometry('vv')
    const limb = container.querySelector(`[data-limb="drainage"] path`)
    expect(limb?.getAttribute('d')).toBe(geometry.drainageLimb)
    const haloPaths = [
      ...container.querySelectorAll('[data-map-emphasis-target="drainage"] path'),
    ].map((node) => node.getAttribute('d'))
    expect(haloPaths).toContain(geometry.drainageLimb)
    expect(haloPaths).toContain(geometry.drainageCannula)
  })

  it('marks in three ways at once — a halo, an outline, and words — and describes it to a reader', () => {
    const state = settledReference('vv')
    const presentation = walkStopPresentation('circuit-flow-path', 1, { readingsVisible: false })
    const { container } = renderMap(state, { circuitPresentation: presentation })

    const svg = container.querySelector('svg.circuitSvg, svg[data-map-frame]')
    expect(svg?.getAttribute('data-map-emphasis-active')).toBe('true')
    expect(markedSegments(container)).toEqual(['pump'])
    const target = container.querySelector('[data-map-emphasis-target="pump"]')
    expect(target?.querySelectorAll('[class*="mapEmphasisHalo"]').length).toBeGreaterThan(0)
    expect(target?.querySelectorAll('[class*="mapEmphasisEdge"]').length).toBeGreaterThan(0)

    const caption = circuitMapEmphasisCaption(presentation, 'vv')
    expect(container.querySelector('[data-map-emphasis-caption]')?.textContent).toBe(caption)
    expect(container.querySelector('#circuit-svg-desc')?.textContent).toContain(caption)
    // The layer is decoration to assistive technology; the description carries the words.
    expect(container.querySelector('[data-map-emphasis]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the whole drawing, marked or not, and fits the pane when the host asks', () => {
    const state = settledReference('va')
    const implicated: EcmoCircuitPresentation = { kind: 'implicated', rowId: 'membrane-resistance' }
    for (const presentation of [null, implicated]) {
      const { container, unmount } = renderMap(state, {
        circuitPresentation: presentation,
        circuitFit: 'pane',
      })
      const svg = container.querySelector('svg[data-map-frame]')
      // The whole circuit, always: the marking is read against the rest of the path, and a wider
      // pane is a larger map. A window that followed the marking hid the rest of the animation.
      expect(svg?.getAttribute('data-map-frame')).toBe('whole')
      expect(svg?.getAttribute('viewBox')).toBe(CIRCUIT_MAP_FRAME_VIEWBOX.whole)
      expect(svg?.getAttribute('class')).toMatch(/circuitSvgFit/)
      // Fitted, there is nothing to scroll sideways: no tab stop, no swipe hint, no promise of one.
      const scroller = svg?.parentElement
      expect(scroller?.getAttribute('tabindex')).toBeNull()
      expect(scroller?.getAttribute('aria-label')).not.toMatch(/horizontally scrollable/)
      expect(container.textContent).not.toMatch(/swipe the diagram/)
      unmount()
    }
    // The poster keeps its scroller and the affordances that go with it.
    const poster = renderMap(state, { circuitPresentation: implicated })
    const svg = poster.container.querySelector('svg[data-map-frame]')
    expect(svg?.getAttribute('class')).not.toMatch(/circuitSvgFit/)
    expect(svg?.parentElement?.getAttribute('tabindex')).toBe('0')
    expect(poster.container.textContent).toMatch(/swipe the diagram/)
    poster.unmount()
    // A host may still ask for the circuit panel alone.
    const panel = renderMap(state, { circuitPresentation: implicated, circuitFrame: 'circuit' })
    expect(panel.container.querySelector('svg[data-map-frame]')?.getAttribute('viewBox')).toBe(
      CIRCUIT_MAP_FRAME_VIEWBOX.circuit,
    )
  })

  it('marks nothing and says nothing when there is nothing to mark', () => {
    const { container } = renderMap(settledReference('vv'))
    expect(container.querySelector('[data-map-emphasis]')).toBeNull()
    expect(container.querySelector('[data-map-emphasis-caption]')).toBeNull()
    expect(
      container.querySelector('svg[data-map-frame]')?.getAttribute('data-map-emphasis-active'),
    ).toBeNull()
  })

  it('rings no sensor site while the map is withholding its placements', () => {
    const state = settledReference('vv')
    const presentation = walkStopPresentation('circuit-flow-path', 0, { readingsVisible: true })
    const { container } = renderMap(state, {
      circuitPresentation: presentation,
      locationDisclosure: 'withheld',
    })
    expect(container.querySelector('[data-sensor-flag]')).toBeNull()
    expect(container.querySelector('[data-map-emphasis-role="sensor-site"]')).toBeNull()
    // The segment is still marked: where you are is not a placement.
    expect(markedSegments(container)).toEqual(['drainage'])
  })

  it('holds still under reduced motion, and never carries the marking in colour alone', () => {
    const css = readFileSync(
      path.join(
        process.cwd(),
        'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css',
      ),
      'utf8',
    )
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reducedMotion).toMatch(/\.mapEmphasisHalo[^}]*animation: none !important/)
    // Width and a dashed outline carry it; the halo alone is the part that pulses.
    expect(css).toMatch(/\.mapEmphasisHalo\s*\{[^}]*stroke-width: 26/)
    expect(css).toMatch(/\.mapEmphasisEdge\s*\{[^}]*stroke-dasharray/)
  })
})

describe('what the reviewers reproduced, pinned', () => {
  it('keeps the fit rule ahead of the narrow-screen poster width in the cascade', () => {
    const css = readFileSync(
      path.join(
        process.cwd(),
        'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css',
      ),
      'utf8',
    )
    // A single-class `.circuitSvgFit` lost to `.circuitSvg { min-width: 1040px }` inside the
    // ≤760px media block on source order; the compound selector outranks it at every width.
    expect(css).toMatch(/\.circuitSvg\.circuitSvgFit\s*\{[^}]*min-width: 0/)
    expect(css).not.toMatch(/(^|[^.\w])\.circuitSvgFit\s*\{/m)
  })

  it('draws the VA return halo along the VA cannula, to the VA port', () => {
    render(
      <EcmoFoundationLessonActivity
        sectionId="circuit-flow-path"
        supportMode="va"
        initialPhase="recognize"
      />,
    )
    const stops = ecmoCircuitWalkStopsForSection('circuit-flow-path')
    for (let index = 1; index < stops.length; index += 1) {
      fireEvent.click(document.querySelector('[data-walk-next]')!)
    }
    expect(markedSegments()).toEqual(['post-membrane', 'return'])
    const geometry = circuitMapGeometry('va')
    const halo = [...document.querySelectorAll('[data-map-emphasis-target="return"] path')].map(
      (node) => node.getAttribute('d'),
    )
    expect(halo).toContain(geometry.returnCannula)
    expect(halo).toContain(geometry.returnRun)
    expect(document.querySelector('[data-map-emphasis-caption]')?.textContent).toMatch(
      /Arterial return to the patient/,
    )
  })
})

/* ------------------------------------------------------------------ *
 * The foundation stage
 * ------------------------------------------------------------------ */

describe('the circuit walk, marked on the real map', () => {
  function mountSection(
    sectionId: 'circuit-flow-path' | 'pump-and-pressure-zones' | 'why-extracorporeal-support',
  ) {
    return render(
      <EcmoFoundationLessonActivity
        sectionId={sectionId}
        supportMode="vv"
        initialPhase="recognize"
      />,
    )
  }

  it('opens the pressure-zone map on the first step and lights the first stop on it', () => {
    mountSection('circuit-flow-path')
    expect(mapTab().getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('[data-surface="circuit"]')?.getAttribute('data-open')).toBe(
      'true',
    )
    expect(markedSegments()).toEqual(['drainage'])
    expect(document.querySelector('[data-map-emphasis-caption]')?.textContent).toBe(
      'You are here: Patient venous drainage.',
    )
    // The whole drawing, fitted to the pane, with the stop lit on it.
    const svg = document.querySelector('svg[data-map-frame]')
    expect(svg?.getAttribute('data-map-frame')).toBe('whole')
    expect(svg?.getAttribute('class')).toMatch(/circuitSvgFit/)
    // And there is exactly one map on the page — the small one in the teaching pane is gone.
    expect(document.querySelector('[data-circuit-minimap]')).toBeNull()
    expect(document.querySelectorAll('[data-map-emphasis]')).toHaveLength(1)
  })

  it('moves the marking with the walk', () => {
    mountSection('circuit-flow-path')
    const stops = ecmoCircuitWalkStopsForSection('circuit-flow-path')
    for (let index = 1; index < stops.length; index += 1) {
      fireEvent.click(document.querySelector('[data-walk-next]')!)
      expect(`${stops[index].id}: ${markedSegments().join(',')}`).toBe(
        `${stops[index].id}: ${ecmoWalkStopSegmentIds(stops[index]).join(',')}`,
      )
      // The drawing itself stays put: only the marking moves.
      expect(document.querySelector('svg[data-map-frame]')?.getAttribute('viewBox')).toBe(
        CIRCUIT_MAP_FRAME_VIEWBOX.whole,
      )
    }
    // The teaching card says where the marking is, in the same words each time.
    expect(document.querySelector('[data-walk-scene-labels]')?.textContent).toMatch(
      /^Marked on the circuit map and in the bedside scene:/,
    )
  })

  it('rings no reading before the prediction is committed, and the stop’s own reading after', () => {
    mountSection('circuit-flow-path')
    expect(document.querySelector('[data-map-emphasis-role="sensor-site"]')).toBeNull()
    expect(
      document.querySelector('#cardiohelp-circuit-panel')?.getAttribute('data-location-disclosure'),
    ).toBe('withheld')

    // Commit, the way a learner does: choose, then commit.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const choice = document.querySelector<HTMLInputElement>('[data-prediction-choices] input')
    fireEvent.click(choice!)
    fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))

    expect(
      document.querySelector('#cardiohelp-circuit-panel')?.getAttribute('data-location-disclosure'),
    ).toBe('full')
    expect(
      [...document.querySelectorAll('[data-map-emphasis-role="sensor-site"]')].map((node) =>
        node.getAttribute('data-map-emphasis-target'),
      ),
    ).toEqual(['pVen'])
    expect(document.querySelector('[data-map-emphasis-caption]')?.textContent).toBe(
      'You are here: Patient venous drainage. Ringed on the map: drainage pressure (pVen).',
    )
  })

  it('reaches both circuit views from the keyboard on a step that selected one of them', () => {
    mountSection('circuit-flow-path')
    const mapTabButton = mapTab()
    const bedside = document.getElementById('cardiohelp-bedside-view-tab')!
    expect(mapTabButton.getAttribute('tabindex')).toBe('0')
    expect(bedside.getAttribute('tabindex')).toBe('-1')
    mapTabButton.focus()
    fireEvent.keyDown(mapTabButton, { key: 'ArrowLeft' })
    expect(bedside.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(bedside)
    fireEvent.keyDown(bedside, { key: 'End' })
    expect(mapTabButton.getAttribute('aria-selected')).toBe('true')
  })

  it('lets a learner who opened the bedside scene keep it for the step, then reopens the map', () => {
    mountSection('circuit-flow-path')
    fireEvent.click(document.getElementById('cardiohelp-bedside-view-tab')!)
    expect(mapTab().getAttribute('aria-selected')).toBe('false')
    // Moving the walk within the step does not drag the tab back.
    fireEvent.click(document.querySelector('[data-walk-next]')!)
    expect(mapTab().getAttribute('aria-selected')).toBe('false')
    // Entering the next step applies the step's own view again.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(mapTab().getAttribute('aria-selected')).toBe('true')
  })

  it('opens the map for the pressure-zones walk too, and not for a section that walks nothing', () => {
    const zones = mountSection('pump-and-pressure-zones')
    expect(mapTab().getAttribute('aria-selected')).toBe('true')
    expect(markedSegments()).toEqual(
      ecmoWalkStopSegmentIds(ecmoCircuitWalkStopsForSection('pump-and-pressure-zones')[0]),
    )
    zones.unmount()

    mountSection('why-extracorporeal-support')
    expect(mapTab().getAttribute('aria-selected')).toBe('false')
    expect(document.querySelector('[data-map-emphasis]')).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * The drill stage
 * ------------------------------------------------------------------ */

describe('a drill, marked on the real map once the learner has committed', () => {
  it('marks nothing before commitment, then the row’s places, on the real stage', async () => {
    await mountDrill('preload-drainage-collapse')
    expect(document.querySelector('[data-map-emphasis]')).toBeNull()
    expect(document.querySelector('[data-map-emphasis-caption]')).toBeNull()
    expect(document.querySelector('svg[data-map-frame]')?.getAttribute('data-map-frame')).toBe(
      'whole',
    )

    readStep(/Inspect the starting pattern/i)
    expect(document.querySelector('[data-map-emphasis]')).toBeNull()
    answerPredictionAndAdvance('preload-drainage-collapse')

    await waitFor(() =>
      expect(markedSegments()).toEqual([
        ...ecmoLocalizationRow('drainage-limitation').implicatedSegmentIds,
      ]),
    )
    expect(document.querySelector('[data-map-emphasis-caption]')?.textContent).toMatch(
      /^Implicated on this map: /,
    )
  })

  it('opens the map at the Explain step of every drill with a row to mark, and only those', () => {
    for (const [scenarioId, spec] of Object.entries(ecmoDrillSpecs)) {
      const guided = resolveGuidedLesson(scenarioId)
      const lesson = buildDrillStageLesson(guided, guided.supportMode)
      const explain = lesson.steps.find((step) => step.phase === 'explain')
      if (!explain) {
        // The two console tours have nothing to explain and nothing to mark.
        expect(`${scenarioId}: ${spec.localizationRowId ?? 'no row'}`).toBe(`${scenarioId}: no row`)
        continue
      }
      const expected = spec.localizationRowId ? 'diagnostic' : undefined
      expect(`${scenarioId}: ${explain.circuitView ?? 'unset'}`).toBe(
        `${scenarioId}: ${expected ?? 'unset'}`,
      )
      if (spec.localizationRowId) expect(explain.surfaces).toContain('circuit')
    }
  })

  it('opens the map for the console tour, whose subject is where the sensors sit', () => {
    for (const scenarioId of ['startup-sensor-orientation'] as const) {
      const guided = resolveGuidedLesson(scenarioId)
      const lesson = buildDrillStageLesson(guided, guided.supportMode)
      const first = lesson.steps[0]
      expect(first.focusTarget).toBe('circuit')
      expect(first.circuitView).toBe('diagnostic')
      expect(first.surfaces).toContain('circuit')
    }
  })

  it('never leaks the row’s places before commitment, on any drill with a row', () => {
    for (const [scenarioId, spec] of Object.entries(ecmoDrillSpecs)) {
      if (!spec.localizationRowId) continue
      const presentation = deriveEcmoCircuitPresentation(settledDrill(scenarioId), {
        kind: 'drill-reveal',
        rowId: spec.localizationRowId,
      })
      expect(`${scenarioId}: ${presentation.kind}`).toBe(`${scenarioId}: neutral`)
      expect(circuitMapEmphasisCaption(presentation, 'vv')).toBeNull()
    }
  })
})
