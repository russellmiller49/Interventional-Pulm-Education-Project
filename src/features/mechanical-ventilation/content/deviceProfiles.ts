import type {
  CanonicalVentilationMode,
  MechanicalVentilationSettings,
  VentilatorControlDescriptor,
  VentilatorControlKey,
  VentilatorDeviceId,
  VentilatorDeviceProfile,
  VentilatorModeAvailability,
  VentilatorModeDescriptor,
  VentilatorModeId,
} from '../engine/types'
import { ventilatorDeviceIds } from '../engine/types'
import {
  canonicalModeForVentilatorMode,
  cloneMechanicalVentilationSettings,
  createDefaultAdvancedVentilationSettings,
} from '../engine/modes'

export type MechanicalVentilationPublicationStatus = 'draft' | 'tester-preview' | 'published'

export const mechanicalVentilationPublicationStatus: MechanicalVentilationPublicationStatus =
  'tester-preview'

export interface VentilatorDeviceSource {
  id: string
  deviceId: VentilatorDeviceId
  title: string
  citation: string
  revision: string
  date: string
  pages: string
  sourceFilename: string
  sourceSha256: string
  intendedUse: string
  limitations: string
}

export const ventilatorDeviceSources: readonly VentilatorDeviceSource[] = [
  {
    id: 'hamilton-c6-manual-1.2.x',
    deviceId: 'hamilton-c6',
    title: 'HAMILTON-C6 Operator’s Manual',
    citation:
      'Hamilton Medical. HAMILTON-C6 Operator’s Manual. Software version 1.2.x; document 10197564/00.',
    revision: '10197564/00 · software 1.2.x',
    date: '2022-03-31',
    pages: '44, 91-112, 123-183, 195-225, 229-235, 311-317',
    sourceFilename: 'HAMILTON-C6_ops-manual_v1.2.x_en_10197564.00.pdf',
    sourceSha256: '5de5eeffee986633ffeaf40fc80dd63fd975b23ad1645ea3b975273f3d511f78',
    intendedUse:
      'Mode vocabulary, control ranges, navigation, graphics, alarms, maneuvers, and physical-control workflow.',
    limitations:
      'Optional features and market-specific configurations are excluded unless explicitly listed.',
  },
  {
    id: 'hamilton-c6-intellivent-asv-1.2.x',
    deviceId: 'hamilton-c6',
    title: 'HAMILTON-C6 INTELLiVENT-ASV Operator’s Manual',
    citation:
      'Hamilton Medical. HAMILTON-C6 INTELLiVENT-ASV Operator’s Manual. Software version 1.2.x; document 624954/05.',
    revision: '624954/05 · software 1.2.x',
    date: '2025-05-12',
    pages: '13-25, 63-80, 113-118',
    sourceFilename: 'HAMILTON-C6_Intellivent-ASV_ops-manual_v1.2.x_en_624954.05.pdf',
    sourceSha256: 'd2690200f69d7298542714d2663515ad575a5d014d4a46fadc1d95e45bdc3927',
    intendedUse:
      'INTELLiVENT-ASV setup, controller state, target ranges, %MinVol, PEEP/Oxygen automation, and safety-boundary workflow.',
    limitations:
      'The simulator implements a bounded educational controller, not the proprietary device algorithm or a validated closed-loop controller.',
  },
  {
    id: 'evita-v800-v600-ifu-3.1n',
    deviceId: 'drager-evita-v800-v600',
    title: 'Evita V800 / V600 Instructions for Use',
    citation:
      'Dräger. Evita V800 / V600 Intensive Care Ventilator Instructions for Use. Software 3.1n; document 9513888; Edition 1.',
    revision: '9513888 · Edition 1 · software 3.1n',
    date: '2026-03',
    pages: '23-35, 56-68, 121-170, 181-191, 315-350',
    sourceFilename: '9513888_1_enUS.pdf',
    sourceSha256: '8c4c65aadd7267d181c694947b9602278f511746af25001ceb220f3be09e8151',
    intendedUse:
      'Current mode names, therapy controls, setting behavior, alarm workflow, ventilation principles, and ranges.',
    limitations:
      'Availability depends on patient category, configuration, country, and licensed options.',
  },
  {
    id: 'evita-v800-v600-pocket-guide-1n',
    deviceId: 'drager-evita-v800-v600',
    title: 'Evita V800 / V600 Pocket Guide',
    citation: 'Dräger. Evita V800 / V600 Pocket Guide. Software version 1.n; document 91 09 438.',
    revision: '91 09 438 · 20.06-1 · software 1.n',
    date: '2020-06',
    pages: '5, 8-11, 16-17, 20-21',
    sourceFilename: 'Quick-Guide-Evita-V800-V600-br-9109438-en-master-V3.pdf',
    sourceSha256: 'a4672679eb64df7bde1df7441fc93407fe0d087f28dcece799c38376aa465293',
    intendedUse: 'Visual operating concept and touch-turn-confirm interaction reference only.',
    limitations:
      'Older software reference; feature and range claims come from the software 3.1n instructions for use.',
  },
  {
    id: 'evita-v800-product-information-2023',
    deviceId: 'drager-evita-v800-v600',
    title: 'Dräger Evita V800 Product Information',
    citation: 'Dräger. Evita V800 ICU Ventilation and Respiratory Monitoring. DMC-106133.',
    revision: 'DMC-106133 · 23.03-1',
    date: '2023-03',
    pages: '1-3, 12',
    sourceFilename: 'evita-v800-sw2n-pi-dmc-106133-en-master.pdf',
    sourceSha256: '4b443cfb100926ab67ebf4d80fc052e5262c5c418a2237080def29cab569eb2a',
    intendedUse: 'High-level physical display and monitoring-layout reference.',
    limitations:
      'Product information is not an operator manual and is not used for clinical claims.',
  },
  {
    id: 'pb980-service-manual-rev-c',
    deviceId: 'puritan-bennett-980',
    title: 'Puritan Bennett 980 Series Ventilator Service Manual',
    citation:
      'Covidien. Puritan Bennett 980 Series Ventilator Service Manual. Part 10078090 Rev C.',
    revision: '10078090 Rev C',
    date: '2014-02',
    pages: '1-5, 1-12 to 1-15, 2-7 to 2-15',
    sourceFilename: '662436517-PB980-Service-Manual.pdf',
    sourceSha256: '7fdf53d323d0f80acc42efde0428db4fc010a86dbe6bce97e1ac2274a88c94d6',
    intendedUse:
      'Physical GUI controls, alarm indicators, supported breath types, control names, and documented ranges.',
    limitations:
      'A service manual, not the operator manual; this profile does not claim exhaustive operator-workflow fidelity.',
  },
  {
    id: 'pb980-icu-brochure-2023',
    deviceId: 'puritan-bennett-980',
    title: 'Puritan Bennett 980 Ventilator in the ICU Brochure',
    citation: 'Medtronic. Puritan Bennett 980 Ventilator in the ICU. 04/2023-US-RE-2300017.',
    revision: '04/2023-US-RE-2300017',
    date: '2023-04',
    pages: '1, 4-7, 12',
    sourceFilename: 'puritan-bennett-980-ventilator-intensive-care-unit-interactive-brochure.pdf',
    sourceSha256: 'dd61c1bedeeb07ae17f387ee0e209aaaae5317d346ecd0fc3c1f7f6e5ba19258',
    intendedUse: 'High-level display configuration and product-generation context.',
    limitations:
      'Marketing brochure; not used for ranges, treatment claims, or procedural instructions.',
  },
  {
    id: 'avea-modes-guide-2014',
    deviceId: 'carefusion-avea',
    title: 'AVEA Ventilator Ventilation Modes User Guide',
    citation: 'CareFusion. AVEA Ventilator Ventilation Modes User Guide. RC3859.',
    revision: 'RC3859 · 0814/2000',
    date: '2014-08',
    pages: '1-6, 10-16, 27-29, 33-46',
    sourceFilename: 'RC_AVEA-Modes-Guide_UG_EN.pdf',
    sourceSha256: '607c34e1dfbbb756375fdfb0668d284248ebed71c84156f24559b7661ac62a96',
    intendedUse:
      'UIM navigation, Touch-Turn-Touch/Accept workflow, mode vocabulary, primary controls, and advanced-setting names.',
    limitations:
      'The guide explicitly does not replace the operator manual and does not publish every primary-control range.',
  },
] as const

const modeDescriptions: Record<VentilatorModeId, string> = {
  'volume-ac': 'Volume-targeted assist/control ventilation',
  'pressure-ac': 'Pressure-targeted assist/control ventilation',
  'pressure-support': 'Spontaneous breathing with CPAP and pressure support',
  'volume-simv':
    'Volume-targeted synchronized mandatory breaths with supported spontaneous breaths',
  'pressure-simv':
    'Pressure-targeted synchronized mandatory breaths with supported spontaneous breaths',
  'adaptive-pressure-ac':
    'Adaptive pressure-targeted mandatory breaths adjusted toward a tidal-volume target',
  'adaptive-pressure-simv':
    'Adaptive volume-targeted mandatory breaths alternating with supported spontaneous breaths',
  aprv: 'Two pressure levels with a brief pressure release and unrestricted spontaneous breathing',
  bilevel: 'Two time-cycled pressure levels with spontaneous breathing available at either level',
  'proportional-assist': 'Patient-triggered proportional unloading based on measured mechanics',
  'volume-support': 'Patient-triggered pressure support adjusted toward a target tidal volume',
  asv: 'Adaptive support targeting a clinician-set percentage of predicted minute ventilation',
  'intellivent-asv':
    'ASV-based ventilation with bounded educational ventilation and oxygenation controllers',
  'tcpl-ac': 'Neonatal time-cycled, pressure-limited assist/control ventilation',
  'tcpl-simv': 'Neonatal time-cycled, pressure-limited synchronized mandatory ventilation',
}

function mode(
  id: VentilatorModeId,
  label: string,
  availability: VentilatorModeAvailability = 'simulated',
  availabilityNote?: string,
): VentilatorModeDescriptor {
  return {
    id,
    canonicalMode: canonicalModeForVentilatorMode(id),
    label,
    description: modeDescriptions[id],
    availability,
    availabilityNote,
  }
}

const profiles: readonly VentilatorDeviceProfile[] = [
  {
    id: 'hamilton-c6',
    displayName: 'HAMILTON-C6',
    shortName: 'C6',
    manufacturer: 'Hamilton Medical',
    softwareVersion: '1.2.x',
    manualProfile: '10197564/00',
    patientGroup: 'Adult/Ped',
    commitBehavior: 'immediate',
    modes: [
      mode('volume-ac', '(S)CMV'),
      mode('pressure-ac', 'PCV+'),
      mode('pressure-support', 'SPONT'),
      mode('volume-simv', 'SIMV'),
      mode('pressure-simv', 'PSIMV+'),
      mode('adaptive-pressure-ac', 'APVcmv'),
      mode('adaptive-pressure-simv', 'APVsimv / SIMV+'),
      mode('bilevel', 'DuoPAP'),
      mode('aprv', 'APRV'),
      mode('asv', 'ASV'),
      mode('intellivent-asv', 'INTELLiVENT-ASV'),
    ],
    features: [
      {
        id: 'intellisync-plus',
        label: 'IntelliSync+',
        description: 'Automated inspiratory and expiratory trigger synchronization.',
        compatibleModes: [
          'volume-simv',
          'pressure-simv',
          'adaptive-pressure-simv',
          'bilevel',
          'pressure-support',
          'asv',
          'intellivent-asv',
        ],
        availability: 'simulated',
      },
    ],
    navigationLabels: {
      main: 'Monitoring',
      modes: 'Modes',
      controls: 'Controls',
      alarms: 'Alarms',
      graphics: 'Graphics',
      tools: 'Tools',
    },
    orientationSteps: [
      'Navigate mode, control, alarm, graphics, and tools screens.',
      'Select a setting, then use the press-and-turn training control.',
      'Separate trigger, target or flow, cycle, and expiration on all three waveforms.',
      'Use bedside data to decide whether the ventilator is the cause, the response, or neither.',
    ],
    deferredModes: ['NIV', 'NIV-ST', 'nCPAP-PS'],
    sourceIds: ['hamilton-c6-manual-1.2.x', 'hamilton-c6-intellivent-asv-1.2.x'],
    controlLabels: {
      oxygenPercent: 'Oxygen',
      peepCmH2O: 'PEEP/CPAP',
      deltaPControlCmH2O: 'Pcontrol',
      pressureSupportCmH2O: 'Psupport',
      pRampMs: 'P-ramp',
      etsPercent: 'ETS',
      tiMaxSeconds: 'TI max',
      peakFlowLMin: 'Peak flow',
      highPressureLimitCmH2O: 'High pressure',
      triggerThreshold: 'Flow trigger',
      trcEnabled: 'TRC compensation',
      targetVtMl: 'Target Vt',
      spontaneousPressureSupportCmH2O: 'Psupport',
      spontaneousRampMs: 'P-ramp',
      spontaneousCyclePercent: 'ETS',
      pHighCmH2O: 'P high',
      pLowCmH2O: 'P low',
      tHighSeconds: 'T high',
      tLowSeconds: 'T low',
      minuteVolumePercent: '%MinVol',
      targetSpO2LowPercent: 'Target SpO₂ low',
      targetPetCO2MmHg: 'Target PetCO₂',
      intelliSyncEnabled: 'IntelliSync+',
    },
    educationalUseOnly: true,
  },
  {
    id: 'drager-evita-v800-v600',
    displayName: 'Dräger Evita V800 / V600',
    shortName: 'Evita',
    manufacturer: 'Dräger',
    softwareVersion: '3.1n',
    manualProfile: '9513888 · Edition 1',
    patientGroup: 'Adult/Pediatric',
    commitBehavior: 'rotary-confirm',
    modes: [
      mode('volume-ac', 'VC-AC'),
      mode('pressure-ac', 'PC-AC'),
      mode('pressure-support', 'SPN-CPAP/PS'),
      mode('volume-simv', 'VC-SIMV'),
      mode('pressure-simv', 'PC-SIMV'),
      mode('aprv', 'PC-APRV'),
      mode('volume-support', 'SPN-CPAP/VS'),
    ],
    features: [
      {
        id: 'autoflow',
        label: 'AutoFlow',
        description:
          'Adapts inspiratory pressure and decelerating flow toward the set tidal volume.',
        compatibleModes: ['volume-ac', 'volume-simv'],
        availability: 'simulated',
      },
      {
        id: 'volume-guarantee',
        label: 'Volume Guarantee',
        description: 'Neonatal adaptive pressure delivery toward a target tidal volume.',
        compatibleModes: ['volume-ac', 'volume-simv'],
        availability: 'requires-neonatal',
        availabilityNote:
          'Source-listed only: the current casebook is adult-only. A neonatal test-lung pathway is required before activation.',
      },
    ],
    navigationLabels: {
      main: 'Main screen',
      modes: 'Other modes',
      controls: 'Therapy bar',
      alarms: 'Alarms',
      graphics: 'Views',
      tools: 'Procedures',
    },
    orientationSteps: [
      'Read the header, monitoring area, right main-menu bar, and lower therapy bar.',
      'Touch a mode tab or therapy control; the pending control turns orange.',
      'Turn the rotary knob, then press it to confirm before the patient model changes.',
      'Use Alarms, Views, Trends/data, and Procedures without losing the live monitoring view.',
    ],
    deferredModes: ['VC-MMV', 'PC-BIPAP / SIMV+', 'SPN-PPS', 'SmartCare/PS'],
    sourceIds: [
      'evita-v800-v600-ifu-3.1n',
      'evita-v800-v600-pocket-guide-1n',
      'evita-v800-product-information-2023',
    ],
    controlLabels: {
      oxygenPercent: 'FiO₂',
      peepCmH2O: 'PEEP',
      deltaPControlCmH2O: 'Pinsp',
      pressureSupportCmH2O: 'ΔPsupp',
      pRampMs: 'Slope',
      etsPercent: 'Insp term',
      tiMaxSeconds: 'Timax',
      ratePerMin: 'RR',
      peakFlowLMin: 'Flow',
      highPressureLimitCmH2O: 'Paw high',
      triggerThreshold: 'Trigger',
      trcEnabled: 'ATC',
      targetVtMl: 'VT',
      spontaneousPressureSupportCmH2O: 'ΔPsupp',
      spontaneousRampMs: 'Slope',
      spontaneousCyclePercent: 'Insp term',
      pHighCmH2O: 'Phigh',
      pLowCmH2O: 'Plow',
      tHighSeconds: 'Thigh',
      tLowSeconds: 'Tlow',
      autoFlowEnabled: 'AutoFlow',
    },
    educationalUseOnly: true,
  },
  {
    id: 'puritan-bennett-980',
    displayName: 'Puritan Bennett 980',
    shortName: 'PB980',
    manufacturer: 'Medtronic / Covidien',
    softwareVersion: 'Rev C source profile',
    manualProfile: '10078090 Rev C',
    patientGroup: 'Adult/Pediatric',
    commitBehavior: 'rotary-confirm',
    modes: [
      mode('volume-ac', 'A/C + VC'),
      mode('pressure-ac', 'A/C + PC'),
      mode('pressure-support', 'SPONT + PS'),
      mode('volume-simv', 'SIMV + VC'),
      mode('pressure-simv', 'SIMV + PC'),
      mode('adaptive-pressure-ac', 'A/C + VC+'),
      mode('adaptive-pressure-simv', 'SIMV + VC+'),
      mode('bilevel', 'BiLevel'),
      mode('proportional-assist', 'SPONT + PAV+'),
      mode('volume-support', 'SPONT + VS'),
    ],
    features: [],
    navigationLabels: {
      main: 'Home',
      modes: 'Vent Setup',
      controls: 'More settings',
      alarms: 'Alarms',
      graphics: 'Waveforms',
      tools: 'Logs / maneuvers',
    },
    orientationSteps: [
      'Use the Home, Vent Setup, Alarms, Logs, and waveform constant-access controls.',
      'Choose the mode and mandatory or spontaneous breath type as a paired setup.',
      'Touch a parameter, turn the central knob, and confirm before applying it.',
      'Use the bezel keys for manual inspiration, holds, alarm reset, silence, and screen lock.',
    ],
    deferredModes: ['NIV+', 'Leak Sync advanced setup'],
    sourceIds: ['pb980-service-manual-rev-c', 'pb980-icu-brochure-2023'],
    controlLabels: {
      oxygenPercent: 'O₂%',
      peepCmH2O: 'PEEP',
      deltaPControlCmH2O: 'PI',
      pressureSupportCmH2O: 'PSUPP',
      pRampMs: 'Rise Time',
      etsPercent: 'ESENS',
      tiMaxSeconds: '2TI SPONT',
      ratePerMin: 'f',
      peakFlowLMin: 'VMAX',
      highPressureLimitCmH2O: '2PPEAK',
      triggerThreshold: 'VSENS',
      trcEnabled: 'Tube compensation',
      targetVtMl: 'VT / VT SUPP',
      spontaneousPressureSupportCmH2O: 'PSUPP',
      spontaneousRampMs: 'Rise Time',
      spontaneousCyclePercent: 'ESENS',
      pHighCmH2O: 'PH',
      pLowCmH2O: 'PL',
      tHighSeconds: 'TH',
      tLowSeconds: 'TL',
      proportionalSupportPercent: '% Supp',
    },
    educationalUseOnly: true,
  },
  {
    id: 'carefusion-avea',
    displayName: 'CareFusion AVEA',
    shortName: 'AVEA',
    manufacturer: 'CareFusion',
    softwareVersion: '2014 modes-guide profile',
    manualProfile: 'RC3859',
    patientGroup: 'Adult/Pediatric',
    commitBehavior: 'touch-or-accept',
    modes: [
      mode('volume-ac', 'Volume A/C'),
      mode('pressure-ac', 'Pressure A/C'),
      mode('pressure-support', 'CPAP/PSV'),
      mode('volume-simv', 'Volume SIMV'),
      mode('pressure-simv', 'Pressure SIMV'),
      mode('adaptive-pressure-ac', 'PRVC A/C'),
      mode('adaptive-pressure-simv', 'PRVC SIMV'),
      mode('aprv', 'APRV/BiPhasic'),
      mode(
        'tcpl-ac',
        'TCPL A/C',
        'requires-neonatal',
        'Neonatal-only mode. The current 15-case adult pathway cannot activate it.',
      ),
      mode(
        'tcpl-simv',
        'TCPL SIMV',
        'requires-neonatal',
        'Neonatal-only mode. The current 15-case adult pathway cannot activate it.',
      ),
    ],
    features: [
      {
        id: 'volume-guarantee',
        label: 'Volume Guarantee',
        description: 'Neonatal adaptive pressure delivery toward a target tidal volume.',
        compatibleModes: ['pressure-ac', 'pressure-simv', 'tcpl-ac', 'tcpl-simv'],
        availability: 'requires-neonatal',
        availabilityNote:
          'Source-listed only: the current casebook is adult-only. A neonatal test-lung pathway is required before activation.',
      },
    ],
    navigationLabels: {
      main: 'Main',
      modes: 'Mode Select',
      controls: 'Primary controls',
      alarms: 'Alarm Limits',
      graphics: 'Waveforms',
      tools: 'Adv Settings',
    },
    orientationSteps: [
      'Use the MODE membrane key or on-screen mode indicator to open Mode Select.',
      'Touch a control, turn the data dial, then touch again or press ACCEPT.',
      'Use ADV SETTINGS for rise, cycling, waveform, bias-flow, and trigger refinements.',
      'Use ALARM LIMITS and the physical maneuver keys while retaining the active mode view.',
    ],
    deferredModes: ['nCPAP/IMV', 'Independent lung ventilation'],
    sourceIds: ['avea-modes-guide-2014'],
    controlLabels: {
      oxygenPercent: '%O₂',
      peepCmH2O: 'PEEP',
      deltaPControlCmH2O: 'Insp Pres',
      pressureSupportCmH2O: 'PSV',
      pRampMs: 'Insp / PSV Rise',
      etsPercent: 'PSV Cycle',
      tiMaxSeconds: 'PSV Tmax',
      ratePerMin: 'Rate',
      peakFlowLMin: 'Peak Flow',
      pausePercent: 'Insp Pause',
      highPressureLimitCmH2O: 'High Peak',
      triggerThreshold: 'Flow Trig',
      targetVtMl: 'Tidal Volume',
      spontaneousPressureSupportCmH2O: 'PSV',
      spontaneousRampMs: 'PSV Rise',
      spontaneousCyclePercent: 'PSV Cycle',
      pHighCmH2O: 'Pressure High',
      pLowCmH2O: 'Pressure Low',
      tHighSeconds: 'Time High',
      tLowSeconds: 'Time Low',
    },
    educationalUseOnly: true,
  },
] as const

export const ventilatorDeviceProfiles = profiles
export const ventilatorDeviceProfileById = new Map(profiles.map((profile) => [profile.id, profile]))
export const defaultVentilatorDeviceId: VentilatorDeviceId = 'hamilton-c6'

export function isVentilatorDeviceId(value: unknown): value is VentilatorDeviceId {
  return typeof value === 'string' && ventilatorDeviceIds.includes(value as VentilatorDeviceId)
}

export function getVentilatorDeviceProfile(deviceId: VentilatorDeviceId): VentilatorDeviceProfile {
  return ventilatorDeviceProfileById.get(deviceId) ?? profiles[0]
}

export function getVentilatorModeDescriptor(
  deviceId: VentilatorDeviceId,
  modeId: VentilatorModeId,
): VentilatorModeDescriptor {
  const profile = getVentilatorDeviceProfile(deviceId)
  return (
    profile.modes.find((candidate) => candidate.id === modeId) ??
    profile.modes.find((candidate) => candidate.id === canonicalModeForVentilatorMode(modeId)) ??
    profile.modes[0]
  )
}

export function getVentilatorModeLabel(
  deviceId: VentilatorDeviceId,
  modeId: VentilatorModeId,
): string {
  return getVentilatorModeDescriptor(deviceId, modeId).label
}

const commonSettings = {
  deviceMode: 'volume-ac' as const,
  advanced: createDefaultAdvancedVentilationSettings(),
  oxygenPercent: 40,
  peepCmH2O: 5,
  trigger: { type: 'flow', thresholdLMin: 2 } as const,
  highPressureLimitCmH2O: 40,
  trcEnabled: false,
  trcPercent: 100,
  tubeInnerDiameterMm: 7.5,
}

export function createDefaultMechanicalVentilationSettings(
  mode: CanonicalVentilationMode,
): MechanicalVentilationSettings {
  const modeCommon = {
    ...commonSettings,
    deviceMode: mode,
    advanced: createDefaultAdvancedVentilationSettings(),
  }
  if (mode === 'pressure-ac') {
    return {
      mode,
      ...modeCommon,
      deltaPControlCmH2O: 15,
      ratePerMin: 16,
      inspiratoryTimeSeconds: 0.9,
      pRampMs: 70,
    }
  }
  if (mode === 'pressure-support') {
    return {
      mode,
      ...modeCommon,
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
    ...modeCommon,
    vtMl: 420,
    ratePerMin: 18,
    peakFlowLMin: 60,
    flowPattern: 'square',
    pausePercent: 0,
  }
}

export function adaptInitialSettingsForDevice(
  settings: MechanicalVentilationSettings,
  deviceId: VentilatorDeviceId,
): MechanicalVentilationSettings {
  const cloned = cloneMechanicalVentilationSettings(settings)
  cloned.deviceMode = cloned.mode
  cloned.advanced.spontaneousRampMs = clamp(
    cloned.advanced.spontaneousRampMs,
    ...riseTimeBounds(deviceId, cloned, 'spontaneousRampMs'),
  )
  if (cloned.mode === 'pressure-support') {
    const [, maximum] = riseTimeBounds(deviceId, cloned)
    return {
      ...cloned,
      pRampMs: clamp(cloned.pRampMs, 0, maximum),
      tiMaxSeconds: clamp(cloned.tiMaxSeconds, 0.5, deviceId === 'hamilton-c6' ? 3 : 5),
    }
  }
  if (cloned.mode === 'pressure-ac') {
    const [, maximum] = riseTimeBounds(deviceId, cloned)
    return { ...cloned, pRampMs: clamp(cloned.pRampMs, 0, maximum) }
  }
  return cloned
}

export const simulationControlRanges = Object.freeze({
  oxygenPercent: [21, 100],
  peepCmH2O: [0, 50],
  vtMl: [20, 2000],
  mandatoryRatePerMin: [4, 80],
  apneaRatePerMin: [5, 80],
  peakFlowLMin: [1, 195],
  deltaPControlCmH2O: [5, 100],
  pressureSupportCmH2O: [0, 100],
  inspiratoryTimeSeconds: [0.1, 12],
  pausePercent: [0, 70],
  highPressureLimitCmH2O: [5, 100],
  pRampPressureSupportMs: [0, 2000],
  pRampControlledMs: [0, 2000],
  etsPercent: [5, 80],
  tiMaxSeconds: [0.5, 5],
  flowTriggerLMin: [0.5, 20],
  flowTriggerMandatoryLMin: [1, 20],
  pressureTriggerCmH2O: [-15, -0.1],
  trcPercent: [0, 100],
  adultTubeInnerDiameterMm: [3, 10],
  targetVtMl: [100, 1000],
  spontaneousPressureSupportCmH2O: [0, 30],
  spontaneousRampMs: [0, 2000],
  spontaneousCyclePercent: [5, 80],
  pHighCmH2O: [5, 50],
  pLowCmH2O: [0, 20],
  tHighSeconds: [0.2, 15],
  tLowSeconds: [0.1, 3],
  proportionalSupportPercent: [5, 95],
  minuteVolumePercent: [25, 350],
  targetSpO2LowPercent: [85, 98],
  targetPetCO2MmHg: [25, 80],
} as const)

function riseTimeMaximumMs(settings: MechanicalVentilationSettings): number {
  if (settings.mode === 'pressure-ac') {
    return Math.min(2000, Math.max(10, Math.floor((settings.inspiratoryTimeSeconds * 1000) / 3)))
  }
  return 2000
}

function riseTimeBounds(
  deviceId: VentilatorDeviceId,
  settings: MechanicalVentilationSettings,
  key: 'pRampMs' | 'spontaneousRampMs' = 'pRampMs',
): readonly [number, number] {
  const maximum = key === 'spontaneousRampMs' ? 2000 : riseTimeMaximumMs(settings)
  if (
    deviceId === 'hamilton-c6' &&
    (settings.mode === 'pressure-support' || key === 'spontaneousRampMs')
  ) {
    return [0, 200]
  }
  return [0, maximum]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function canonicalToNativeControlValue(
  deviceId: VentilatorDeviceId,
  settings: MechanicalVentilationSettings,
  key: VentilatorControlKey,
  value: number,
): number {
  if (deviceId === 'drager-evita-v800-v600' && key === 'deltaPControlCmH2O') {
    return value + settings.peepCmH2O
  }
  if (key !== 'pRampMs' && key !== 'spontaneousRampMs') return value
  const [minimum, maximum] = riseTimeBounds(deviceId, settings, key)
  const bounded = clamp(value, minimum, maximum)
  if (deviceId === 'drager-evita-v800-v600') return Number((bounded / 1000).toFixed(2))
  if (deviceId === 'puritan-bennett-980') {
    if (maximum <= minimum) return 100
    return Math.round(1 + (99 * (maximum - bounded)) / (maximum - minimum))
  }
  if (deviceId === 'carefusion-avea') {
    if (maximum <= minimum) return 1
    return Math.round(1 + (8 * (bounded - minimum)) / (maximum - minimum))
  }
  return bounded
}

export function nativeToCanonicalControlValue(
  deviceId: VentilatorDeviceId,
  settings: MechanicalVentilationSettings,
  key: VentilatorControlKey,
  value: number,
): number {
  if (deviceId === 'drager-evita-v800-v600' && key === 'deltaPControlCmH2O') {
    return value - settings.peepCmH2O
  }
  if (key !== 'pRampMs' && key !== 'spontaneousRampMs') return value
  const [minimum, maximum] = riseTimeBounds(deviceId, settings, key)
  if (deviceId === 'drager-evita-v800-v600') return clamp(value * 1000, minimum, maximum)
  if (deviceId === 'puritan-bennett-980') {
    const percent = clamp(value, 1, 100)
    return minimum + ((100 - percent) / 99) * (maximum - minimum)
  }
  if (deviceId === 'carefusion-avea') {
    const relative = clamp(value, 1, 9)
    return minimum + ((relative - 1) / 8) * (maximum - minimum)
  }
  return clamp(value, minimum, maximum)
}

export function adaptControlDescriptor(
  deviceId: VentilatorDeviceId,
  settings: MechanicalVentilationSettings,
  descriptor: VentilatorControlDescriptor,
): VentilatorControlDescriptor {
  const profile = getVentilatorDeviceProfile(deviceId)
  const label = profile.controlLabels[descriptor.key] ?? descriptor.label
  if (descriptor.key === 'deltaPControlCmH2O' && deviceId === 'drager-evita-v800-v600') {
    return {
      ...descriptor,
      label,
      minimum: settings.peepCmH2O + 5,
      maximum: Math.min(80, settings.peepCmH2O + 45),
      rangeNote:
        'Pinsp is displayed as an absolute upper pressure; the model retains Pinsp − PEEP.',
    }
  }
  if (descriptor.key === 'pRampMs' || descriptor.key === 'spontaneousRampMs') {
    if (deviceId === 'drager-evita-v800-v600') {
      return {
        ...descriptor,
        label,
        unit: 's',
        minimum: 0,
        maximum: Number((riseTimeBounds(deviceId, settings, descriptor.key)[1] / 1000).toFixed(2)),
        step: 0.01,
      }
    }
    if (deviceId === 'puritan-bennett-980') {
      return {
        ...descriptor,
        label,
        unit: '%',
        minimum: 1,
        maximum: 100,
        step: 1,
        rangeNote: 'Higher percentages produce a faster educational pressure rise.',
      }
    }
    if (deviceId === 'carefusion-avea') {
      return {
        ...descriptor,
        label,
        unit: 'relative',
        minimum: 1,
        maximum: 9,
        step: 1,
        rangeNote: 'Documented relative control: 1 fastest, 9 slowest.',
      }
    }
  }
  if (deviceId === 'carefusion-avea') {
    return {
      ...descriptor,
      label,
      rangeNote:
        descriptor.rangeNote ??
        'Simulator range bounded to the case-safe envelope; verify the applicable limit in the AVEA operator manual.',
    }
  }
  return { ...descriptor, label }
}
