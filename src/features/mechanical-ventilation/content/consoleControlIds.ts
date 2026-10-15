import type { VentilatorControlKey, VentilatorScreen } from '../engine/types'

/**
 * The stable DOM ids of the console's targetable controls, and of the clock bar above it.
 *
 * "Show me where" (`guidedConsoleTask.ts`) names one of these and the console marks the element
 * that carries it with `data-guided-help`; the help dialog and the Now card name the same control
 * in words. Ids are the contract between the two, so they are built here and nowhere else.
 */

/** A numeric setting tile on the Controls screen (or the alarm-limit tile on Alarms). */
export function consoleControlId(key: VentilatorControlKey | string): string {
  return `mv-control-${key}`
}

/** A navigation button under the console screen. */
export function consoleScreenId(screen: VentilatorScreen): string {
  return `mv-screen-${screen}`
}

/** An occlusion on the Tools screen. */
export function consoleHoldId(hold: 'inspiratory' | 'expiratory'): string {
  return `mv-hold-${hold}`
}

/** A mode card on the Modes screen. */
export function consoleModeId(modeId: string): string {
  return `mv-mode-${modeId}`
}

/** The press-and-turn knob on the bezel. */
export const CONSOLE_KNOB_ID = 'mv-knob'

/** Run / Pause on the clock bar. */
export const CLOCK_RUN_ID = 'mv-clock-run'

/** One breath on the clock bar. */
export const CLOCK_ONE_BREATH_ID = 'mv-clock-one-breath'

/** A bedside action card beside the console. Bedside actions are not ventilator controls. */
export function bedsideActionId(id: string): string {
  return `mv-action-${id}`
}

/**
 * A teaching-patient slider beside the console (compliance, resistance). The patient's mechanics
 * are not a control on any of the four consoles, so they keep the quick-control id they always had.
 */
export function quickControlId(key: string): string {
  return `mv-quick-${key}`
}

/**
 * Narrow teaching ranges for the patient and setting words a goal is phrased in. The console keeps
 * its own native ranges; these name a goal's control in plain words and bound the teaching sliders.
 */
export const quickControlRanges: Partial<
  Record<
    VentilatorControlKey,
    { label: string; unit: string; min: number; max: number; step: number }
  >
> = {
  vtMl: { label: 'Tidal volume', unit: 'mL', min: 200, max: 700, step: 10 },
  peakFlowLMin: { label: 'Inspiratory flow', unit: 'L/min', min: 20, max: 90, step: 1 },
  oxygenPercent: { label: 'Oxygen', unit: '%', min: 21, max: 100, step: 1 },
  peepCmH2O: { label: 'PEEP', unit: 'cmH₂O', min: 0, max: 20, step: 1 },
  ratePerMin: { label: 'Rate', unit: '/min', min: 8, max: 35, step: 1 },
  triggerThreshold: { label: 'Flow trigger', unit: 'L/min', min: 0.5, max: 8, step: 0.5 },
  etsPercent: { label: 'Cycle-off (ETS)', unit: '%', min: 5, max: 80, step: 1 },
  pRampMs: { label: 'Rise time', unit: 'ms', min: 0, max: 1000, step: 10 },
}

export const interventionLabels: Readonly<Record<string, string>> = {
  'assess-patient': 'Assess the patient',
  'inspect-circuit': 'Inspect the circuit',
  'drain-condensate': 'Clear the condensate',
  'communication-board': 'Establish communication',
  'treat-pain': 'Treat the pain (modeled)',
}

/** The confirm key of a pending edit (Press knob to confirm, or the AVEA's ACCEPT). */
export const CONSOLE_PENDING_CONFIRM_ID = 'mv-pending-confirm'
