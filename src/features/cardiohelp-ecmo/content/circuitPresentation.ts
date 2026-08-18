import type { EcmoSimulationState, SupportMode } from '../engine/types'
import {
  ecmoBloodPathSegments,
  ecmoCircuitSegment,
  ecmoGasPathSegments,
  ecmoSensorSite,
  resolveEcmoModeText,
  type EcmoCircuitSegmentId,
  type EcmoSensorSiteId,
} from './circuitSegments'
import { ecmoLocalizationRow, type EcmoLocalizationRowId } from './localizationCards'

/**
 * What the circuit map is showing, and who is allowed to decide it.
 *
 * The map and the localization card have to reveal at the same instant. If the map lit the membrane
 * while the card was still withheld, a learner would read the answer off the picture — so both are
 * driven from one presentation value, and in a drill that value is derived from the engine's own
 * `scenario.prediction.committed` rather than from anything a caller passes in. That is the same
 * gate `AfterCommitment` reads, deliberately: a panel cannot be handed a truthy flag by a caller
 * that has not taken a commitment, and reloading a scenario clears the commitment and closes both
 * surfaces again without either of them knowing that reloading is a thing.
 *
 * Note this is *not* the gate the simulator's own diagnosis banner uses — that one waits for
 * `scenario.phase === 'complete'`. The asymmetry is intended: a committed learner has earned the
 * teaching, and the verdict surface answers a different question at a different moment.
 */

/**
 * How much of the instrument a scaffolded map annotates.
 *
 * Scaffold states differ only in which sensor sites they flag, because that is the only thing the
 * three scaffolded lessons actually disagree about. Nothing in a scaffold marks a segment — marking
 * is what `implicated` does, and keeping the two vocabularies disjoint means a leak test can assert
 * the absence of one attribute rather than reasoning about degrees of emphasis.
 */
export type EcmoCircuitScaffoldEmphasis = 'path-order' | 'sensor-sites' | 'pressure-zones'

export type EcmoCircuitPresentation =
  | { readonly kind: 'neutral' }
  | { readonly kind: 'scaffold'; readonly emphasis: EcmoCircuitScaffoldEmphasis }
  /** Multi-segment is not a fourth kind: it is a row whose problem lives in more than one place. */
  | { readonly kind: 'implicated'; readonly rowId: EcmoLocalizationRowId }

export type EcmoCircuitPresentationContext =
  /** A foundation lesson, which teaches rather than tests and may annotate freely. */
  | { readonly kind: 'foundation-scaffold'; readonly emphasis: EcmoCircuitScaffoldEmphasis }
  /**
   * The console tour, whose subject is where the sensors are.
   *
   * Commitment-independent on purpose: this drill asks what has been established before support
   * starts, not what is wrong, and the locations it flags are the ones its own signal register
   * already prints beside every reading before a learner commits anything.
   */
  | { readonly kind: 'drill-orientation-scaffold' }
  /** A fault drill. Neutral until the learner has committed; the row's segments after. */
  | { readonly kind: 'drill-reveal'; readonly rowId: EcmoLocalizationRowId }

export function deriveEcmoCircuitPresentation(
  state: EcmoSimulationState,
  context: EcmoCircuitPresentationContext,
): EcmoCircuitPresentation {
  switch (context.kind) {
    case 'foundation-scaffold':
      return { kind: 'scaffold', emphasis: context.emphasis }
    case 'drill-orientation-scaffold':
      return { kind: 'scaffold', emphasis: 'sensor-sites' }
    case 'drill-reveal':
      return state.scenario.prediction.committed
        ? { kind: 'implicated', rowId: context.rowId }
        : { kind: 'neutral' }
  }
}

/** The console pressure channels, which every state flags because every state is about them. */
const PRESSURE_CHANNEL_SITE_IDS: readonly EcmoSensorSiteId[] = ['pVen', 'pInt', 'deltaP', 'pArt']

/** What the circuit-walk stop list names, which is the pressures plus the two saturations. */
const WALK_SITE_IDS: readonly EcmoSensorSiteId[] = [
  'pVen',
  'pInt',
  'svo2-venous-cell',
  'deltaP',
  'pArt',
  'post-oxygenator-saturation',
]

export function ecmoMapSensorSiteIds(
  presentation: EcmoCircuitPresentation,
): readonly EcmoSensorSiteId[] {
  if (presentation.kind !== 'scaffold') return PRESSURE_CHANNEL_SITE_IDS
  switch (presentation.emphasis) {
    case 'path-order':
      return WALK_SITE_IDS
    case 'sensor-sites':
      return [...WALK_SITE_IDS, 'flow-bubble-sensor']
    case 'pressure-zones':
      return PRESSURE_CHANNEL_SITE_IDS
  }
}

export function ecmoMapImplicatedSegmentIds(
  presentation: EcmoCircuitPresentation,
): readonly EcmoCircuitSegmentId[] {
  return presentation.kind === 'implicated'
    ? ecmoLocalizationRow(presentation.rowId).implicatedSegmentIds
    : []
}

/**
 * The words that carry the implication when colour and line weight cannot.
 *
 * Returned rather than rendered so the caption and the text equivalent say the same thing, and so a
 * test can assert the sentence exists without matching on markup.
 */
export function ecmoMapImplicatedCaption(
  presentation: EcmoCircuitPresentation,
  supportMode: SupportMode,
): string | null {
  if (presentation.kind !== 'implicated') return null
  const names = ecmoMapImplicatedSegmentIds(presentation).map((segmentId) =>
    resolveEcmoModeText(ecmoCircuitSegment(segmentId).label, supportMode),
  )
  return `Implicated on this map: ${names.join(' and ')}.`
}

/**
 * The map in prose, complete enough to replace looking at it.
 *
 * Order, both paths, the return the track actually uses, every flagged site with the name its
 * console prints, and — when the map is implicating something — the same sentence the caption
 * shows. A learner who never sees the picture should be able to answer the same questions from
 * this paragraph.
 */
export function ecmoCircuitMapTextEquivalent(
  supportMode: SupportMode,
  presentation: EcmoCircuitPresentation,
): string {
  const bloodOrder = [
    resolveEcmoModeText(ecmoCircuitSegment('patient').label, supportMode),
    ...ecmoBloodPathSegments().map((segment) => resolveEcmoModeText(segment.label, supportMode)),
    resolveEcmoModeText(ecmoCircuitSegment('patient').label, supportMode),
  ].join(' → ')

  const gasOrder = ecmoGasPathSegments()
    .map((segment) => resolveEcmoModeText(segment.label, supportMode))
    .join(' → ')

  const sites = ecmoMapSensorSiteIds(presentation)
    .map((siteId) => {
      const site = ecmoSensorSite(siteId)
      return `${site.plainName} (${site.deviceLabel}) at ${site.measuredAt.toLowerCase()}`
    })
    .join('; ')

  const sentences = [
    `A schematic of this circuit. The blood path is drawn as a solid line and runs ${bloodOrder}.`,
    `The sweep-gas path is drawn dashed and runs ${gasOrder}, leaving as exhaust. It never joins the blood path, and no pressure channel sits in it.`,
    `Flagged on the map: ${sites}.`,
  ]

  const caption = ecmoMapImplicatedCaption(presentation, supportMode)
  if (caption) sentences.push(caption)

  return sentences.join(' ')
}
