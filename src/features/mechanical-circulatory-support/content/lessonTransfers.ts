import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import type { McsObservedSignal } from './sectionLearningContracts'
import { MCS_NUMBERS } from './teachingNumbers'
import type { McsAction, McsDeviceKind, McsSimulationState } from '../engine/types'

export interface McsLessonTransferDefinition {
  readonly lessonId: string
  readonly title: string
  readonly contextItems: readonly { readonly label: string; readonly value: string }[]
  readonly setupDevice: McsDeviceKind
  readonly setupActions: readonly McsAction[]
  readonly requiredActionIds: readonly string[]
  readonly requiredActionLabel: string
  readonly observation?: McsObservedSignal
  readonly isWorkSatisfied?: (state: McsSimulationState) => boolean
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
            'Reassess the patient and validate the pressure signal before changing any support',
          rationale:
            'A plausible MAP does not prove perfusion or signal fidelity; the patient, measurement, and support circuit must be reconciled.',
          plausibility: 'best',
        },
        {
          id: 'increase-support-first',
          label:
            'Increase the device setting immediately, because the displayed flow is lower than before',
          rationale:
            'A setting change before validating preload, afterload, position, and measurement can worsen suction or obscure the cause.',
          plausibility: 'unsafe',
        },
        {
          id: 'accept-map',
          label: 'Accept the mean pressure as proof that systemic perfusion is adequate for now',
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
      {
        label: 'Hemodynamics',
        // Measured on this model at the settled transfer state: wedge 26 mm Hg against the
        // reference patient's 20, end-diastolic volume 149 mL against 133 — and native flow
        // 4.46 L/min against the reference's 4.51. The card used to say "low native output",
        // which sent a reader looking for a number that is not there and is not the point of
        // the comparison (F14). The output is unchanged; the loading is what moved.
        value:
          'High wedge pressure and a large end-diastolic volume, at the reference patient’s output',
      },
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
    observation: {
      key: 'pcwpMmHg',
      label: 'Modeled wedge pressure',
      unit: 'mm Hg',
      digits: 0,
      level: 'pressure',
    },
    isWorkSatisfied: (state) => state.device.kind === 'impella' && state.device.left.enabled,
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
      stem: 'A patient has persistent LV distension and pulmonary congestion despite well-timed counterpulsation, at an output no better than the reference patient’s. Which comparison best tests a different support mechanism?',
      choices: [
        {
          id: 'compare-direct-lv-unloading',
          label:
            'Compare direct left-ventricular unloading while tracking wedge, volume, and effective flow',
          rationale:
            'This tests a distinct mechanism and preserves the need to reconcile loading and total effective flow.',
          plausibility: 'best',
        },
        {
          id: 'sum-device-native',
          label:
            'Add native output measured before support to the current pump estimate and label that sum measured cardiac output',
          rationale:
            'Native output before support is not native output during support. Add the pump flow to the native flow measured at the same time.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'ignore-rv',
          label:
            'Choose the device reporting the highest flow, without assessing right-sided delivery',
          rationale:
            'Left-sided support remains preload dependent and can expose or worsen RV-limited delivery.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['compare-direct-lv-unloading'],
      explanation:
        'The transfer asks whether a different mechanism addresses the dominant LV loading problem, not which displayed number is largest.',
      evidenceIds: bedsideEvidence,
      reviewStatus: 'draft',
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
    observation: {
      key: 'timingQualityPercent',
      label: 'Modeled timing synchrony',
      unit: '%',
      digits: 0,
      level: 'model-index',
    },
    // The predicate used to require leaving ECG triggering, which rewarded this model's own rating of
    // triggers in atrial fibrillation — a rating the supplied Cardiosave material contradicts
    // (MCS-03-05). It keeps only the genuine prerequisite, a running balloon: the exercise is a
    // comparison on the trace, whichever trigger it ends on.
    isWorkSatisfied: (state) => state.device.kind === 'iabp' && state.device.running,
    requiredActionIds: ['iabp:set-trigger'],
    requiredActionLabel:
      'Try the trigger sources and read each assisted beat on the arterial waveform. Do not choose from the synchrony figure: in atrial fibrillation the simulator rates pressure triggering above ECG triggering, which the supplied Cardiosave operating instructions do not support.',
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
          label: 'Select the most reliable trigger available and verify the timing on the trace',
          rationale:
            'Trigger choice is only useful when the resulting timing remains physiologically aligned across variable cycles.',
          plausibility: 'best',
        },
        {
          id: 'assume-ecg',
          label:
            'Keep ECG triggering, because an electrical signal stays reliable when the pressure trace does not',
          rationale:
            'The supplied Cardiosave material recommends ECG triggering for arrhythmias when the R wave is reliable and advises against pressure triggering in a sustained irregular rhythm, so keeping ECG is where that console family starts. What this leaves out is the check: no trigger is reliable by category, and the timing still has to be read beat by beat on the arterial trace.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'increase-ratio',
          label:
            'Increase the assist frequency without checking the trigger or the waveform timing',
          rationale:
            'More assisted beats do not resolve mistiming and can reproduce the error more often.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['compare-trigger-to-waveform'],
      explanation:
        'The transfer introduces an irregular rhythm. Judge a trigger by whether inflation and deflation still land in the right places on the arterial trace, beat by beat. The simulator’s synchrony figure does not settle that: in atrial fibrillation it rates pressure triggering above ECG triggering, which the supplied Cardiosave material advises against, and the simulator has no R-wave quality and no console arrhythmia handling. Check the trace and the console’s instructions.',
      evidenceIds: [
        ...iabpEvidence,
        'getinge-cardiosave-hybrid-operating-instructions',
        'getinge-cardiosave-troubleshooting-strategies',
      ],
      reviewStatus: 'draft',
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
      'Call the shock team once you have recognized that the balloon is not the limit.',
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
          label: 'Recognize right-limited delivery and escalate the support strategy',
          rationale:
            'IABP depends on native ejection and does not replace failing RV-to-pulmonary delivery.',
          plausibility: 'best',
        },
        {
          id: 'retime-normal',
          label:
            'Continue changing inflation timing even though the waveform timing is already acceptable',
          rationale:
            'Technical timing changes do not resolve a support-mechanism mismatch, and adjusting a device that is already aligned is the misreading this section exists to name.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'accept-map-only',
          label: 'Defer escalation while the mean pressure stays above a single numeric threshold',
          rationale: 'Pressure alone does not tell you flow or end-organ perfusion.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['recognize-ceiling-escalate'],
      explanation:
        'The new condition is RV-limited rather than a timing fault. Completion requires an actual escalation action after interpreting the transfer case.',
      evidenceIds: iabpEvidence,
      reviewStatus: 'draft',
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
            'Reconcile afterload, preload, position, and native output before touching the level',
          rationale:
            'A higher outflow pressure can reduce microaxial pump flow despite an unchanged performance setting.',
          plausibility: 'best',
        },
        {
          id: 'setting-equals-flow',
          label:
            'The performance level sets the patient flow, so the display should not have moved',
          rationale:
            'Performance level is a setting, not a loading-independent guarantee of effective patient flow.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'advance-blindly',
          label:
            'Increase the performance level without checking loading, position, or perfusion first',
          rationale:
            'Escalating without diagnosing the pressure-flow change can create suction or other harm.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['pressure-gradient-dependent'],
      explanation:
        'The P-level is unchanged and afterload has risen, so the fall in flow is a pressure-flow effect, not a setting.',
      evidenceIds: ['impella-cp-ifu-rev-v-supplied', ...impellaEvidence],
      reviewStatus: 'draft',
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
            'Reduce support temporarily, reassess filling and position, and address the cause first',
          rationale:
            'The supplied Impella CP instructions for use give this order for a suction alarm: reduce the performance level by one or two levels, make sure the patient has adequate volume, check the pump position with imaging, and evaluate right ventricular function, then return slowly to the previous level once suction has resolved.',
          plausibility: 'best',
        },
        {
          id: 'increase-through-suction',
          label:
            'Increase the performance level, because the displayed flow is the number that is low',
          rationale: 'Escalating through active suction can worsen underfilling and blood trauma.',
          plausibility: 'unsafe',
        },
        {
          id: 'purge-only',
          label:
            'Treat this low-flow pattern as a purge-system problem before looking at filling or position',
          rationale: 'Purge abnormalities are distinct from preload- or position-limited suction.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['reduce-and-diagnose'],
      explanation:
        'The transfer creates underfilling at high support. Here a one- or two-level reduction leaves the suction pattern in place while effective flow and mean pressure fall, and restoring filling clears it. Lowering the level is the first step, not the whole response: give volume if the patient is underfilled, check position with echo and assess the right ventricle before you return to the previous level.',
      evidenceIds: impellaEvidence,
      reviewStatus: 'draft',
    }),
  },
  {
    lessonId: 'lvad-parameters-assessment',
    title: 'Transfer afterload: low flow with hypertension',
    contextItems: [
      { label: 'Device', value: 'Durable continuous-flow LVAD at unchanged speed' },
      { label: 'Change', value: 'SVR rises markedly' },
      { label: 'Display', value: 'Modeled flow falls; power does not surge' },
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
      stem: 'At unchanged LVAD speed, MAP and SVR rise while displayed flow falls. What is the best interpretation?',
      choices: [
        {
          id: 'afterload-sensitive-assessment',
          label:
            'Afterload is limiting pump flow: lower the blood pressure toward the goal, and do not raise the speed',
          rationale:
            'A continuous-flow pump is afterload-sensitive. Low flow with a high mean pressure and a high pulsatility index is afterload, and flow returns as the pressure comes down.',
          plausibility: 'best',
        },
        {
          id: 'speed-first',
          label: 'Increase the speed before evaluating blood pressure and filling',
          rationale:
            'Reflexive speed changes can worsen suction, septal shift, RV failure, or aortic-valve closure.',
          plausibility: 'unsafe',
        },
        {
          id: 'flow-is-measured-output',
          label:
            'Assume the displayed flow is a direct measurement of the patient’s total cardiac output',
          rationale:
            'Displayed flow is the pump’s flow alone. It does not include native output, and it does not tell you perfusion.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['afterload-sensitive-assessment'],
      explanation: `Higher afterload lowers pump flow at an unchanged speed, and the pulsatility index rises. Lower mean arterial pressure to ${MCS_NUMBERS.value('lvad-map-goal')} with afterload reduction; do not raise the speed.`,
      evidenceIds: lvadEvidence,
      reviewStatus: 'sme-review',
    }),
  },
  {
    lessonId: 'lvad-alarms-emergencies',
    // MCS-03-08: the setup switches on only the high-power pattern, which in this model raises power
    // without moving modeled flow. The context and stem used to say effective flow and perfusion
    // worsen, which the patient on screen does not show.
    title: 'Transfer emergency: high power and a patient who is worse',
    contextItems: [
      { label: 'Device', value: 'Durable continuous-flow LVAD' },
      {
        label: 'Change',
        value: 'Power rises and the displayed flow rises with it; the pulsatility index falls',
      },
      {
        label: 'Concern',
        value: 'Suspected pump thrombosis',
      },
      { label: 'Patient', value: 'Lower mean pressure and falling perfusion' },
    ],
    setupDevice: 'lvad',
    setupActions: [{ type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true }],
    requiredActionIds: ['team:escalate'],
    requiredActionLabel:
      'Call the LVAD team and surgeon while you keep power connected and start the first moves.',
    item: item({
      id: 'mcs-lvad-emergency-transfer-1',
      activityId: 'mcs:learn:lvad-alarms-emergencies',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-lvad-high-power-low-flow',
      visualAssetIds: ['mcs-monitor', 'mcs-lvad-controls'],
      transferVariantId: 'mcs-lvad-high-power-perfusion-decline',
      stem: 'At an unchanged speed, LVAD power rises and a high-power alarm appears. The displayed flow rises with it, the pulsatility index falls, and the mean pressure is lower. What do you do first?',
      choices: [
        {
          id: 'preserve-power-escalate',
          label:
            'Keep power connected, send LDH and plasma free hemoglobin, check the anticoagulation, get an echo, and call the LVAD team and surgeon',
          rationale:
            'Power up with displayed flow up, pulsatility index down and a worse patient is suspected pump thrombosis. The displayed flow is calculated from power, so it reads falsely high.',
          plausibility: 'best',
        },
        {
          id: 'disconnect-power',
          label: 'Disconnect the power briefly to see whether the alarm clears, then reconnect it',
          rationale:
            'Stopping a continuous-flow pump can cause immediate hemodynamic collapse and backflow through the pump.',
          plausibility: 'unsafe',
        },
        {
          id: 'controller-only',
          label: 'Read the higher displayed flow as better support and keep observing',
          rationale:
            'The displayed flow is calculated from power. Thrombus raises power, so the display rises while the real flow falls. Waiting is the delay that does the harm.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['preserve-power-escalate'],
      explanation:
        'A loading change moves power and displayed flow in the same direction as the patient. Here power and displayed flow are up while the pulsatility index, the mean pressure and the patient are down: suspected pump thrombosis. Keep power connected, send LDH and plasma free hemoglobin, check the anticoagulation, get an echo, and call the LVAD team and surgeon.',
      evidenceIds: lvadEvidence,
      reviewStatus: 'draft',
    }),
  },
  {
    lessonId: 'mcs-device-selection-integration',
    title: 'Transfer selection: the same low output, a different limiting problem',
    contextItems: [
      { label: 'Phenotype', value: 'Low output with a rising RAP and a falling PAPi' },
      { label: 'Filling', value: 'RAP has risen to about the wedge pressure; both are elevated' },
      { label: 'Current support', value: 'Left-sided support is being considered' },
      { label: 'Variant', value: 'RV delivery is the limiting problem, not LV filling pressure' },
    ],
    setupDevice: 'impella',
    setupActions: [
      { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.32 },
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 85 },
    ],
    requiredActionIds: ['inspect:preload', 'inspect:device'],
    requiredActionLabel:
      'Inspect right-sided filling and the device/effective flow relationship before committing to a device.',
    item: item({
      id: 'mcs-device-selection-integration-transfer-1',
      activityId: 'mcs:learn:mcs-device-selection-integration',
      phase: 'transfer',
      itemType: 'transfer-case',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-transfer-rv-limited-selection',
      visualAssetIds: ['mcs-monitor', 'mcs-anatomy'],
      transferVariantId: 'mcs-rv-limited-device-selection',
      stem: 'Output is low, RAP is rising to meet an already elevated PCWP, and PAPi is falling. Which reasoning best selects the next mechanism?',
      choices: [
        {
          id: 'name-rv-limitation-first',
          label: 'Name right-sided delivery as the limit and evaluate right-sided support',
          rationale:
            'A right atrial pressure climbing to meet the wedge pressure, with a falling PAPi, places the limitation upstream of the left heart rather than at LV unloading — not because the wedge pressure is low, but because relieving the left ventricle does not answer a delivery problem. Adding left-sided support to an RV-limited circulation raises effective systemic flow only a little and leaves the suction pattern in place.',
          plausibility: 'best',
        },
        {
          id: 'escalate-left-support',
          label:
            'Escalate left-sided support further, since the output is still low on the current level',
          rationale:
            'Escalating LV unloading against an underfilled left heart increases suction risk and does not address the delivery problem upstream of it.',
          plausibility: 'unsafe',
        },
        {
          id: 'add-counterpulsation',
          label: 'Add counterpulsation to improve coronary and systemic loading on top of the pump',
          rationale:
            'Counterpulsation modifies loading around a native beat; it does not address delivery of volume to the left heart, which is what this profile identifies.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'wait-for-lactate',
          label: 'Continue the current support and re-evaluate after the next lactate result',
          rationale:
            'Trending perfusion markers is reasonable and belongs in the plan, but on its own it defers a selection the hemodynamic profile is already discriminating.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['name-rv-limitation-first'],
      explanation:
        'The transfer keeps the presenting number — low output — and moves the limiting problem upstream. Device selection follows the limiting problem; it is not a ranking of devices by flow. Here the right heart is the limit: treat it (an inotrope, a pulmonary vasodilator, right-sided support) instead of raising the left pump.',
      evidenceIds: [...bedsideEvidence, 'ishlt-durable-mcs-2023'],
      // MCS-03-07: the best option said left-sided escalation adds no effective flow here; the model
      // adds a little and the suction pattern stays. Reworded, so draft until a reviewer reads it.
      reviewStatus: 'draft',
    }),
  },
] as const

export const mcsLessonTransferByLessonId = new Map(
  mcsLessonTransfers.map((transfer) => [transfer.lessonId, transfer]),
)
