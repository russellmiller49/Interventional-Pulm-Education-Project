import { mcsReducer } from '../engine/reducer'
import type { IabpDeviceState, McsSimulationState } from '../engine/types'
import { mcsAfTriggerLimitApplies } from './afTriggerLimit'

/**
 * The worked comparison that replaced a graded trigger decision.
 *
 * In atrial fibrillation the engine rates pressure triggering 0.74, ECG 0.5 and internal 0.4, and
 * raises `iabp-trigger-unreliable` below 0.6 — so pressure is the only source that clears the
 * alarm, and the only source that reaches IABP-02's authored condition (≥60) or CAP-IABP-01's
 * (≥65). The supplied Cardiosave material says the opposite. MCS-03 held the model and wrote the
 * disagreement down; MCS-AF-PRESENTATION-01 put it beside the control. Neither stopped the module
 * from answering a learner who switched to pressure triggering with a higher figure, a cleared
 * alarm and a met condition — three positive signals for the action the note warns against.
 *
 * So the decision is not graded any more, and what the learner gets instead is all three of this
 * model's own ratings at once, with the disagreement in the same place. Putting the three side by
 * side is the point: a rating that only exists inside this simulation is far harder to mistake for
 * a console's verdict when its two rivals are printed next to it under the same conditions.
 *
 * Every figure is produced by running the live state forward on a separate copy per trigger source,
 * from the same starting state, over the same simulated interval, with nothing else changed. No
 * number here is authored, and the live session is never touched.
 */

export const MCS_AF_COMPARISON_SECONDS = 5

export interface McsAfTriggerRating {
  readonly source: IabpDeviceState['triggerSource']
  readonly label: string
  /** This model's own synchrony rating, as displayed. */
  readonly synchronyPercent: number | null
  /** Whether the engine's own trigger-reliability alarm is raised on this source. */
  readonly triggerAlarmActive: boolean
  /** True for the source the live state is on, so the table can say where the learner is. */
  readonly selected: boolean
}

export interface McsAfTriggerComparison {
  readonly ratings: readonly McsAfTriggerRating[]
  /** The simulated instant every rating was read at, so the comparison is matched, not drifting. */
  readonly observedAtSeconds: number
  /** The settings held constant across the three runs, for the caption. */
  readonly assistRatio: number
  readonly inflationOffsetMs: number
  readonly deflationOffsetMs: number
  readonly running: boolean
}

const TRIGGER_LABELS: Readonly<Record<IabpDeviceState['triggerSource'], string>> = {
  ecg: 'ECG',
  pressure: 'Arterial pressure',
  internal: 'Internal',
}

const TRIGGER_ORDER: readonly IabpDeviceState['triggerSource'][] = ['ecg', 'pressure', 'internal']

function settle(state: McsSimulationState, seconds: number): McsSimulationState {
  let next = state
  const steps = Math.round(seconds / 0.25)
  for (let index = 0; index < steps; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.25 })
  }
  return next
}

/**
 * Rate all three trigger sources from the state on screen, on separate copies.
 *
 * Returns `null` unless the limitation actually applies — an IABP in atrial fibrillation — so the
 * comparison never appears where there is nothing held. `mcsReducer` is pure over its state, so
 * each run forks from the same value and none of them is the session the learner is in.
 */
export function mcsAfTriggerComparison(
  state: McsSimulationState,
  seconds: number = MCS_AF_COMPARISON_SECONDS,
): McsAfTriggerComparison | null {
  if (!mcsAfTriggerLimitApplies(state)) return null
  if (state.device.kind !== 'iabp') return null
  const device = state.device
  const ratings = TRIGGER_ORDER.map((source) => {
    /*
     * The fork sets the device directly rather than dispatching `SET_IABP_CONTROL`. A dispatch
     * would run the permitted-action check and append `iabp:set-trigger` to the copy's action log,
     * which is a record of work the learner did not do; reading a comparison is not performing one.
     */
    const run = settle({ ...state, device: { ...device, triggerSource: source } }, seconds)
    return {
      source,
      label: TRIGGER_LABELS[source],
      synchronyPercent: run.metrics.timingQualityPercent,
      triggerAlarmActive: run.alarms.some(
        (alarm) => alarm.id === 'iabp-trigger-unreliable' && alarm.active,
      ),
      selected: device.triggerSource === source,
    }
  })
  return {
    ratings,
    observedAtSeconds: state.timeSeconds + seconds,
    assistRatio: device.assistRatio,
    inflationOffsetMs: device.inflationOffsetMs,
    deflationOffsetMs: device.deflationOffsetMs,
    running: device.running,
  }
}
