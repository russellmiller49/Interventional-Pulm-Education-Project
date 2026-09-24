/**
 * A real alarm set, from a separate reference patient, for the Section 13 sorting panel (S13-1).
 *
 * "Where does the answer live?" sorts whatever the console is alarming on. Section 13's live
 * patient is MV-15 — an awake, distressed patient on pressure support whose console raises no
 * alarm — so the panel opened on four empty boxes beside a written example of "a high-pressure
 * alarm with falling blood pressure and new asymmetric breath sounds". Two fixes were rejected: an
 * invented alarm on MV-15 (it has none, and giving it one would teach the wrong patient), and a
 * pasted list (it would not be what any simulated console says).
 *
 * This is what the simulator itself raises for MV-14's unstable branch — the tension pneumothorax
 * the written example describes — at the moment that case opens: SpO₂ low and blood pressure low
 * from the patient, and the pressure-limitation alarm from the ventilator. It is computed by the
 * engine, never written into the learner's patient, and the panel names it as a separate
 * reference each time it is shown.
 */
import { createInitialSimulationState } from '../engine/simulation'
import type { AlarmEvent, VentilatorDeviceId } from '../engine/types'

export const REFERENCE_ALARM_CASE_ID = 'MV-14'
export const REFERENCE_ALARM_BRANCH = 'unstable'

export interface ReferenceAlarmSet {
  readonly caseId: string
  readonly branch: string
  readonly atSeconds: number
  readonly alarms: readonly AlarmEvent[]
}

const cache = new Map<VentilatorDeviceId, ReferenceAlarmSet>()

export function referenceAlarmSet(deviceId: VentilatorDeviceId): ReferenceAlarmSet {
  const cached = cache.get(deviceId)
  if (cached) return cached
  for (let attempt = 1; attempt < 64; attempt += 1) {
    const opened = createInitialSimulationState(
      REFERENCE_ALARM_CASE_ID,
      'practice',
      attempt,
      deviceId,
    )
    if (opened.branch !== REFERENCE_ALARM_BRANCH) continue
    const set: ReferenceAlarmSet = {
      caseId: REFERENCE_ALARM_CASE_ID,
      branch: REFERENCE_ALARM_BRANCH,
      atSeconds: opened.simulationTime,
      alarms: opened.alarms,
    }
    cache.set(deviceId, set)
    return set
  }
  throw new Error(`${REFERENCE_ALARM_CASE_ID} never selects branch ${REFERENCE_ALARM_BRANCH}`)
}
