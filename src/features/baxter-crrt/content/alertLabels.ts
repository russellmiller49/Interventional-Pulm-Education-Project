import type { EngineAlarmCode } from '../engine/types'

/**
 * Learner wording for the simulation's generic alerts (CRRT-FELLOW-04, F-19).
 *
 * Every alert this engine raises is a generic model alert: `ActiveAlarm.deviceMappingStatus` is
 * `pending-device-adapter` and `urgency` is null for all of them, because no reviewed device
 * adapter maps a modeled fault to a PrisMax alarm. Learners used to see the raw engine code
 * (`ACCESS_OBSTRUCTION`), which reads like a console message, or a title-cased copy of it.
 *
 * The label says what the alert is — a simulated alert for a modeled fault — and nothing more.
 * It invents no manufacturer alarm name, priority, color, reset behavior or pump response, and
 * the boundary sentence says so wherever alerts are listed.
 */
const faultWords: Readonly<Record<EngineAlarmCode, string>> = Object.freeze({
  ACCESS_OBSTRUCTION: 'access-obstruction',
  ACCESS_DISCONNECTION: 'access-disconnection',
  RETURN_OBSTRUCTION: 'return-obstruction',
  RETURN_DISCONNECTION: 'return-disconnection',
  FILTER_FOULING: 'filter-fouling',
  EFFLUENT_OBSTRUCTION: 'effluent-obstruction',
  AIR_DETECTED: 'air-detection',
  BLOOD_LEAK_DETECTED: 'blood-leak-detection',
  SUPPLY_BAG_EMPTY: 'empty-supply-bag',
  EFFLUENT_BAG_FULL: 'full-effluent-bag',
  SCALE_OPEN: 'open-scale',
  FLUID_GAIN_LOSS: 'fluid gain-or-loss',
  POWER_INTERRUPTION: 'power-interruption',
})

/** For example `ACCESS_OBSTRUCTION` → “Simulated access-obstruction alert”. */
export function crrtSimulatedAlertLabel(code: EngineAlarmCode): string {
  return `Simulated ${faultWords[code]} alert`
}

/**
 * For surfaces that receive the code as a plain string (the PrisMax facsimile's operations view).
 * An unrecognized code still reads as a generic simulated alert, never as a raw engine code.
 */
export function crrtSimulatedAlertLabelFromCode(code: string): string {
  return Object.hasOwn(faultWords, code)
    ? crrtSimulatedAlertLabel(code as EngineAlarmCode)
    : 'Simulated alert'
}

/** The same label inside a sentence: “the simulated access-obstruction alert”. */
export function crrtSimulatedAlertPhrase(code: EngineAlarmCode): string {
  return `simulated ${faultWords[code]} alert`
}

export const CRRT_SIMULATED_ALERT_BOUNDARY =
  'Simulated alerts come from this teaching model. They are not PrisMax alarm names, and no manufacturer priority, color or automatic pump response has been mapped to them; that mapping awaits device review.' as const
