import {
  UNAIDED_DISQUALIFYING_ASSISTS,
  type AccessoryPosition,
  type AccessoryState,
  type CordsState,
  type ScopeAssist,
  type ScopeInputMode,
  type ScopeInputs,
  type ScopeMetricId,
  type ScopeState,
  type ScopeViewSpec,
} from '../../components/scope/types'
import { inspectionLedgerSummary } from './inspectionLedger'

/**
 * The readouts under the scope controls, and the numbers the goals test.
 *
 * Every readout is formatted here once, so the 3D pane, the fallback and the test double print the
 * same words. Contact and lost-view counts are feedback signals, never a measure of force, trauma
 * or skill (knowledge spec §23.3). The annulus is geometry from two authored diameters — a
 * worked illustration of area, not airflow, ventilation or a safe-size rule (A36).
 */

export const SCOPE_METRIC_LABELS: Readonly<Record<ScopeMetricId, string>> = {
  currentAirway: 'Current airway',
  parentage: 'Parentage',
  depthMm: 'Insertion depth',
  rotationDeg: 'Control-section rotation',
  deflectionDeg: 'Tip deflection',
  suction: 'Suction',
  contactCount: 'Wall contacts',
  lossOfViewCount: 'Views lost',
  annularAreaFraction: 'Share of the tube left open',
  annularAreaMm2: 'Open area around the scope',
  cordsState: 'True vocal folds',
  accessoryState: 'Accessory',
  ledgerSummary: 'Inspection record',
  inputMode: 'Input',
  assistsUsed: 'Assists used',
}

export const SCOPE_ASSIST_NAMES: Readonly<Record<ScopeAssist, string>> = {
  'centerline-lock': 'centerline lock',
  'aim-guard': 'aim guard',
  'branch-labels': 'in-view labels',
  'align-to-branch': 'align to a branch',
  'teleport-to-start': 'back to the start',
  recenter: 'recenter',
  'reference-orientation': 'reference orientation',
}

export const SCOPE_INPUT_MODE_NAMES: Readonly<Record<ScopeInputMode, string>> = {
  keyboard: 'keyboard',
  pointer: 'pointer',
  touch: 'touch',
  gamepad: 'game controller',
  scripted: 'scripted',
}

export const CORDS_STATE_WORDS: Readonly<Record<CordsState, string>> = {
  abducted: 'Apart, on the breath in',
  narrowing: 'Narrowing, on the breath out',
  adducted: 'Together, with a scripted cough',
}

export const ACCESSORY_STATE_WORDS: Readonly<Record<AccessoryState, string>> = {
  none: 'None loaded',
  'forceps-closed': 'Forceps, cups closed',
  'forceps-open': 'Forceps, cups open',
  'brush-sheathed': 'Brush, inside its sheath',
  'brush-exposed': 'Brush, bristles exposed',
  'needle-sheathed': 'Needle, inside its sheath',
  'needle-exposed': 'Needle, exposed',
}

export const ACCESSORY_POSITION_WORDS: Readonly<Record<AccessoryPosition, string>> = {
  none: 'not in the scope',
  'in-channel': 'in the working channel',
  'at-tip': 'at the tip',
  extended: 'beyond the tip',
}

/** The geometric annulus of an ideal circular scope inside an ideal circular tube. */
export function annularArea(
  inputs: Pick<ScopeInputs, 'tube' | 'scopeOdMm'>,
): { readonly fraction: number; readonly mm2: number } | null {
  if (!inputs.tube) return null
  const id = inputs.tube.idMm
  const od = inputs.scopeOdMm
  if (!(id > 0) || !(od > 0) || od >= id) return { fraction: 0, mm2: 0 }
  return { fraction: 1 - (od / id) ** 2, mm2: (Math.PI / 4) * (id * id - od * od) }
}

/** A fraction in words, never a percentage (the course's copy rule). */
export function fractionInWords(fraction: number): string {
  if (fraction <= 0) return 'none'
  if (fraction < 0.2) return 'less than a fifth'
  if (fraction < 0.3) return 'about a quarter'
  if (fraction < 0.38) return 'about a third'
  if (fraction < 0.47) return 'a little under half'
  if (fraction < 0.54) return 'about half'
  if (fraction < 0.72) return 'more than half'
  return 'most of it'
}

export type ScopeGoalMetricId = 'rotationDeg' | 'deflectionDeg' | 'depthMm' | 'annularAreaFraction'

/** The number a metric goal tests, or null when it has no value in this state. */
export function scopeMetricValue(metric: ScopeGoalMetricId, state: ScopeState): number | null {
  switch (metric) {
    case 'rotationDeg':
      return state.inputs.rotationDeg
    case 'deflectionDeg':
      return state.inputs.deflectionDeg
    case 'depthMm':
      return state.depthMm
    case 'annularAreaFraction':
      return annularArea(state.inputs)?.fraction ?? null
  }
}

function formatRotation(deg: number): string {
  const rounded = Math.round(deg)
  if (rounded === 0) return '0°, neutral'
  return rounded > 0 ? `${rounded}° clockwise` : `${-rounded}° counterclockwise`
}

function formatDeflection(deg: number): string {
  const rounded = Math.round(deg)
  if (rounded === 0) return '0°, tip straight'
  return rounded > 0
    ? `${rounded}° toward the top of the image`
    : `${-rounded}° toward the bottom of the image`
}

/** "keyboard, assisted (centerline lock, aim guard)" — the honest record a summary prints (A18). */
export function describeScopePerformance(
  state: Pick<ScopeState, 'inputModes' | 'assistsUsed'>,
): string {
  const modes = state.inputModes.filter((mode) => mode !== 'scripted')
  const how = modes.length
    ? modes.map((mode) => SCOPE_INPUT_MODE_NAMES[mode]).join(', ')
    : 'no input yet'
  const disqualifying = state.assistsUsed.filter((assist) =>
    UNAIDED_DISQUALIFYING_ASSISTS.includes(assist),
  )
  if (disqualifying.length === 0) return `${how}, unaided`
  return `${how}, assisted (${disqualifying.map((assist) => SCOPE_ASSIST_NAMES[assist]).join(', ')})`
}

/** Whether a performance may be called unaided: no disqualifying assist was used (A18). */
export function scopePerformanceUnaided(state: Pick<ScopeState, 'assistsUsed'>): boolean {
  return !state.assistsUsed.some((assist) => UNAIDED_DISQUALIFYING_ASSISTS.includes(assist))
}

export function formatScopeMetric(metric: ScopeMetricId, state: ScopeState): string {
  switch (metric) {
    case 'currentAirway':
      return state.location.fullLabel
    case 'parentage':
      return state.location.parentage.length
        ? state.location.parentage.join(' → ')
        : 'Not inside an airway'
    case 'depthMm':
      return `${Math.round(state.depthMm)} mm`
    case 'rotationDeg':
      return formatRotation(state.inputs.rotationDeg)
    case 'deflectionDeg':
      return formatDeflection(state.inputs.deflectionDeg)
    case 'suction':
      return state.inputs.suction ? 'On' : 'Off'
    case 'contactCount':
      return `${state.signals.contactCount} (a feedback signal)`
    case 'lossOfViewCount':
      return `${state.signals.lossOfViewCount} (a feedback signal)`
    case 'annularAreaFraction': {
      const area = annularArea(state.inputs)
      if (!area) return 'No tube in place'
      return `${area.fraction.toFixed(2)} of the tube’s lumen — ${fractionInWords(area.fraction)}`
    }
    case 'annularAreaMm2': {
      const area = annularArea(state.inputs)
      if (!area) return 'No tube in place'
      return `${Math.round(area.mm2)} mm² between scope and tube`
    }
    case 'cordsState':
      return CORDS_STATE_WORDS[state.inputs.cords]
    case 'accessoryState':
      return `${ACCESSORY_STATE_WORDS[state.inputs.accessory]}, ${ACCESSORY_POSITION_WORDS[state.inputs.accessoryPosition]}`
    case 'ledgerSummary': {
      const summary = inspectionLedgerSummary(state.ledger)
      if (summary.total === 0) return 'No airways listed on this step'
      const parts = [`${summary.inspected} inspected`]
      if (summary.notSafelyAccessible)
        parts.push(`${summary.notSafelyAccessible} not safely accessible`)
      if (summary.notObserved) parts.push(`${summary.notObserved} not observed`)
      parts.push(`${summary.open} still open, of ${summary.total}`)
      return parts.join(' · ')
    }
    case 'inputMode': {
      const last = state.inputModes[state.inputModes.length - 1]
      return last ? SCOPE_INPUT_MODE_NAMES[last] : 'No input yet'
    }
    case 'assistsUsed':
      return state.assistsUsed.length
        ? state.assistsUsed.map((assist) => SCOPE_ASSIST_NAMES[assist]).join(', ')
        : 'None'
  }
}

export interface ScopeReadout {
  readonly id: ScopeMetricId
  readonly label: string
  readonly value: string
}

/** The readouts a view lists, in its order, formatted. */
export function scopeReadouts(
  view: Pick<ScopeViewSpec, 'readouts'>,
  state: ScopeState,
): readonly ScopeReadout[] {
  return (view.readouts ?? []).map((id) => ({
    id,
    label: SCOPE_METRIC_LABELS[id],
    value: formatScopeMetric(id, state),
  }))
}
