import type { EcmoSimulationState, SupportMode } from '../engine/types'
import {
  ecmoBloodPathSegments,
  ecmoCircuitSegment,
  ecmoGasPathSegments,
  ecmoSensorSite,
  ecmoSensorSites,
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
 *
 * `sensor-sites` is the console tour's. The other two have no consumer since the circuit walk gave
 * both foundation sections a map that follows the stop instead of annotating the whole instrument —
 * which is the outcome the note under `path-order` below was written in anticipation of. They are
 * kept for the same reason the localization registry keeps rows no pilot drill consumes yet: the
 * vocabulary is authored once and consumed by reference, and deleting a name the moment its last
 * caller moves is how a registry ends up being re-derived by the next package that wants it.
 */
export type EcmoCircuitScaffoldEmphasis = 'path-order' | 'sensor-sites' | 'pressure-zones'

export type EcmoCircuitPresentation =
  | { readonly kind: 'neutral' }
  | { readonly kind: 'scaffold'; readonly emphasis: EcmoCircuitScaffoldEmphasis }
  /** Multi-segment is not a fourth kind: it is a row whose problem lives in more than one place. */
  | { readonly kind: 'implicated'; readonly rowId: EcmoLocalizationRowId }
  /**
   * Where the walk is standing.
   *
   * A fourth kind rather than a scaffold, because a scaffold annotates the whole instrument and a
   * stop points at one part of it. And emphatically not `implicated`: "you are here" and "the
   * problem lives here" are different claims, and the drills' leak test asserts the *absence* of the
   * implicated attribute rather than weighing degrees of emphasis. Keeping the two marking
   * vocabularies disjoint is what lets that assertion stay a simple one.
   */
  | {
      readonly kind: 'walk-stop'
      readonly stopId: string
      readonly segmentIds: readonly EcmoCircuitSegmentId[]
      readonly sensorSiteIds: readonly EcmoSensorSiteId[]
      /**
       * True when the stop reports readings but the walk is withholding their names until the
       * learner commits the prediction. Without this the map's text equivalent said "no reading is
       * taken at this place" about a place that does take readings — a false sentence produced by
       * a true gate. The map draws the same either way; only the prose differs.
       */
      readonly readingsWithheld?: boolean
    }

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
  /**
   * A foundation walk, standing at one stop.
   *
   * Commitment-independent, like the console tour and for the same reason: the walk teaches where
   * things are rather than asking what is wrong, and the place it is pointing at is the subject of
   * the paragraph beside it rather than the answer to a question.
   */
  | {
      readonly kind: 'foundation-walk-stop'
      readonly stopId: string
      readonly segmentIds: readonly EcmoCircuitSegmentId[]
      readonly sensorSiteIds: readonly EcmoSensorSiteId[]
      /** See the presentation field of the same name. */
      readonly readingsWithheld?: boolean
    }

export function deriveEcmoCircuitPresentation(
  state: EcmoSimulationState,
  context: EcmoCircuitPresentationContext,
): EcmoCircuitPresentation {
  switch (context.kind) {
    case 'foundation-scaffold':
      return { kind: 'scaffold', emphasis: context.emphasis }
    case 'drill-orientation-scaffold':
      return { kind: 'scaffold', emphasis: 'sensor-sites' }
    case 'foundation-walk-stop':
      return {
        kind: 'walk-stop',
        stopId: context.stopId,
        segmentIds: context.segmentIds,
        sensorSiteIds: context.sensorSiteIds,
        readingsWithheld: context.readingsWithheld,
      }
    case 'drill-reveal':
      return state.scenario.prediction.committed
        ? { kind: 'implicated', rowId: context.rowId }
        : { kind: 'neutral' }
  }
}

/** The console pressure channels, which every state flags because every state is about them. */
const PRESSURE_CHANNEL_SITE_IDS: readonly EcmoSensorSiteId[] = ['pVen', 'pInt', 'deltaP', 'pArt']

/**
 * Every site the registry places on the circuit, in registry order.
 *
 * Derived rather than listed, so the map cannot fall behind the stop list beside it. It did once:
 * the walk emphasis carried a hand-written six of the seven, and the lesson's own stop list — which
 * reads the registry — named the flow and bubble sensor the map was not drawing.
 */
const ALL_SITE_IDS: readonly EcmoSensorSiteId[] = ecmoSensorSites.map((site) => site.id)

export function ecmoMapSensorSiteIds(
  presentation: EcmoCircuitPresentation,
): readonly EcmoSensorSiteId[] {
  /*
   * The per-stop subset this file always expected to be asked for.
   *
   * Returned in registry order rather than in the order the stop happens to list them, so the map
   * reads top-to-bottom along the circuit however a stop was authored. A stop that names no reading
   * — the pump, which reports no channel of its own — flags nothing, and that emptiness is the
   * teaching rather than a gap.
   */
  if (presentation.kind === 'walk-stop') {
    const stopSites = new Set<EcmoSensorSiteId>(presentation.sensorSiteIds)
    return ALL_SITE_IDS.filter((siteId) => stopSites.has(siteId))
  }
  if (presentation.kind === 'implicated') {
    /*
     * The pressure channels, plus whatever this row actually turns on.
     *
     * Without the second half the gas row's map flagged four pressure channels and omitted the
     * post-membrane saturation — the one signal that moves in the fault being explained, and the
     * only thing on the map the row's own text is about.
     */
    const rowSites = ecmoLocalizationRow(presentation.rowId).sensorSiteIds
    return ALL_SITE_IDS.filter(
      (siteId) => PRESSURE_CHANNEL_SITE_IDS.includes(siteId) || rowSites.includes(siteId),
    )
  }
  if (presentation.kind !== 'scaffold') return PRESSURE_CHANNEL_SITE_IDS
  switch (presentation.emphasis) {
    /*
     * The circuit walk and the console tour both flag everything: one is teaching that every signal
     * has a place, the other that the places are what you verify. They are kept as separate names
     * because they are separate lessons, and because R3's walk will want a subset per stop.
     */
    case 'path-order':
    case 'sensor-sites':
      return ALL_SITE_IDS
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
 * The places the walk is standing, which is a different question from what is implicated.
 *
 * Empty for every other kind, so a caller cannot accidentally draw a stop marker on a drill map —
 * and, read the other way, `ecmoMapImplicatedSegmentIds` stays empty on a walk map, which is what
 * keeps the drills' leak assertion meaningful.
 */
export function ecmoMapWalkStopSegmentIds(
  presentation: EcmoCircuitPresentation,
): readonly EcmoCircuitSegmentId[] {
  return presentation.kind === 'walk-stop' ? presentation.segmentIds : []
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
 * Where the walk is standing, in words.
 *
 * Deliberately a different sentence from the implicated caption, in different words, because the
 * two mean different things and a learner who met "marked" in both would have to work out that one
 * of them was not an accusation.
 */
export function ecmoMapWalkStopCaption(
  presentation: EcmoCircuitPresentation,
  supportMode: SupportMode,
): string | null {
  if (presentation.kind !== 'walk-stop') return null
  const names = presentation.segmentIds.map((segmentId) =>
    resolveEcmoModeText(ecmoCircuitSegment(segmentId).label, supportMode),
  )
  if (names.length === 0) return null
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `You are here: ${list}.`
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
    // A walk stop can flag nothing for two different reasons, and they get different sentences: a
    // place that reports no channel of its own (the pump), or readings the walk is withholding
    // until the prediction is committed. The first version said "no reading is taken at this
    // place" for both, which was false at every reporting stop before the commitment.
    sites.length > 0
      ? `Flagged on the map: ${sites}.`
      : presentation.kind === 'walk-stop' && presentation.readingsWithheld
        ? 'Nothing on the map is flagged yet: the readings taken here are named once you have committed your prediction.'
        : 'Nothing on the map is flagged at this stop: no reading is taken at this place.',
  ]

  const walkCaption = ecmoMapWalkStopCaption(presentation, supportMode)
  if (walkCaption) sentences.push(walkCaption)

  const caption = ecmoMapImplicatedCaption(presentation, supportMode)
  if (caption) sentences.push(caption)

  return sentences.join(' ')
}
