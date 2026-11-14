import type { AlarmPriority, ContextStripItem } from '@/features/learning-module/stage/ContextStrip'

import { MCS_AF_TRIGGER_CONTAINMENT, mcsAfTriggerLimitApplies } from '../../content/afTriggerLimit'
import { mcsDeviceStatusLabel } from '../../content/deviceNaming'
import type { McsSimulationState } from '../../engine/types'

/**
 * What the one clock (`McsClockBar`) says about the console now: the device and its mechanism, the
 * setting, the flow it reports, the mean pressure, and the alarm. One derivation for the section's
 * patient and for the case that is a section's last task, which runs its own clock in the same bar.
 */
export function mcsClockContext(state: McsSimulationState): {
  readonly items: readonly ContextStripItem[]
  readonly alarm: { readonly priority: AlarmPriority; readonly text: string }
} {
  const activeAlarm =
    state.alarms.find((alarm) => alarm.active && alarm.priority === 'critical') ??
    state.alarms.find((alarm) => alarm.active)
  const items: ContextStripItem[] = [
    { label: 'Device · mechanism', value: mcsDeviceStatusLabel(state) },
    { label: 'Setting', value: settingLabel(state) },
    { label: 'Displayed flow', value: displayedFlowLabel(state) },
    { label: 'Mean pressure', value: `${state.metrics.mapMmHg} mm Hg` },
  ]
  /*
   * The clock bar may not say "No active alarm" on its own while the trigger rating is held.
   *
   * In atrial fibrillation the engine's trigger alarm is quiet on arterial pressure and on nothing
   * else, so the bar answered a switch to the warned-against source with an all-clear (F19). The
   * bar still reports every alarm the model raises; it just cannot report silence as the whole
   * story here.
   */
  const alarm = activeAlarm
    ? { priority: alarmPriority(activeAlarm.priority), text: activeAlarm.label }
    : mcsAfTriggerLimitApplies(state)
      ? { priority: 'medium' as const, text: MCS_AF_TRIGGER_CONTAINMENT.notAnAllClear }
      : { priority: 'none' as const, text: 'No active alarm' }
  return { items, alarm }
}

function settingLabel(state: McsSimulationState): string {
  if (state.device.kind === 'iabp') {
    return `1:${state.device.assistRatio} · ${state.device.triggerSource.toUpperCase()} trigger`
  }
  if (state.device.kind === 'lvad') return `${state.device.speedRpm} rpm`
  const { left, right } = state.device
  const parts: string[] = []
  if (left.enabled) parts.push(`${left.variant === '55' ? '5.5' : 'CP'} P${left.performanceLevel}`)
  if (right.enabled) parts.push(`RP P${right.performanceLevel}`)
  return parts.join(' · ') || 'no pump in place'
}

function displayedFlowLabel(state: McsSimulationState): string {
  if (state.device.kind === 'iabp') return 'none reported'
  if (state.device.kind === 'lvad')
    return `${(state.metrics.estimatedPumpFlowLMin ?? state.metrics.deviceFlowLMin).toFixed(1)} L/min`
  const { left, right } = state.device
  const parts: string[] = []
  if (left.enabled) parts.push(`left ${state.metrics.leftDeviceFlowLMin.toFixed(1)} L/min`)
  if (right.enabled) parts.push(`right ${state.metrics.rightDeviceFlowLMin.toFixed(1)} L/min`)
  return parts.join(' · ') || 'none reported'
}

function alarmPriority(priority: 'advisory' | 'warning' | 'critical'): 'low' | 'medium' | 'high' {
  return priority === 'critical' ? 'high' : priority === 'warning' ? 'medium' : 'low'
}
