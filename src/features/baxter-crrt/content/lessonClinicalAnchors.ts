import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import type { BaxterCrrtLearnLessonId } from './learnerRegistry'

export interface BaxterCrrtLessonClinicalAnchor {
  readonly title: string
  readonly contextItems: readonly {
    readonly label: string
    readonly value: string
  }[]
  readonly immediateGoal: string
  readonly applicationItem: ClinicalLearningItem
  readonly labEvidenceLabel?: string
}

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const principlesEvidence = [
  'TEXT-CRRT-NEYRA-2026',
  'REVIEW-CRRT-PRINCIPLES-2021',
  'REVIEW-CKRT-CORE-2025',
]

export const baxterCrrtLessonClinicalAnchors: Readonly<
  Record<BaxterCrrtLearnLessonId, BaxterCrrtLessonClinicalAnchor>
> = {
  'crrt-indications-modality': {
    title: 'Septic shock with oliguric AKI',
    contextItems: [
      { label: 'Patient', value: '72 kg adult · septic shock' },
      { label: 'Kidney problem', value: 'Oliguria with worsening acid–base and volume control' },
      { label: 'Constraint', value: 'Vasopressor-dependent hemodynamic instability' },
      { label: 'Decision', value: 'Define the treatment goal before choosing a modality' },
    ],
    immediateGoal:
      'State the solute, acid–base, and volume goals—and the physiologic constraints—before selecting a CRRT modality.',
    applicationItem: item({
      id: 'crrt-indications-application-1',
      activityId: 'crrt:learn:crrt-indications-modality',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'patient',
      clinicalContextId: 'crrt-anchor-septic-aki',
      stem: 'The patient has pulmonary edema, oliguria, worsening acidosis, and escalating vasopressor support. What is the best first step in framing kidney support?',
      choices: [
        {
          id: 'define-goals-and-constraints',
          label:
            'Define the patient-specific solute, acid–base, and volume goals and name the hemodynamic constraint',
          rationale:
            'This makes the indication and tolerance problem explicit before modality and prescription decisions.',
          plausibility: 'best',
        },
        {
          id: 'choose-combined-modality',
          label:
            'Choose the modality with the most transport mechanisms because it is most complete',
          rationale:
            'More transport mechanisms do not make one modality universally preferable; the modality should serve the stated goals.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'wait-for-creatinine-cutoff',
          label: 'Wait for a single creatinine threshold before defining a treatment goal',
          rationale:
            'The decision uses the whole clinical condition and urgent solute, acid–base, and volume problems rather than one isolated value.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['define-goals-and-constraints'],
      explanation:
        'CRRT is a delivery strategy, not the treatment goal. Begin with the patient problem and tolerance constraint, then choose modality, flows, monitoring, and reassessment that serve those goals.',
      evidenceIds: [...principlesEvidence, 'GUID-RRT-ICU-2026', 'GUID-NICE-NG148-2024'],
      reviewStatus: 'sme-review',
    }),
  },
  'crrt-solute-transport': {
    title: 'Small-solute control during continuous therapy',
    contextItems: [
      { label: 'Patient', value: '68 kg adult · severe AKI' },
      { label: 'Solute issue', value: 'Potassium and acid–base control remain inadequate' },
      {
        label: 'Change under review',
        value: 'Dialysate flow increased; replacement flow unchanged',
      },
      { label: 'Question', value: 'Which transport mechanism changed?' },
    ],
    immediateGoal:
      'Connect the changed flow to diffusion, convection, ultrafiltration, or adsorption before predicting the response.',
    applicationItem: item({
      id: 'crrt-transport-application-1',
      activityId: 'crrt:learn:crrt-solute-transport',
      phase: 'predict',
      itemType: 'mechanism-interpretation',
      contextRequirement: 'patient',
      clinicalContextId: 'crrt-anchor-solute-transport',
      stem: 'Dialysate flow is increased while blood and replacement flows are unchanged. Which mechanism is being increased most directly for small-solute removal?',
      choices: [
        {
          id: 'diffusion',
          label: 'Diffusion across the membrane down a concentration gradient',
          rationale:
            'Dialysate flow directly supports diffusive transport of small solutes when other flows are held constant.',
          plausibility: 'best',
        },
        {
          id: 'convection',
          label: 'Convection from increased replacement-supported ultrafiltration',
          rationale:
            'Replacement and ultrafiltration flows were not the changed terms in this comparison.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'patient-fluid-removal',
          label: 'Whole-patient fluid removal without a change in solute transport',
          rationale:
            'Dialysate flow is a transport term and is distinct from the patient fluid-removal goal.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['diffusion'],
      explanation:
        'Diffusion, convection, ultrafiltration, and adsorption can coexist, but each flow change should be tied to the mechanism it alters most directly.',
      evidenceIds: [...principlesEvidence, 'SYNTH-LAB-TRANSPORT-001'],
      reviewStatus: 'sme-review',
    }),
  },
  'crrt-prescription-dosing': {
    title: 'Prescription interrupted by access downtime',
    contextItems: [
      { label: 'Patient', value: '80 kg adult · fluid-overloaded AKI' },
      { label: 'Displayed prescription', value: '2,000 mL/h total effluent · 25 mL/kg/h' },
      { label: 'Interruption', value: '3 hours of access-related downtime' },
      {
        label: 'Fluid goal',
        value: 'Machine removal must remain separate from whole-patient balance',
      },
    ],
    immediateGoal:
      'Reconcile prescription, actual delivery, downtime, and the whole-patient fluid ledger over the same interval.',
    labEvidenceLabel: 'Change a prescription input, then inspect the updated calculation outputs.',
    applicationItem: item({
      id: 'crrt-prescription-application-1',
      activityId: 'crrt:learn:crrt-prescription-dosing',
      phase: 'predict',
      itemType: 'reassessment',
      contextRequirement: 'patient',
      clinicalContextId: 'crrt-anchor-dose-downtime',
      stem: 'After three hours of downtime, the console again displays the prescribed effluent dose. Which review best determines what therapy the patient actually received?',
      choices: [
        {
          id: 'reconcile-delivery',
          label:
            'Reconcile elapsed treatment time and downtime with actual effluent delivery, then review machine removal within the whole-patient fluid ledger',
          rationale:
            'Delivered therapy depends on treatment time and interruptions, while machine removal is only one term in patient balance.',
          plausibility: 'best',
        },
        {
          id: 'accept-display',
          label:
            'Use the current prescribed-dose display as proof of delivery for the full interval',
          rationale:
            'A prescription display does not account for the time therapy was interrupted.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'pfr-is-balance',
          label: 'Treat the machine patient-fluid-removal setting as the whole-patient balance',
          rationale:
            'External inputs, non-machine outputs, interruptions, and variance remain outside that single machine term.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['reconcile-delivery'],
      explanation:
        'Prescription and delivery are separate ledgers. Dose review must include downtime, and fluid review must keep machine removal distinct from whole-patient balance.',
      evidenceIds: [
        ...principlesEvidence,
        'MATH-PM-001',
        'DOSE-PM-001',
        'FLUID-PM-002',
        'SYNTH-LAB-PRESCRIPTION-001',
      ],
      reviewStatus: 'sme-review',
    }),
  },
  'crrt-circuit-pressures': {
    title: 'Abrupt access-pressure change',
    contextItems: [
      { label: 'Patient', value: 'CRRT running after a position change' },
      {
        label: 'Signal',
        value: 'Access pressure becomes more negative with intermittent blood flow',
      },
      { label: 'Other findings', value: 'No isolated value establishes the cause' },
      { label: 'Priority', value: 'Patient and circuit inspection before control changes' },
    ],
    immediateGoal:
      'Use pressure direction, circuit location, and direct inspection together to localize the problem.',
    labEvidenceLabel:
      'Commit a complete pressure prediction, reveal the pattern, and compare prediction with observation.',
    applicationItem: item({
      id: 'crrt-pressure-application-1',
      activityId: 'crrt:learn:crrt-circuit-pressures',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'patient',
      clinicalContextId: 'crrt-anchor-access-pressure',
      visualAssetIds: ['crrt-circuit-path', 'crrt-pressure-pattern'],
      stem: 'Access pressure becomes progressively more negative and blood flow is intermittent after the patient is repositioned. What is the best next reasoning step?',
      choices: [
        {
          id: 'inspect-access-path',
          label:
            'Assess the patient and inspect the catheter and access-line path, then compare the full pressure pattern and delivery',
          rationale:
            'The access-side signal and timing localize the first inspection without treating one number as a diagnosis.',
          plausibility: 'best',
        },
        {
          id: 'raise-flow',
          label: 'Increase blood flow immediately to overcome the negative access pressure',
          rationale:
            'Increasing flow before identifying an access restriction can intensify the pressure change and interruption.',
          plausibility: 'unsafe',
        },
        {
          id: 'filter-only',
          label: 'Assume filter clotting from the access pressure alone',
          rationale:
            'Filter burden is assessed with the filter, return, TMP, pressure-drop, and delivery trends—not an isolated access signal.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['inspect-access-path'],
      explanation:
        'Pressure signals are location dependent. Localize by circuit path, pattern, trend, timing, and direct patient/circuit inspection before changing therapy.',
      evidenceIds: [
        'DEV-PM-009',
        'DEV-PM-010',
        'MATH-PM-002',
        'REVIEW-CRRT-PRINCIPLES-2021',
        'SYNTH-LAB-PRESSURE-001',
      ],
      reviewStatus: 'sme-review',
    }),
  },
  'crrt-anticoagulation': {
    title: 'Discordant citrate-monitoring trend',
    contextItems: [
      { label: 'Therapy', value: 'Regional citrate concept under an authorized local protocol' },
      {
        label: 'Trend',
        value: 'Systemic ionized calcium falling with a changing total-calcium relationship',
      },
      { label: 'Additional signal', value: 'New acid–base discordance' },
      { label: 'Boundary', value: 'No medication quantity is taught here' },
    ],
    immediateGoal:
      'Verify the linked patient, sampling, circuit-delivery, and protocol context before escalation.',
    applicationItem: item({
      id: 'crrt-anticoagulation-application-1',
      activityId: 'crrt:learn:crrt-anticoagulation',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'patient',
      clinicalContextId: 'crrt-anchor-citrate-trend',
      stem: 'Systemic ionized calcium is falling while the total-calcium relationship and acid–base pattern are changing. What is the safest next step within this lesson’s scope?',
      choices: [
        {
          id: 'verify-linked-context',
          label:
            'Verify sample source and timing, citrate and calcium delivery, the linked trends, and escalate through the authorized local protocol',
          rationale:
            'The pattern must be confirmed across patient, circuit, delivery, and monitoring domains before protocol-directed action.',
          plausibility: 'best',
        },
        {
          id: 'single-value-dose',
          label: 'Change a medication quantity from the ionized-calcium value alone',
          rationale:
            'A single value without sampling, delivery, and protocol context is insufficient, and this lesson does not supply dosing instructions.',
          plausibility: 'unsafe',
        },
        {
          id: 'filter-pressure-only',
          label: 'Interpret the pattern only as a filter-pressure problem',
          rationale:
            'The linked calcium and acid–base findings require patient and delivery verification beyond circuit pressure.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['verify-linked-context'],
      explanation:
        'Citrate safety is a linked monitoring problem. Verify the data and delivery context, communicate the discordant pattern, and follow the authorized protocol and responsible clinical team.',
      evidenceIds: ['TEXT-CRRT-NEYRA-2026', 'REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026'],
      reviewStatus: 'sme-review',
    }),
  },
  'crrt-alarms-troubleshooting': {
    title: 'Therapy interrupted by a return-path alarm',
    contextItems: [
      { label: 'Patient', value: 'Continuous therapy with a new return-pressure alert' },
      { label: 'Device state', value: 'Therapy interrupted; alert acknowledged' },
      { label: 'Recent event', value: 'Patient and tubing were repositioned' },
      { label: 'Question', value: 'Has the cause actually resolved?' },
    ],
    immediateGoal:
      'Preserve patient safety, inspect the detected physical domain, and verify correction before continuation.',
    applicationItem: item({
      id: 'crrt-alarm-application-1',
      activityId: 'crrt:learn:crrt-alarms-troubleshooting',
      phase: 'predict',
      itemType: 'management-decision',
      contextRequirement: 'patient',
      clinicalContextId: 'crrt-anchor-return-alarm',
      stem: 'A return-pressure alert has been acknowledged after repositioning, but therapy remains interrupted. What should happen before any continuation decision?',
      choices: [
        {
          id: 'assess-inspect-verify',
          label:
            'Assess the patient, inspect the return catheter and line pathway, verify the detected condition has resolved, then reassess delivery',
          rationale:
            'Acknowledgment changes message state; it does not prove that the patient or circuit cause has resolved.',
          plausibility: 'best',
        },
        {
          id: 'resume-after-ack',
          label: 'Resume because acknowledging the alert confirms correction',
          rationale: 'Acknowledgment alone does not verify the physical pathway or patient safety.',
          plausibility: 'unsafe',
        },
        {
          id: 'change-dose-first',
          label: 'Change the effluent prescription before inspecting the return pathway',
          rationale:
            'The alert localizes the first inspection to the patient and corresponding circuit domain, not the solute-dose prescription.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['assess-inspect-verify'],
      explanation:
        'Cause-first troubleshooting separates device notification from physical resolution: assess, inspect, address the cause under current instructions and policy, then verify delivery and recurrence.',
      evidenceIds: ['DEV-PM-008', 'DEV-PM-012', 'DEV-PM-013', 'DEV-PM-014', 'GUID-RRT-ICU-2026'],
      reviewStatus: 'sme-review',
    }),
  },
  'crrt-fluid-liberation': {
    title: 'Fluid ledger before a liberation trial',
    contextItems: [
      { label: 'Machine removal', value: '100 mL/h during the review window' },
      {
        label: 'External inputs',
        value: 'Medication carriers, nutrition, and intermittent boluses',
      },
      { label: 'Other outputs', value: 'Urine and drains are changing' },
      { label: 'Transition question', value: 'Can kidney support be reduced or stopped safely?' },
    ],
    immediateGoal:
      'Reconcile the whole-patient balance and reassess the original indication before planning liberation.',
    applicationItem: item({
      id: 'crrt-fluid-application-1',
      activityId: 'crrt:learn:crrt-fluid-liberation',
      phase: 'predict',
      itemType: 'reassessment',
      contextRequirement: 'patient',
      clinicalContextId: 'crrt-anchor-fluid-liberation',
      stem: 'The machine removed 100 mL/h, but medication carriers, nutrition, boluses, urine, drains, and downtime varied. Which review best supports a liberation decision?',
      choices: [
        {
          id: 'whole-patient-and-indication',
          label:
            'Reconcile all inputs, outputs, machine removal, variance, and downtime over one interval, then reassess the original indication and patient tolerance',
          rationale:
            'Liberation depends on the patient’s fluid, solute, acid–base, hemodynamic, and native-kidney trajectory—not one machine value.',
          plausibility: 'best',
        },
        {
          id: 'machine-rate-only',
          label: 'Use the machine removal setting as the net patient balance',
          rationale:
            'The setting omits other inputs, outputs, interruptions, and unintended variance.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'urine-alone',
          label: 'Stop therapy because urine output increased during one interval',
          rationale:
            'Urine output is relevant but does not alone establish solute, acid–base, volume, or hemodynamic readiness.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['whole-patient-and-indication'],
      explanation:
        'Keep device and patient ledgers separate, then bring them together over the same time window. Liberation is a reassessed clinical transition with a monitoring and contingency plan.',
      evidenceIds: [
        'TEXT-CRRT-NEYRA-2026',
        'FLUID-PM-001',
        'FLUID-PM-002',
        'GUID-RRT-ICU-2026',
        'SYNTH-LAB-FLUID-001',
      ],
      reviewStatus: 'sme-review',
    }),
  },
}
