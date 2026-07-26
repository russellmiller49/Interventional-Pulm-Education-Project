import type {
  VentilationSimulationState,
  VentilatorControlKey,
  VentilatorDisplayProfile,
  VentilatorMonitorField,
  VentilatorMonitorMetric,
} from '../engine/types'

/**
 * Resolution of the vendor-neutral monitor metrics onto simulator state. Each device profile picks
 * which of these it shows, in what order, and under which abbreviation; only the arithmetic lives
 * here so every console layout reports the same number.
 */

export type BreathPhaseCode = 'C' | 'A' | 'S'

export interface BreathPhaseIndicator {
  code: BreathPhaseCode
  label: string
}

/** Expiratory limb of the I:E ratio, expressed as 1:x. */
export function expiratoryRatio(state: VentilationSimulationState): number {
  const inspiratory = Math.max(0.1, state.measurements.mechanicalInspiratoryTimeSeconds)
  const cycle = 60 / Math.max(1, state.measurements.totalRatePerMin)
  return Math.max(0.3, (cycle - inspiratory) / inspiratory)
}

export function resolveMonitorMetric(
  state: VentilationSimulationState,
  metric: VentilatorMonitorMetric,
): number {
  const measurements = state.measurements
  switch (metric) {
    case 'peakPressure':
      return measurements.peakPressureCmH2O
    case 'plateauPressure':
      return measurements.plateauPressureCmH2O
    case 'meanAirwayPressure':
      return measurements.meanAirwayPressureCmH2O
    case 'peep':
      return state.ventilator.settings.peepCmH2O
    case 'intrinsicPeep':
      return measurements.intrinsicPeepCmH2O
    case 'exhaledTidalVolume':
      return measurements.exhaledVtMl
    case 'minuteVolume':
      return measurements.minuteVentilationLMin
    case 'totalRate':
      return measurements.totalRatePerMin
    case 'spontaneousRate':
      return measurements.observedPatientRatePerMin
    case 'ieRatio':
      return expiratoryRatio(state)
    case 'oxygenPercent':
      return state.ventilator.settings.oxygenPercent
    case 'staticCompliance':
      return measurements.staticComplianceMlCmH2O
    case 'spo2':
      return state.patient.gasExchange.spo2Percent
  }
}

export function formatMonitorField(
  state: VentilationSimulationState,
  field: VentilatorMonitorField,
): string {
  const value = resolveMonitorMetric(state, field.metric)
  if (field.metric === 'ieRatio') return `1:${value.toFixed(field.precision ?? 1)}`
  return value.toFixed(field.precision ?? 0)
}

/** The flat precedence list for a device, whether it groups its controls or prints one bar. */
export function resolveControlOrder(
  display: VentilatorDisplayProfile,
): readonly VentilatorControlKey[] {
  if (display.controlGroups?.length) {
    return display.controlGroups.flatMap((group) => [...group.keys])
  }
  return display.controlOrder
}

/**
 * Reorder a mode's controls into the order the device presents them. Keys the vendor does not
 * list keep their engine order, after everything that is listed — so an unmapped control is
 * displaced rather than dropped.
 */
export function orderControlsForDevice<T extends { key: VentilatorControlKey }>(
  display: VentilatorDisplayProfile,
  controls: readonly T[],
): T[] {
  const order = resolveControlOrder(display)
  if (order.length === 0) return [...controls]
  const rank = new Map(order.map((key, index) => [key, index]))
  return controls
    .map((control, index) => ({ control, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.control.key) ?? Number.MAX_SAFE_INTEGER
      const rightRank = rank.get(right.control.key) ?? Number.MAX_SAFE_INTEGER
      return leftRank === rightRank ? left.index - right.index : leftRank - rightRank
    })
    .map((entry) => entry.control)
}

/** Split ordered controls into the vendor's on-screen groups, dropping groups with no members. */
export function groupControlsForDevice<T extends { key: VentilatorControlKey }>(
  display: VentilatorDisplayProfile,
  controls: readonly T[],
): { label: string; controls: T[] }[] {
  if (!display.controlGroups?.length) return [{ label: '', controls: [...controls] }]
  const assigned = new Set<VentilatorControlKey>()
  const groups = display.controlGroups.map((group) => {
    const members = controls.filter((control) => group.keys.includes(control.key))
    members.forEach((member) => assigned.add(member.key))
    return { label: group.label, controls: members }
  })
  const remaining = controls.filter((control) => !assigned.has(control.key))
  if (remaining.length) groups.push({ label: 'Other settings', controls: remaining })
  return groups.filter((group) => group.controls.length > 0)
}

/**
 * The PB980's breath-phase indicator: Control, Assist, or Spontaneous (service manual Table 2-10).
 * A spontaneous breath is flagged on the waveform sample; a mandatory breath is an assist whenever
 * the patient is carrying the rate above the set mandatory rate.
 */
export function resolveBreathPhase(state: VentilationSimulationState): BreathPhaseIndicator {
  const settings = state.ventilator.settings
  if (settings.mode === 'pressure-support' || state.waveforms.at(-1)?.spontaneous) {
    return { code: 'S', label: 'Spontaneous' }
  }
  return state.measurements.totalRatePerMin > settings.ratePerMin + 0.5
    ? { code: 'A', label: 'Assist' }
    : { code: 'C', label: 'Control' }
}
