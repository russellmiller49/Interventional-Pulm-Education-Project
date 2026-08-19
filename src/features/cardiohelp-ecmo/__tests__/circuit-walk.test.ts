import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  ecmoBloodPathSegmentIds,
  ecmoCircuitSegmentIds,
  ecmoPressureZoneIds,
  ecmoSensorSiteIds,
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
