/**
 * One evidence contract per authored identification item.
 *
 * The walkthrough's P0: Section 1 step 2 asks "Which phase is shown at cursor A?", keys
 * *Expiration*, and explains that "the cursor lies in the interval after inspiratory delivery,
 * with negative flow and falling volume" — while the only cursor on screen sat at 0.30 s with
 * flow +40 L/min and volume rising, and no "A" was drawn on any trace. Three separate things had
 * come apart:
 *
 *   1. the figure had no fixed marker at all — the line it drew was the *exploration* cursor,
 *      which starts at an inspiration default and moves whenever the learner moves it;
 *   2. nothing bound the authored key to a position on the reference breath;
 *   3. nothing checked that the samples at that position actually show what the key claims.
 *
 * This file is the binding, and it is checked at import. Each entry names: which round of which
 * unit it belongs to, the letter the item asks about, where on the breath the marker is pinned,
 * and what the samples there must show. `markerEvidence` then resolves it against a real captured
 * breath and validates the flow sign and the volume direction from the samples themselves rather
 * than from a timestamp. When the trace cannot support the contract — an incomplete buffer, a
 * phase the breath does not contain — it returns null and the surface says the evidence is not
 * available, which is the one honest alternative to drawing a plausible substitute.
 *
 * The keys are not touched here. The assertion below runs the other way: the marker's phase has to
 * match the option the round already keys, so an edit to either one that breaks the pair fails at
 * import instead of shipping another cursor-A.
 */
import { breathStopIndex } from '../engine/teachingBreath'
import type { WaveformSample } from '../engine/types'
import type { BreathStopId } from './breathSpine'
import { ventilationExperimentByUnit } from './learningExperiments'

export type MarkerPhase = 'inspiration' | 'expiration'

export interface VentilationReferenceMarker {
  readonly unitId: string
  readonly roundIndex: 0 | 1
  /** The letter the authored stem uses: "cursor A". */
  readonly markerId: string
  /** Where on the breath the marker is pinned, using the module's own four stops. */
  readonly stop: BreathStopId
  /** The phase the keyed option names. Checked against the round's key at import. */
  readonly phase: MarkerPhase
}

export const ventilationReferenceMarkers: readonly VentilationReferenceMarker[] = [
  {
    unitId: 'breathing-with-support',
    roundIndex: 0,
    markerId: 'A',
    stop: 'expiration',
    phase: 'expiration',
  },
  {
    unitId: 'breathing-with-support',
    roundIndex: 1,
    markerId: 'B',
    stop: 'inspiration',
    phase: 'inspiration',
  },
]

for (const marker of ventilationReferenceMarkers) {
  const round = ventilationExperimentByUnit.get(marker.unitId)?.rounds[marker.roundIndex]
  if (!round) throw new Error(`Reference marker ${marker.markerId} has no round to belong to`)
  const keyed = round.choices[round.correct].trim().toLowerCase()
  if (keyed !== marker.phase)
    throw new Error(
      `Reference marker ${marker.markerId} is pinned in ${marker.phase} but ${marker.unitId} round ${marker.roundIndex + 1} keys "${round.choices[round.correct]}"`,
    )
}

const markerIndex = new Map(
  ventilationReferenceMarkers.map((marker) => [`${marker.unitId}:${marker.roundIndex}`, marker]),
)

export function ventilationReferenceMarker(
  unitId: string,
  roundIndex: 0 | 1,
): VentilationReferenceMarker | null {
  return markerIndex.get(`${unitId}:${roundIndex}`) ?? null
}

export interface MarkerEvidence {
  readonly marker: VentilationReferenceMarker
  /** Index into the captured breath the marker is drawn at. */
  readonly index: number
  readonly sample: WaveformSample
  readonly previous: WaveformSample
  readonly flowLMin: number
  readonly volumeChangeMl: number
  /** Seconds from the start of the captured breath. */
  readonly atSeconds: number
}

function supports(
  marker: VentilationReferenceMarker,
  sample: WaveformSample,
  previous: WaveformSample,
) {
  const volumeChange = sample.volumeMl - previous.volumeMl
  if (sample.phase !== marker.phase) return false
  return marker.phase === 'inspiration'
    ? sample.flowLMin > 0 && volumeChange > 0
    : sample.flowLMin < 0 && volumeChange < 0
}

/**
 * Resolve a marker against a captured breath, or return null when the trace cannot support it.
 *
 * The preferred position is the module's own stop index, so the marker lands where the breath map
 * says that stop is. It is accepted only if the samples there actually show the flow sign and the
 * volume direction the key depends on; otherwise the breath is scanned for the first sample in the
 * right phase that does. Nothing is interpolated and no sample outside the captured breath is
 * consulted.
 */
export function markerEvidence(
  breath: readonly WaveformSample[],
  marker: VentilationReferenceMarker,
): MarkerEvidence | null {
  if (breath.length < 4) return null
  const at = (index: number): MarkerEvidence | null => {
    if (index < 1 || index > breath.length - 1) return null
    const sample = breath[index]
    const previous = breath[index - 1]
    if (!supports(marker, sample, previous)) return null
    return {
      marker,
      index,
      sample,
      previous,
      flowLMin: sample.flowLMin,
      volumeChangeMl: sample.volumeMl - previous.volumeMl,
      atSeconds: sample.time - breath[0].time,
    }
  }
  const preferred = at(breathStopIndex(breath, marker.stop))
  if (preferred) return preferred
  for (let index = 1; index < breath.length; index += 1) {
    const candidate = at(index)
    if (candidate) return candidate
  }
  return null
}

/** The sentence a surface prints for a resolved marker, built from the samples it resolved to. */
export function markerEvidenceSentence(evidence: MarkerEvidence): string {
  const rising = evidence.volumeChangeMl > 0
  return `Interval ${evidence.marker.markerId} is at ${evidence.atSeconds.toFixed(2)} s on this breath: flow ${evidence.flowLMin.toFixed(1)} L/min (${evidence.flowLMin > 0 ? 'gas moving in' : 'gas moving out'}) and volume ${rising ? 'rising' : 'falling'} by ${Math.abs(evidence.volumeChangeMl).toFixed(0)} mL over the preceding ${(evidence.sample.time - evidence.previous.time).toFixed(2)} s.`
}

export const MARKER_UNAVAILABLE_NOTE =
  'The marked interval is not available on this trace yet: the captured breath does not contain a complete interval in that phase. Run or advance one breath and capture again rather than reading a substitute.'
