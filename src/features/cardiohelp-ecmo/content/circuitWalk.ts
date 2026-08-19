import type { SupportMode } from '../engine/types'
import {
  ecmoBloodPathSegmentIds,
  ecmoCircuitSegment,
  ecmoPressureZone,
  ecmoSensorSite,
  resolveEcmoModeText,
  type EcmoCircuitSegmentId,
  type EcmoModeText,
  type EcmoPressureZoneId,
  type EcmoSensorSiteId,
} from './circuitSegments'
import { ecmoSceneLabelIdsForSegment } from './circuitSceneAnchors'
import { validateEvidenceIds } from './evidence'
import type { EcmoInteractiveFoundationSectionId } from './foundationLessonRuntime'

/**
 * The walk, as an ordered list of places rather than a page of paragraphs.
 *
 * The instruction already existed. `circuit-flow-path`'s `recognize` phase has always told the
 * learner to "step through the circuit segments in order", and nothing stepped — the panel printed
 * all six segments at once and the learner scrolled. That is the same shape as the defect R2-OD-7
 * retired, where the `act` phase described an interaction that existed nowhere, and it is fixed the
 * same way: by building the thing the copy already promised rather than by rewriting the promise.
 *
 * A stop is a *place on the circuit* plus what a learner should be able to say after standing at
 * it. It is deliberately not a phase: a phase is a task the learner performs and there are six of
 * those per section already, in the pane next door. Stops are numbered once across both sections,
 * so "stop five of six" means the walk is nearly over rather than that a second counter has started.
 *
 * Nothing here re-describes the circuit. Every place is an id from `circuitSegments.ts`, every
 * reading is a sensor-site id, every grouping is a pressure-zone id, and the bedside scene is
 * reached through the string table in `circuitSceneAnchors.ts`. This file authors the *teaching* —
 * the analogy, the short list, the takeaway, the boundary — and nothing else, because a second copy
 * of the anatomy is exactly what R2 existed to end.
 *
 * Pure content. No React, no three.js, no engine values. Numbers are barred outright: a stop that
 * printed one would be asserting a quantity this simulation authors, and every quantity a learner
 * sees has to come from the live state instead.
 */

export const ecmoCircuitWalkStopIds = [
  'walk-drainage',
  'walk-pump',
  'walk-membrane',
  'walk-return',
  'walk-pump-under-load',
  'walk-downstream-load',
] as const
export type EcmoCircuitWalkStopId = (typeof ecmoCircuitWalkStopIds)[number]

/**
 * What the learner does here, which decides what the stop card puts on screen.
 *
 * `instructional` reads a place. `interactive` reads a place and then changes something about it
 * through an action the lesson already owns. `comparative` loads authored states side by side in
 * time. The kind is recorded rather than inferred from whether `comparison` is present, so a stop
 * that means to be comparative and has lost its beats fails validation instead of rendering quietly
 * as an instructional one.
 */
export type EcmoWalkStopKind = 'instructional' | 'comparative' | 'interactive'

/**
 * One beat of an authored comparison.
 *
 * A beat names a guided action the lesson runtime already declares — never a scenario id, and never
 * a bare variant. The runtime's `restore-and-apply` already expresses everything a beat needs:
 * which state to rebuild, what to do to it, and how long to let it settle, all in one transition so
 * no half-loaded frame is ever rendered. Pointing at that rather than re-implementing it is what
 * keeps the walk from becoming a second place where states are selected.
 */
export interface EcmoWalkComparisonBeat {
  readonly id: string
  readonly label: string
  /** An `EcmoFoundationGuidedAction.id` on this stop's own section. */
  readonly guidedActionId: string
  /** What the learner is being sent to read, said before they read it. */
  readonly readThis: string
}

export interface EcmoCircuitWalkStop {
  readonly id: EcmoCircuitWalkStopId
  readonly sectionId: EcmoInteractiveFoundationSectionId
  /** One-based and continuous across both sections. Authored rather than derived, so it is checkable. */
  readonly ordinal: number
  readonly kind: EcmoWalkStopKind
  readonly title: EcmoModeText
  /** The concrete image, before the precise statement. One per stop; competing images are worse than none. */
  readonly analogy: EcmoModeText
  /** At most four. A longer list is not carried to a bedside. */
  readonly checklist: readonly EcmoModeText[]
  readonly primarySegmentId: EcmoCircuitSegmentId
  readonly secondarySegmentIds: readonly EcmoCircuitSegmentId[]
  readonly sensorSiteIds: readonly EcmoSensorSiteId[]
  readonly pressureZoneIds: readonly EcmoPressureZoneId[]
  /** What the learner should be able to say having stood here. Shown after the stop, never before it. */
  readonly takeaway: EcmoModeText
  /** What this stop does not represent, in learner language, beside the thing it does not represent. */
  readonly modelBoundary: EcmoModeText
  readonly sourceIds: readonly string[]
  /** Present exactly when `kind` is `comparative`. */
  readonly comparison?: readonly EcmoWalkComparisonBeat[]
}

/*
 * Sources, chosen the way R2 chose them: for what the record actually supports.
 *
 * `ecmo-book-ch16` is absent from the anatomical stops even though `circuit-flow-path` cites it at
 * section level, because that record supports naming a patient-centred endpoint before changing
 * support — a management claim, not a claim about where a sensor sits. `ecmo-book-ch17` joins the
 * two pump-and-pressure stops, where the claim is about the named limits on delivered blood flow.
 */
const PLACE_SOURCES = ['ecmo-book-ch9', 'elso-circuit-2022', 'bounded-educational-model'] as const
const LOADING_SOURCES = [...PLACE_SOURCES, 'ecmo-book-ch17'] as const

const AUTHORED_RESPONSE_BOUNDARY =
  'Every response size here is a quantity this simulation authors for teaching, not a bedside dose-response.'

export const ecmoCircuitWalkStops: readonly EcmoCircuitWalkStop[] = Object.freeze([
  {
    id: 'walk-drainage',
    sectionId: 'circuit-flow-path',
    ordinal: 1,
    kind: 'instructional',
    title: 'Where blood leaves the patient',
    analogy:
      'Drinking through a straw. The pump can only move what actually reaches it, and it has to pull to get it.',
    checklist: ['A kinked limb', 'A clotted limb', 'The volume available', 'Cannula position'],
    primarySegmentId: 'drainage',
    secondarySegmentIds: ['patient'],
    sensorSiteIds: ['pVen'],
    pressureZoneIds: ['upstream-of-pump'],
    takeaway:
      'The drainage limb reports what is available to drain. A pressure read here is about supply, not about what the pump can do.',
    modelBoundary:
      'The drainage a circuit can supply is an authored teaching quantity. This reference circuit has drainage to spare at every speed the walk offers, so nothing here is a cut point.',
    sourceIds: [...PLACE_SOURCES],
  },
  {
    id: 'walk-pump',
    sectionId: 'circuit-flow-path',
    ordinal: 2,
    kind: 'instructional',
    title: 'The pump',
    analogy:
      'A spinning cone, not a syringe. It moves what arrives at its inlet; it does not create volume.',
    checklist: [
      'The speed is chosen',
      'The flow is what comes back',
      'Negative pressure before it',
      'Positive pressure after it',
    ],
    primarySegmentId: 'pump',
    secondarySegmentIds: [],
    // The pump reports no channel of its own, and that absence is the teaching: the readings that
    // describe it are taken either side of it, which is why this stop lights two zones.
    sensorSiteIds: [],
    pressureZoneIds: ['upstream-of-pump', 'downstream-of-pump'],
    takeaway: 'The sign of the pressure flips across this one object.',
    modelBoundary:
      'On this device the pump and the membrane lung are one integrated disposable, so the scene lights the same object at this stop and the next.',
    sourceIds: [...PLACE_SOURCES],
  },
  {
    id: 'walk-membrane',
    sectionId: 'circuit-flow-path',
    ordinal: 3,
    kind: 'instructional',
    title: 'The membrane lung',
    analogy:
      'Thousands of hollow fibres. Blood weaves around the outside, sweep gas blows through the inside, and diffusion does the rest.',
    checklist: [
      'Gas exchange happens here',
      'It has a resistance of its own',
      'That resistance is read across the device',
      'The gas side never joins the blood',
    ],
    primarySegmentId: 'membrane',
    secondarySegmentIds: ['pre-membrane'],
    sensorSiteIds: ['pInt', 'svo2-venous-cell', 'deltaP'],
    pressureZoneIds: ['across-membrane'],
    takeaway:
      'The gradient is a difference between two places rather than a reading taken at one, which is why it needs both of them named.',
    modelBoundary:
      'Clot burden and how a membrane changes over a run are not modelled. The drainage-line saturation is taken at the module’s own venous inlet, not at the patient.',
    sourceIds: [...PLACE_SOURCES],
  },
  {
    id: 'walk-return',
    sectionId: 'circuit-flow-path',
    ordinal: 4,
    kind: 'instructional',
    title: 'Back to the patient',
    analogy: 'Pushing the drink back down the straw, against whatever is waiting at the far end.',
    checklist: [
      'A kinked limb',
      'A clotted limb',
      'Cannula position',
      { vv: 'The vessel it returns into', va: 'The artery pushing back' },
    ],
    primarySegmentId: 'post-membrane',
    secondarySegmentIds: ['return', 'patient'],
    sensorSiteIds: ['pArt', 'post-oxygenator-saturation', 'flow-bubble-sensor'],
    pressureZoneIds: ['downstream-of-pump'],
    takeaway: {
      vv: 'The return limb is where the flow probe and the bubble detector sit, and what the circuit moves is not the same quantity as what reaches the tissues.',
      va: 'The return limb is where the flow probe and the bubble detector sit, and it is pushing into a circulation the heart is also pushing into.',
    },
    modelBoundary:
      'The return pressure is a pressure inside the circuit. The patient’s own arterial pressure comes from the independent monitor and is not modelled from this channel.',
    sourceIds: [...PLACE_SOURCES],
  },
  {
    id: 'walk-pump-under-load',
    sectionId: 'pump-and-pressure-zones',
    ordinal: 5,
    kind: 'interactive',
    title: 'Speed is chosen, flow is returned',
    analogy:
      'Pulling harder on the straw. More comes through, and you feel the effort on the drawing side.',
    checklist: [
      'The speed is a setting',
      'The flow is a result',
      'Watch the drainage side while it changes',
      'Read the two together, never one alone',
    ],
    primarySegmentId: 'pump',
    secondarySegmentIds: ['drainage'],
    // The speed change is read on the drawing side. The post-pump channels move too, but they are
    // this stop's neighbours rather than its subject, and naming them here would put four numbers
    // in front of a learner who was asked to watch two.
    sensorSiteIds: ['pVen'],
    pressureZoneIds: ['upstream-of-pump'],
    takeaway:
      'Flow follows speed on a circuit that has drainage to spare, and it is bought with suction — which is why the two are read as a pair.',
    modelBoundary: AUTHORED_RESPONSE_BOUNDARY,
    sourceIds: [...LOADING_SOURCES],
  },
  {
    id: 'walk-downstream-load',
    sectionId: 'pump-and-pressure-zones',
    ordinal: 6,
    kind: 'comparative',
    title: 'What the circuit is pushing against',
    analogy:
      'The same straw with a thumb over the far end. The effort shows where you are pushing from, not where the obstruction is.',
    checklist: [
      'Both post-pump readings move together',
      'The drainage side stays quiet',
      'Compare the gradient at similar flow',
      'The pressures carry the localization',
    ],
    primarySegmentId: 'post-membrane',
    // The pattern spans the whole run downstream of the pump, so the stop stands at all of it: the
    // pre-membrane location where pInt is taken, the membrane the gradient spans, and the return
    // path where the resistance actually lives.
    secondarySegmentIds: ['pre-membrane', 'membrane', 'return'],
    sensorSiteIds: ['pInt', 'pArt', 'deltaP'],
    pressureZoneIds: ['downstream-of-pump', 'across-membrane'],
    takeaway:
      'The gradient moved with the flow rather than with the membrane. Read it at matched flow and the membrane is unchanged, while both post-pump pressures are not.',
    modelBoundary:
      'This simulation authors the resistance so the pattern can be read. It does not model what is causing it, or how such a cause would develop over time.',
    sourceIds: [...LOADING_SOURCES],
    comparison: [
      {
        id: 'walk-return-load-baseline',
        label: 'Restore the reference circuit',
        guidedActionId: 'restore-reference',
        readThis: 'The flow, both post-pump pressures, and the gradient, with nothing added.',
      },
      {
        id: 'walk-return-load-obstructed',
        label: 'Read the same speed against a resisted return',
        guidedActionId: 'load-return-resistance',
        readThis:
          'The same pump setting, with resistance beyond the membrane. Read the flow first, then both post-pump pressures, then the drainage side.',
      },
      {
        id: 'walk-return-load-matched-flow',
        label: 'Bring the reference circuit down to that flow',
        guidedActionId: 'reference-at-matched-flow',
        readThis:
          'A circuit with nothing wrong with it, slowed until it is moving what the resisted circuit manages, so the gradient can be read like for like.',
      },
    ],
  },
])

export const ecmoCircuitWalkStopById: ReadonlyMap<EcmoCircuitWalkStopId, EcmoCircuitWalkStop> =
  new Map(ecmoCircuitWalkStops.map((stop) => [stop.id, stop]))

export function ecmoCircuitWalkStop(id: EcmoCircuitWalkStopId): EcmoCircuitWalkStop {
  const stop = ecmoCircuitWalkStopById.get(id)
  if (!stop) throw new Error(`Unknown ECMO circuit walk stop: ${id}`)
  return stop
}

/** The stops of one section, in ordinal order. Empty for every section that is not on the walk. */
export function ecmoCircuitWalkStopsForSection(
  sectionId: EcmoInteractiveFoundationSectionId,
): readonly EcmoCircuitWalkStop[] {
  return ecmoCircuitWalkStops
    .filter((stop) => stop.sectionId === sectionId)
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)
}

export function hasEcmoCircuitWalk(sectionId: EcmoInteractiveFoundationSectionId): boolean {
  return ecmoCircuitWalkStopsForSection(sectionId).length > 0
}

/** Every place this stop is about, primary first, de-duplicated. */
export function ecmoWalkStopSegmentIds(stop: EcmoCircuitWalkStop): readonly EcmoCircuitSegmentId[] {
  return [...new Set([stop.primarySegmentId, ...stop.secondarySegmentIds])]
}

/**
 * The bedside-scene labels this stop is standing at.
 *
 * Strings out, nothing else in — this function is the whole of the walk's relationship with the 3D
 * scene, and it is why `content/` still holds no three.js import. Several segments resolve to the
 * same label on this device, so the result is de-duplicated rather than repeated.
 */
export function ecmoWalkStopSceneLabelIds(
  stop: EcmoCircuitWalkStop,
  supportMode: SupportMode,
): readonly string[] {
  return [
    ...new Set(
      ecmoWalkStopSegmentIds(stop).flatMap((segmentId) =>
        ecmoSceneLabelIdsForSegment(segmentId, supportMode),
      ),
    ),
  ]
}

/**
 * The stop in prose, complete enough to replace looking at anything.
 *
 * Deliberately excludes the takeaway: a text equivalent describes what is on screen, and the
 * takeaway is shown after the stop rather than beside it. Including it here would have handed a
 * screen-reader user the conclusion a sighted learner reaches a step later.
 */
export function ecmoWalkStopTextEquivalent(
  stop: EcmoCircuitWalkStop,
  supportMode: SupportMode,
): string {
  const places = ecmoWalkStopSegmentIds(stop)
    .map((segmentId) => resolveEcmoModeText(ecmoCircuitSegment(segmentId).label, supportMode))
    .join(', ')
  const zones = stop.pressureZoneIds.map((zoneId) => ecmoPressureZone(zoneId).label).join(', ')

  const sentences = [
    `Stop ${stop.ordinal}. ${resolveEcmoModeText(stop.title, supportMode)}.`,
    `On the circuit: ${places}.`,
    `${resolveEcmoModeText(stop.analogy, supportMode)}`,
    `What to check here: ${stop.checklist
      .map((item) => resolveEcmoModeText(item, supportMode))
      .join('; ')}.`,
  ]

  if (stop.sensorSiteIds.length > 0) {
    const sites = stop.sensorSiteIds
      .map((siteId) => {
        const site = ecmoSensorSite(siteId)
        return `${site.plainName} (${site.deviceLabel})`
      })
      .join(', ')
    sentences.push(`Reported here: ${sites}.`)
  } else {
    sentences.push(
      'No reading is taken at this place; the readings that describe it sit either side of it.',
    )
  }

  sentences.push(`Read in: ${zones}.`)
  sentences.push(`Model boundary: ${resolveEcmoModeText(stop.modelBoundary, supportMode)}`)

  return sentences.join(' ')
}

export function validateEcmoCircuitWalk(): readonly string[] {
  const errors: string[] = []
  const declared = ecmoCircuitWalkStops.map((stop) => stop.id)

  if (new Set(ecmoCircuitWalkStopIds).size !== ecmoCircuitWalkStopIds.length) {
    errors.push('duplicate stop id in the tuple')
  }
  if (new Set(declared).size !== declared.length) errors.push('duplicate stop record')
  for (const id of ecmoCircuitWalkStopIds) {
    if (!declared.includes(id)) errors.push(`stop ${id} is declared but has no record`)
  }
  for (const id of declared) {
    if (!(ecmoCircuitWalkStopIds as readonly string[]).includes(id)) {
      errors.push(`stop ${id} has a record but is not declared`)
    }
  }

  const ordinals = ecmoCircuitWalkStops.map((stop) => stop.ordinal)
  const expected = ecmoCircuitWalkStops.map((_stop, index) => index + 1)
  if (ordinals.join() !== expected.join()) {
    errors.push('ordinals are not one-based, contiguous, and in declaration order')
  }

  for (const stop of ecmoCircuitWalkStops) {
    for (const supportMode of ['vv', 'va'] as const) {
      const texts: readonly EcmoModeText[] = [
        stop.title,
        stop.analogy,
        stop.takeaway,
        stop.modelBoundary,
        ...stop.checklist,
      ]
      for (const text of texts) {
        if (resolveEcmoModeText(text, supportMode).length === 0) {
          errors.push(`${stop.id}: empty ${supportMode} copy`)
        }
      }
    }

    if (stop.checklist.length === 0) errors.push(`${stop.id}: no checklist`)
    if (stop.checklist.length > 4)
      errors.push(`${stop.id}: more to check than a learner will carry`)

    // Throwing accessors: an unknown id fails here rather than rendering a hole.
    for (const segmentId of ecmoWalkStopSegmentIds(stop)) ecmoCircuitSegment(segmentId)
    for (const siteId of stop.sensorSiteIds) ecmoSensorSite(siteId)
    for (const zoneId of stop.pressureZoneIds) ecmoPressureZone(zoneId)

    if (stop.secondarySegmentIds.includes(stop.primarySegmentId)) {
      errors.push(`${stop.id}: names its primary place a second time`)
    }
    if (stop.pressureZoneIds.length === 0) errors.push(`${stop.id}: reads in no zone`)

    /*
     * A sensor site the stop does not stand at would put a reading in the wrong place, which is the
     * one error this whole vocabulary exists to make impossible.
     */
    const places = ecmoWalkStopSegmentIds(stop)
    for (const siteId of stop.sensorSiteIds) {
      if (!places.includes(ecmoSensorSite(siteId).segmentId)) {
        errors.push(`${stop.id}: reports ${siteId}, which sits at a place this stop is not at`)
      }
    }

    if (stop.sourceIds.length === 0) errors.push(`${stop.id}: no registered source`)
    if (!validateEvidenceIds(stop.sourceIds)) {
      errors.push(`${stop.id}: names a source that is not registered`)
    }

    if (stop.kind === 'comparative' && (stop.comparison?.length ?? 0) < 2) {
      errors.push(`${stop.id}: comparative, but has nothing to compare`)
    }
    if (stop.kind !== 'comparative' && stop.comparison) {
      errors.push(`${stop.id}: carries comparison beats but is not comparative`)
    }
    const beatIds = (stop.comparison ?? []).map((beat) => beat.id)
    if (new Set(beatIds).size !== beatIds.length) errors.push(`${stop.id}: duplicate beat id`)
    for (const beat of stop.comparison ?? []) {
      if (beat.label.length === 0) errors.push(`${stop.id}: ${beat.id} has no label`)
      if (beat.readThis.length === 0) errors.push(`${stop.id}: ${beat.id} says nothing to read`)
      if (beat.guidedActionId.length === 0) errors.push(`${stop.id}: ${beat.id} names no action`)
    }

    /*
     * No number, anywhere a learner reads.
     *
     * Same rule as the localization registry, for the same reason: every quantity on this walk is
     * read off the live circuit, and a quantity written into the copy beside it would be a second
     * opinion about what the console is saying.
     */
    for (const value of [
      resolveEcmoModeText(stop.title, 'vv'),
      resolveEcmoModeText(stop.title, 'va'),
      resolveEcmoModeText(stop.analogy, 'vv'),
      resolveEcmoModeText(stop.analogy, 'va'),
      resolveEcmoModeText(stop.takeaway, 'vv'),
      resolveEcmoModeText(stop.takeaway, 'va'),
      resolveEcmoModeText(stop.modelBoundary, 'vv'),
      resolveEcmoModeText(stop.modelBoundary, 'va'),
      ...stop.checklist.flatMap((item) => [
        resolveEcmoModeText(item, 'vv'),
        resolveEcmoModeText(item, 'va'),
      ]),
      ...(stop.comparison ?? []).flatMap((beat) => [beat.label, beat.readThis]),
    ]) {
      if (/\d/.test(value)) errors.push(`${stop.id}: a number appears in learner-facing copy`)
    }
  }

  /*
   * The blood path, covered exactly once, walked in the direction blood travels.
   *
   * This is what makes the walk the successor of the static stop list rather than a second one
   * beside it, and it is two claims rather than one.
   *
   * Coverage: the places the first section's stops stand at are the blood path, each exactly once.
   * Sorting before comparing is deliberate — a stop groups the membrane with the location in front
   * of it, and listing its primary place first is right for the teaching even though the pre-
   * membrane location comes first along the tubing. What must not happen is a segment going
   * unvisited or being taught at two different stops.
   *
   * Direction: the stops advance. Each stop's primary place sits further along the path than the
   * previous stop's, so the walk never doubles back.
   */
  const firstSectionStops = ecmoCircuitWalkStopsForSection('circuit-flow-path')
  const pathIndex = (segmentId: string): number =>
    (ecmoBloodPathSegmentIds as readonly string[]).indexOf(segmentId)

  const covered = firstSectionStops
    .flatMap((stop) => ecmoWalkStopSegmentIds(stop))
    .filter((segmentId) => pathIndex(segmentId) >= 0)
    .slice()
    .sort((left, right) => pathIndex(left) - pathIndex(right))
  if (covered.join() !== ecmoBloodPathSegmentIds.join()) {
    errors.push(
      `circuit-flow-path stops cover ${covered.join(' → ')}, not the blood path exactly once`,
    )
  }

  const primaries = firstSectionStops.map((stop) => pathIndex(stop.primarySegmentId))
  for (let index = 1; index < primaries.length; index += 1) {
    if (primaries[index] <= primaries[index - 1]) {
      errors.push(
        `${firstSectionStops[index].id}: stands no further along the blood path than the stop before it`,
      )
    }
  }

  return errors
}

const walkErrors = validateEcmoCircuitWalk()
if (walkErrors.length > 0) {
  throw new Error(`Invalid ECMO circuit walk:\n- ${walkErrors.join('\n- ')}`)
}
