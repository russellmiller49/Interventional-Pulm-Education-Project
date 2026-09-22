import { plateauReadingValidity } from '../content/plateauValidity'
import { measurementInputs } from './measurementConditions'
import { advanceSimulation } from './simulation'
import type { VentilationSimulationState, WaveformSample } from './types'

export { measurementInputs }

export interface HoldAcquisition {
  hold: 'inspiratory' | 'expiratory'
  revision: number
  inputs: Record<string, string | number>
  startedAt: number
  endsAt: number
  value: number
  interpretable: boolean
  reason: string | null
  waveforms: readonly WaveformSample[]
}
export interface CapturedHold extends HoldAcquisition {
  capturedAt: number
}

export function updateHoldAcquisition(
  before: VentilationSimulationState,
  after: VentilationSimulationState,
  revision: number,
  pending?: HoldAcquisition,
): { acquisition?: HoldAcquisition; captured?: CapturedHold } {
  const v = after.ventilator
  // A change while occluded invalidates the acquisition as a controlled maneuver, even if a
  // subsequent change returns to the same numeric inputs. Keep already captured history elsewhere.
  if (pending && pending.revision !== revision) return {}
  if (
    !pending &&
    v.holdType &&
    v.holdUntil !== null &&
    before.ventilator.holdUntil !== v.holdUntil
  ) {
    pending = {
      hold: v.holdType,
      revision,
      inputs: measurementInputs(after),
      startedAt: after.simulationTime,
      endsAt: v.holdUntil,
      value: 0,
      interpretable: true,
      reason: null,
      waveforms: [],
    }
  }
  if (!pending) return {}
  const stillActive = v.holdType === pending.hold && v.holdUntil === pending.endsAt
  const finished = !v.holdType && after.simulationTime >= pending.endsAt
  if (!stillActive && !finished) return {} // aborted, not acquired
  // A one-breath step can cross the end of an entire hold. Read the actual engine at its last
  // occluded sample, rather than using the pre-step value or a post-release modeled value.
  // This immutable replay observes the maneuver; it never changes the learner's simulation.
  const readingState = stillActive
    ? after
    : advanceSimulation(before, Math.max(0, pending.endsAt - before.simulationTime - 0.02))
  const validity = plateauReadingValidity(readingState)
  const recorded = [
    ...pending.waveforms,
    ...after.waveforms.filter(
      (s) =>
        s.time >= pending!.startedAt &&
        s.time <= pending!.endsAt &&
        s.time > (pending!.waveforms.at(-1)?.time ?? -Infinity),
    ),
  ]
  // Bound persisted samples while preserving time and both ends. Clinical state still keeps 50 Hz.
  const waveforms =
    recorded.length > 150
      ? recorded.filter((_, i) => i % 2 === 0 || i === recorded.length - 1)
      : recorded
  const next: HoldAcquisition = {
    ...pending,
    waveforms,
    value:
      pending.hold === 'inspiratory'
        ? readingState.measurements.plateauPressureCmH2O
        : readingState.ventilator.settings.peepCmH2O + readingState.measurements.intrinsicPeepCmH2O,
    interpretable: pending.interpretable && validity.interpretable,
    reason: pending.reason ?? validity.reason,
  }
  return finished ? { captured: { ...next, capturedAt: pending.endsAt } } : { acquisition: next }
}

export function holdStatus(
  state: VentilationSimulationState,
  holds: readonly CapturedHold[],
  revision: number,
  hold: CapturedHold['hold'] = 'inspiratory',
) {
  if (state.ventilator.pendingHold === hold) return 'Requested / queued; no acquisition yet'
  if (state.ventilator.holdType === hold) return 'Hold in progress; acquisition is not complete'
  const last = holds.filter((h) => h.hold === hold).at(-1)
  if (!last) return 'Modeled reference; not acquired in this task'
  if (last.revision !== revision)
    return `Historical hold at ${last.capturedAt.toFixed(1)} s; repeat after the change`
  return last.interpretable
    ? `Current captured hold at ${last.capturedAt.toFixed(1)} s; passive interpretation supported`
    : `Captured at ${last.capturedAt.toFixed(1)} s; performed but unsuitable for passive interpretation: recent effort`
}
