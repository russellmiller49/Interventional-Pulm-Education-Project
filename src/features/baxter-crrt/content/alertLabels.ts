import type { EngineAlarmCode } from '../engine/types'

/**
 * The name a learner reads for each alert the simulation raises.
 *
 * Each modeled fault carries the title the PrisMax shows for the same condition (Operator's
 * Manual AW8035 Rev B, alarm tables, PDF pp. 102–132), so the name learned here is the name on
 * the screen at the bedside. Two faults have no PrisMax title of their own and say what they are.
 * The engine's alert is still generic: priority and the automatic pump response are simplified.
 */
const alarmTitles: Readonly<Record<EngineAlarmCode, string>> = Object.freeze({
  ACCESS_OBSTRUCTION: 'Access Extremely Negative',
  ACCESS_DISCONNECTION: 'Set Disconnection',
  RETURN_OBSTRUCTION: 'Return Extremely Positive',
  RETURN_DISCONNECTION: 'Return Disconnection',
  FILTER_FOULING: 'High Filter Pressure',
  EFFLUENT_OBSTRUCTION: 'Effluent line obstruction',
  AIR_DETECTED: 'Air Detected in Blood',
  BLOOD_LEAK_DETECTED: 'Blood Leak Detected',
  SUPPLY_BAG_EMPTY: 'Bag Empty',
  EFFLUENT_BAG_FULL: 'Effluent Bag Full',
  SCALE_OPEN: 'Scale Open',
  FLUID_GAIN_LOSS: 'CRRT Gain/Loss Limit Reached',
  POWER_INTERRUPTION: 'Loss of AC Power',
})

/** For example `ACCESS_OBSTRUCTION` → “Access Extremely Negative alarm”. */
export function crrtSimulatedAlertLabel(code: EngineAlarmCode): string {
  return `${alarmTitles[code]} alarm`
}

/**
 * For surfaces that receive the code as a plain string (the PrisMax facsimile's operations view).
 * An unrecognized code reads as a generic alarm, never as a raw engine code.
 */
export function crrtSimulatedAlertLabelFromCode(code: string): string {
  return Object.hasOwn(alarmTitles, code)
    ? crrtSimulatedAlertLabel(code as EngineAlarmCode)
    : 'Alarm'
}

/** The same label inside a sentence: “the Access Extremely Negative alarm”. */
export function crrtSimulatedAlertPhrase(code: EngineAlarmCode): string {
  return `${alarmTitles[code]} alarm`
}

export const CRRT_SIMULATED_ALERT_BOUNDARY =
  'Alarm names follow the PrisMax operator’s manual. On the machine a high-priority alarm stops the pumps; here they keep running so you can watch the pressures.' as const
