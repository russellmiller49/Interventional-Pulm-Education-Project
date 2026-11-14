import type { McsDerivedMetrics } from '../engine/types'
import type { McsObservedSignal } from './sectionLearningContracts'

/**
 * The readings each section's Observe instruction names, in the order it names them.
 *
 * Walked on screen in November 2026, an Observe task named two or three readings in its
 * instruction ("Watch mean pressure and effective systemic delivery separate … while timing
 * synchrony does not move at all") and then listed six in the table in another order, with the
 * named ones below the fold and nothing marked beside the picture. The task now lists the named
 * readings first, marks them, and marks the same readings among the live values in the simulator
 * pane, each with where it stood before the change.
 *
 * This is a reading of the instruction that already exists (`observationFocus` in the section's
 * learning contract), not new teaching: every key is one of that section's observed signals, and a
 * reading the instruction names because it does not move ("timing synchrony does not move at all")
 * is named here too. Presentation only: no value, threshold or answer lives in this file.
 */
export const MCS_OBSERVE_FOCUS: Readonly<Record<string, readonly (keyof McsDerivedMetrics)[]>> = {
  // "Hold the mean pressure beside the effective systemic delivery and the mixed venous saturation"
  'mcs-foundations-signals': ['mapMmHg', 'effectiveSystemicFlowLMin', 'svo2Percent'],
  // "Compare the device line and the pulse pressure … effective systemic delivery rises by less
  // than the pump number, because native flow falls"
  'mcs-foundations-mechanisms': [
    'deviceFlowLMin',
    'pulsePressureMmHg',
    'effectiveSystemicFlowLMin',
    'nativeFlowLMin',
  ],
  // "timing synchrony recover, then read how much effective systemic delivery actually moved"
  'iabp-timing-triggering': ['timingQualityPercent', 'effectiveSystemicFlowLMin'],
  // "mean pressure and effective systemic delivery separate … while timing synchrony does not move"
  'iabp-efficacy-limits': ['mapMmHg', 'effectiveSystemicFlowLMin', 'timingQualityPercent'],
  // "displayed pump flow with effective systemic delivery, and … ventricular volume and wedge"
  'impella-unloading-placement': [
    'leftDeviceFlowLMin',
    'effectiveSystemicFlowLMin',
    'lvedvMl',
    'pcwpMmHg',
  ],
  // "Add the two displayed pump flows together …, then compare that sum with the effective
  // systemic delivery"
  'impella-suction-purge-rv': [
    'rightDeviceFlowLMin',
    'leftDeviceFlowLMin',
    'effectiveSystemicFlowLMin',
  ],
  // "the mean pressure and the effective systemic delivery …, then check what cardiac power did"
  'lvad-parameters-assessment': ['mapMmHg', 'effectiveSystemicFlowLMin', 'cardiacPowerOutputW'],
  // "power and displayed flow with the pulsatility index, mean pressure and effective delivery"
  'lvad-alarms-emergencies': [
    'pumpPowerW',
    'estimatedPumpFlowLMin',
    'pulsatilityIndex',
    'mapMmHg',
    'effectiveSystemicFlowLMin',
  ],
  // "the displayed pump flow …, the effective systemic delivery …, and whether the right atrial
  // pressure moved at all"
  'mcs-device-selection-integration': [
    'leftDeviceFlowLMin',
    'effectiveSystemicFlowLMin',
    'rapMmHg',
  ],
}

export function mcsObserveFocus(sectionId: string): readonly (keyof McsDerivedMetrics)[] {
  return MCS_OBSERVE_FOCUS[sectionId] ?? []
}

/** The section's observed signals, the named ones first in the order the instruction names them. */
export function mcsOrderObservedSignals(
  signals: readonly McsObservedSignal[],
  focus: readonly (keyof McsDerivedMetrics)[],
): { readonly named: readonly McsObservedSignal[]; readonly others: readonly McsObservedSignal[] } {
  const named = focus.flatMap((key) => signals.find((signal) => signal.key === key) ?? [])
  return { named, others: signals.filter((signal) => !focus.includes(signal.key)) }
}
