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
import { deriveVolumeFlowTimeSeconds } from '../engine/physics'
import { resolveControlUnit } from './deviceDisplay'

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
    pages: '44, 47-52, 91-112, 123-183, 184-192, 195-225, 229-235, 311-317',
    sourceFilename: 'HAMILTON-C6_ops-manual_v1.2.x_en_10197564.00.pdf',
    sourceSha256: '5de5eeffee986633ffeaf40fc80dd63fd975b23ad1645ea3b975273f3d511f78',
    intendedUse:
      'Mode vocabulary, control ranges and grouping, main-display layout, monitored-parameter names and units, waveform colors, navigation, graphics, alarms, maneuvers, and physical-control workflow.',
    limitations:
      'Optional features and market-specific configurations are excluded unless explicitly listed. Main monitoring parameters are configurable on the device; the profile uses the set shown in the manual figures.',
  },
  {
    id: 'hamilton-c6-quick-guide',
    deviceId: 'hamilton-c6',
    title: 'HAMILTON-C6 Quick Guide',
    citation: 'Hamilton Medical. HAMILTON-C6 Quick Guide. Document 624972/00.',
    revision: '624972/00',
    date: '2018-04-24',
    pages: '4-12, 29-32',
    sourceFilename: 'HAMILTON-C6_quick-guide_en_624972.00.pdf',
    sourceSha256: '7d3576c9de465d275b3b42c5e948c091c59ea051d3f54ed0714931ec91940a26',
    intendedUse:
      'Bezel key legends, main-display element names, and the navigation shortcuts reachable from each screen element.',
    limitations:
      'A quick reference that explicitly does not replace the operator’s manual; control ranges and clinical claims come from the operator’s manual.',
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
    pages: '23-35, 45-51, 56-68, 121-170, 181-191, 315-350',
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
    pages: '1-5, 1-12 to 1-15, 2-7 to 2-21',
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
    pages: '1, 4-9, 12',
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
    pages: '1-6, 10-31, 33-46',
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
    sourceIds: [
      'hamilton-c6-manual-1.2.x',
      'hamilton-c6-intellivent-asv-1.2.x',
      'hamilton-c6-quick-guide',
    ],
    // Control names as defined in operator's manual Table 5-9.
    controlLabels: {
      oxygenPercent: 'Oxygen',
      peepCmH2O: 'PEEP/CPAP',
      deltaPControlCmH2O: 'ΔPcontrol',
      pressureSupportCmH2O: 'ΔPsupport',
      pRampMs: 'P-ramp',
      etsPercent: 'ETS',
      tiMaxSeconds: 'TI max',
      ratePerMin: 'Rate',
      vtMl: 'Vt',
      inspiratoryTimeSeconds: 'TI',
      peakFlowLMin: 'Peak flow',
      pausePercent: 'Pause',
      highPressureLimitCmH2O: 'High pressure',
      triggerThreshold: 'Flow trigger',
      trcEnabled: 'TRC compensation',
      targetVtMl: 'Vt',
      spontaneousPressureSupportCmH2O: 'ΔPsupport',
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
    display: {
      pressureUnit: 'cmH₂O',
      // Operator's manual Table 16-5 prints the unit beside each control parameter: Vt (ml),
      // Rate (b/min), Peak flow and Trigger flow (l/min), TI / TI max / T high / T low (s),
      // P-ramp (ms), Pause and ETS and Oxygen (%), TRC tube size (mm). Lowercase l throughout.
      controlUnits: { mL: 'ml', '/min': 'b/min', 'L/min': 'l/min' },
      pressureLabels: { peak: 'Ppeak', plateau: 'Pplateau', mean: 'Pmean', peep: 'PEEP/CPAP' },
      // Operator's manual §2.2.2 and §8.2.1: the MMPs run down the left of the display, with the
      // SpO2 value and its low alarm limit in a strip beneath them. Ppeak is always displayed;
      // the rest are configurable, so this is the set shown in Figures 2-6, 8-1, and 8-2.
      monitorLayout: 'left-column',
      monitorLabel: 'Main monitoring parameters',
      monitorFields: [
        { metric: 'peakPressure', label: 'Ppeak', unit: 'cmH2O' },
        { metric: 'minuteVolume', label: 'ExpMinVol', unit: 'l/min', precision: 1 },
        { metric: 'exhaledTidalVolume', label: 'VTE', unit: 'ml' },
        { metric: 'totalRate', label: 'fTotal', unit: 'b/min' },
        { metric: 'ieRatio', label: 'I:E', unit: '' },
      ],
      monitorFooter: [{ metric: 'spo2', label: 'SpO2', unit: '%' }],
      // §8.3.3.3: the Paw waveform is yellow. Flow and volume traces are magenta and green in
      // Figures 7-2 through 7-12 and 8-11.
      waveforms: [
        {
          field: 'pawCmH2O',
          label: 'Paw',
          unit: 'cmH2O',
          minimum: 0,
          maximum: 50,
          color: '#e8c33c',
        },
        {
          field: 'flowLMin',
          label: 'Flow',
          unit: 'l/min',
          minimum: -100,
          maximum: 100,
          color: '#d6489a',
        },
        {
          field: 'volumeMl',
          label: 'Volume',
          unit: 'ml',
          minimum: 0,
          maximum: 1000,
          color: '#2f9e5f',
        },
      ],
      showBreathPhase: false,
      // Quick guide §1.1: the keys either side of the press-and-turn knob.
      bezelKeys: [
        { action: 'alarm-silence', label: 'Audio Pause' },
        { action: 'oxygen-enrichment', label: 'O2 enrichment' },
        { action: 'manual-breath', label: 'Manual breath' },
        { action: 'screen-lock', label: 'Screen lock' },
      ],
      knobPosition: 4,
      // Figures 7-2 to 7-12 list the ventilator controls of every mode under three headings, in
      // this order. ΔPsupport sits under CO2 elimination in SPONT, where it is the primary
      // control, and under Oxygenation wherever it supports spontaneous breaths in a SIMV mode.
      controlGroups: [
        {
          label: 'CO2 elimination',
          keys: [
            'minuteVolumePercent',
            'vtMl',
            'targetVtMl',
            'deltaPControlCmH2O',
            'pressureSupportCmH2O',
            'pHighCmH2O',
            'pLowCmH2O',
            'tHighSeconds',
            'tLowSeconds',
            'ratePerMin',
            'inspiratoryTimeSeconds',
            'pausePercent',
          ],
        },
        {
          label: 'Oxygenation',
          keys: [
            'peepCmH2O',
            'spontaneousPressureSupportCmH2O',
            'oxygenPercent',
            'peakFlowLMin',
            'targetSpO2LowPercent',
          ],
        },
        {
          label: 'Patient synchronization',
          keys: [
            'pRampMs',
            'spontaneousRampMs',
            'triggerThreshold',
            'etsPercent',
            'spontaneousCyclePercent',
            'tiMaxSeconds',
          ],
        },
        {
          label: 'Patient, TRC, and apnea',
          keys: ['apneaRatePerMin', 'trcEnabled', 'targetPetCO2MmHg', 'highPressureLimitCmH2O'],
        },
      ],
      controlOrder: [],
      displayNote:
        'MMP column, SpO2 strip, waveform colors, and the grouping of the ventilator controls follow the HAMILTON-C6 operator’s manual §2.2.2, §8.2.1-8.3.3 and Figures 7-2 to 7-12, verified against the registered SHA-256. Setting units are the ones Table 16-5 prints beside each control parameter — ml, b/min, l/min. Bezel key legends come from quick guide §1.1. MMPs are configurable on the device, so this is the set the manual figures show.',
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
      vtMl: 'VT',
      inspiratoryTimeSeconds: 'Ti',
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
      pausePercent: 'Tplat',
      autoFlowEnabled: 'AutoFlow',
    },
    display: {
      // Pocket guide p. 5 and p. 9: the monitoring area carries a column of large values to the
      // right of the waveform fields, top to bottom FiO2, an airway pressure, PEEP, MVe, RR, VT.
      pressureUnit: 'mbar',
      // The Evita's own abbreviations (§3.9, and the monitoring column on pocket guide p. 5)
      // match the simulator's neutral spelling for every non-pressure unit, so nothing is renamed.
      // Authored explicitly rather than omitted so the agreement is recorded, not assumed.
      controlUnits: {},
      pressureLabels: { peak: 'PIP', plateau: 'Pplat', mean: 'Pmean', peep: 'PEEP' },
      monitorLayout: 'right-column',
      monitorLabel: 'Monitoring area',
      monitorFields: [
        { metric: 'oxygenPercent', label: 'FiO2', unit: 'Vol%' },
        { metric: 'peakPressure', label: 'PIP', unit: 'mbar' },
        { metric: 'peep', label: 'PEEP', unit: 'mbar', precision: 1 },
        { metric: 'minuteVolume', label: 'MVe', unit: 'L/min', precision: 2 },
        { metric: 'totalRate', label: 'RR', unit: '/min' },
        { metric: 'exhaledTidalVolume', label: 'VTe', unit: 'mL' },
      ],
      waveforms: [
        { field: 'pawCmH2O', label: 'Paw', unit: 'mbar', minimum: 0, maximum: 50 },
        { field: 'flowLMin', label: 'Flow', unit: 'L/min', minimum: -100, maximum: 100 },
        { field: 'volumeMl', label: 'Volume', unit: 'mL', minimum: 0, maximum: 1000 },
      ],
      showBreathPhase: false,
      // Pocket guide p. 5: the display unit carries an ON/OFF key, power indicators, the rotary
      // knob, and a 2-minute alarm silence. Maneuvers are on-screen, under Procedures.
      bezelKeys: [{ action: 'alarm-silence', label: 'Alarm silence 2 min' }],
      knobPosition: 1,
      // Therapy bar order as printed on the pocket guide main screen (pp. 5, 8-9):
      // FiO2 · VT · Ti · RR · PEEP · ΔPsupp · Slope · Flow, with Pinsp taking VT's place in the
      // pressure-controlled modes.
      controlOrder: [
        'oxygenPercent',
        'vtMl',
        'targetVtMl',
        'deltaPControlCmH2O',
        'pHighCmH2O',
        'pLowCmH2O',
        'inspiratoryTimeSeconds',
        'tHighSeconds',
        'tLowSeconds',
        'ratePerMin',
        'peepCmH2O',
        'pressureSupportCmH2O',
        'spontaneousPressureSupportCmH2O',
        'pRampMs',
        'spontaneousRampMs',
        'peakFlowLMin',
        'pausePercent',
        'etsPercent',
        'spontaneousCyclePercent',
        'tiMaxSeconds',
        'triggerThreshold',
        'apneaRatePerMin',
        'highPressureLimitCmH2O',
      ],
      displayNote:
        'Parameter names and units follow the Evita V800 / V600 instructions for use §3.9 abbreviations; the monitoring-area and therapy-bar arrangement follows §4.1 and the pocket guide pp. 5, 8-9. Pressures print in mbar, which this simulator treats as numerically interchangeable with cmH₂O. The remaining setting units carry the same abbreviations as this device’s monitored column.',
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
      // Service manual Table 2-8 (settings) and Table 2-9 (alarms). The up arrow marks a high
      // alarm limit; the dot marks a flow. Both had been transcribed as a literal "2".
      oxygenPercent: 'O₂%',
      peepCmH2O: 'PEEP',
      deltaPControlCmH2O: 'PI',
      pressureSupportCmH2O: 'PSUPP',
      pRampMs: 'Rise Time',
      etsPercent: 'ESENS',
      tiMaxSeconds: '↑TI SPONT',
      ratePerMin: 'f',
      peakFlowLMin: 'V̇MAX',
      pausePercent: 'TPL',
      inspiratoryTimeSeconds: 'TI',
      highPressureLimitCmH2O: '↑PPEAK',
      triggerThreshold: 'V̇SENS',
      trcEnabled: 'Tube compensation',
      targetVtMl: 'VT / VT SUPP',
      spontaneousPressureSupportCmH2O: 'PSUPP',
      spontaneousRampMs: 'Rise Time',
      spontaneousCyclePercent: 'ESENS',
      pHighCmH2O: 'PH',
      pLowCmH2O: 'PL',
      tHighSeconds: 'TH',
      tLowSeconds: 'TL',
      apneaRatePerMin: 'fA',
      proportionalSupportPercent: '% Supp',
    },
    display: {
      // ICU brochure pp. 1 and 9 show the patient-data banner running across the top of the
      // screen, opened by the breath-phase letter. Symbol names come from service manual
      // Table 2-10 (patient data).
      pressureUnit: 'cmH₂O',
      // Rate prints as 1/min on this device — the symbol used for fTOT in service manual
      // Table 2-10. Volume and flow keep mL and L/min, as the same table prints them.
      controlUnits: { '/min': '1/min' },
      pressureLabels: { peak: 'PPEAK', plateau: 'PPL', mean: 'PMEAN', peep: 'PEEP' },
      monitorLayout: 'top-banner',
      monitorLabel: 'Patient data banner',
      monitorFields: [
        { metric: 'totalRate', label: 'fTOT', unit: '1/min' },
        { metric: 'minuteVolume', label: 'V̇E TOT', unit: 'L/min', precision: 1 },
        { metric: 'exhaledTidalVolume', label: 'VTE', unit: 'mL' },
        { metric: 'peep', label: 'PEEP', unit: 'cmH₂O', precision: 1 },
        { metric: 'ieRatio', label: 'I:E', unit: '' },
        // Table 2-12: pressure resolution is 1 cmH₂O at or above 10 cmH₂O.
        { metric: 'peakPressure', label: 'PPEAK', unit: 'cmH₂O' },
        { metric: 'meanAirwayPressure', label: 'PMEAN', unit: 'cmH₂O' },
      ],
      waveforms: [
        { field: 'pawCmH2O', label: 'Pressure', unit: 'cmH₂O', minimum: 0, maximum: 50 },
        { field: 'flowLMin', label: 'Flow', unit: 'L/min', minimum: -100, maximum: 100 },
        { field: 'volumeMl', label: 'Volume', unit: 'mL', minimum: 0, maximum: 1000 },
      ],
      showBreathPhase: true,
      // Service manual §1.11.1: eight off-screen bezel keys straddle the rotary encoder.
      // Brightness and alarm volume are omitted because this simulator models neither.
      bezelKeys: [
        { action: 'screen-lock', label: 'Display lock' },
        { action: 'manual-breath', label: 'Manual inspiration' },
        { action: 'inspiratory-hold', label: 'Inspiratory pause' },
        { action: 'expiratory-hold', label: 'Expiratory pause' },
        { action: 'alarm-reset', label: 'Alarm reset' },
        { action: 'alarm-silence', label: 'Alarm silence' },
        { action: 'oxygen-enrichment', label: 'Elevate O₂' },
      ],
      knobPosition: 2,
      // The service manual documents the setting names and ranges but not the order the Vent Setup
      // screen lays them out in, so the engine's mode-driven order stands.
      controlOrder: [],
      displayNote:
        'Banner parameters use the symbol names in service manual Table 2-10; the bezel key set and its order follow §1.11.1. Breath phase shows the documented Control / Assist / Spontaneous indicator. Setting units carry the same abbreviations as that table — rate in 1/min. The service manual does not publish a Vent Setup screen layout, so the settings keep the simulator’s own order.',
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
    // Membrane-key legends: SCREEN SELECT keys (MAIN, LOOP, MANEUVER) from the modes guide p. 31,
    // and the MODE / ADV SETTINGS / ALARM LIMITS keys from pp. 2, 4 and 6.
    navigationLabels: {
      main: 'MAIN',
      modes: 'MODE',
      controls: 'ADV SETTINGS',
      alarms: 'ALARM LIMITS',
      graphics: 'LOOP',
      tools: 'MANEUVER',
    },
    orientationSteps: [
      'Use the MODE membrane key or on-screen mode indicator to open Mode Select.',
      'Touch a control, turn the data dial, then touch again or press ACCEPT.',
      'Use ADV SETTINGS for rise, cycling, waveform, bias-flow, and trigger refinements.',
      'Use ALARM LIMITS and the physical maneuver keys while retaining the active mode view.',
    ],
    deferredModes: ['nCPAP/IMV', 'Independent lung ventilation'],
    sourceIds: ['avea-modes-guide-2014'],
    // Row names as printed in the modes guide primary-control tables, pp. 43-46.
    controlLabels: {
      oxygenPercent: '%O₂',
      peepCmH2O: 'PEEP',
      deltaPControlCmH2O: 'Insp Pres',
      pressureSupportCmH2O: 'PSV',
      pRampMs: 'Insp Rise',
      etsPercent: 'PSV Cycle',
      tiMaxSeconds: 'PSV Tmax',
      ratePerMin: 'Rate',
      vtMl: 'Volume',
      peakFlowLMin: 'Peak Flow',
      inspiratoryTimeSeconds: 'Insp Time',
      pausePercent: 'Insp Pause',
      highPressureLimitCmH2O: 'High Ppeak',
      triggerThreshold: 'Flow Trig',
      targetVtMl: 'Volume',
      spontaneousPressureSupportCmH2O: 'PSV',
      spontaneousRampMs: 'PSV Rise',
      spontaneousCyclePercent: 'PSV Cycle',
      pHighCmH2O: 'Pres High',
      pLowCmH2O: 'Pres Low',
      tHighSeconds: 'Time High',
      tLowSeconds: 'Time Low',
    },
    display: {
      pressureUnit: 'cmH₂O',
      // Rate prints as BPM in the modes guide's alarm-limits window (p. 6). Volume and flow keep
      // mL and L/min from the same window; the waveform axes on pp. 11-26 print ml and l/min, but
      // that is the graphics region, not the settings tiles.
      controlUnits: { '/min': 'BPM' },
      pressureLabels: { peak: 'Ppeak', plateau: 'Pplat', mean: 'Pmean', peep: 'PEEP' },
      monitorLayout: 'right-tiles',
      monitorLabel: 'Patient data',
      // Parameter vocabulary taken from the alarm-limits window (p. 6) and the derived values
      // printed under the primary controls (pp. 4-5). The modes guide does not publish the full
      // configurable monitor screen, so this is the documented subset rather than a full facsimile.
      monitorFields: [
        { metric: 'peakPressure', label: 'Ppeak', unit: 'cmH₂O' },
        { metric: 'peep', label: 'PEEP', unit: 'cmH₂O', precision: 1 },
        { metric: 'exhaledTidalVolume', label: 'Vte', unit: 'mL' },
        { metric: 'minuteVolume', label: 'Ve', unit: 'L/min', precision: 1 },
        { metric: 'totalRate', label: 'Rate', unit: 'BPM' },
        { metric: 'ieRatio', label: 'I:E', unit: '' },
      ],
      // Axis legends and scales as printed on the mode waveform figures, pp. 11-26.
      waveforms: [
        { field: 'pawCmH2O', label: 'Paw', unit: 'cmH₂O', minimum: -40, maximum: 80 },
        { field: 'flowLMin', label: 'Flow', unit: 'l/min', minimum: -80, maximum: 80 },
        { field: 'volumeMl', label: 'Vt', unit: 'ml', minimum: -500, maximum: 1500 },
      ],
      showBreathPhase: false,
      bezelKeys: [
        { action: 'manual-breath', label: 'MANUAL BREATH' },
        { action: 'alarm-reset', label: 'ALARM RESET' },
      ],
      knobPosition: 2,
      // Primary-control row order as printed in the mode tables, pp. 43-46: Rate, Volume,
      // Insp Pres, Peak flow, Insp time, Insp pause, PSV, PEEP, Flow trig, % oxygen, then the
      // APRV/BiPhasic pressures. Advanced settings follow, matching the ADV SETTINGS row.
      controlOrder: [
        'ratePerMin',
        'vtMl',
        'targetVtMl',
        'deltaPControlCmH2O',
        'peakFlowLMin',
        'inspiratoryTimeSeconds',
        'pausePercent',
        'pressureSupportCmH2O',
        'spontaneousPressureSupportCmH2O',
        'peepCmH2O',
        'triggerThreshold',
        'oxygenPercent',
        'pHighCmH2O',
        'tHighSeconds',
        'tLowSeconds',
        'pLowCmH2O',
        'pRampMs',
        'spontaneousRampMs',
        'etsPercent',
        'spontaneousCyclePercent',
        'tiMaxSeconds',
        'apneaRatePerMin',
        'highPressureLimitCmH2O',
      ],
      displayNote:
        'Control names, membrane-key legends, primary-control order, and waveform axis scales follow the AVEA ventilation modes user guide. Setting units carry the abbreviations printed in that guide’s alarm-limits window — rate in BPM. The guide is explicit that it does not replace the operator manual, so the monitored-parameter set is the documented subset, not the full configurable monitor screen.',
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

/**
 * The engine holds the inspiratory pause as a percentage of the flow-delivery time. Every device
 * except the C6 prints it as a duration: PB980 `TPL` (service manual Table 2-8, 0 to 2 s), AVEA
 * `Insp pause sec` (modes guide pp. 43-46), and Evita `Tplat`.
 */
const pauseInSecondsDevices: readonly VentilatorDeviceId[] = [
  'drager-evita-v800-v600',
  'puritan-bennett-980',
  'carefusion-avea',
]

const pauseSecondsMaximum = 2

function pauseSecondsPerPercent(settings: MechanicalVentilationSettings): number {
  return deriveVolumeFlowTimeSeconds(settings) / 100
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
  if (key === 'pausePercent' && pauseInSecondsDevices.includes(deviceId)) {
    const seconds = value * pauseSecondsPerPercent(settings)
    return Number(clamp(seconds, 0, pauseSecondsMaximum).toFixed(2))
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
  if (key === 'pausePercent' && pauseInSecondsDevices.includes(deviceId)) {
    const secondsPerPercent = pauseSecondsPerPercent(settings)
    if (secondsPerPercent <= 0) return 0
    return Number(clamp(value / secondsPerPercent, 0, 70).toFixed(2))
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
  rawDescriptor: VentilatorControlDescriptor,
): VentilatorControlDescriptor {
  const profile = getVentilatorDeviceProfile(deviceId)
  const label = profile.controlLabels[rawDescriptor.key] ?? rawDescriptor.label
  // Settings print in the unit spelling the device uses on screen: mbar on the Evita, `ml` and
  // `b/min` on the C6. `unit` below is the vendor's spelling from here down.
  const unit = (neutral: string) => resolveControlUnit(profile.display, neutral)
  const descriptor = { ...rawDescriptor, unit: unit(rawDescriptor.unit) }
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
  if (descriptor.key === 'pausePercent' && pauseInSecondsDevices.includes(deviceId)) {
    const maximum = Number(
      clamp(70 * pauseSecondsPerPercent(settings), 0.1, pauseSecondsMaximum).toFixed(2),
    )
    return {
      ...descriptor,
      label,
      unit: unit('s'),
      minimum: 0,
      maximum,
      step: 0.05,
      rangeNote:
        deviceId === 'drager-evita-v800-v600'
          ? 'Evita derives the plateau from Ti and Flow; the simulator exposes Tplat directly so the pause remains adjustable.'
          : 'Set as a duration on this device. The model holds the pause as a fraction of flow-delivery time, so the seconds shown move with Vt and peak flow.',
    }
  }
  if (descriptor.key === 'pRampMs' || descriptor.key === 'spontaneousRampMs') {
    if (deviceId === 'drager-evita-v800-v600') {
      return {
        ...descriptor,
        label,
        unit: unit('s'),
        minimum: 0,
        maximum: Number((riseTimeBounds(deviceId, settings, descriptor.key)[1] / 1000).toFixed(2)),
        step: 0.01,
      }
    }
    if (deviceId === 'puritan-bennett-980') {
      return {
        ...descriptor,
        label,
        unit: unit('%'),
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
