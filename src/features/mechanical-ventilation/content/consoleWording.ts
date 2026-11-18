import type { VentilatorDeviceId } from '../engine/types'
import { getVentilatorDeviceProfile } from './deviceProfiles'

/**
 * Task copy that names a console control in the selected console's own words.
 *
 * The cycle-off threshold and the rise time carry a different name on every console in this
 * module: ETS and P-ramp on the Hamilton C6, Insp term and Slope on the Evita, ESENS and Rise Time
 * on the PB980, PSV Cycle and Insp Rise on the AVEA. The rounds used to print the Hamilton names on
 * every console. The author's ruling of 2026-11-12 ("Follow the console"): the copy reads the
 * selected console's label, with the clinical term first — "the cycle-off threshold (Insp term)".
 *
 * Authored copy carries a token where the name goes (`{console:etsPercent}`), and the token is
 * resolved for one console before anything is shown. The label is the device profile's own
 * (`controlLabels`), the same one the console tile prints, so the copy and the console cannot
 * disagree.
 */

const CLINICAL_TERMS = {
  etsPercent: 'cycle-off threshold',
  pRampMs: 'rise time',
} as const

export type ConsoleNamedControl = keyof typeof CLINICAL_TERMS

export const consoleNamedControls = Object.keys(CLINICAL_TERMS) as readonly ConsoleNamedControl[]

/** The token authored copy writes where the console's name for a control goes. */
export function consoleTermToken(key: ConsoleNamedControl): string {
  return `{console:${key}}`
}

const TOKEN = /\{console:(etsPercent|pRampMs)\}/g

/** The selected console's label for a control, as its tile prints it. */
export function consoleControlLabel(
  deviceId: VentilatorDeviceId,
  key: ConsoleNamedControl,
): string {
  return getVentilatorDeviceProfile(deviceId).controlLabels[key] ?? CLINICAL_TERMS[key]
}

const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The clinical term, then the console's label: "cycle-off threshold (ETS)". Where the console's
 * label is the clinical term itself (the PB980's "Rise Time"), the term alone.
 */
export function consoleControlTerm(deviceId: VentilatorDeviceId, key: ConsoleNamedControl): string {
  const clinical = CLINICAL_TERMS[key]
  const label = consoleControlLabel(deviceId, key)
  return plain(label) === plain(clinical) ? clinical : `${clinical} (${label})`
}

/** Authored copy with every console token resolved for one console. */
export function resolveConsoleWording(text: string, deviceId: VentilatorDeviceId): string {
  return text.replace(TOKEN, (_, key: ConsoleNamedControl) => consoleControlTerm(deviceId, key))
}

/** Whether a piece of copy still carries an unresolved token: never true for anything shown. */
export function hasConsoleToken(text: string): boolean {
  return /\{console:/.test(text)
}
