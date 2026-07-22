import type { McsDeviceProfile } from '../engine/types'

export const mcsDeviceProfiles: readonly McsDeviceProfile[] = [
  {
    id: 'iabp-counterpulsation-neutral-v1',
    kind: 'iabp',
    displayName: 'Intra-aortic balloon pump',
    category: 'Temporary counterpulsation support',
    jurisdiction: 'US',
    labelingRevision:
      'Current US IABP update-center material; formal local-IFU reconciliation remains a release gate',
    softwareOrModelRevision:
      'Neutral facsimile informed by Cardiosave B.17 reference material; not console-specific',
    reviewedAt: '2026-07-19',
    mechanism:
      'Diastolic balloon inflation augments aortic diastolic pressure; pre-systolic deflation reduces effective LV afterload.',
    controlSummary: 'Assist ratio, trigger source, inflation timing, and deflation timing.',
    controlBounds: [
      { id: 'assistRatio', label: 'Assist ratio', allowedValues: [1, 2, 3] },
      {
        id: 'triggerSource',
        label: 'Trigger source',
        allowedValues: ['ecg', 'pressure', 'internal'],
      },
      {
        id: 'inflationOffsetMs',
        label: 'Inflation offset',
        minimum: -180,
        maximum: 180,
        unit: 'ms',
      },
      {
        id: 'deflationOffsetMs',
        label: 'Deflation offset',
        minimum: -180,
        maximum: 180,
        unit: 'ms',
      },
    ],
    alarmDefinitions: [
      {
        id: 'iabp-early-inflation',
        label: 'Inflation before aortic-valve closure',
        priority: 'warning',
        interpretation: 'Modeled impedance to LV ejection rises.',
      },
      {
        id: 'iabp-late-deflation',
        label: 'Late deflation',
        priority: 'critical',
        interpretation: 'The next ejection begins against an inflated balloon.',
      },
      {
        id: 'iabp-trigger-unreliable',
        label: 'Trigger reliability reduced',
        priority: 'warning',
        interpretation: 'Signal/rhythm mismatch produces inconsistent assisted beats.',
      },
    ],
    modelLimitations: [
      'No insertion, balloon sizing, helium-system service, or transport certification.',
      'Counterpulsation effects are directional educational estimates.',
    ],
    sourceIds: [
      'master-hemodynamics-reference',
      'ishlt-hfsa-acute-mcs-2023',
      'getinge-iabp-current',
    ],
    educationalModelVersion: '1.0.0-preview.1',
  },
  {
    id: 'impella-biventricular-family-v2',
    kind: 'impella',
    displayName: 'Impella CP, 5.5, and RP support',
    category: 'Temporary left, right, or biventricular microaxial support',
    jurisdiction: 'US',
    labelingRevision:
      'FDA PMA P140003 supplement index reviewed 2026-07-19; current local IFU still required',
    softwareOrModelRevision:
      'SmartAssist-family neutral facsimile; current FDA safety notices flagged below',
    reviewedAt: '2026-07-19',
    mechanism:
      'CP/5.5 move blood from LV to aorta; RP moves systemic venous blood from an IVC/atrial inlet to the pulmonary artery. When combined, the two serial pump flows must be reconciled rather than summed as systemic flow.',
    controlSummary:
      'Left-pump variant, independent left/right activation, performance level, placement state, and purge-system state.',
    controlBounds: [
      {
        id: 'leftVariant',
        label: 'Left-sided pump',
        allowedValues: ['off', 'cp', '55'],
      },
      {
        id: 'rightVariant',
        label: 'Right-sided pump',
        allowedValues: ['off', 'rp'],
      },
      {
        id: 'leftPerformanceLevel',
        label: 'Left performance level',
        minimum: 0,
        maximum: 9,
        unit: 'P-level',
      },
      {
        id: 'rightPerformanceLevel',
        label: 'RP performance level',
        minimum: 0,
        maximum: 9,
        unit: 'P-level',
      },
      {
        id: 'leftPosition',
        label: 'Left placement state',
        allowedValues: ['correct', 'too-deep', 'too-shallow'],
      },
      {
        id: 'rightPosition',
        label: 'RP placement state',
        allowedValues: ['correct', 'inlet-too-high', 'outlet-too-proximal', 'too-distal'],
      },
      {
        id: 'leftPurgeState',
        label: 'Left purge-system state',
        allowedValues: ['normal', 'high-pressure', 'low-pressure'],
      },
      {
        id: 'rightPurgeState',
        label: 'RP purge-system state',
        allowedValues: ['normal', 'high-pressure', 'low-pressure'],
      },
    ],
    alarmDefinitions: [
      {
        id: 'impella-left-suction',
        label: 'Left Impella suction detected',
        priority: 'critical',
        interpretation: 'LV filling is inadequate or restricted for selected support.',
      },
      {
        id: 'impella-right-suction',
        label: 'RP inflow suction detected',
        priority: 'critical',
        interpretation: 'Caval/atrial filling is inadequate for selected right-sided support.',
      },
      {
        id: 'impella-left-position',
        label: 'Left position signal abnormal',
        priority: 'critical',
        interpretation: 'Malposition reduces support and raises blood-trauma risk.',
      },
      {
        id: 'impella-right-position',
        label: 'RP position signal abnormal',
        priority: 'critical',
        interpretation: 'The modeled IVC-inlet/PA-outlet relationship is abnormal.',
      },
      {
        id: 'impella-right-flow-imbalance',
        label: 'Right-to-left pump imbalance',
        priority: 'warning',
        interpretation: 'RP delivery exceeds modeled left-heart handling.',
      },
      {
        id: 'impella-left-hemolysis-risk',
        label: 'Left hemolysis-risk pattern',
        priority: 'warning',
        interpretation: 'Suction or malposition raises modeled blood-trauma risk.',
      },
    ],
    modelLimitations: [
      'No insertion, imaging guidance, surgical access, access management, anticoagulation, or purge-fluid prescription.',
      'Displayed left and right flows are pressure/preload-dependent educational estimates and are not summed as systemic output.',
      'Only aortic cusps are segmented valve morphology; tricuspid and pulmonic crossings are route/orifice gates.',
    ],
    sourceIds: [
      'master-hemodynamics-reference',
      'ishlt-hfsa-acute-mcs-2023',
      'fda-impella-cp-labeling',
      'jnj-impella-cp-current',
      'fda-impella-55-labeling',
      'jnj-impella-55-current',
      'fda-impella-rp-labeling',
      'jnj-impella-rp-current',
      'fda-impella-cp-2026-recall',
      'fda-impella-rp-2026-recall',
      'fda-impella-controller-2025-recall',
    ],
    educationalModelVersion: '2.0.0-preview.1',
  },
  {
    id: 'durable-cf-lvad-v1',
    kind: 'lvad',
    displayName: 'Durable continuous-flow LVAD',
    category: 'Implanted LV-to-aorta support',
    jurisdiction: 'US',
    labelingRevision:
      'P160054/S008 IFU teaching anchor; current PMA supplement/local-IFU reconciliation remains pending',
    softwareOrModelRevision:
      'Neutral HeartMate 3-concept facsimile; current power-system safety notices flagged below',
    reviewedAt: '2026-07-19',
    mechanism:
      'An apical inflow cannula and ascending-aortic outflow graft provide continuous LV support.',
    controlSummary:
      'Flow, speed, power, pulsatility index, controller, and power-source interpretation.',
    controlBounds: [
      {
        id: 'speedRpm',
        label: 'Pump speed',
        minimum: 4600,
        maximum: 6200,
        unit: 'rpm',
        authorization: 'Explicit simulated authorized-personnel order required.',
      },
      { id: 'powerConnected', label: 'Approved power path', allowedValues: [true, false] },
      { id: 'controllerFault', label: 'Controller fault', allowedValues: [true, false] },
      {
        id: 'suspectedPumpThrombosis',
        label: 'High-power/thrombosis pattern',
        allowedValues: [true, false],
      },
    ],
    alarmDefinitions: [
      {
        id: 'lvad-low-flow',
        label: 'Low-flow alarm',
        priority: 'warning',
        interpretation:
          'Differentiate preload, RV failure, tamponade, afterload, obstruction, and recirculation.',
      },
      {
        id: 'lvad-power-disconnected',
        label: 'External power disconnected',
        priority: 'critical',
        interpretation: 'Pump support is unavailable until an approved power path is restored.',
      },
      {
        id: 'lvad-controller-fault',
        label: 'Controller fault',
        priority: 'critical',
        interpretation: 'Use current emergency procedures and contact the LVAD team.',
      },
      {
        id: 'lvad-high-power',
        label: 'High-power pattern',
        priority: 'critical',
        interpretation: 'Urgent MCS-team evaluation is required.',
      },
    ],
    modelLimitations: [
      'No outpatient longitudinal care, driveline procedure, anticoagulation dosing, or controller exchange certification.',
      'Speed changes require the simulated authorized-personnel gate.',
    ],
    sourceIds: [
      'ishlt-durable-mcs-2023',
      'fda-heartmate3-ifu',
      'fda-heartmate3-pma-current',
      'fda-heartmate-mpu-2025-recall',
      'fda-heartmate-power-cord-2025-recall',
    ],
    educationalModelVersion: '1.0.0-preview.1',
  },
] as const

export const mcsDeviceProfileByKind = new Map(
  mcsDeviceProfiles.map((profile) => [profile.kind, profile]),
)
