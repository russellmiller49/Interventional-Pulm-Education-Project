import type { SupportMode } from '../engine/types'
import { validateEvidenceIds } from './evidence'

/**
 * One circuit, named once, for every surface that points at a place on it.
 *
 * The module already taught this vocabulary — it just taught it three times. The circuit-walk stop
 * list lived as a private array inside `CircuitFlowPathPanel`, the pressure-comparison groupings
 * lived as row labels inside the drill panels, and the sensor locations lived as free prose in each
 * panel's signal register. Three copies of one taxonomy drift, and a learner who is told "upstream
 * of the pump" in one lesson and "the drainage side" in the next has to work out that those are the
 * same claim.
 *
 * So: segments are physical extents, sensor sites are the places a displayed signal is produced,
 * and pressure zones are the groupings the drills compare against each other. Every consumer names
 * a place by id and renders whatever this file says that place is called.
 *
 * Pure content. No React, no three.js, no engine values — the circuit map marks this, the localization
 * rows point into it, and the later circuit walk will drive it, and none of those may fork it.
 * Deliberately *not* here: clamp positions, the VA mixing region, and anything about the patient's
 * own circulation. Those are different models with different boundaries, and folding them in would
 * make this file the place a learner is told something the simulation does not represent.
 */

/**
 * Text that is either shared by both tracks or authored per track.
 *
 * Most of this circuit is the same circuit in VV and VA — the pump does not know which vessel the
 * return cannula sits in. Only the return, where the difference actually lives, is authored twice.
 * A per-track copy of the whole registry would let the two drift apart on facts that never differ.
 */
export type EcmoModeText = string | { readonly vv: string; readonly va: string }

export function resolveEcmoModeText(text: EcmoModeText, supportMode: SupportMode): string {
  return typeof text === 'string' ? text : text[supportMode]
}

/**
 * The blood path, in the order blood travels it.
 *
 * This tuple is the ordering authority. `foundation-lesson.test.tsx` asserts the same order against
 * the rendered circuit-walk stops, and `circuit-segment-model.test.ts` asserts it here, so a
 * reorder has to be made deliberately in two places before anything passes.
 */
export const ecmoBloodPathSegmentIds = [
  'drainage',
  'pump',
  'pre-membrane',
  'membrane',
  'post-membrane',
  'return',
] as const
export type EcmoBloodPathSegmentId = (typeof ecmoBloodPathSegmentIds)[number]

/**
 * The gas path, as two segments rather than four.
 *
 * The gas drill inspects four stations — source, blender, the line into the membrane, and the
 * membrane's gas side — and that order is the teaching. It lives in the localization row's cause
 * list, where a learner reads it, rather than as four nodes on a schematic that has to stay legible
 * in a pane whose floor is two hundred and eighty pixels. `gas-supply` is everything before the
 * membrane; `membrane-gas-side` is the other side of the membrane from the blood. The id union is
 * additive, so a later package that needs the stations drawn separately can subdivide `gas-supply`
 * without renaming anything.
 */
export const ecmoGasPathSegmentIds = ['gas-supply', 'membrane-gas-side'] as const
export type EcmoGasPathSegmentId = (typeof ecmoGasPathSegmentIds)[number]

/** Every segment, including the terminus the loop opens and closes on. */
export const ecmoCircuitSegmentIds = [
  'patient',
  ...ecmoBloodPathSegmentIds,
  ...ecmoGasPathSegmentIds,
] as const
export type EcmoCircuitSegmentId = (typeof ecmoCircuitSegmentIds)[number]

export type EcmoCircuitPathKind = 'patient' | 'blood' | 'gas'

export interface EcmoCircuitSegment {
  readonly id: EcmoCircuitSegmentId
  readonly path: EcmoCircuitPathKind
  /** The full name a lesson uses in prose and a text equivalent reads out. */
  readonly label: EcmoModeText
  /** A short name for a drawing with no room for the label: registry vocabulary, kept for that use. */
  readonly mapLabel: EcmoModeText
  /** What happens here, one sentence, as the circuit walk states it. */
  readonly detail: EcmoModeText
  readonly sourceIds: readonly string[]
}

/**
 * Where a displayed signal is produced.
 *
 * Separate from the segment because a site is not a place so much as a claim about a place: which
 * channel reports it, whether this console displays it at all, and — for the gradient — that it is
 * a relationship between two other sites rather than a measurement of its own.
 */
export const ecmoSensorSiteIds = [
  'pVen',
  'pInt',
  'svo2-venous-cell',
  'deltaP',
  'pArt',
  'post-oxygenator-saturation',
  'flow-bubble-sensor',
] as const
export type EcmoSensorSiteId = (typeof ecmoSensorSiteIds)[number]

export interface EcmoSensorSite {
  readonly id: EcmoSensorSiteId
  /** Plain name first, always: "drainage pressure" before "pVen". */
  readonly plainName: string
  /** What this manufacturer prints on the screen. */
  readonly deviceLabel: string
  /** What the circuit-walk stop lists under "Reported here". */
  readonly stopLabel: string
  /** What a map rings at this location. */
  readonly mapLabel: string
  readonly kind: 'measured' | 'derived'
  readonly segmentId: EcmoCircuitSegmentId
  /** Non-empty exactly when the site is derived: the sites it is computed from. */
  readonly derivedFromSiteIds: readonly EcmoSensorSiteId[]
  /** Where it is taken, phrased as the drill signal registers phrase it. */
  readonly measuredAt: string
  readonly channel: 'console' | 'off-console'
  /**
   * A confusion this site invites, stated wherever the site is named in full.
   *
   * Only `pArt` carries one, and it carries the same correction the circuit-walk panel has always
   * made: the name reads like a patient measurement and is not one.
   */
  readonly caution?: string
}

/**
 * The groupings a pressure pattern is read in.
 *
 * These are the row labels the drills already use — "upstream of the pump", "downstream of the
 * pump", "across the membrane" — promoted so the localization rows can point at them by id instead
 * of restating them. A zone is where a pattern *shows*; where the problem *lives* is a property of
 * the localization row, because the two are not the same place. Return-side resistance shows in the
 * downstream zone and lives in the return path, and collapsing that distinction is exactly the
 * error the drills exist to prevent.
 */
export const ecmoPressureZoneIds = [
  'upstream-of-pump',
  'downstream-of-pump',
  'across-membrane',
] as const
export type EcmoPressureZoneId = (typeof ecmoPressureZoneIds)[number]

export interface EcmoPressureZone {
  readonly id: EcmoPressureZoneId
  readonly label: string
  readonly segmentIds: readonly EcmoCircuitSegmentId[]
  readonly sensorSiteIds: readonly EcmoSensorSiteId[]
}

/*
 * Sources chosen for what they actually say about circuit anatomy.
 *
 * `ecmo-book-ch9` is registered as supporting "circuit pressure zones, sensor orientation" and
 * `elso-circuit-2022` as supporting "circuit components, monitoring" — between them they cover
 * every claim a segment record makes. `ecmo-book-ch16` is deliberately absent even though the
 * circuit-walk section cites it: that record supports naming a patient-centred endpoint before
 * changing support, which is a management claim rather than an anatomical one, and a source list
 * that reaches past what its records support is the habit this module exists not to have.
 */
const CORE_SOURCES = ['ecmo-book-ch9', 'elso-circuit-2022', 'bounded-educational-model'] as const
const BLOOD_PATH_SOURCES = CORE_SOURCES
const GAS_PATH_SOURCES = [...CORE_SOURCES, 'ecmo-book-ch18'] as const

export const ecmoCircuitSegments: readonly EcmoCircuitSegment[] = Object.freeze([
  {
    id: 'patient',
    path: 'patient',
    label: 'Patient',
    mapLabel: 'Patient',
    detail: {
      vv: 'Blood leaves the venous circulation and is returned to it, so the circuit works in series with the native lung.',
      va: 'Blood leaves the venous circulation and is returned to the arterial side, so the circuit works in parallel with the native heart.',
    },
    sourceIds: [...BLOOD_PATH_SOURCES],
  },
  {
    id: 'drainage',
    path: 'blood',
    label: 'Patient venous drainage',
    mapLabel: 'Drainage',
    detail: 'Blood is pulled from the venous circulation into the drainage limb.',
    sourceIds: [...BLOOD_PATH_SOURCES],
  },
  {
    id: 'pump',
    path: 'blood',
    label: 'Centrifugal pump',
    mapLabel: 'Pump',
    detail: 'Generates the flow by pulling on drainage and pushing into the membrane.',
    sourceIds: [...BLOOD_PATH_SOURCES],
  },
  {
    id: 'pre-membrane',
    path: 'blood',
    label: 'Pre-oxygenator location',
    mapLabel: 'Pre-membrane',
    detail: 'After the pump, before the membrane lung. This is where pInt is reported.',
    sourceIds: [...BLOOD_PATH_SOURCES],
  },
  {
    id: 'membrane',
    path: 'blood',
    label: 'Membrane lung',
    mapLabel: 'Membrane',
    detail:
      'Gas exchange happens here, across a membrane the sweep gas passes on the other side of.',
    sourceIds: [...BLOOD_PATH_SOURCES],
  },
  {
    id: 'post-membrane',
    path: 'blood',
    label: 'Post-oxygenator / return location',
    mapLabel: 'Post-membrane',
    detail: 'After the membrane, on the return limb. This is where pArt is reported.',
    sourceIds: [...BLOOD_PATH_SOURCES],
  },
  {
    id: 'return',
    path: 'blood',
    label: { vv: 'Venous return to the patient', va: 'Arterial return to the patient' },
    mapLabel: { vv: 'Venous return', va: 'Arterial return' },
    detail: {
      vv: 'Returned to the venous side, so circuit blood is in series with the native lung and some of it can be drained straight back.',
      va: 'Returned to the arterial side, so circuit flow runs in parallel with the native heart and competes with it.',
    },
    sourceIds: [...BLOOD_PATH_SOURCES],
  },
  {
    id: 'gas-supply',
    path: 'gas',
    label: 'Sweep-gas supply',
    mapLabel: 'Sweep source',
    detail:
      'The gas source, the blender that sets sweep flow and oxygen fraction, and the line carrying gas to the membrane. A setting here is a request, not proof of delivery.',
    sourceIds: [...GAS_PATH_SOURCES],
  },
  {
    id: 'membrane-gas-side',
    path: 'gas',
    label: 'Gas side of the membrane',
    mapLabel: 'Gas side',
    detail:
      'The other side of the membrane from the blood, where sweep gas passes and leaves as exhaust. It never joins the blood path, and no pressure channel sits in it.',
    sourceIds: [...GAS_PATH_SOURCES],
  },
])

export const ecmoSensorSites: readonly EcmoSensorSite[] = Object.freeze([
  {
    id: 'pVen',
    plainName: 'drainage pressure',
    deviceLabel: 'pVen',
    stopLabel: 'pVen',
    mapLabel: 'pVen',
    kind: 'measured',
    segmentId: 'drainage',
    derivedFromSiteIds: [],
    measuredAt: 'Drainage limb, before the pump',
    channel: 'console',
  },
  {
    id: 'pInt',
    plainName: 'pre-membrane pressure',
    deviceLabel: 'pInt',
    stopLabel: 'pInt',
    mapLabel: 'pInt',
    kind: 'measured',
    segmentId: 'pre-membrane',
    derivedFromSiteIds: [],
    measuredAt: 'Between pump and oxygenator',
    channel: 'console',
  },
  {
    id: 'svo2-venous-cell',
    plainName: 'drainage-line saturation',
    deviceLabel: 'SvO₂',
    stopLabel: 'SvO₂ (venous measuring cell)',
    mapLabel: 'SvO₂',
    kind: 'measured',
    segmentId: 'pre-membrane',
    derivedFromSiteIds: [],
    measuredAt: 'Venous measuring cell on the oxygenator pump unit',
    channel: 'console',
  },
  {
    id: 'deltaP',
    plainName: 'the gradient across the membrane',
    deviceLabel: 'ΔP',
    stopLabel: 'ΔP spans this',
    mapLabel: 'ΔP',
    kind: 'derived',
    segmentId: 'membrane',
    derivedFromSiteIds: ['pInt', 'pArt'],
    measuredAt: 'Derived across the membrane',
    channel: 'console',
  },
  {
    id: 'pArt',
    plainName: 'return pressure',
    deviceLabel: 'pArt',
    stopLabel: 'pArt',
    mapLabel: 'pArt',
    kind: 'measured',
    segmentId: 'post-membrane',
    derivedFromSiteIds: [],
    measuredAt: 'Return limb, after the oxygenator',
    channel: 'console',
    caution:
      'A pressure inside the circuit, not the patient’s arterial blood pressure — that comes from the independent monitor.',
  },
  {
    id: 'post-oxygenator-saturation',
    plainName: 'post-membrane blood saturation',
    deviceLabel: 'Post-oxygenator saturation',
    stopLabel: 'Post-oxygenator saturation',
    mapLabel: 'Post-ox sat',
    kind: 'measured',
    segmentId: 'post-membrane',
    derivedFromSiteIds: [],
    measuredAt: 'Post-oxygenator sampling point on the return limb',
    channel: 'off-console',
  },
  {
    id: 'flow-bubble-sensor',
    plainName: 'the flow and bubble sensor',
    deviceLabel: 'Flow / bubble sensor',
    stopLabel: 'Flow and bubble sensor',
    mapLabel: 'Flow · bubble',
    kind: 'measured',
    segmentId: 'post-membrane',
    derivedFromSiteIds: [],
    measuredAt: 'Flow probe on the circuit tubing',
    channel: 'console',
  },
])

export const ecmoPressureZones: readonly EcmoPressureZone[] = Object.freeze([
  {
    id: 'upstream-of-pump',
    label: 'Upstream of the pump',
    segmentIds: ['drainage'],
    sensorSiteIds: ['pVen'],
  },
  {
    id: 'downstream-of-pump',
    label: 'Downstream of the pump',
    segmentIds: ['pre-membrane', 'membrane', 'post-membrane'],
    sensorSiteIds: ['pInt', 'pArt'],
  },
  {
    id: 'across-membrane',
    label: 'Across the membrane',
    segmentIds: ['membrane'],
    sensorSiteIds: ['deltaP'],
  },
])

export const ecmoCircuitSegmentById: ReadonlyMap<EcmoCircuitSegmentId, EcmoCircuitSegment> =
  new Map(ecmoCircuitSegments.map((segment) => [segment.id, segment]))

export const ecmoSensorSiteById: ReadonlyMap<EcmoSensorSiteId, EcmoSensorSite> = new Map(
  ecmoSensorSites.map((site) => [site.id, site]),
)

export const ecmoPressureZoneById: ReadonlyMap<EcmoPressureZoneId, EcmoPressureZone> = new Map(
  ecmoPressureZones.map((zone) => [zone.id, zone]),
)

/*
 * Throwing accessors rather than `| undefined` returns.
 *
 * Every id in this module is a literal union, so a caller that type-checks cannot miss. The throw
 * is for the boundaries where an id arrives as a string — a test fixture, a future walk definition
 * read from elsewhere — and it fails loudly at the point of the mistake instead of rendering a hole.
 */
export function ecmoCircuitSegment(id: EcmoCircuitSegmentId): EcmoCircuitSegment {
  const segment = ecmoCircuitSegmentById.get(id)
  if (!segment) throw new Error(`Unknown ECMO circuit segment: ${id}`)
  return segment
}

export function ecmoSensorSite(id: EcmoSensorSiteId): EcmoSensorSite {
  const site = ecmoSensorSiteById.get(id)
  if (!site) throw new Error(`Unknown ECMO sensor site: ${id}`)
  return site
}

export function ecmoPressureZone(id: EcmoPressureZoneId): EcmoPressureZone {
  const zone = ecmoPressureZoneById.get(id)
  if (!zone) throw new Error(`Unknown ECMO pressure zone: ${id}`)
  return zone
}

export function ecmoBloodPathSegments(): readonly EcmoCircuitSegment[] {
  return ecmoBloodPathSegmentIds.map((id) => ecmoCircuitSegment(id))
}

export function ecmoGasPathSegments(): readonly EcmoCircuitSegment[] {
  return ecmoGasPathSegmentIds.map((id) => ecmoCircuitSegment(id))
}

/**
 * The sites that sit on a segment, in registry order.
 *
 * Derived rather than stored on the segment, so the relation exists in exactly one place and a site
 * cannot end up listed at a stop it does not sit on.
 */
export function ecmoSensorSitesForSegment(
  segmentId: EcmoCircuitSegmentId,
): readonly EcmoSensorSite[] {
  return ecmoSensorSites.filter((site) => site.segmentId === segmentId)
}

export function validateEcmoCircuitSegmentModel(): readonly string[] {
  const errors: string[] = []

  const reconcile = (kind: string, ids: readonly string[], recordIds: readonly string[]): void => {
    if (new Set(ids).size !== ids.length) errors.push(`${kind}: duplicate id in the tuple`)
    if (new Set(recordIds).size !== recordIds.length) errors.push(`${kind}: duplicate record`)
    for (const id of ids) {
      if (!recordIds.includes(id)) errors.push(`${kind}: ${id} is declared but has no record`)
    }
    for (const id of recordIds) {
      if (!ids.includes(id)) errors.push(`${kind}: ${id} has a record but is not declared`)
    }
  }

  reconcile(
    'segment',
    ecmoCircuitSegmentIds,
    ecmoCircuitSegments.map((segment) => segment.id),
  )
  reconcile(
    'sensor site',
    ecmoSensorSiteIds,
    ecmoSensorSites.map((site) => site.id),
  )
  reconcile(
    'pressure zone',
    ecmoPressureZoneIds,
    ecmoPressureZones.map((zone) => zone.id),
  )

  for (const segment of ecmoCircuitSegments) {
    for (const supportMode of ['vv', 'va'] as const) {
      if (resolveEcmoModeText(segment.label, supportMode).length === 0) {
        errors.push(`${segment.id}: no ${supportMode} label`)
      }
      if (resolveEcmoModeText(segment.mapLabel, supportMode).length === 0) {
        errors.push(`${segment.id}: no ${supportMode} map label`)
      }
      if (resolveEcmoModeText(segment.detail, supportMode).length === 0) {
        errors.push(`${segment.id}: no ${supportMode} detail`)
      }
    }
    if (segment.sourceIds.length === 0) errors.push(`${segment.id}: no registered source`)
    if (!validateEvidenceIds(segment.sourceIds)) {
      errors.push(`${segment.id}: names a source that is not registered`)
    }
    const declaredPath =
      segment.id === 'patient'
        ? 'patient'
        : (ecmoGasPathSegmentIds as readonly string[]).includes(segment.id)
          ? 'gas'
          : 'blood'
    if (segment.path !== declaredPath) {
      errors.push(
        `${segment.id}: declared on the ${segment.path} path but listed as ${declaredPath}`,
      )
    }
  }

  for (const site of ecmoSensorSites) {
    if (!ecmoCircuitSegmentById.has(site.segmentId)) {
      errors.push(`${site.id}: sits on unknown segment ${site.segmentId}`)
    }
    if (site.plainName.length === 0) errors.push(`${site.id}: no plain name`)
    if (site.deviceLabel.length === 0) errors.push(`${site.id}: no device label`)
    if (site.measuredAt.length === 0) errors.push(`${site.id}: no measurement site`)
    if (site.kind === 'derived') {
      if (site.derivedFromSiteIds.length === 0) {
        errors.push(`${site.id}: derived but names nothing it is derived from`)
      }
      for (const sourceId of site.derivedFromSiteIds) {
        const source = ecmoSensorSiteById.get(sourceId)
        if (!source) errors.push(`${site.id}: derived from unknown site ${sourceId}`)
        // A relationship between relationships would have no location a learner could inspect.
        else if (source.kind !== 'measured') {
          errors.push(`${site.id}: derived from ${sourceId}, which is itself derived`)
        }
      }
    } else if (site.derivedFromSiteIds.length > 0) {
      errors.push(`${site.id}: a measured site cannot be derived from anything`)
    }
  }

  for (const zone of ecmoPressureZones) {
    if (zone.label.length === 0) errors.push(`${zone.id}: no label`)
    if (zone.segmentIds.length === 0) errors.push(`${zone.id}: covers no segment`)
    for (const segmentId of zone.segmentIds) {
      if (!ecmoCircuitSegmentById.has(segmentId)) {
        errors.push(`${zone.id}: names unknown segment ${segmentId}`)
      }
    }
    for (const siteId of zone.sensorSiteIds) {
      const site = ecmoSensorSiteById.get(siteId)
      if (!site) {
        errors.push(`${zone.id}: names unknown sensor site ${siteId}`)
        continue
      }
      if (!zone.segmentIds.includes(site.segmentId)) {
        errors.push(`${zone.id}: reads ${siteId}, which sits outside the zone`)
      }
    }
  }

  return errors
}

const segmentModelErrors = validateEcmoCircuitSegmentModel()
if (segmentModelErrors.length > 0) {
  throw new Error(`Invalid ECMO circuit segment model:\n- ${segmentModelErrors.join('\n- ')}`)
}
