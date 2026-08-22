import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  ecmoBloodPathSegmentIds,
  ecmoCircuitSegmentIds,
  ecmoPressureZoneIds,
  ecmoSensorSiteIds,
  ecmoSensorSite,
  ecmoSensorSitesForSegment,
  resolveEcmoModeText,
} from '../content/circuitSegments'
import { ecmoSceneLabelIdsForSegment } from '../content/circuitSceneAnchors'
import {
  ecmoCircuitWalkStop,
  ecmoCircuitWalkStopIds,
  ecmoCircuitWalkStops,
  ecmoCircuitWalkStopsForSection,
  ecmoWalkStopSceneLabelIds,
  ecmoWalkStopSegmentIds,
  ecmoWalkStopTextEquivalent,
  hasEcmoCircuitWalk,
  validateEcmoCircuitWalk,
} from '../content/circuitWalk'
import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationVariants,
  ecmoInteractiveFoundationSectionIds,
} from '../content/foundationLessonRuntime'
import { evidenceById } from '../content/evidence'
import type { SupportMode } from '../engine/types'

const MODES: readonly SupportMode[] = ['vv', 'va']
const WALK_SECTIONS = ['circuit-flow-path', 'pump-and-pressure-zones'] as const

const walkSource = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/content/circuitWalk.ts'),
  'utf8',
)

describe('the circuit walk is six stops across two sections', () => {
  it('registers exactly six, with unique ids', () => {
    expect(ecmoCircuitWalkStops).toHaveLength(6)
    expect(new Set(ecmoCircuitWalkStopIds).size).toBe(6)
    expect(ecmoCircuitWalkStops.map((stop) => stop.id)).toEqual([...ecmoCircuitWalkStopIds])
  })

  it('numbers them one to six, continuously, across both sections', () => {
    expect(ecmoCircuitWalkStops.map((stop) => stop.ordinal)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('puts the first four on the flow path and the last two on the pump section', () => {
    expect(ecmoCircuitWalkStopsForSection('circuit-flow-path').map((stop) => stop.id)).toEqual([
      'walk-drainage',
      'walk-pump',
      'walk-membrane',
      'walk-return',
    ])
    expect(
      ecmoCircuitWalkStopsForSection('pump-and-pressure-zones').map((stop) => stop.id),
    ).toEqual(['walk-pump-under-load', 'walk-downstream-load'])
  })

  it('leaves every other foundation section without a walk', () => {
    for (const sectionId of ecmoInteractiveFoundationSectionIds) {
      const expected = (WALK_SECTIONS as readonly string[]).includes(sectionId)
      expect(`${sectionId}: ${hasEcmoCircuitWalk(sectionId)}`).toBe(`${sectionId}: ${expected}`)
    }
  })

  it('validates clean at import', () => {
    expect(validateEcmoCircuitWalk()).toEqual([])
  })

  it('throws rather than returning a hole for an unknown id', () => {
    expect(() => ecmoCircuitWalkStop('walk-nowhere' as never)).toThrow(
      /Unknown ECMO circuit walk stop/,
    )
  })
})

describe('every place a stop names comes from the shared registry', () => {
  it('resolves every segment, sensor site and pressure zone', () => {
    for (const stop of ecmoCircuitWalkStops) {
      for (const segmentId of ecmoWalkStopSegmentIds(stop)) {
        expect(ecmoCircuitSegmentIds).toContain(segmentId)
      }
      for (const siteId of stop.sensorSiteIds) expect(ecmoSensorSiteIds).toContain(siteId)
      for (const zoneId of stop.pressureZoneIds) expect(ecmoPressureZoneIds).toContain(zoneId)
    }
  })

  it('never reports a reading at a place the stop is not standing at', () => {
    for (const stop of ecmoCircuitWalkStops) {
      const places = ecmoWalkStopSegmentIds(stop)
      const available = places.flatMap((segmentId) =>
        ecmoSensorSitesForSegment(segmentId).map((site) => site.id),
      )
      for (const siteId of stop.sensorSiteIds) {
        expect(`${stop.id} reports ${siteId}`).toBe(
          `${stop.id} reports ${available.includes(siteId) ? siteId : 'a site it does not stand at'}`,
        )
      }
    }
  })

  /*
   * No second anatomy registry.
   *
   * The failure this guards against is a walk that starts describing the circuit in its own words —
   * a stop that hard-codes "post-oxygenator" as prose, or invents a place id, and then drifts from
   * the registry the map and the drills read. The scan is deliberately narrow: the walk may name
   * ids, and it may not restate the labels that belong to them.
   */
  it('does not restate a label the segment registry already owns', () => {
    // The walk imports its vocabulary; it does not declare one.
    expect(walkSource).toMatch(/from '\.\/circuitSegments'/)
    expect(walkSource).not.toMatch(/ecmoCircuitSegments\s*[:=]\s*\[/)
    expect(walkSource).not.toMatch(/ecmoSensorSites\s*[:=]\s*\[/)
    expect(walkSource).not.toMatch(/ecmoPressureZones\s*[:=]\s*\[/)
  })

  it('imports no React, no three.js, and no engine values', () => {
    expect(walkSource).not.toMatch(/from 'react'/)
    expect(walkSource).not.toMatch(/from 'three'/)
    expect(walkSource).not.toMatch(/from '\.\.\/engine'/)
    // The engine type import is a type-only import of SupportMode, which carries no value.
    expect(walkSource).toMatch(/import type \{ SupportMode \} from '\.\.\/engine\/types'/)
  })
})

describe('the first section walks the blood path', () => {
  it('covers every blood-path segment exactly once', () => {
    const covered = ecmoCircuitWalkStopsForSection('circuit-flow-path')
      .flatMap((stop) => ecmoWalkStopSegmentIds(stop))
      .filter((segmentId) => (ecmoBloodPathSegmentIds as readonly string[]).includes(segmentId))
    expect(covered.slice().sort()).toEqual([...ecmoBloodPathSegmentIds].sort())
    expect(covered).toHaveLength(ecmoBloodPathSegmentIds.length)
  })

  it('advances along the path and never doubles back', () => {
    const primaries = ecmoCircuitWalkStopsForSection('circuit-flow-path').map((stop) =>
      (ecmoBloodPathSegmentIds as readonly string[]).indexOf(stop.primarySegmentId),
    )
    for (let index = 1; index < primaries.length; index += 1) {
      expect(primaries[index]).toBeGreaterThan(primaries[index - 1])
    }
  })

  it('introduces every console reading exactly once across the four stops', () => {
    const reported = ecmoCircuitWalkStopsForSection('circuit-flow-path').flatMap(
      (stop) => stop.sensorSiteIds,
    )
    expect(reported.slice().sort()).toEqual([...ecmoSensorSiteIds].sort())
  })
})

describe('the walk reaches the bedside scene through the R2 seam and nothing else', () => {
  it.each(MODES)('%s: resolves every stop to scene labels the scene actually builds', (mode) => {
    for (const stop of ecmoCircuitWalkStops) {
      const labels = ecmoWalkStopSceneLabelIds(stop, mode)
      expect(labels.length).toBeGreaterThan(0)
      expect(new Set(labels).size).toBe(labels.length)

      const expected = new Set(
        ecmoWalkStopSegmentIds(stop).flatMap((segmentId) =>
          ecmoSceneLabelIdsForSegment(segmentId, mode),
        ),
      )
      expect(new Set(labels)).toEqual(expected)
    }
  })

  it('adds the distal perfusion catheter under VA, at exactly the stops standing on the return', () => {
    for (const stop of ecmoCircuitWalkStops) {
      const standsOnReturn = ecmoWalkStopSegmentIds(stop).includes('return')
      expect(`${stop.id} VA dpc: ${ecmoWalkStopSceneLabelIds(stop, 'va').includes('dpc')}`).toBe(
        `${stop.id} VA dpc: ${standsOnReturn}`,
      )
      // The catheter does not exist on a VV circuit, so no stop may light it there.
      expect(`${stop.id} VV dpc: ${ecmoWalkStopSceneLabelIds(stop, 'vv').includes('dpc')}`).toBe(
        `${stop.id} VV dpc: false`,
      )
    }
    expect(ecmoWalkStopSegmentIds(ecmoCircuitWalkStop('walk-return'))).toContain('return')
  })

  /*
   * Recorded rather than worked around.
   *
   * The pump, both pressure locations either side of it and the membrane's gas side are one
   * integrated disposable on this device, so three stops resolve to the same scene label. R2 left
   * adding separate anchors as an R3 decision with a geometry contract attached; this package
   * declined it and says so in the stop copy instead. If a later package adds the anchors, this
   * test is where the change announces itself.
   */
  /*
   * Found by looking at the render rather than by reasoning about it.
   *
   * The terminus segment resolves to *both* femoral access sites, because the loop opens and closes
   * on the patient. Naming it as a secondary place — which reads as obviously right — lit the return
   * cannula at the stop about drainage, and the drainage cannula at the stop about return. Neither
   * stop stands at the patient, so neither names it, and this is the pin.
   */
  it('never lights the access site at the far end of the circuit from the stop', () => {
    expect(ecmoWalkStopSceneLabelIds(ecmoCircuitWalkStop('walk-drainage'), 'vv')).not.toContain(
      'return-site',
    )
    expect(ecmoWalkStopSceneLabelIds(ecmoCircuitWalkStop('walk-return'), 'vv')).not.toContain(
      'drainage-site',
    )
    for (const stop of ecmoCircuitWalkStops) {
      expect(
        `${stop.id} stands at patient: ${ecmoWalkStopSegmentIds(stop).includes('patient')}`,
      ).toBe(`${stop.id} stands at patient: false`)
    }
  })

  it('lights the same one object at the pump and at the membrane, and says so', () => {
    for (const id of ['walk-pump', 'walk-membrane'] as const) {
      expect(`${id}: ${ecmoWalkStopSceneLabelIds(ecmoCircuitWalkStop(id), 'vv').join()}`).toBe(
        `${id}: hls-module`,
      )
    }
    // The learner is told why two stops in a row look identical in the scene, rather than left to
    // conclude the highlight is broken.
    expect(resolveEcmoModeText(ecmoCircuitWalkStop('walk-pump').modelBoundary, 'vv')).toMatch(
      /one integrated disposable/i,
    )
  })

  /*
   * The resolved emphasis of the return-side stops, as an outcome rather than a table entry.
   *
   * The independent review remapped `post-membrane` to `hls-module` — a valid scene label on the
   * wrong object — and every test above stayed green, because they checked that anchors resolve
   * and stay consistent with the table, never what the table ought to say. These cases pin the
   * final resolved set each return-side stop hands the scene, so a wrong-but-valid mapping fails
   * with the stop's name on it.
   */
  it.each(MODES)(
    '%s: the return stop lights the flow sensor and the return path, and nothing upstream',
    (mode) => {
      const resolved = new Set(ecmoWalkStopSceneLabelIds(ecmoCircuitWalkStop('walk-return'), mode))
      const expected = new Set(
        mode === 'va'
          ? ['sensor', 'return-site', 'return-clamp', 'dpc']
          : ['sensor', 'return-site', 'return-clamp'],
      )
      expect(resolved).toEqual(expected)
      // Spelled out even though the set equality implies it: the emphasized objects must never
      // include the drainage side, which is the far end of the circuit from this stop.
      expect(resolved.has('drainage-site')).toBe(false)
      expect(resolved.has('drainage-clamp')).toBe(false)
    },
  )

  it.each(MODES)(
    '%s: the downstream-load stop lights everything the pattern spans, and nothing upstream',
    (mode) => {
      const resolved = new Set(
        ecmoWalkStopSceneLabelIds(ecmoCircuitWalkStop('walk-downstream-load'), mode),
      )
      // Post-membrane (the sensor), the pre-membrane location and the membrane (the one integrated
      // disposable), and the return path where the resistance actually lives.
      const expected = new Set(
        mode === 'va'
          ? ['sensor', 'hls-module', 'return-site', 'return-clamp', 'dpc']
          : ['sensor', 'hls-module', 'return-site', 'return-clamp'],
      )
      expect(resolved).toEqual(expected)
      expect(resolved.has('drainage-site')).toBe(false)
      expect(resolved.has('drainage-clamp')).toBe(false)
    },
  )

  /*
   * The mapping and the geometry agree: the object anchoring `post-membrane` sits on the
   * post-membrane run.
   *
   * `layout.ts` places the flow/bubble sensor by construction on the return line, so the label
   * the anchor table names for the post-membrane segment is the one scene object whose position
   * lies on the tubing that segment describes. This is what makes `sensor` the right answer and
   * `hls-module` — the review's mutation — a wrong one, in geometric terms rather than by fiat.
   */
  it.each(MODES)(
    '%s: post-membrane anchors the object that sits on the post-membrane tubing',
    (mode) => {
      expect(ecmoSceneLabelIdsForSegment('post-membrane', mode)).toEqual(['sensor'])

      // Lazy import so this file's content-purity checks stay about `content/`, which still holds
      // no three.js; the test itself may read the scene's geometry.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { buildCircuitLayout } = require('../components/ecmo-circuit/layout') as {
        buildCircuitLayout: (mode: SupportMode) => {
          sensorPosition: { distanceTo: (other: unknown) => number }
          returnLine: { getPoints: (count: number) => { distanceTo: (o: unknown) => number }[] }
          drainageLine: { getPoints: (count: number) => { distanceTo: (o: unknown) => number }[] }
        }
      }
      const layout = buildCircuitLayout(mode)
      const nearest = (points: { distanceTo: (o: unknown) => number }[]) =>
        Math.min(...points.map((point) => point.distanceTo(layout.sensorPosition)))
      const toReturnLine = nearest(layout.returnLine.getPoints(200))
      const toDrainageLine = nearest(layout.drainageLine.getPoints(200))
      expect(toReturnLine).toBeLessThan(0.02)
      expect(toDrainageLine).toBeGreaterThan(toReturnLine + 0.1)
    },
  )
})

describe('the walk is authored so both tracks read the same lesson', () => {
  it.each(MODES)('%s: resolves every learner-facing string non-empty', (mode) => {
    for (const stop of ecmoCircuitWalkStops) {
      expect(resolveEcmoModeText(stop.title, mode).length).toBeGreaterThan(0)
      expect(resolveEcmoModeText(stop.analogy, mode).length).toBeGreaterThan(0)
      expect(resolveEcmoModeText(stop.takeaway, mode).length).toBeGreaterThan(0)
      expect(resolveEcmoModeText(stop.modelBoundary, mode).length).toBeGreaterThan(0)
      for (const item of stop.checklist) {
        expect(resolveEcmoModeText(item, mode).length).toBeGreaterThan(0)
      }
    }
  })

  it('never names a track, a vessel, or a support mode in shared copy', () => {
    for (const stop of ecmoCircuitWalkStops) {
      const shared = [
        stop.title,
        stop.analogy,
        stop.takeaway,
        stop.modelBoundary,
        ...stop.checklist,
      ]
      for (const text of shared) {
        if (typeof text !== 'string') continue
        // A per-track fact belongs in the mode-keyed form, where both tracks get an answer.
        expect(`${stop.id}: ${text}`).not.toMatch(/\b(venovenous|venoarterial|VV|VA)\b/)
      }
    }
  })

  it('keeps every checklist to four items or fewer', () => {
    for (const stop of ecmoCircuitWalkStops) {
      expect(`${stop.id}: ${stop.checklist.length}`).toBe(
        `${stop.id}: ${Math.min(stop.checklist.length, 4)}`,
      )
      expect(stop.checklist.length).toBeGreaterThan(0)
    }
  })
})

describe('the walk carries no authored quantity', () => {
  it.each(MODES)('%s: has no digit in any learner-facing string', (mode) => {
    for (const stop of ecmoCircuitWalkStops) {
      const strings = [
        resolveEcmoModeText(stop.title, mode),
        resolveEcmoModeText(stop.analogy, mode),
        resolveEcmoModeText(stop.takeaway, mode),
        resolveEcmoModeText(stop.modelBoundary, mode),
        ...stop.checklist.map((item) => resolveEcmoModeText(item, mode)),
        ...(stop.comparison ?? []).flatMap((beat) => [beat.label, beat.readThis]),
      ]
      for (const value of strings) {
        expect(`${stop.id}: ${value}`).not.toMatch(/\d/)
      }
    }
  })

  it('states a model boundary at every stop', () => {
    for (const stop of ecmoCircuitWalkStops) {
      expect(`${stop.id}: ${resolveEcmoModeText(stop.modelBoundary, 'vv')}`).toMatch(
        /simulation|model|author|device/i,
      )
    }
  })

  it('registers every source it names', () => {
    for (const stop of ecmoCircuitWalkStops) {
      expect(stop.sourceIds.length).toBeGreaterThan(0)
      for (const id of stop.sourceIds) expect(evidenceById.has(id)).toBe(true)
      expect(stop.sourceIds).toContain('bounded-educational-model')
    }
  })
})

describe('the comparative stop names actions the lesson runtime declares', () => {
  /*
   * The cross-registry check lives here rather than in `validateEcmoCircuitWalk`.
   *
   * The walk knows its own shape at import; whether an action exists is a fact about a different
   * throwing module, and making one import-time validator depend on another's initialisation order
   * buys a confusing failure mode for no extra safety. A test proves the same thing without the
   * coupling.
   */
  it('resolves every beat to a guided action its own section offers', () => {
    for (const stop of ecmoCircuitWalkStopsForSection('pump-and-pressure-zones')) {
      const runtime = ecmoFoundationLessonRuntime(stop.sectionId)
      const actionIds = runtime.guidedActions.map((action) => action.id)
      for (const beat of stop.comparison ?? []) {
        expect(`${beat.id} → ${beat.guidedActionId}`).toBe(
          `${beat.id} → ${actionIds.includes(beat.guidedActionId) ? beat.guidedActionId : actionIds.join('|')}`,
        )
      }
    }
  })

  it('resolves every beat action to a state that exists in both tracks', () => {
    const runtime = ecmoFoundationLessonRuntime('pump-and-pressure-zones')
    for (const mode of MODES) {
      const variantIds = ecmoFoundationVariants(runtime, mode).map((variant) => variant.id)
      for (const stop of ecmoCircuitWalkStopsForSection('pump-and-pressure-zones')) {
        for (const beat of stop.comparison ?? []) {
          const action = runtime.guidedActions.find((entry) => entry.id === beat.guidedActionId)
          expect(action).toBeDefined()
          if (!action?.variantId) continue
          expect(`${mode} ${beat.id} → ${action.variantId}`).toBe(
            `${mode} ${beat.id} → ${variantIds.includes(action.variantId) ? action.variantId : variantIds.join('|')}`,
          )
        }
      }
    }
  })

  it('is the only comparative stop, and it has at least a baseline and a change', () => {
    const comparative = ecmoCircuitWalkStops.filter((stop) => stop.kind === 'comparative')
    expect(comparative.map((stop) => stop.id)).toEqual(['walk-downstream-load'])
    expect((comparative[0].comparison ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

/*
 * The guard that was missing.
 *
 * Stop five's conclusion shipped as the keyed answer to its own section's prediction, rendered in
 * the pane beside the question with nothing committed. Four independent reviewers found it and the
 * plan's own deny list had predicted it, which is the argument for asserting it rather than
 * remembering it.
 *
 * What is checked is the *claim*, not the words. Stop six has to be able to say that the drainage
 * side does not become more negative — that is the discriminator its whole comparison exists to
 * draw, and it is the module's own wording for it — so an explicitly negated form is neutralised
 * before the phrases are looked for. A guard that could not tell "X" from "not X" would have forced
 * a paraphrase, and paraphrasing a correct sentence to get past a test is how this module's
 * vocabulary drifts.
 */
describe('no stop states its own section’s answer before the section asks for it', () => {
  /** The distinctive claims each section's prediction exists to elicit, in affirmative form. */
  const KEYED_CLAIMS: Readonly<Record<string, readonly RegExp[]>> = {
    // `ecmo.foundation.path.prediction` — where is pInt reported?
    'circuit-flow-path': [
      /\bpInt\b/i,
      /between the pump (outlet )?and the membrane/i,
      /pre-membrane pressure/i,
    ],
    // `ecmo.foundation.pump.prediction` — a speed rise, and what it costs on the drainage side.
    'pump-and-pressure-zones': [
      /becomes? more negative/i,
      /pull(s|ing) harder/i,
      /bought with suction/i,
      /flow follows speed/i,
    ],
  }

  /** Explicit denials of a claim are not the claim. */
  function withoutNegations(copy: string): string {
    return copy.replace(/\b(does|do|did|is|are|was|were|has|have)\s+not\s+[^.;]*/gi, ' ')
  }

  function preCommitmentCopy(stop: (typeof ecmoCircuitWalkStops)[number], mode: SupportMode) {
    const takeawayShown = (stop.takeawayVisibility ?? 'always') === 'always'
    return [
      resolveEcmoModeText(stop.title, mode),
      resolveEcmoModeText(stop.analogy, mode),
      ...stop.checklist.map((item) => resolveEcmoModeText(item, mode)),
      ...(takeawayShown ? [resolveEcmoModeText(stop.takeaway, mode)] : []),
      ...(stop.comparison ?? []).flatMap((beat) => [beat.label, beat.readThis]),
      ecmoWalkStopTextEquivalent(stop, mode, { readingsVisible: false }),
    ].join(' ')
  }

  it.each(MODES)('%s: withholds every claim its own section is about to ask for', (mode) => {
    for (const stop of ecmoCircuitWalkStops) {
      const claims = KEYED_CLAIMS[stop.sectionId]
      if (!claims) continue
      const copy = withoutNegations(preCommitmentCopy(stop, mode))
      for (const claim of claims) {
        expect(`${stop.id}/${mode}: ${claim} → ${claim.test(copy) ? 'STATED' : 'absent'}`).toBe(
          `${stop.id}/${mode}: ${claim} → absent`,
        )
      }
    }
  })

  it('neutralises a denial, and nothing else', () => {
    // The stop-six sentence this exists for, and the affirmative it must still catch.
    expect(withoutNegations('The drainage side does not become more negative')).not.toMatch(
      /becomes? more negative/i,
    )
    expect(withoutNegations('The drainage pressure becomes more negative')).toMatch(
      /becomes? more negative/i,
    )
  })

  it('says everything once the prediction has been taken', () => {
    // The gate withholds; it does not delete. Stop five's conclusion is still the conclusion.
    const stop = ecmoCircuitWalkStop('walk-pump-under-load')
    expect(stop.takeawayVisibility).toBe('after-prediction')
    expect(resolveEcmoModeText(stop.takeaway, 'vv')).toMatch(/bought with suction/i)
    expect(ecmoWalkStopTextEquivalent(stop, 'vv', { readingsVisible: true })).toMatch(
      /Reported here: drainage pressure/i,
    )
  })

  it('names no reading in a text equivalent written before the prediction', () => {
    for (const stop of ecmoCircuitWalkStops) {
      const withheld = ecmoWalkStopTextEquivalent(stop, 'vv', { readingsVisible: false })
      expect(withheld).not.toMatch(/Reported here:/)
      for (const siteId of stop.sensorSiteIds) {
        expect(`${stop.id}: ${withheld}`).not.toContain(ecmoSensorSite(siteId).deviceLabel)
      }
    }
  })
})

describe('the text equivalent replaces looking at the stop', () => {
  it.each(MODES)('%s: names the place, the checklist, the zones, and the boundary', (mode) => {
    for (const stop of ecmoCircuitWalkStops) {
      const prose = ecmoWalkStopTextEquivalent(stop, mode)
      expect(prose).toContain(resolveEcmoModeText(stop.title, mode))
      expect(prose).toContain(resolveEcmoModeText(stop.analogy, mode))
      for (const item of stop.checklist) {
        expect(prose).toContain(resolveEcmoModeText(item, mode))
      }
      expect(prose).toContain(resolveEcmoModeText(stop.modelBoundary, mode))
    }
  })

  /*
   * The takeaway is what the learner should be able to say having stood here, and it is shown after
   * the stop rather than beside it. Putting it in the text equivalent would hand a screen-reader
   * user the conclusion a sighted learner reaches a step later.
   */
  it('withholds the takeaway', () => {
    for (const stop of ecmoCircuitWalkStops) {
      for (const mode of MODES) {
        expect(ecmoWalkStopTextEquivalent(stop, mode)).not.toContain(
          resolveEcmoModeText(stop.takeaway, mode),
        )
      }
    }
  })

  it('says plainly when a place reports nothing of its own', () => {
    const pump = ecmoCircuitWalkStop('walk-pump')
    expect(pump.sensorSiteIds).toEqual([])
    expect(ecmoWalkStopTextEquivalent(pump, 'vv')).toMatch(/no reading is taken at this place/i)
  })
})

/*
 * The stylesheet, asserted — because the defect it prevents is invisible to every DOM test.
 *
 * The emphasis attributes were correct all along; the browser held the previous stop's opacity
 * because the transition these labels inherit never advanced. Only a production build showed it,
 * so what is pinned here is the CSS itself: the states carry their own `transition: none`, and the
 * orbit dim keeps precedence over them.
 */
describe('the scene-label emphasis is painted, not animated', () => {
  const css = readFileSync(
    join(process.cwd(), 'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css'),
    'utf8',
  )

  function ruleFor(selector: string): string {
    const start = css.indexOf(selector)
    expect(`${selector} present: ${start >= 0}`).toBe(`${selector} present: true`)
    return css.slice(start, css.indexOf('}', start))
  }

  it('cancels the inherited fade on any emphasis state', () => {
    expect(ruleFor('.circuit3dSceneLabel[data-emphasis] {')).toMatch(/transition:\s*none/)
  })

  it('distinguishes the emphasised label by more than opacity', () => {
    const emphasised = ruleFor(".circuit3dSceneLabel[data-emphasis='emphasised'] {")
    // Weight and a ring, so the state survives being read by someone who cannot compare two teals.
    expect(emphasised).toMatch(/border-width/)
    expect(emphasised).toMatch(/box-shadow/)
    expect(emphasised).toMatch(/opacity:\s*1/)
  })

  it('recedes the rest without making them unreadable, and never hides them', () => {
    const receded = ruleFor(".circuit3dSceneLabel[data-emphasis='receded'] {")
    const opacity = Number(/opacity:\s*([\d.]+)/.exec(receded)?.[1])
    expect(opacity).toBeGreaterThan(0.25)
    expect(opacity).toBeLessThan(1)
  })

  it('lets the orbit dim win, so labels still clear out of the way while a learner drags', () => {
    const dimmed = ruleFor('.circuit3dSceneLabel[data-dimmed][data-emphasis] {')
    expect(dimmed).toMatch(/opacity:\s*0\.08/)
    // Declared after the emphasis states, so equal specificity resolves in its favour.
    expect(css.indexOf('[data-dimmed][data-emphasis]')).toBeGreaterThan(
      css.indexOf("[data-emphasis='emphasised']"),
    )
  })
})
