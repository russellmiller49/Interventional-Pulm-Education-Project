import { render } from '@testing-library/react'

import { EcmoCircuitMinimap } from '../components/teaching/EcmoCircuitMinimap'
import {
  deriveEcmoCircuitPresentation,
  ecmoCircuitMapTextEquivalent,
  ecmoMapSensorSiteIds,
  type EcmoCircuitPresentation,
} from '../content/circuitPresentation'
import {
  ecmoBloodPathSegmentIds,
  ecmoCircuitSegment,
  ecmoCircuitSegmentIds,
  ecmoGasPathSegmentIds,
  ecmoSensorSite,
  ecmoSensorSites,
  resolveEcmoModeText,
} from '../content/circuitSegments'
import {
  ecmoCircuitWalkStop,
  ecmoCircuitWalkStops,
  ecmoWalkStopSegmentIds,
  type EcmoCircuitWalkStop,
} from '../content/circuitWalk'
import { ecmoLocalizationRow, ecmoLocalizationRowIds } from '../content/localizationCards'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import { ecmoSimulationReducer } from '../engine/reducer'
import { createInitialSimulationState } from '../engine/simulation'
import type { EcmoSimulationState } from '../engine/types'

/**
 * The map, checked for the two things a picture in a teaching pane can get wrong: saying something
 * the registry does not say, and saying it in a way that only works if you can see it.
 */

const MODES = ['vv', 'va'] as const

/*
 * The same two helpers the drill-panel suite uses, for the same reason: the gate under test is the
 * engine's own commitment flag, so the state has to be a real drill reached the way a learner
 * reaches it. Two earlier drafts of this helper were quietly wrong — `createInitialSimulationState`
 * takes a scenario id rather than a support mode, and a reference-profile state arrives with a
 * commitment already recorded, so neither could have failed if the gate were broken.
 */
function settled(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < steps; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
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

const NEUTRAL: EcmoCircuitPresentation = { kind: 'neutral' }

describe('ECMO circuit minimap', () => {
  it('draws every segment the registry declares, exactly once, and nothing it does not', () => {
    const { container } = render(<EcmoCircuitMinimap supportMode="vv" presentation={NEUTRAL} />)
    const drawn = [...container.querySelectorAll('[data-map-segment]')].map((node) =>
      node.getAttribute('data-map-segment'),
    )
    expect(drawn.sort()).toEqual([...ecmoCircuitSegmentIds].sort())
    expect(new Set(drawn).size).toBe(drawn.length)

    for (const id of ecmoBloodPathSegmentIds) {
      expect(
        container.querySelector(`[data-map-path="blood"] [data-map-segment="${id}"]`),
      ).not.toBeNull()
    }
    for (const id of ecmoGasPathSegmentIds) {
      expect(
        container.querySelector(`[data-map-path="gas"] [data-map-segment="${id}"]`),
      ).not.toBeNull()
    }
  })

  it('flags only the sites the presentation asks for, naming each as the console names it', () => {
    for (const presentation of [
      NEUTRAL,
      { kind: 'scaffold', emphasis: 'path-order' } as const,
      { kind: 'scaffold', emphasis: 'sensor-sites' } as const,
      { kind: 'scaffold', emphasis: 'pressure-zones' } as const,
    ]) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode="vv" presentation={presentation} />,
      )
      const flagged = [...container.querySelectorAll('[data-map-sensor-site]')].map((node) =>
        node.getAttribute('data-map-sensor-site'),
      )
      expect(flagged).toEqual([...ecmoMapSensorSiteIds(presentation)])
      for (const siteId of ecmoMapSensorSiteIds(presentation)) {
        expect(container.textContent).toContain(ecmoSensorSite(siteId).mapLabel)
      }
      unmount()
    }
  })

  it('shows the console tour every site, and the pressure lesson only the pressure channels', () => {
    const tour = ecmoMapSensorSiteIds({ kind: 'scaffold', emphasis: 'sensor-sites' })
    expect(tour).toContain('flow-bubble-sensor')
    const zones = ecmoMapSensorSiteIds({ kind: 'scaffold', emphasis: 'pressure-zones' })
    expect(zones).not.toContain('flow-bubble-sensor')
    expect(zones).not.toContain('svo2-venous-cell')
  })

  it.each(MODES)('renders the %s return from the shared registry, not a second copy', (mode) => {
    const { container } = render(<EcmoCircuitMinimap supportMode={mode} presentation={NEUTRAL} />)
    expect(
      container.querySelector('[data-circuit-minimap]')?.getAttribute('data-support-mode'),
    ).toBe(mode)
    expect(container.textContent).toContain(
      resolveEcmoModeText(ecmoCircuitSegment('return').mapLabel, mode),
    )
    expect(container.textContent).toContain(
      resolveEcmoModeText(ecmoCircuitSegment('return').label, mode),
    )
  })

  it('marks nothing at all unless a row is being revealed', () => {
    for (const presentation of [
      NEUTRAL,
      { kind: 'scaffold', emphasis: 'path-order' } as const,
      { kind: 'scaffold', emphasis: 'sensor-sites' } as const,
      { kind: 'scaffold', emphasis: 'pressure-zones' } as const,
    ]) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode="vv" presentation={presentation} />,
      )
      expect(container.querySelector('[data-circuit-implicated]')).toBeNull()
      expect(container.querySelector('[data-implicated-caption]')).toBeNull()
      expect(container.querySelector('[data-implicated-marker]')).toBeNull()
      expect(container.querySelectorAll('[data-segment-state="implicated"]')).toHaveLength(0)
      unmount()
    }
  })

  it.each(ecmoLocalizationRowIds)('marks exactly the segments row %s implicates', (rowId) => {
    const row = ecmoLocalizationRow(rowId)
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={{ kind: 'implicated', rowId }} />,
    )
    const marked = [...container.querySelectorAll('[data-circuit-implicated="true"]')].map((node) =>
      node.getAttribute('data-map-segment'),
    )
    expect(marked).toEqual([...row.implicatedSegmentIds])

    // Words, not only weight: the caption names each implicated segment in full.
    const caption = container.querySelector('[data-implicated-caption]')?.textContent ?? ''
    for (const segmentId of row.implicatedSegmentIds) {
      expect(caption).toContain(resolveEcmoModeText(ecmoCircuitSegment(segmentId).label, 'vv'))
    }
  })

  it('carries the implication in weight, texture and a marker as well as in words', () => {
    /*
     * Both shapes, because they texture differently and only one of them was right the first time:
     * a rect gets an offset dashed outline, and a line gets ticks that stand proud of it. The line
     * originally got a thin dashed stroke of the same colour laid over a thicker stroke of the same
     * colour, which is invisible, so a rendered check is the only kind worth having here.
     */
    for (const [rowId, segmentId] of [
      ['drainage-limitation', 'drainage'],
      ['membrane-resistance', 'membrane'],
    ] as const) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode="vv" presentation={{ kind: 'implicated', rowId }} />,
      )
      const marked = container.querySelector(`[data-map-segment="${segmentId}"]`)
      expect(marked?.getAttribute('data-circuit-implicated')).toBe('true')

      const texture = marked?.querySelector('[data-implicated-texture]')
      expect(texture).not.toBeNull()
      expect(texture?.getAttribute('stroke-dasharray')).toBeTruthy()
      expect(marked?.querySelector('[data-implicated-marker]')).not.toBeNull()

      // Drawn heavier than the same segment is when nothing is implicated.
      const neutralRender = render(<EcmoCircuitMinimap supportMode="vv" presentation={NEUTRAL} />)
      const plain = neutralRender.container.querySelector(
        `[data-map-segment="${segmentId}"] path, [data-map-segment="${segmentId}"] rect`,
      )
      const heavy = marked?.querySelector('path, rect')
      expect(Number(heavy?.getAttribute('stroke-width'))).toBeGreaterThan(
        Number(plain?.getAttribute('stroke-width')),
      )
      neutralRender.unmount()
      unmount()
    }
  })

  it('flags the channels the revealed row is actually about', () => {
    // The gas row's map used to show four pressure channels and omit the post-membrane saturation,
    // which is the one signal that moves in the fault it explains.
    const { container } = render(
      <EcmoCircuitMinimap
        supportMode="vv"
        presentation={{ kind: 'implicated', rowId: 'gas-path-failure' }}
      />,
    )
    const flagged = [...container.querySelectorAll('[data-map-sensor-site]')].map((node) =>
      node.getAttribute('data-map-sensor-site'),
    )
    expect(flagged).toContain('post-oxygenator-saturation')
    for (const row of [ecmoLocalizationRow('gas-path-failure')]) {
      for (const siteId of row.sensorSiteIds) expect(flagged).toContain(siteId)
    }
  })

  it('flags every site the walk stop list names', () => {
    // The map and the stop list beside it read the same registry, so the map cannot be missing one.
    const walk = ecmoMapSensorSiteIds({ kind: 'scaffold', emphasis: 'path-order' })
    expect(walk).toContain('flow-bubble-sensor')
    expect([...walk].sort()).toEqual([...ecmoSensorSites.map((site) => site.id)].sort())
  })

  it('draws every implicated outline inside the canvas it declares', () => {
    /*
     * The sweep-gas chip sat three units below the top edge, and the dashed outline that marks it
     * as implicated is drawn three units outside the shape — so the cue was clipped away exactly
     * when the gas row was the answer.
     */
    for (const rowId of ecmoLocalizationRowIds) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode="vv" presentation={{ kind: 'implicated', rowId }} />,
      )
      for (const node of container.querySelectorAll('[data-implicated-texture]')) {
        const y = Number(node.getAttribute('y'))
        const x = Number(node.getAttribute('x'))
        if (Number.isNaN(y)) continue
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y + Number(node.getAttribute('height'))).toBeLessThanOrEqual(140)
        expect(x + Number(node.getAttribute('width'))).toBeLessThanOrEqual(320)
      }
      unmount()
    }
  })

  it('reads as sentences in its accessible name', () => {
    const { container } = render(<EcmoCircuitMinimap supportMode="vv" presentation={NEUTRAL} />)
    const title = container.querySelector('title')?.textContent ?? ''
    expect(title).not.toMatch(/\.\S/)
    expect(title).toMatch(/Venovenous circuit map\. The blood path/)
  })

  it('paints nothing with a colour of its own', () => {
    const { container } = render(
      <EcmoCircuitMinimap
        supportMode="va"
        presentation={{ kind: 'implicated', rowId: 'gas-path-failure' }}
      />,
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    for (const node of svg?.querySelectorAll('*') ?? []) {
      for (const attribute of ['stroke', 'fill']) {
        const value = node.getAttribute(attribute)
        if (value === null) continue
        expect(['currentColor', 'none']).toContain(value)
      }
    }
    // Nor with an inline style, which would survive a theme it was not written for.
    expect(svg?.innerHTML).not.toMatch(/style=/)
  })

  it('tells the blood path from the gas path without relying on either', () => {
    const { container } = render(<EcmoCircuitMinimap supportMode="vv" presentation={NEUTRAL} />)
    const gas = container.querySelector('[data-map-segment="membrane-gas-side"] path')
    expect(gas?.getAttribute('stroke-dasharray')).toBeTruthy()
    const blood = container.querySelector('[data-map-segment="pre-membrane"] path')
    expect(blood?.getAttribute('stroke-dasharray')).toBeNull()
  })

  it('scales to its pane rather than forcing one, and takes no keyboard stop', () => {
    const { container } = render(<EcmoCircuitMinimap supportMode="vv" presentation={NEUTRAL} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 320 140')
    expect(svg?.getAttribute('class')).toContain('w-full')
    expect(svg?.getAttribute('class')).toContain('h-auto')
    expect(svg?.getAttribute('class')).not.toContain('min-w')

    // No scroller of its own — the teaching pane already clips, and a fourth scroller around
    // panes that scroll independently is the arrangement the workspace exists to remove.
    expect(container.querySelector('.overflow-x-auto')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
    expect(container.querySelector('button, a, input, select')).toBeNull()
  })

  it('holds still, in every state', () => {
    for (const presentation of [
      NEUTRAL,
      { kind: 'scaffold', emphasis: 'sensor-sites' } as const,
      { kind: 'implicated', rowId: 'drainage-limitation' } as const,
    ]) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode="vv" presentation={presentation} />,
      )
      expect(container.querySelectorAll('animate, animateTransform, animateMotion')).toHaveLength(0)
      expect(container.querySelector('svg')?.getAttribute('class')).not.toMatch(/animate/)
      unmount()
    }
  })

  it('is named for assistive technology, and carries the whole map in words', () => {
    const presentation: EcmoCircuitPresentation = {
      kind: 'implicated',
      rowId: 'return-path-resistance',
    }
    const { container } = render(
      <EcmoCircuitMinimap supportMode="va" presentation={presentation} />,
    )
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    const titleId = svg?.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(svg?.querySelector('title')?.getAttribute('id')).toBe(titleId)

    const equivalent = container.querySelector('[data-text-equivalent]')?.textContent ?? ''
    expect(equivalent).toBe(ecmoCircuitMapTextEquivalent('va', presentation))

    // Order, both paths, the track's own return, and the sites — all readable without the picture.
    for (const id of ecmoBloodPathSegmentIds) {
      expect(equivalent).toContain(resolveEcmoModeText(ecmoCircuitSegment(id).label, 'va'))
    }
    expect(equivalent).toContain('solid')
    expect(equivalent).toContain('dashed')
    expect(equivalent).toContain('Arterial return to the patient')
    for (const siteId of ecmoMapSensorSiteIds(presentation)) {
      expect(equivalent).toContain(ecmoSensorSite(siteId).plainName)
    }
  })

  it('keeps the blood path in registry order inside the description', () => {
    const equivalent = ecmoCircuitMapTextEquivalent('vv', NEUTRAL)
    const positions = ecmoBloodPathSegmentIds.map((id) =>
      equivalent.indexOf(resolveEcmoModeText(ecmoCircuitSegment(id).label, 'vv')),
    )
    for (const position of positions) expect(position).toBeGreaterThan(-1)
    expect([...positions]).toEqual([...positions].sort((left, right) => left - right))
  })
})

describe('ECMO circuit presentation, derived from the engine', () => {
  it('holds a drill neutral until the learner has actually committed', () => {
    const state = settled('preload-drainage-collapse')
    expect(state.scenario.prediction.committed).toBe(false)
    expect(
      deriveEcmoCircuitPresentation(state, {
        kind: 'drill-reveal',
        rowId: 'drainage-limitation',
      }),
    ).toEqual({ kind: 'neutral' })
  })

  it('reveals the row once the engine records a commitment', () => {
    const state = afterCommitment(settled('preload-drainage-collapse'))
    expect(state.scenario.prediction.committed).toBe(true)
    expect(
      deriveEcmoCircuitPresentation(state, {
        kind: 'drill-reveal',
        rowId: 'drainage-limitation',
      }),
    ).toEqual({ kind: 'implicated', rowId: 'drainage-limitation' })
  })

  it('closes again when the scenario is reloaded', () => {
    const reloaded = ecmoSimulationReducer(afterCommitment(settled('preload-drainage-collapse')), {
      type: 'LOAD_SCENARIO',
      scenarioId: 'preload-drainage-collapse',
    })
    expect(reloaded.scenario.prediction.committed).toBe(false)
    expect(
      deriveEcmoCircuitPresentation(reloaded, {
        kind: 'drill-reveal',
        rowId: 'drainage-limitation',
      }),
    ).toEqual({ kind: 'neutral' })
  })

  it('scaffolds the console tour whether or not anything has been committed', () => {
    const tour = settled('startup-sensor-orientation')
    for (const state of [tour, afterCommitment(tour)]) {
      expect(deriveEcmoCircuitPresentation(state, { kind: 'drill-orientation-scaffold' })).toEqual({
        kind: 'scaffold',
        emphasis: 'sensor-sites',
      })
    }
  })

  it('lets a foundation lesson choose its own emphasis, since it teaches rather than tests', () => {
    expect(
      deriveEcmoCircuitPresentation(settled('preload-drainage-collapse'), {
        kind: 'foundation-scaffold',
        emphasis: 'path-order',
      }),
    ).toEqual({ kind: 'scaffold', emphasis: 'path-order' })
  })
})

describe('the map shows where the walk is standing', () => {
  const LAYOUTS = ['regular', 'compact'] as const

  function walkPresentation(stop: EcmoCircuitWalkStop): EcmoCircuitPresentation {
    return deriveEcmoCircuitPresentation(settled('preload-drainage-collapse'), {
      kind: 'foundation-walk-stop',
      stopId: stop.id,
      segmentIds: ecmoWalkStopSegmentIds(stop),
      sensorSiteIds: stop.sensorSiteIds,
    })
  }

  it.each(LAYOUTS)('%s: marks exactly the segments the stop stands at', (layout) => {
    for (const stop of ecmoCircuitWalkStops) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap
          supportMode="vv"
          presentation={walkPresentation(stop)}
          layout={layout}
        />,
      )
      const marked = [...container.querySelectorAll('[data-walk-stop-segment="true"]')].map(
        (node) => node.getAttribute('data-map-segment'),
      )
      expect(`${stop.id} ${layout}: ${marked.slice().sort().join()}`).toBe(
        `${stop.id} ${layout}: ${ecmoWalkStopSegmentIds(stop).slice().sort().join()}`,
      )
      unmount()
    }
  })

  /*
   * The vocabularies stay disjoint.
   *
   * The drills' leak test asserts that no foundation map sets `data-circuit-implicated`. A walk
   * stop marks segments too, so if it had reused that attribute the assertion would have started
   * failing for a reason that has nothing to do with leaking an answer.
   */
  it('never sets the implicated attribute, and a drill map never sets the walk one', () => {
    for (const stop of ecmoCircuitWalkStops) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode="vv" presentation={walkPresentation(stop)} />,
      )
      expect(container.querySelector('[data-circuit-implicated]')).toBeNull()
      expect(container.querySelector('[data-implicated-marker]')).toBeNull()
      unmount()
    }

    const revealed = deriveEcmoCircuitPresentation(
      afterCommitment(settled('preload-drainage-collapse')),
      { kind: 'drill-reveal', rowId: 'drainage-limitation' },
    )
    const { container } = render(<EcmoCircuitMinimap supportMode="vv" presentation={revealed} />)
    expect(container.querySelector('[data-circuit-implicated]')).not.toBeNull()
    expect(container.querySelector('[data-walk-stop-segment]')).toBeNull()
    expect(container.querySelector('[data-walk-stop-marker]')).toBeNull()
  })

  it('names the stop it is drawing, and says where you are in words', () => {
    const stop = ecmoCircuitWalkStop('walk-membrane')
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={walkPresentation(stop)} />,
    )
    const map = container.querySelector('[data-circuit-minimap]')
    expect(map?.getAttribute('data-presentation')).toBe('walk-stop')
    expect(map?.getAttribute('data-walk-stop')).toBe('walk-membrane')

    // Not colour, not weight: a sentence.
    const caption = container.querySelector('[data-walk-stop-caption]')
    expect(caption?.textContent).toMatch(/^You are here:/)
    expect(caption?.textContent).toContain(
      resolveEcmoModeText(ecmoCircuitSegment('membrane').label, 'vv'),
    )
  })

  it.each(MODES)('%s: flags only the readings the stop is about', (mode) => {
    for (const stop of ecmoCircuitWalkStops) {
      const { container, unmount } = render(
        <EcmoCircuitMinimap supportMode={mode} presentation={walkPresentation(stop)} />,
      )
      const flagged = [...container.querySelectorAll('[data-map-sensor-site]')].map((node) =>
        node.getAttribute('data-map-sensor-site'),
      )
      expect(`${stop.id} ${mode}: ${flagged.slice().sort().join()}`).toBe(
        `${stop.id} ${mode}: ${[...stop.sensorSiteIds].sort().join()}`,
      )
      unmount()
    }
  })

  it('says plainly when a stop has no reading of its own', () => {
    const pump = ecmoCircuitWalkStop('walk-pump')
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={walkPresentation(pump)} />,
    )
    expect(container.querySelectorAll('[data-map-sensor-site]')).toHaveLength(0)
    expect(container.textContent).toMatch(/Nothing on the map is flagged at this stop/i)
  })

  it('marks without colour: weight, a ring, and a caption', () => {
    const stop = ecmoCircuitWalkStop('walk-drainage')
    const { container } = render(
      <EcmoCircuitMinimap supportMode="vv" presentation={walkPresentation(stop)} />,
    )
    const marked = container.querySelector('[data-walk-stop-segment="true"]')
    expect(marked).not.toBeNull()
    expect(marked?.querySelector('[data-walk-stop-marker]')).not.toBeNull()
    // Every stroke in this drawing is currentColor; nothing may introduce a hue of its own.
    expect(container.querySelector('svg')?.innerHTML).not.toMatch(/#[0-9a-f]{3,6}/i)
  })
})
