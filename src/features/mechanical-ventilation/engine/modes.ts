import type {
  AdvancedVentilationSettings,
  CanonicalVentilationMode,
  MechanicalVentilationSettings,
  VentilatorModeId,
} from './types'

export const ventilatorModeIds: readonly VentilatorModeId[] = [
  'volume-ac',
  'pressure-ac',
  'pressure-support',
  'volume-simv',
  'pressure-simv',
  'adaptive-pressure-ac',
  'adaptive-pressure-simv',
  'aprv',
  'bilevel',
  'proportional-assist',
  'volume-support',
  'asv',
  'intellivent-asv',
  'tcpl-ac',
  'tcpl-simv',
]

export function createDefaultAdvancedVentilationSettings(): AdvancedVentilationSettings {
  return {
    targetVtMl: 420,
    spontaneousPressureSupportCmH2O: 10,
    spontaneousRampMs: 100,
    spontaneousCyclePercent: 25,
    pHighCmH2O: 24,
    pLowCmH2O: 5,
    tHighSeconds: 4,
    tLowSeconds: 0.6,
    proportionalSupportPercent: 60,
    minuteVolumePercent: 100,
    targetSpO2LowPercent: 92,
    targetPetCO2MmHg: 40,
    automaticVentilationController: true,
    automaticOxygenationController: true,
    autoFlowEnabled: false,
    intelliSyncEnabled: false,
  }
}

export function canonicalModeForVentilatorMode(mode: VentilatorModeId): CanonicalVentilationMode {
  if (mode === 'volume-ac' || mode === 'volume-simv') return 'volume-ac'
  if (mode === 'pressure-support' || mode === 'proportional-assist' || mode === 'volume-support') {
    return 'pressure-support'
  }
  return 'pressure-ac'
}

export function isSimvMode(mode: VentilatorModeId): boolean {
  return (
    mode === 'volume-simv' ||
    mode === 'pressure-simv' ||
    mode === 'adaptive-pressure-simv' ||
    mode === 'tcpl-simv'
  )
}

export function isAdaptivePressureMode(mode: VentilatorModeId): boolean {
  return mode === 'adaptive-pressure-ac' || mode === 'adaptive-pressure-simv'
}

export function isTwoLevelMode(mode: VentilatorModeId): boolean {
  return mode === 'aprv' || mode === 'bilevel'
}

export function isAdaptiveSupportMode(mode: VentilatorModeId): boolean {
  return mode === 'asv' || mode === 'intellivent-asv'
}

export function isSpontaneousAdaptiveMode(mode: VentilatorModeId): boolean {
  return mode === 'proportional-assist' || mode === 'volume-support'
}

export function cloneMechanicalVentilationSettings(
  settings: MechanicalVentilationSettings,
): MechanicalVentilationSettings {
  return {
    ...settings,
    trigger: { ...settings.trigger },
    advanced: { ...settings.advanced },
  } as MechanicalVentilationSettings
}
