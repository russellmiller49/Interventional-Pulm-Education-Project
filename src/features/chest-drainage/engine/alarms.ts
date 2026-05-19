import type { SimulationState } from './types'
import { isSuctionIndicatorPresent } from './pleuralPhysics'

export type DrainAlarmSeverity = 'info' | 'caution' | 'danger'

export interface DrainAlarm {
  id: string
  severity: DrainAlarmSeverity
  title: string
  message: string
}

export function getDrainageAlarms(state: SimulationState): DrainAlarm[] {
  const alarms: DrainAlarm[] = []

  if (state.tube.clamped && state.patient.airLeakSeverity > 0.2) {
    alarms.push({
      id: 'clamped-active-leak',
      severity: 'danger',
      title: 'Active leak with tube clamped',
      message:
        'The modeled leak cannot evacuate through the tube. In real care, clamping requires protocol, indication, and close supervision.',
    })
  }

  if (state.tube.kinked || state.tube.patency < 0.25) {
    alarms.push({
      id: 'blocked-tube',
      severity: 'caution',
      title: 'Possible tube obstruction',
      message:
        'Inspect patient tubing, dependent loops, kinks, side-hole position, canister connections, and the patient before resetting alarms.',
    })
  }

  if (state.device.canisterFull || state.device.collectionVolumeMl >= 2000) {
    alarms.push({
      id: 'canister-full',
      severity: 'caution',
      title: 'Collection chamber near full',
      message:
        'Output scale is approaching capacity in this model. Device-specific canister exchange follows the current IFU and local policy.',
    })
  }

  if (!state.device.upright) {
    alarms.push({
      id: 'unit-not-upright',
      severity: 'danger',
      title: 'Drainage unit not upright',
      message:
        'A tipped unit can compromise readings and seal function. Re-establish a closed, upright system and assess the patient.',
    })
  }

  if (!isSuctionIndicatorPresent(state)) {
    alarms.push({
      id: 'dry-suction-not-confirmed',
      severity: 'caution',
      title: 'Dry suction indicator absent',
      message:
        'The dry suction dial is set, but source flow is not enough for the modeled target. Check wall suction, tubing, and regulator setup.',
    })
  }

  if ((state.device.batteryPct ?? 100) < 20) {
    alarms.push({
      id: 'battery-low',
      severity: 'caution',
      title: 'Battery low',
      message:
        'Digital or powered drainage systems need battery and power-source checks. This analog dry-seal model keeps the warning for comparison.',
    })
  }

  return alarms
}
