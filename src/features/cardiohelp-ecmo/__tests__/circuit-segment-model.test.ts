import { buildCircuitLayout } from '../components/ecmo-circuit/layout'
import {
  ecmoBloodPathSegmentIds,
  ecmoBloodPathSegments,
  ecmoCircuitSegment,
  ecmoCircuitSegmentById,
  ecmoCircuitSegmentIds,
  ecmoCircuitSegments,
  ecmoGasPathSegmentIds,
  ecmoGasPathSegments,
  ecmoPressureZone,
  ecmoPressureZoneIds,
  ecmoPressureZones,
  ecmoSensorSite,
  ecmoSensorSiteIds,
  ecmoSensorSites,
  ecmoSensorSitesForSegment,
  resolveEcmoModeText,
  validateEcmoCircuitSegmentModel,
} from '../content/circuitSegments'
import {
  ecmoSceneLabelIdsForSegment,
  ecmoSegmentSceneAnchors,
  validateEcmoSegmentSceneAnchors,
} from '../content/circuitSceneAnchors'
import { evidenceById } from '../content/evidence'

/**
 * The canonical circuit model, checked as a registry rather than as rendered output.
 *
 * Two of these assertions are deliberately a second copy of a fact stated in the source: the blood
 * order below repeats `ecmoBloodPathSegmentIds`, and `foundation-lesson.test.tsx` repeats it a
 * third time against the rendered panel. That is the same two-declaration idiom the drill panel
 * registry uses — a reorder has to be made twice on purpose before it can pass, and the rendered
 * copy proves the promotion changed nothing a learner sees. Anyone tempted to deduplicate one side
 * away should read this paragraph first.
 */

describe('ECMO circuit segment model', () => {
  it('validates cleanly at import and by explicit call', () => {
    expect(validateEcmoCircuitSegmentModel()).toEqual([])
  })

  it('keeps the blood path in the order the circuit walk teaches it', () => {
    expect([...ecmoBloodPathSegmentIds]).toEqual([
      'drainage',
      'pump',
      'pre-membrane',
      'membrane',
      'post-membrane',
      'return',
    ])
    expect(ecmoBloodPathSegments().map((segment) => segment.id)).toEqual([
      ...ecmoBloodPathSegmentIds,
    ])
  })

  it('reconciles the id tuples and the records in both directions', () => {
    expect(new Set(ecmoCircuitSegmentIds).size).toBe(ecmoCircuitSegmentIds.length)
    expect(new Set(ecmoSensorSiteIds).size).toBe(ecmoSensorSiteIds.length)
    expect(new Set(ecmoPressureZoneIds).size).toBe(ecmoPressureZoneIds.length)

    expect(ecmoCircuitSegments.map((segment) => segment.id).sort()).toEqual(
      [...ecmoCircuitSegmentIds].sort(),
    )
    expect(ecmoSensorSites.map((site) => site.id).sort()).toEqual([...ecmoSensorSiteIds].sort())
    expect(ecmoPressureZones.map((zone) => zone.id).sort()).toEqual([...ecmoPressureZoneIds].sort())

    for (const id of ecmoCircuitSegmentIds) expect(ecmoCircuitSegmentById.get(id)?.id).toBe(id)
  })

  it('separates the blood path, the gas path, and the patient terminus', () => {
    expect(ecmoBloodPathSegments().every((segment) => segment.path === 'blood')).toBe(true)
    expect(ecmoGasPathSegments().every((segment) => segment.path === 'gas')).toBe(true)
    expect(ecmoGasPathSegments().map((segment) => segment.id)).toEqual([...ecmoGasPathSegmentIds])
    expect(ecmoCircuitSegment('patient').path).toBe('patient')
  })

  it('throws rather than returning undefined for an unknown id', () => {
    // @ts-expect-error the accessor is typed, and the throw is what protects a cast at a boundary.
    expect(() => ecmoCircuitSegment('oxygenator')).toThrow(/oxygenator/)
    // @ts-expect-error see above.
    expect(() => ecmoSensorSite('pMean')).toThrow(/pMean/)
    // @ts-expect-error see above.
    expect(() => ecmoPressureZone('across-the-pump')).toThrow(/across-the-pump/)
  })

  it('places every sensor site on a segment, and derives only from measured sites', () => {
    for (const site of ecmoSensorSites) {
      expect(ecmoCircuitSegmentById.has(site.segmentId)).toBe(true)
      expect(site.plainName.length).toBeGreaterThan(0)
      expect(site.deviceLabel.length).toBeGreaterThan(0)
      expect(site.measuredAt.length).toBeGreaterThan(0)

      if (site.kind === 'derived') {
        expect(site.derivedFromSiteIds.length).toBeGreaterThan(0)
        for (const sourceId of site.derivedFromSiteIds) {
          expect(ecmoSensorSite(sourceId).kind).toBe('measured')
        }
      } else {
        expect(site.derivedFromSiteIds).toEqual([])
      }
    }

    // The one derived relationship this console reports, and the two channels it is the difference of.
    expect(ecmoSensorSite('deltaP').kind).toBe('derived')
    expect([...ecmoSensorSite('deltaP').derivedFromSiteIds]).toEqual(['pInt', 'pArt'])
    expect(ecmoSensorSite('deltaP').segmentId).toBe('membrane')
  })

  it('reports the sites that sit on a segment, in registry order', () => {
    expect(ecmoSensorSitesForSegment('drainage').map((site) => site.id)).toEqual(['pVen'])
    expect(ecmoSensorSitesForSegment('pre-membrane').map((site) => site.id)).toEqual([
      'pInt',
      'svo2-venous-cell',
    ])
    expect(ecmoSensorSitesForSegment('membrane').map((site) => site.id)).toEqual(['deltaP'])
    expect(ecmoSensorSitesForSegment('post-membrane').map((site) => site.id)).toEqual([
      'pArt',
      'post-oxygenator-saturation',
      'flow-bubble-sensor',
    ])
    expect(ecmoSensorSitesForSegment('pump')).toEqual([])
  })

  it('says which pressure is not a patient measurement, where the site is named', () => {
    expect(ecmoSensorSite('pArt').caution).toMatch(/not the patient/i)
    expect(ecmoSensorSite('pVen').caution).toBeUndefined()
  })

  it('groups the pressure zones the drills compare against each other', () => {
    for (const zone of ecmoPressureZones) {
      expect(zone.label.length).toBeGreaterThan(0)
      expect(zone.segmentIds.length).toBeGreaterThan(0)
      for (const segmentId of zone.segmentIds) {
        expect(ecmoCircuitSegmentById.has(segmentId)).toBe(true)
      }
      for (const siteId of zone.sensorSiteIds) {
        expect(ecmoSensorSite(siteId).id).toBe(siteId)
      }
    }

    expect([...ecmoPressureZone('upstream-of-pump').sensorSiteIds]).toEqual(['pVen'])
    expect([...ecmoPressureZone('across-membrane').sensorSiteIds]).toEqual(['deltaP'])
  })

  it('resolves every registered source id', () => {
    for (const segment of ecmoCircuitSegments) {
      expect(segment.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of segment.sourceIds) {
        expect(evidenceById.has(sourceId)).toBe(true)
      }
    }
  })

  it('reads in both tracks, and flips only what the track actually changes', () => {
    for (const segment of ecmoCircuitSegments) {
      for (const supportMode of ['vv', 'va'] as const) {
        expect(resolveEcmoModeText(segment.label, supportMode).length).toBeGreaterThan(0)
        expect(resolveEcmoModeText(segment.mapLabel, supportMode).length).toBeGreaterThan(0)
        expect(resolveEcmoModeText(segment.detail, supportMode).length).toBeGreaterThan(0)
      }
    }

    const returnSegment = ecmoCircuitSegment('return')
    expect(resolveEcmoModeText(returnSegment.label, 'vv')).toBe('Venous return to the patient')
    expect(resolveEcmoModeText(returnSegment.label, 'va')).toBe('Arterial return to the patient')

    // Everything upstream of the return is one shared definition, not two track copies.
    const drainage = ecmoCircuitSegment('drainage')
    expect(resolveEcmoModeText(drainage.detail, 'vv')).toBe(
      resolveEcmoModeText(drainage.detail, 'va'),
    )
  })

  it('carries no number a learner could read as a target', () => {
    const strings = [
      ...ecmoCircuitSegments.flatMap((segment) =>
        (['vv', 'va'] as const).flatMap((mode) => [
          resolveEcmoModeText(segment.label, mode),
          resolveEcmoModeText(segment.mapLabel, mode),
          resolveEcmoModeText(segment.detail, mode),
        ]),
      ),
      ...ecmoSensorSites.flatMap((site) => [
        site.plainName,
        site.deviceLabel,
        site.stopLabel,
        site.mapLabel,
        site.measuredAt,
        site.caution ?? '',
      ]),
      ...ecmoPressureZones.map((zone) => zone.label),
    ]
    for (const value of strings) expect(value).not.toMatch(/\d/)
  })
})

describe('ECMO segment-to-scene anchors', () => {
  it('validates structurally and covers every segment exactly once', () => {
    expect(validateEcmoSegmentSceneAnchors()).toEqual([])
    expect(ecmoSegmentSceneAnchors.map((anchor) => anchor.segmentId).sort()).toEqual(
      [...ecmoCircuitSegmentIds].sort(),
    )
  })

  it.each(['vv', 'va'] as const)(
    'names only labels the %s bedside scene actually builds',
    (supportMode) => {
      const sceneLabelIds = new Set(buildCircuitLayout(supportMode).labels.map((label) => label.id))
      for (const segmentId of ecmoCircuitSegmentIds) {
        for (const labelId of ecmoSceneLabelIdsForSegment(segmentId, supportMode)) {
          expect(sceneLabelIds.has(labelId)).toBe(true)
        }
      }
    },
  )

  it('offers the distal perfusion catheter only where the scene builds one', () => {
    expect(ecmoSceneLabelIdsForSegment('return', 'va')).toContain('dpc')
    expect(ecmoSceneLabelIdsForSegment('return', 'vv')).not.toContain('dpc')
  })

  it('keeps the seam a table of strings, so R3 can adapt it without touching the registry', () => {
    for (const anchor of ecmoSegmentSceneAnchors) {
      for (const labelId of anchor.sceneLabelIds) expect(typeof labelId).toBe('string')
      for (const labelId of anchor.vaOnlySceneLabelIds ?? []) {
        expect(typeof labelId).toBe('string')
        // A VA-only anchor that also appeared in the shared list would render twice under VA.
        expect(anchor.sceneLabelIds).not.toContain(labelId)
      }
    }
  })
})
