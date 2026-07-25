import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import type { McsAction, McsDeviceKind } from '../engine/types'

export interface McsLessonTransferDefinition {
  readonly lessonId: string
  readonly title: string
  readonly contextItems: readonly { readonly label: string; readonly value: string }[]
  readonly setupDevice: McsDeviceKind
  readonly setupActions: readonly McsAction[]
  readonly requiredActionIds: readonly string[]
  readonly requiredActionLabel: string
  readonly item: ClinicalLearningItem
}

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const bedsideEvidence = ['mcs-bedside-reference-supplied', 'ishlt-hfsa-acute-mcs-2023']
const iabpEvidence = [...bedsideEvidence, 'getinge-iabp-current']
const impellaEvidence = [...bedsideEvidence, 'fda-impella-cp-labeling']
const lvadEvidence = [
  'mcs-bedside-reference-supplied',
  'ishlt-durable-mcs-2023',
  'fda-heartmate3-ifu',
]

export const mcsLessonTransfers: readonly McsLessonTransferDefinition[] = [
  {
    lessonId: 'mcs-foundations-signals',
    title: 'Transfer after transport: plausible pressure, falling perfusion',
    contextItems: [
      { label: 'Change', value: 'Returned from CT; arterial trace looks damped' },
      { label: 'Patient', value: 'Cool extremities with lower urine output' },
      { label: 'Device', value: 'IABP running at the prior setting' },
      { label: 'Loading variant', value: 'Lower preload with higher afterload' },
    ],
    setupDevice: 'iabp',
    setupActions: [
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 65 },
      {
        type: 'SET_PATIENT_CONTROL',
        control: 'systemicVascularResistanceDynSecCm5',
        value: 1_650,
      },
    ],
    requiredActionIds: ['inspect:arterial', 'inspect:preload', 'inspect:device'],
    requiredActionLabel:
      'Inspect the arterial signal, filling pressures, and device/effective flow in the transfer patient.',
    item: item({
      id: 'mcs-foundations-signals-transfer-1',
      activityId: 'mcs:learn:mcs-foundations-signals',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-post-transport-low-flow',
      visualAssetIds: ['mcs-monitor', 'mcs-device-display'],
      transferVariantId: 'mcs-post-transport-signal-validation',
      stem: 'After transport, the displayed MAP remains plausible but pulsatility and effective flow have fallen. What is the best first response?',
      choices: [
        {
          id: 'validate-patient-signal-device',
          label:
            'Reassess the patient, validate the pressure signal, and reconcile filling, native flow, and device flow before changing support',
          rationale:
            'A plausible MAP does not prove perfusion or signal fidelity; the patient, measurement, and support circuit must be reconciled.',
          plausibility: 'best',
        },
        {
          id: 'increase-support-first',
          label: 'Increase the device setting immediately because the displayed flow is lower',
          rationale:
            'A setting change before validating preload, afterload, position, and measurement can worsen suction or obscure the cause.',
          plausibility: 'unsafe',
        },
        {
          id: 'accept-map',
          label: 'Accept the MAP as proof that systemic perfusion is adequate',
          rationale:
            'Pressure can remain acceptable despite low effective flow and impaired end-organ perfusion.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['validate-patient-signal-device'],
      explanation:
        'The transfer condition changes loading and signal quality. Rebuild the bedside baseline before attributing the change to the device.',
      evidenceIds: bedsideEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'mcs-foundations-mechanisms',
    title: 'Transfer mechanism: LV congestion despite counterpulsation',
    contextItems: [
      { label: 'Phenotype', value: 'LV-dominant shock with pulmonary congestion' },
      { label: 'Current support', value: 'IABP with technically acceptable timing' },
      { label: 'Hemodynamics', value: 'High PCWP with low native output' },
      { label: 'Variant', value: 'Compare augmentation with direct LV unloading' },
    ],
    setupDevice: 'iabp',
    setupActions: [
      {
        type: 'SET_PATIENT_CONTROL',
        control: 'leftVentricularContractility',
        value: 0.38,
      },
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 125 },
    ],
    requiredActionIds: ['device:select:impella'],
    requiredActionLabel:
      'Select the Impella mechanism in the transfer workspace and compare LV filling, native flow, and pump flow.',
    item: item({
      id: 'mcs-foundations-mechanisms-transfer-1',
      activityId: 'mcs:learn:mcs-foundations-mechanisms',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-lv-congestion-mechanism',
      visualAssetIds: ['mcs-anatomy', 'mcs-monitor'],
      transferVariantId: 'mcs-counterpulsation-to-direct-unloading',
      stem: 'A patient has persistent LV distension and pulmonary congestion despite well-timed counterpulsation. Which comparison best tests a different support mechanism?',
      choices: [
        {
          id: 'compare-direct-lv-unloading',
          label:
            'Compare direct LV-to-aorta unloading while tracking PCWP, LV volume, native ejection, and effective systemic flow',
          rationale:
            'This tests a distinct mechanism and preserves the need to reconcile loading and total effective flow.',
          plausibility: 'best',
        },
        {
          id: 'sum-device-native',
          label:
            'Add the displayed pump flow directly to native flow and use the sum as cardiac output',
          rationale:
            'Displayed device flow and native flow are not universally additive; recirculation and serial flow pathways matter.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'ignore-rv',
          label: 'Choose the highest-flow device without assessing RV delivery or filling',
          rationale:
            'Left-sided support remains preload dependent and can expose or worsen RV-limited delivery.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['compare-direct-lv-unloading'],
      explanation:
        'The transfer asks whether a different mechanism addresses the dominant LV loading problem, not which displayed number is largest.',
      evidenceIds: bedsideEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'iabp-timing-triggering',
    title: 'Transfer rhythm: irregular triggering',
    contextItems: [
      { label: 'Rhythm', value: 'Atrial fibrillation with variable R–R intervals' },
      { label: 'Device', value: 'IABP in 1:1 support' },
      { label: 'Problem', value: 'Intermittently mistimed assisted beats' },
      { label: 'Variant', value: 'Compare available trigger signals' },
    ],
    setupDevice: 'iabp',
    setupActions: [{ type: 'SET_RHYTHM', rhythm: 'atrial-fibrillation' }],
    requiredActionIds: ['iabp:set-trigger'],
    requiredActionLabel:
      'Change the simulated trigger source and compare assisted-beat timing against the arterial waveform.',
    item: item({
      id: 'mcs-iabp-trigger-transfer-1',
      activityId: 'mcs:learn:iabp-timing-triggering',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-iabp-irregular-rhythm',
      visualAssetIds: ['mcs-arterial-waveform', 'mcs-iabp-controls'],
      transferVariantId: 'mcs-iabp-irregular-trigger-signal',
      stem: 'With an irregular rhythm, some assisted beats are mistimed. What is the most defensible way to evaluate a trigger change?',
      choices: [
        {
          id: 'compare-trigger-to-waveform',
          label:
            'Select the most reliable available trigger and verify inflation and deflation beat by beat on the arterial waveform',
          rationale:
            'Trigger choice is only useful when the resulting timing remains physiologically aligned across variable cycles.',
          plausibility: 'best',
        },
        {
          id: 'assume-ecg',
          label: 'Keep ECG triggering because it is always superior to pressure triggering',
          rationale:
            'Signal reliability depends on rhythm and signal quality; no source is universally superior.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'increase-ratio',
          label: 'Increase assist frequency without checking the trigger or waveform timing',
          rationale:
            'More assisted beats do not resolve mistiming and can reproduce the error more often.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['compare-trigger-to-waveform'],
      explanation:
        'The transfer introduces rhythm irregularity. The learner must change the trigger and then verify the mechanical timing on the actual pressure trace.',
      evidenceIds: iabpEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'iabp-efficacy-limits',
    title: 'Transfer ceiling: RV-limited delivery',
    contextItems: [
      { label: 'Phenotype', value: 'RV-dominant shock with high pulmonary resistance' },
      { label: 'Device', value: 'IABP timing is technically acceptable' },
      { label: 'Hemodynamics', value: 'High RAP, low PAPi, limited LV filling' },
      { label: 'Problem', value: 'Persistent low effective systemic flow' },
    ],
    setupDevice: 'iabp',
    setupActions: [
      {
        type: 'SET_PATIENT_CONTROL',
        control: 'rightVentricularContractility',
        value: 0.3,
      },
      {
        type: 'SET_PATIENT_CONTROL',
        control: 'pulmonaryVascularResistanceWU',
        value: 6,
      },
    ],
    requiredActionIds: ['team:escalate'],
    requiredActionLabel:
      'Escalate to the shock/MCS team after recognizing the support-mechanism ceiling.',
    item: item({
      id: 'mcs-iabp-limits-transfer-1',
      activityId: 'mcs:learn:iabp-efficacy-limits',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-iabp-rv-limited',
      visualAssetIds: ['mcs-monitor', 'mcs-iabp-controls'],
      transferVariantId: 'mcs-iabp-rv-delivery-ceiling',
      stem: 'Counterpulsation is well timed, but RAP is high, PAPi is low, LV filling is limited, and perfusion remains poor. What is the best next step?',
      choices: [
        {
          id: 'recognize-ceiling-escalate',
          label:
            'Recognize RV-limited delivery, reassess the full shock phenotype, and escalate the support strategy',
          rationale:
            'IABP depends on native ejection and does not replace failing RV-to-pulmonary delivery.',
          plausibility: 'best',
        },
        {
          id: 'retime-normal',
          label:
            'Continue changing inflation timing even though the waveform timing is already acceptable',
          rationale: 'Technical timing changes do not resolve a support-mechanism mismatch.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'accept-map-only',
          label: 'Defer escalation if MAP is above a single numeric threshold',
          rationale: 'Pressure alone does not establish adequate flow or end-organ perfusion.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['recognize-ceiling-escalate'],
      explanation:
        'The new condition is RV-limited rather than a timing fault. Completion requires an actual escalation action after interpreting the transfer case.',
      evidenceIds: iabpEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'impella-unloading-placement',
    title: 'Transfer afterload: lower flow at the same performance level',
    contextItems: [
      { label: 'Device', value: 'Impella CP at a high performance level' },
      { label: 'Change', value: 'SVR and aortic pressure rise' },
      { label: 'Observation', value: 'Displayed pump flow falls' },
      { label: 'Variant', value: 'Pressure-gradient limitation without a setting change' },
    ],
    setupDevice: 'impella',
    setupActions: [
      {
        type: 'SET_IMPELLA_CONTROL',
        side: 'left',
        control: 'performanceLevel',
        value: 7,
      },
      {
        type: 'SET_PATIENT_CONTROL',
        control: 'systemicVascularResistanceDynSecCm5',
        value: 1_950,
      },
    ],
    requiredActionIds: ['inspect:device'],
    requiredActionLabel:
      'Inspect device, native, and effective flow after the transfer afterload change.',
    item: item({
      id: 'mcs-impella-afterload-transfer-1',
      activityId: 'mcs:learn:impella-unloading-placement',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-impella-high-afterload',
      visualAssetIds: ['mcs-monitor', 'mcs-impella-controls'],
      transferVariantId: 'mcs-impella-fixed-level-high-afterload',
      stem: 'At the same performance level and acceptable position, estimated pump flow falls as aortic pressure rises. Which interpretation best fits?',
      choices: [
        {
          id: 'pressure-gradient-dependent',
          label:
            'The pump is pressure-gradient dependent; reconcile afterload, preload, position, native output, and effective flow',
          rationale:
            'A higher outflow pressure can reduce microaxial pump flow despite an unchanged performance setting.',
          plausibility: 'best',
        },
        {
          id: 'setting-equals-flow',
          label:
            'The performance level guarantees the same patient flow in every loading condition',
          rationale:
            'Performance level is a setting, not a loading-independent guarantee of effective patient flow.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'advance-blindly',
          label: 'Increase performance level without checking loading, position, or perfusion',
          rationale:
            'Escalating without diagnosing the pressure-flow change can create suction or other harm.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['pressure-gradient-dependent'],
      explanation:
        'The authored variant holds the performance setting while changing afterload, requiring interpretation of the resulting pressure-flow relationship.',
      evidenceIds: impellaEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'impella-suction-purge-rv',
    title: 'Transfer suction: abrupt loss of LV filling',
    contextItems: [
      { label: 'Device', value: 'Impella CP at P8' },
      { label: 'Change', value: 'Preload falls abruptly' },
      { label: 'Alarm', value: 'Suction/low-flow pattern appears' },
      { label: 'Variant', value: 'Underfilling rather than isolated purge failure' },
    ],
    setupDevice: 'impella',
    setupActions: [
      {
        type: 'SET_IMPELLA_CONTROL',
        side: 'left',
        control: 'performanceLevel',
        value: 8,
      },
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 55 },
    ],
    requiredActionIds: ['impella:left:set-level'],
    requiredActionLabel:
      'Temporarily reduce the left-pump performance level while evaluating and correcting the cause of underfilling.',
    item: item({
      id: 'mcs-impella-suction-transfer-1',
      activityId: 'mcs:learn:impella-suction-purge-rv',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-impella-acute-underfilling',
      visualAssetIds: ['mcs-monitor', 'mcs-impella-controls'],
      transferVariantId: 'mcs-impella-acute-preload-loss',
      stem: 'At high support, preload falls and a suction pattern appears with lower effective flow. What is the safest immediate simulated response?',
      choices: [
        {
          id: 'reduce-and-diagnose',
          label:
            'Reduce support temporarily, reassess preload, RV delivery, and position, and address the cause before re-escalating',
          rationale:
            'This limits ongoing suction while preserving a structured patient–position–device evaluation.',
          plausibility: 'best',
        },
        {
          id: 'increase-through-suction',
          label: 'Increase the performance level because the displayed flow is low',
          rationale: 'Escalating through active suction can worsen underfilling and blood trauma.',
          plausibility: 'unsafe',
        },
        {
          id: 'purge-only',
          label: 'Treat every low-flow pattern as a purge-system problem',
          rationale: 'Purge abnormalities are distinct from preload- or position-limited suction.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['reduce-and-diagnose'],
      explanation:
        'The transfer deliberately creates underfilling at high support. The learner must make a real pump-level adjustment and identify the loading mechanism.',
      evidenceIds: impellaEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'lvad-parameters-assessment',
    title: 'Transfer afterload: low estimated flow with hypertension',
    contextItems: [
      { label: 'Device', value: 'Durable continuous-flow LVAD at unchanged speed' },
      { label: 'Change', value: 'SVR rises markedly' },
      { label: 'Display', value: 'Estimated flow falls; power does not surge' },
      { label: 'Variant', value: 'Afterload sensitivity without a controller fault' },
    ],
    setupDevice: 'lvad',
    setupActions: [
      {
        type: 'SET_PATIENT_CONTROL',
        control: 'systemicVascularResistanceDynSecCm5',
        value: 1_950,
      },
    ],
    requiredActionIds: ['inspect:device'],
    requiredActionLabel:
      'Inspect controller parameters together with MAP, filling pressures, aortic-valve opening, and effective flow.',
    item: item({
      id: 'mcs-lvad-afterload-transfer-1',
      activityId: 'mcs:learn:lvad-parameters-assessment',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-lvad-hypertension',
      visualAssetIds: ['mcs-monitor', 'mcs-lvad-controls'],
      transferVariantId: 'mcs-lvad-fixed-speed-high-afterload',
      stem: 'At unchanged LVAD speed, MAP and SVR rise while estimated flow falls. What is the best interpretation?',
      choices: [
        {
          id: 'afterload-sensitive-assessment',
          label:
            'Treat the controller value as an afterload-sensitive estimate and assess the patient, pressures, power, pulsatility, and filling together',
          rationale:
            'Continuous-flow output depends on the pressure gradient and cannot be interpreted from estimated flow alone.',
          plausibility: 'best',
        },
        {
          id: 'speed-first',
          label:
            'Increase speed before evaluating blood pressure, filling, or device-team authorization',
          rationale:
            'Reflexive speed changes can worsen suction, septal shift, RV failure, or aortic-valve closure.',
          plausibility: 'unsafe',
        },
        {
          id: 'flow-is-measured-output',
          label: 'Assume the displayed flow is a direct measurement of total cardiac output',
          rationale:
            'Controller flow is an estimate and does not independently capture native output or systemic perfusion.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['afterload-sensitive-assessment'],
      explanation:
        'The new loading condition changes estimated flow without changing speed. The interpretation must remain patient- and hemodynamics-centered.',
      evidenceIds: lvadEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'lvad-alarms-emergencies',
    title: 'Transfer emergency: high power with worsening perfusion',
    contextItems: [
      { label: 'Device', value: 'Durable continuous-flow LVAD' },
      { label: 'Change', value: 'Power rises while effective flow and perfusion worsen' },
      { label: 'Concern', value: 'Pump thrombosis or flow obstruction pattern' },
      { label: 'Boundary', value: 'Urgent MCS-team and bedside evaluation required' },
    ],
    setupDevice: 'lvad',
    setupActions: [{ type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true }],
    requiredActionIds: ['team:escalate'],
    requiredActionLabel:
      'Escalate urgently to the MCS team while preserving power and reassessing the patient and circuit.',
    item: item({
      id: 'mcs-lvad-emergency-transfer-1',
      activityId: 'mcs:learn:lvad-alarms-emergencies',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-lvad-high-power-low-flow',
      visualAssetIds: ['mcs-monitor', 'mcs-lvad-controls'],
      transferVariantId: 'mcs-lvad-high-power-perfusion-decline',
      stem: 'LVAD power rises while effective flow and perfusion worsen. Which response best respects the emergency and device boundary?',
      choices: [
        {
          id: 'preserve-power-escalate',
          label:
            'Preserve verified power, reassess the patient and circuit, obtain focused imaging as available, and escalate urgently to the MCS team',
          rationale:
            'High power with worsening perfusion may indicate a time-critical pump or flow-path problem that requires specialist evaluation.',
          plausibility: 'best',
        },
        {
          id: 'disconnect-power',
          label: 'Disconnect power to see whether the alarm clears',
          rationale:
            'Stopping a continuous-flow pump can cause immediate hemodynamic collapse and retrograde flow.',
          plausibility: 'unsafe',
        },
        {
          id: 'controller-only',
          label: 'Treat the controller display as sufficient and defer examination or imaging',
          rationale:
            'The bedside patient, flow path, power sources, controller trend, and focused imaging must be reconciled.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['preserve-power-escalate'],
      explanation:
        'The transfer separates a high-power emergency from ordinary low-flow loading changes and requires a real escalation action.',
      evidenceIds: lvadEvidence,
      reviewStatus: 'sme-review',
    }),
  },
] as const

export const mcsLessonTransferByLessonId = new Map(
  mcsLessonTransfers.map((transfer) => [transfer.lessonId, transfer]),
)
