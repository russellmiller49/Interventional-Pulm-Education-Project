import type { C6Mode, C6VentilatorSettings } from '../engine/types'

export type HamiltonC6PublicationStatus = 'draft' | 'published'

export const hamiltonC6PublicationStatus: HamiltonC6PublicationStatus = 'draft'

export const hamiltonC6DeviceProfile = Object.freeze({
  id: 'hamilton-c6-en-1.2.x-10197564-00',
  displayName: 'HAMILTON-C6',
  manufacturer: 'Hamilton Medical',
  softwareVersion: '1.2.x',
  manualNumber: '10197564/00',
  manualDate: '2022-03-31',
  patientGroup: 'Adult/Ped',
  volumeTimingConfiguration: 'Peak flow + Tip',
  spontTiMaxEnabled: true,
  supportedModes: ['scmv', 'pcv-plus', 'spont'] as const,
  optionalFeaturesExcluded: ['ASV', 'INTELLiVENT-ASV', 'IntelliSync+'] as const,
  educationalUseOnly: true,
})

const commonSettings = {
  oxygenPercent: 40,
  peepCmH2O: 5,
  trigger: { type: 'flow', thresholdLMin: 2 } as const,
  highPressureLimitCmH2O: 40,
  trcEnabled: false,
  trcPercent: 100,
  tubeInnerDiameterMm: 7.5,
}

export function createDefaultC6Settings(mode: C6Mode): C6VentilatorSettings {
  if (mode === 'pcv-plus') {
    return {
      mode,
      ...commonSettings,
      deltaPControlCmH2O: 15,
      ratePerMin: 16,
      inspiratoryTimeSeconds: 0.9,
      pRampMs: 70,
    }
  }
  if (mode === 'spont') {
    return {
      mode,
      ...commonSettings,
      pressureSupportCmH2O: 10,
      pRampMs: 100,
      etsPercent: 25,
      tiMaxSeconds: 1.5,
      apneaBackupEnabled: true,
      apneaRatePerMin: 12,
    }
  }
  return {
    mode,
    ...commonSettings,
    vtMl: 420,
    ratePerMin: 18,
    peakFlowLMin: 60,
    flowPattern: 'square',
    pausePercent: 0,
  }
}

export const c6ControlRanges = Object.freeze({
  oxygenPercent: [21, 100],
  peepCmH2O: [0, 50],
  vtMl: [20, 2000],
  mandatoryRatePerMin: [4, 80],
  peakFlowLMin: [1, 195],
  pRampSpontMs: [0, 200],
  pRampControlledMs: [0, 2000],
  etsPercent: [5, 80],
  tiMaxSeconds: [0.5, 3],
  flowTriggerLMin: [0.5, 20],
  pressureTriggerCmH2O: [-15, -0.1],
} as const)
