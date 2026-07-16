import type { AssessmentItem, StentLessonId } from '../engine/learningLabTypes'

import type { EvidenceReferenceId } from './evidenceRegistry'

export type ClinicalReviewStatus = 'draft' | 'reviewed'

export interface ClinicalLessonMetadata {
  id: StentLessonId
  step: number
  eyebrow: string
  title: string
  summary: string
  objectives: readonly string[]
  evidenceRefs: readonly EvidenceReferenceId[]
}

export interface ClinicalModuleCopy {
  title: string
  subtitle: string
  audience: string
  estimatedMinutes: number
  disclaimer: string
  evidenceLimitations: readonly string[]
  clinicalReviewStatus: ClinicalReviewStatus
  lessons: readonly ClinicalLessonMetadata[]
}

function evidenceRefs<const T extends readonly EvidenceReferenceId[]>(...ids: T): T {
  return ids
}

export const clinicalAssessmentMasteryThreshold = 5

export const clinicalAssessmentItems: readonly AssessmentItem[] = [
  {
    id: 'assessment-indication',
    stem: 'An intrinsic malignant obstruction is removed bronchoscopically. The airway remains patent, the residual wall is stable, and no important external compression is seen.',
    prompt: 'Which plan most directly addresses the current structural finding?',
    choices: [
      {
        id: 'no-stent-now',
        label:
          'Do not place a stent now; document the benefit sought, reassess the airway, and follow the disease course.',
        rationale:
          'Correct. Once the intraluminal burden is treated, the case no longer describes a residual structural job for a scaffold. Follow-up remains linked to symptoms, disease, and the overall treatment plan.',
      },
      {
        id: 'stent-after-debulking',
        label:
          'Place a stent because any debulked malignant obstruction requires ongoing scaffolding.',
        rationale:
          'Successful debulking does not by itself establish a continuing mechanical indication. The residual airway behavior and intended patient-centered benefit must be defined first.',
      },
      {
        id: 'architecture-before-indication',
        label:
          'Select an architecture family before deciding whether a structural problem remains.',
        rationale:
          'Architecture comparison comes after the indication and mechanical job are established. Starting with a device family can create treatment burden without a defined purpose.',
      },
    ],
    correctChoiceId: 'no-stent-now',
    explanation:
      'Airway stenting should answer a residual structural problem and a defined clinical goal. A stable airway after successful treatment of purely intrinsic disease supports observation and reassessment rather than automatic device placement.',
    evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
  },
  {
    id: 'assessment-architecture-fit',
    stem: 'After treatment of mixed disease, substantial external compression remains along a curved main bronchus. Both distal lobar pathways must stay patent, and later removal may matter.',
    prompt: 'Which comparison produces the most defensible architecture plan?',
    choices: [
      {
        id: 'material-shortcut',
        label: 'Choose by material category, then assume nominal dimensions establish fit.',
        rationale:
          'A material label does not describe finished geometry, coverage, anchoring, curvature response, branch relationships, tissue interface, or the consequences of later removal.',
      },
      {
        id: 'job-fit-time',
        label:
          'Compare architecture families against the residual load, curvature, landing zones, branch preservation, tissue interface, time horizon, and removal plan.',
        rationale:
          'Correct. The architecture must be judged against the defined job and the whole airway geometry while keeping secretion burden, tissue response, surveillance, and reversibility visible.',
      },
      {
        id: 'opening-only',
        label: 'Choose whichever schematic opens furthest in a straight educational scene.',
        rationale:
          'A straight schematic cannot establish curved-airway conformity, end contact, distal branch patency, removability, or clinical benefit in this case.',
      },
    ],
    correctChoiceId: 'job-fit-time',
    explanation:
      'Architecture selection is a tradeoff statement, not a material shortcut. It should connect the residual mechanical job to anatomy, fit, interface burden, expected duration, surveillance, and an exit strategy.',
    evidenceRefs: evidenceRefs('wabip-malignant-stenting-2024', 'ratnovsky-airway-mechanics-2015'),
  },
  {
    id: 'assessment-granulation-differential',
    stem: 'Several weeks after stenting a curved main bronchus, a patient develops recurrent cough, increasing secretions, purulent material, and focal tissue near the proximal device end.',
    prompt: 'Which interpretation should organize the reassessment?',
    choices: [
      {
        id: 'granulation-only',
        label:
          'Treat the visible tissue as an isolated granulation problem and stop the evaluation there.',
        rationale:
          'Visible tissue does not exclude retained mucus, infection, tumor, migration, malposition, or structural failure, and an isolated treatment may leave important drivers unchanged.',
      },
      {
        id: 'single-mechanical-cause',
        label:
          'Attribute the finding to one mechanical variable without reviewing secretions or biology.',
        rationale:
          'Granulation is a multifactorial wound-healing and foreign-body response. Fit and motion may interact with infection, secretion burden, dwell time, disease, and host biology.',
      },
      {
        id: 'multifactorial-differential',
        label:
          'Evaluate granulation alongside mucus, infection, recurrent disease, migration, malposition, and structural failure, then reassess fit and ongoing indication.',
        rationale:
          'Correct. The pattern supports a broad differential and a response that restores patency while addressing infectious, secretory, mechanical, disease-related, and time-dependent contributors.',
      },
    ],
    correctChoiceId: 'multifactorial-differential',
    explanation:
      'Granulation should be taught as a plausible multifactorial pathway rather than a single-cause prediction. The clinical response includes restoring patency, evaluating infection and secretions, and revisiting fit, position, architecture, and ongoing need.',
    evidenceRefs: evidenceRefs(
      'ost-infection-granulation-2012',
      'hu-granulation-diameter-2011',
      'gupta-granulation-review-2025',
    ),
  },
  {
    id: 'assessment-surveillance-exit',
    stem: 'A benign complex stenosis is being considered for temporary support after definitive options and the purpose of a trial have been reviewed. Later removal is an explicit goal.',
    prompt: 'What belongs in the initial plan before a device is selected?',
    choices: [
      {
        id: 'surveillance-later',
        label: 'Defer surveillance and removal planning until symptoms recur.',
        rationale:
          'Waiting for recurrence disconnects follow-up from the intended trial, expected failure modes, tissue incorporation, and the point at which the original indication may have changed.',
      },
      {
        id: 'patency-only',
        label:
          'Define technical patency as the only endpoint and leave the time horizon open-ended.',
        rationale:
          'Patency alone does not capture the intended clinical benefit, complications, changing interface, or when continued device burden may outweigh the original purpose.',
      },
      {
        id: 'surveillance-exit-upfront',
        label:
          'Define the trial question, expected duration, recognition triggers, reassessment method, removal feasibility, and criteria for exchange, removal, or another strategy.',
        rationale:
          'Correct. Surveillance and exit planning are part of the initial prescription and should reflect the indication, architecture, expected tissue interface, and uncertainty over time.',
      },
    ],
    correctChoiceId: 'surveillance-exit-upfront',
    explanation:
      'A temporary strategy needs a defined clinical question and an exit path from the start. Follow-up timing and actions remain context dependent; this framework does not impose one schedule or management rule across benign conditions.',
    evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
  },
  {
    id: 'assessment-y-fit',
    stem: 'A bifurcated architecture appears secure at the main carina, but one bronchial limb is too long, follows the wrong branch angle, and threatens a distal orifice.',
    prompt: 'Which fit model should guide reassessment?',
    choices: [
      {
        id: 'saddle-only',
        label: 'Treat stable contact at the carinal saddle as sufficient evidence of fit.',
        rationale:
          'Junctional fixation does not correct a mismatched limb, threatened distal ventilation, focal tissue contact, or secretion trapping elsewhere in the coupled geometry.',
      },
      {
        id: 'whole-y-geometry',
        label:
          'Assess the tracheal segment, both limb diameters and lengths, branch angles, saddle relationship, landing zones, and distal patency together.',
        rationale:
          'Correct. A bifurcated architecture is one coupled fit problem; each limb and the junction can affect tissue contact, branch preservation, fixation, and secretion clearance.',
      },
      {
        id: 'straight-tube-model',
        label: 'Reduce the decision to a straight-tube length comparison.',
        rationale:
          'A straight-tube model omits the branch angles, limb interactions, carinal relationship, and distal pathways that define the clinical fit problem.',
      },
    ],
    correctChoiceId: 'whole-y-geometry',
    explanation:
      'Main-carinal support requires whole-device assessment. Apparent fixation at the junction cannot substitute for compatible limb geometry, acceptable tissue relationships, and preservation of every distal airway the plan intends to protect.',
    evidenceRefs: evidenceRefs('wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'),
  },
  {
    id: 'assessment-changing-anatomy',
    stem: 'After systemic therapy, external compression decreases. The airway caliber and device contact change, while new secretion retention and intermittent device movement are observed.',
    prompt: 'Which response addresses the new clinical state?',
    choices: [
      {
        id: 'reassess-changing-plan',
        label:
          'Reassess the ongoing indication, current anatomy, fit and position, secretion burden, expected failure modes, and the exchange or removal pathway.',
        rationale:
          'Correct. Treatment response can alter fixation and interface behavior. The plan should be rebuilt around the present anatomy and clinical purpose rather than the original deployment state.',
      },
      {
        id: 'original-plan-fixed',
        label:
          'Keep the original plan unchanged because the initial indication once supported placement.',
        rationale:
          'An initial indication does not settle later management when disease burden, airway caliber, contact, secretion clearance, and device position have changed.',
      },
      {
        id: 'movement-only',
        label: 'Address movement as an isolated device event without revisiting the clinical job.',
        rationale:
          'Migration or micromotion may signal altered anatomy or a changed indication. Treating it in isolation can miss secretion, airway, disease, and exit-strategy consequences.',
      },
    ],
    correctChoiceId: 'reassess-changing-plan',
    explanation:
      'Airway-stent planning is longitudinal. Disease response, progression, or remodeling can change contact, fixation, secretion clearance, and benefit, so surveillance must repeatedly reconnect the device to its current job and exit strategy.',
    evidenceRefs: evidenceRefs('wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'),
  },
]

export const clinicalModuleCopy: ClinicalModuleCopy = {
  title: 'Airway Stent Clinical Decision Lab: Indication, Architecture, Fit & Complications',
  subtitle:
    'Begin with a clinical problem, build a defensible stent plan, and use mechanics only when it clarifies architecture, fit, tissue interaction, or change over time.',
  audience:
    'Interventional pulmonology fellows and practicing bronchoscopists, with resident scaffolding',
  estimatedMinutes: 65,
  disclaimer:
    'This module is for professional education only. It does not provide patient-specific medical advice, force or tissue-pressure estimates, complication-risk predictions, universal sizing or management rules, procedural credentialing, or product rankings. Selection, placement, surveillance, exchange, and removal depend on patient goals, anatomy, pathology, disease trajectory, device instructions for use, multidisciplinary judgment, local resources, and operator expertise.',
  evidenceLimitations: [
    'Guideline recommendations are conditional or supported by limited-certainty evidence in several areas and remain population and context specific.',
    'Clinical observational studies can identify associations but do not prove a single causal pathway or predict an individual outcome.',
    'Bench and schematic behavior remains tied to the tested architecture, fixture, direction, boundary conditions, and endpoint.',
    'Transferred engineering evidence can explain a plausible mechanism but cannot establish airway clinical thresholds, treatment rules, or comparative outcomes.',
  ],
  clinicalReviewStatus: 'draft',
  lessons: [
    {
      id: 'indication',
      step: 1,
      eyebrow: 'Clinical Case 1 · Indication',
      title: 'Should this airway be stented?',
      summary:
        'Classify the obstruction, identify what remains after the primary intervention, and connect any proposed scaffold to a patient-centered benefit.',
      objectives: [
        'Distinguish intrinsic, extrinsic, mixed, and dynamic central-airway problems.',
        'Identify whether a residual structural problem remains after treatable intraluminal disease is addressed.',
        'Defend a no-stent decision when no ongoing mechanical job is present.',
      ],
      evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
    },
    {
      id: 'clinical-job',
      step: 2,
      eyebrow: 'Clinical Case 2 · Job Statement',
      title: 'Define the mechanical and clinical job',
      summary:
        'State what support must accomplish, which airways must remain patent, what may change, and when the strategy should end.',
      objectives: [
        'Translate obstruction morphology into one or more explicit mechanical jobs.',
        'Name target anatomy, branch-preservation constraints, landing zones, and intended duration.',
        'Write a job statement that includes surveillance and an exit consideration.',
      ],
      evidenceRefs: evidenceRefs(
        'chest-cao-guideline-2024',
        'wabip-malignant-stenting-2024',
        'wabip-benign-stenting-2025',
        'textbook-stent-placement',
      ),
    },
    {
      id: 'architecture-choice',
      step: 3,
      eyebrow: 'Clinical Case 3 · Architecture',
      title: 'Choose an architecture, not merely a material',
      summary:
        'Compare architecture families through coverage, geometry, anchoring, branch preservation, tissue interface, removability, and time horizon.',
      objectives: [
        'Compare a leading architecture family with a reasonable alternative for a defined job.',
        'Name one potential advantage, two important liabilities, and the finding that would change the plan.',
        'Keep branded examples and isolated schematic behavior out of the correct-answer logic.',
      ],
      evidenceRefs: evidenceRefs(
        'wabip-malignant-stenting-2024',
        'wabip-benign-stenting-2025',
        'ratnovsky-airway-mechanics-2015',
        'textbook-silicone-stents-2025',
        'textbook-airway-stents-primer-2025',
      ),
    },
    {
      id: 'fit-behavior',
      step: 4,
      eyebrow: 'Clinical Case 4 · Fit & Behavior',
      title: 'Plan fit across airway geometry and change',
      summary:
        'Inspect landing zones, curvature, taper, branches, bifurcations, motion, secretion pathways, and expected remodeling before accepting a fit plan.',
      objectives: [
        'Evaluate fit across the whole target anatomy rather than one diameter or a straight segment.',
        'Anticipate gapping, focal contact, branch compromise, secretion pooling, movement, and changing fixation.',
        'Use optional mechanics scenes as observation aids without treating them as clinical predictions.',
      ],
      evidenceRefs: evidenceRefs(
        'wabip-malignant-stenting-2024',
        'wabip-benign-stenting-2025',
        'ratnovsky-airway-mechanics-2015',
        'textbook-silicone-stents-2025',
        'textbook-y-stenting-2025',
      ),
    },
    {
      id: 'complications-surveillance',
      step: 5,
      eyebrow: 'Clinical Case 5 · Complications',
      title: 'When the airway worsens, identify what failed',
      summary:
        'Build a differential for recurrent symptoms or obstruction, correct the underlying drivers, and reconnect surveillance to the ongoing indication and exit plan.',
      objectives: [
        'Distinguish granulation from mucus, infection, recurrent disease, migration, malposition, and structural failure.',
        'Explain granulation through interacting mechanical, infectious-secretory, biologic, and time-dependent contributors.',
        'Construct a response that restores patency, evaluates contributors, reassesses fit and indication, and defines follow-up.',
      ],
      evidenceRefs: evidenceRefs(
        'wabip-malignant-stenting-2024',
        'wabip-benign-stenting-2025',
        'ost-infection-granulation-2012',
        'hu-granulation-diameter-2011',
        'gupta-granulation-review-2025',
        'textbook-y-stenting-2025',
        'textbook-airway-stents-primer-2025',
      ),
    },
    {
      id: 'assessment',
      step: 6,
      eyebrow: 'Integrated Assessment',
      title: 'Commit across indication, fit, complications, and time',
      summary:
        'Apply the full stent-plan model to clinical cases and review the rationale for every committed decision.',
      objectives: [
        'Apply indication, mechanical-job, architecture, fit, complication, and surveillance reasoning together.',
        'Explain why rejected options fail without relying on brands or universal rules.',
        'Demonstrate mastery while keeping scoring based on the assessment items presented.',
      ],
      evidenceRefs: evidenceRefs(
        'chest-cao-guideline-2024',
        'wabip-malignant-stenting-2024',
        'wabip-benign-stenting-2025',
        'ost-infection-granulation-2012',
        'hu-granulation-diameter-2011',
        'gupta-granulation-review-2025',
      ),
    },
  ],
}
