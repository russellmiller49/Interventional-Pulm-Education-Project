import {
  STENT_LESSON_IDS,
  type StentClinicalCase,
  type StentLessonId,
} from '../engine/learningLabTypes'
import { findMissingEvidenceRefs, type EvidenceReferenceId } from './evidenceRegistry'
import { physicsLensRegistry } from './physicsLensRegistry'

const evidenceRefs = <const T extends readonly EvidenceReferenceId[]>(...ids: T): T => ids

/**
 * Draft educational cases for the required clinical path. Architecture choices are
 * deliberately expressed as nonbranded families and remain contingent on anatomy,
 * treatment horizon, local expertise, and a documented surveillance or exit plan.
 */
export const clinicalCaseRegistry = [
  {
    id: 'post-debulking-no-stent',
    lessonId: 'indication',
    title: 'Stable airway after treatment of intrinsic obstruction',
    stem: 'A patient with symptomatic malignant central-airway obstruction undergoes successful removal of a purely intraluminal lesion. The treated segment remains patent during observation, no important external compression is seen, and the distal lung appears potentially functional. The oncology plan can now proceed.',
    findings: [
      {
        id: 'morphology',
        label: 'Obstruction pattern',
        value: 'Purely intrinsic before treatment',
        emphasis: 'important',
      },
      {
        id: 'post-treatment-wall',
        label: 'After treatment',
        value: 'Patent lumen with no demonstrated residual structural instability',
        emphasis: 'important',
      },
      {
        id: 'external-load',
        label: 'External compression',
        value: 'No important residual compression identified',
      },
      {
        id: 'distal-function',
        label: 'Downstream lung',
        value: 'Potentially functional and connected to the broader treatment plan',
      },
    ],
    decisions: [
      {
        id: 'residual-indication',
        question: 'What is the most defensible stent decision now?',
        instruction: 'Commit to the indication before considering an architecture.',
        options: [
          {
            id: 'no-stent-now',
            label: 'No stent now',
            rationale:
              'The primary intervention removed the obstruction and no residual mechanical job is demonstrated. A device would add an airway interface and surveillance burden without a defined structural target.',
            domains: ['indication', 'mechanical-job'],
          },
          {
            id: 'stent-because-severe',
            label: 'Place a stent because the original obstruction was severe',
            rationale:
              'Pre-treatment severity does not by itself establish a persistent mechanical job after successful treatment.',
            domains: ['indication'],
          },
          {
            id: 'stent-to-prevent-recurrence',
            label: 'Place a stent to prevent any future tumor recurrence',
            rationale:
              'An airway stent is not a substitute for the oncologic plan and would not eliminate the need to reassess recurrent disease.',
            domains: ['indication', 'surveillance'],
          },
        ],
        correctChoiceId: 'no-stent-now',
        evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
      },
      {
        id: 'no-device-follow-up',
        question: 'What belongs in the plan after choosing no stent?',
        options: [
          {
            id: 'monitor-and-reassess',
            label: 'Document the achieved benefit and reassess if obstruction recurs',
            rationale:
              'The plan should connect symptom response, airway patency, downstream function, and the ongoing cancer strategy without inventing a device-specific follow-up obligation.',
            domains: ['surveillance', 'indication'],
          },
          {
            id: 'device-surveillance',
            label: 'Schedule stent surveillance despite no device being present',
            rationale:
              'Follow-up should address the treated disease and clinical course; there is no stent interface to inspect.',
            domains: ['surveillance'],
          },
          {
            id: 'architecture-preselection',
            label: 'Preselect an architecture for routine placement',
            rationale:
              'Architecture selection begins only if a future assessment demonstrates a residual mechanical job.',
            domains: ['architecture', 'indication'],
          },
        ],
        correctChoiceId: 'monitor-and-reassess',
        evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
      },
    ],
    finalTakeaway:
      'A prior obstruction does not create a standing indication. After successful intrinsic-disease treatment, stenting requires a residual structural problem, an intended patient-centered benefit, and a plan congruent with downstream function and overall care.',
    evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'mixed-residual-extrinsic-compression',
    lessonId: 'indication',
    title: 'Mixed obstruction with a residual external load',
    stem: 'A left-mainstem malignant obstruction has both intraluminal and extrinsic components. Bronchoscopic treatment clears the intraluminal component, but substantial external compression persists across a curved segment. Both left-lobar pathways can be identified, the distal lung appears potentially recruitable, and tumor-directed therapy is planned.',
    findings: [
      {
        id: 'morphology',
        label: 'Obstruction pattern',
        value: 'Mixed before treatment; predominantly extrinsic afterward',
        emphasis: 'important',
      },
      {
        id: 'residual-problem',
        label: 'Residual structural problem',
        value: 'Persistent external compression of the left mainstem',
        emphasis: 'warning',
      },
      {
        id: 'geometry',
        label: 'Anatomic constraint',
        value: 'Curved target segment with two distal lobar pathways to preserve',
      },
      {
        id: 'time-horizon',
        label: 'Expected change',
        value: 'Airway geometry may change as tumor-directed therapy takes effect',
      },
    ],
    decisions: [
      {
        id: 'residual-structural-job',
        question: 'How should the residual problem change the stent decision?',
        options: [
          {
            id: 'reasonable-with-defined-benefit',
            label: 'Stenting is reasonable if the residual job and clinical benefit are explicit',
            rationale:
              'Persistent extrinsic compression remains after treatable intraluminal disease is addressed, and the distal lung and overall plan make restoration of patency potentially meaningful.',
            domains: ['indication', 'mechanical-job'],
          },
          {
            id: 'no-stent-because-debulked',
            label: 'Do not consider a stent because debulking was completed',
            rationale:
              'Debulking removed only the intrinsic component; it did not resolve the external load now defining the structural problem.',
            domains: ['indication'],
          },
          {
            id: 'choose-architecture-first',
            label: 'Choose an architecture from the visual before defining the goal',
            rationale:
              'A visible deformation or architecture label cannot substitute for the indication, benefit, distal-airway, and treatment-plan assessment.',
            domains: ['architecture', 'indication'],
          },
        ],
        correctChoiceId: 'reasonable-with-defined-benefit',
        evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
      },
      {
        id: 'left-mainstem-job-statement',
        question: 'Which job statement captures the important constraints?',
        options: [
          {
            id: 'complete-job-statement',
            label: 'Maintain left-mainstem patency while preserving both lobar pathways',
            rationale:
              'The statement links the residual external load, curved geometry, distal branch preservation, anticipated treatment response, and a feasible reassessment or exit strategy.',
            domains: ['mechanical-job', 'fit', 'surveillance'],
          },
          {
            id: 'radial-support-only',
            label: 'Provide as much radial support as possible',
            rationale:
              'This omits curvature, landing zones, distal branches, changing tumor burden, and the intended clinical benefit.',
            domains: ['mechanical-job'],
          },
          {
            id: 'cover-everything',
            label: 'Cover the longest airway segment available',
            rationale:
              'Unnecessary coverage can add branch and secretion consequences without defining the actual disease span.',
            domains: ['fit', 'complication'],
          },
        ],
        correctChoiceId: 'complete-job-statement',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ratnovsky-airway-mechanics-2015',
        ),
      },
      {
        id: 'response-aware-surveillance',
        question: 'Which follow-up principle belongs in the initial plan?',
        options: [
          {
            id: 'reassess-changing-anatomy',
            label:
              'Reassess patency, fit, symptoms, and ongoing indication as treatment changes anatomy',
            rationale:
              'Tumor response can alter compression and fixation, so surveillance and an exit strategy are part of the original prescription.',
            domains: ['surveillance', 'fit', 'indication'],
          },
          {
            id: 'ignore-until-symptoms',
            label: 'Treat placement as the endpoint unless severe symptoms return',
            rationale:
              'This misses evolving anatomy, secretion burden, position, and the possibility that the indication may resolve or change.',
            domains: ['surveillance'],
          },
          {
            id: 'permanent-by-default',
            label: 'Assume the initial device plan will remain appropriate indefinitely',
            rationale:
              'The time horizon is dynamic when tumor-directed therapy may change the target airway and landing zones.',
            domains: ['surveillance', 'fit'],
          },
        ],
        correctChoiceId: 'reassess-changing-anatomy',
        evidenceRefs: evidenceRefs('wabip-malignant-stenting-2024'),
      },
    ],
    physicsLens: physicsLensRegistry['residual-extrinsic-load'],
    finalTakeaway:
      'Stenting enters the discussion because a clinically meaningful external load remains after the intraluminal component is treated. The plan must still protect distal pathways and anticipate treatment-related change.',
    evidenceRefs: evidenceRefs(
      'chest-cao-guideline-2024',
      'wabip-malignant-stenting-2024',
      'ratnovsky-airway-mechanics-2015',
    ),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'aerodigestive-fistula-sealing',
    lessonId: 'clinical-job',
    title: 'A malignant aerodigestive fistula requiring a sealing plan',
    stem: 'A patient with thoracic malignancy has an aerodigestive fistula involving a relatively straight distal-tracheal segment. The airway is patent, but the defect creates contamination and aspiration concerns. Usable landing zones appear present before the main carina, rigid deployment is feasible, later removal may matter, and the esophageal plan is being coordinated by a multidisciplinary team.',
    findings: [
      {
        id: 'primary-job',
        label: 'Primary mechanical job',
        value: 'Create a continuous barrier across the fistula',
        emphasis: 'important',
      },
      {
        id: 'airway-patency',
        label: 'Current airway lumen',
        value: 'Patent; support against major external compression is not the primary job',
      },
      {
        id: 'geometry',
        label: 'Geometry',
        value:
          'Relatively straight distal trachea with the carina and both main bronchi to preserve',
      },
      {
        id: 'adjacent-plan',
        label: 'Adjacent-organ constraint',
        value: 'Airway and esophageal strategies must be planned together',
        emphasis: 'warning',
      },
    ],
    decisions: [
      {
        id: 'fistula-job-statement',
        question: 'Which statement defines the mechanical job?',
        options: [
          {
            id: 'seal-and-preserve',
            label:
              'Span the defect with a continuous surface while preserving the carina and distal pathways',
            rationale:
              'The plan prioritizes sealing, landing-zone apposition, branch preservation, adjacent-device interaction, and a removal or revision strategy.',
            domains: ['mechanical-job', 'fit', 'surveillance'],
          },
          {
            id: 'maximize-opening',
            label: 'Maximize airway opening regardless of surface continuity',
            rationale:
              'The airway is already patent, and an open-cell architecture would not accomplish the defined sealing job.',
            domains: ['mechanical-job', 'architecture'],
          },
          {
            id: 'treat-as-compression',
            label: 'Treat the fistula as an external-compression problem',
            rationale:
              'External support alone does not define whether the defect is covered or whether adjacent structures and branches are protected.',
            domains: ['mechanical-job'],
          },
        ],
        correctChoiceId: 'seal-and-preserve',
        evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
      },
      {
        id: 'fistula-architecture',
        question: 'Which nonbranded architecture comparison is most defensible for this vignette?',
        options: [
          {
            id: 'continuous-wall-leading',
            label:
              'Lead with removable continuous-wall silicone; retain a fully covered scaffold as an alternative',
            rationale:
              'A continuous removable wall matches the sealing and future-removal constraints when access and fit permit. A fully covered scaffold remains a reasonable alternative if delivery or geometry changes the balance.',
            domains: ['architecture', 'mechanical-job', 'surveillance'],
          },
          {
            id: 'uncovered-leading',
            label: 'Lead with an uncovered wire scaffold',
            rationale:
              'Open cells do not supply the continuous barrier required by the stated job and can add tissue-incorporation consequences.',
            domains: ['architecture', 'mechanical-job'],
          },
          {
            id: 'material-only',
            label: 'Choose by material name without comparing coverage or removal',
            rationale:
              'Material alone does not define surface continuity, landing-zone behavior, secretion burden, or the exit strategy.',
            domains: ['architecture'],
          },
        ],
        correctChoiceId: 'continuous-wall-leading',
        evidenceRefs: evidenceRefs(
          'chest-cao-guideline-2024',
          'wabip-malignant-stenting-2024',
          'wabip-benign-stenting-2025',
        ),
      },
      {
        id: 'fistula-tradeoffs',
        question: 'Which tradeoff statement should accompany that leading choice?',
        options: [
          {
            id: 'seal-with-liabilities',
            label:
              'Gain a continuous removable barrier; anticipate secretion retention, migration, and focal end contact',
            rationale:
              'The advantage addresses the job, while the liabilities identify clearance, fixation, and interface problems that require active planning.',
            domains: ['architecture', 'complication', 'surveillance'],
          },
          {
            id: 'seal-without-cost',
            label: 'Treat full coverage as a benefit without interface liabilities',
            rationale:
              'Coverage changes secretion transport and creates ends and transition zones that must be inspected.',
            domains: ['architecture', 'complication'],
          },
          {
            id: 'support-only',
            label: 'Judge success from central airway diameter alone',
            rationale:
              'A patent lumen does not establish a seal, stable landing-zone contact, carinal preservation, or absence of retained secretions.',
            domains: ['fit', 'mechanical-job'],
          },
        ],
        correctChoiceId: 'seal-with-liabilities',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ost-infection-granulation-2012',
        ),
      },
      {
        id: 'fistula-change-finding',
        question: 'Which new finding should trigger a major redesign?',
        options: [
          {
            id: 'carinal-or-adjacent-conflict',
            label:
              'Extension to the carina, inadequate landing zones, or conflict with the esophageal strategy',
            rationale:
              'Any of these findings changes coverage geometry, branch preservation, fixation, and the coordinated airway-esophageal plan.',
            domains: ['fit', 'architecture', 'surveillance'],
          },
          {
            id: 'device-color',
            label: 'A different device color is available',
            rationale:
              'A cosmetic property does not change the clinical job, anatomy, tissue interface, or exit plan.',
            domains: ['architecture'],
          },
          {
            id: 'unchanged-stable-lumen',
            label: 'The airway remains patent with unchanged anatomy',
            rationale:
              'Stable anatomy does not remove the need for surveillance, but it does not by itself invalidate the stated architecture comparison.',
            domains: ['surveillance'],
          },
        ],
        correctChoiceId: 'carinal-or-adjacent-conflict',
        evidenceRefs: evidenceRefs('chest-cao-guideline-2024'),
      },
    ],
    physicsLens: physicsLensRegistry['coverage-interface'],
    finalTakeaway:
      'A fistula changes the job from opening a lumen to creating and maintaining a seal. Surface continuity, defect coverage, landing zones, adjacent-organ coordination, secretions, and a revision or removal strategy must be considered together.',
    evidenceRefs: evidenceRefs(
      'chest-cao-guideline-2024',
      'wabip-malignant-stenting-2024',
      'ost-infection-granulation-2012',
    ),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'selected-dynamic-collapse-trial',
    lessonId: 'clinical-job',
    title: 'A defined temporary trial for selected dynamic collapse',
    stem: 'A patient with symptomatic dynamic central-airway collapse has persistent activity limitation despite evaluation and optimization of important coexisting conditions. Symptoms correlate with dynamic airway narrowing, and a multidisciplinary team is considering a temporary stent trial to answer whether stabilizing the involved segment produces meaningful benefit before another strategy is chosen.',
    findings: [
      {
        id: 'dynamic-pattern',
        label: 'Failure mode',
        value: 'Respiratory-cycle-dependent collapse rather than fixed narrowing',
        emphasis: 'important',
      },
      {
        id: 'trial-question',
        label: 'Purpose of support',
        value:
          'Test whether temporary stabilization improves a predefined patient-centered outcome',
      },
      {
        id: 'affected-segments',
        label: 'Anatomic constraint',
        value: 'Central dynamic segments with branch patency and secretion clearance to preserve',
      },
      {
        id: 'time-horizon',
        label: 'Time horizon',
        value: 'Temporary, with explicit assessment endpoints and a removal plan',
        emphasis: 'warning',
      },
    ],
    decisions: [
      {
        id: 'dynamic-trial-indication',
        question: 'When is a stent trial defensible in this scenario?',
        options: [
          {
            id: 'defined-selected-trial',
            label: 'As a selected, time-limited trial with a clear question and removal plan',
            rationale:
              'The device is being used to test a specific clinical hypothesis after broader evaluation, not as an indefinite response to a visual collapse finding.',
            domains: ['indication', 'mechanical-job', 'surveillance'],
          },
          {
            id: 'collapse-alone',
            label: 'Whenever dynamic collapse is visible',
            rationale:
              'A visual finding alone does not establish symptom causality, meaningful benefit, tolerance, or an exit strategy.',
            domains: ['indication'],
          },
          {
            id: 'indefinite-test',
            label: 'As an open-ended trial without a planned reassessment',
            rationale:
              'An undefined dwell period makes it difficult to interpret benefit and exposes the patient to accumulating interface and secretion burdens.',
            domains: ['surveillance', 'complication'],
          },
        ],
        correctChoiceId: 'defined-selected-trial',
        evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
      },
      {
        id: 'dynamic-job-statement',
        question: 'Which job statement is complete?',
        options: [
          {
            id: 'stabilize-and-test',
            label:
              'Temporarily stabilize the involved segment to test meaningful benefit while preserving branches and clearance',
            rationale:
              'The statement includes the dynamic failure mode, trial purpose, affected geometry, secretion tolerance, outcome assessment, and exit.',
            domains: ['mechanical-job', 'fit', 'surveillance'],
          },
          {
            id: 'stop-motion',
            label: 'Eliminate every visible airway-shape change',
            rationale:
              'The goal is not a motion-free airway; it is to test whether selected stabilization improves a clinically meaningful outcome.',
            domains: ['mechanical-job'],
          },
          {
            id: 'support-without-endpoint',
            label: 'Support the airway until another decision is made',
            rationale:
              'Without predefined endpoints and timing, the trial cannot cleanly answer its intended question.',
            domains: ['mechanical-job', 'surveillance'],
          },
        ],
        correctChoiceId: 'stabilize-and-test',
        evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
      },
      {
        id: 'dynamic-architecture',
        question: 'Which architecture comparison fits a temporary trial?',
        options: [
          {
            id: 'removable-leading',
            label:
              'Lead with a removable silicone family; retain a fully covered retrievable family as a conditional alternative',
            rationale:
              'Planned removal is a present-tense constraint. Geometry, deployment access, involved segments, branch preservation, secretion tolerance, and local expertise determine whether the alternative remains reasonable.',
            domains: ['architecture', 'fit', 'surveillance'],
          },
          {
            id: 'uncovered-incorporating',
            label: 'Lead with an uncovered incorporating scaffold',
            rationale:
              'Tissue incorporation conflicts with a short diagnostic trial and can make the planned exit more difficult.',
            domains: ['architecture', 'surveillance'],
          },
          {
            id: 'longest-coverage',
            label: 'Choose the longest covered device without mapping involved segments',
            rationale:
              'Excess coverage can compromise branches and add secretion burden without improving the interpretability of the trial.',
            domains: ['fit', 'complication'],
          },
        ],
        correctChoiceId: 'removable-leading',
        evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
      },
      {
        id: 'dynamic-exit',
        question: 'What should be decided before the trial begins?',
        options: [
          {
            id: 'endpoints-and-removal',
            label: 'Outcome endpoints, tolerance criteria, reassessment timing, and removal plan',
            rationale:
              'Predefined benefit and harm signals make the trial interpretable and preserve a feasible exit if symptoms do not improve or complications emerge.',
            domains: ['surveillance', 'complication', 'indication'],
          },
          {
            id: 'architecture-only',
            label: 'Only the architecture family',
            rationale:
              'Architecture choice does not define the clinical question, outcome measure, tolerance threshold, or exit.',
            domains: ['architecture'],
          },
          {
            id: 'wait-for-intolerance',
            label: 'Wait for severe intolerance before discussing removal',
            rationale: 'Removal and response criteria belong in the initial temporary-trial plan.',
            domains: ['surveillance', 'complication'],
          },
        ],
        correctChoiceId: 'endpoints-and-removal',
        evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
      },
    ],
    finalTakeaway:
      'For selected dynamic collapse, the stent is a temporary test of a clinical hypothesis. The question, affected segments, outcome endpoints, secretion tolerance, and removal plan must be explicit before placement.',
    evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'benign-complex-stenosis-removal-horizon',
    lessonId: 'architecture-choice',
    title: 'Benign complex stenosis with a removal horizon',
    stem: 'A patient has recurrent complex benign tracheal stenosis after prior endoscopic treatment. The multidisciplinary team is reassessing definitive options and considers temporary airway support as a bridge because benefit from dilation has not persisted. The airway is mildly curved, rigid access is feasible, and a later removal strategy is important.',
    findings: [
      {
        id: 'etiology',
        label: 'Disease context',
        value: 'Benign complex stenosis',
        emphasis: 'important',
      },
      {
        id: 'definitive-options',
        label: 'Definitive strategy',
        value: 'Requires multidisciplinary reassessment before temporary support is finalized',
      },
      {
        id: 'geometry',
        label: 'Target geometry',
        value: 'Mild curvature with landing zones and nearby branches to map',
      },
      {
        id: 'removal',
        label: 'Time horizon',
        value: 'Temporary support with a planned removal or transition point',
        emphasis: 'warning',
      },
    ],
    decisions: [
      {
        id: 'benign-strategy',
        question: 'What should frame the use of a stent in this benign stenosis?',
        options: [
          {
            id: 'bridge-with-exit',
            label:
              'Reassess definitive therapy and use temporary support only for a defined bridge or goal',
            rationale:
              'The ongoing indication, expected benefit, alternatives, duration, surveillance, and exit strategy should be explicit before introducing a long-term airway interface.',
            domains: ['indication', 'surveillance', 'mechanical-job'],
          },
          {
            id: 'permanent-default',
            label: 'Treat stenting as the default permanent solution',
            rationale:
              'Benign etiologies and definitive options are heterogeneous, and interface or removal burdens can increase with time.',
            domains: ['indication', 'surveillance'],
          },
          {
            id: 'architecture-before-goal',
            label: 'Choose an architecture before defining the bridge goal',
            rationale:
              'The time horizon and exit strategy are constraints on architecture choice, not details to add after placement.',
            domains: ['architecture', 'mechanical-job'],
          },
        ],
        correctChoiceId: 'bridge-with-exit',
        evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
      },
      {
        id: 'benign-architecture',
        question: 'Which architecture comparison is most defensible?',
        options: [
          {
            id: 'silicone-leading-covered-alternative',
            label:
              'Lead with removable continuous-wall silicone; retain a fully covered retrievable scaffold as an alternative',
            rationale:
              'The leading family supports a planned removal and can be customized when access permits. A fully covered alternative may remain reasonable if geometry, deployment, or local expertise changes the tradeoff.',
            domains: ['architecture', 'fit', 'surveillance'],
          },
          {
            id: 'uncovered-leading',
            label: 'Lead with an uncovered self-expanding scaffold',
            rationale:
              'Exposed cells can incorporate into tissue and conflict with the stated removal horizon.',
            domains: ['architecture', 'surveillance'],
          },
          {
            id: 'support-ranking',
            label: 'Choose whichever family appears to provide the most support in a schematic',
            rationale:
              'A schematic does not determine clinical support requirements, removability, secretion tolerance, fit, or comparative outcomes.',
            domains: ['architecture'],
          },
        ],
        correctChoiceId: 'silicone-leading-covered-alternative',
        evidenceRefs: evidenceRefs('wabip-benign-stenting-2025', 'ratnovsky-airway-mechanics-2015'),
      },
      {
        id: 'benign-tradeoffs',
        question: 'Which advantage-and-liability statement should be documented?',
        options: [
          {
            id: 'removal-with-interface-costs',
            label:
              'Advantage: planned removability; liabilities: secretion retention plus migration or focal end contact',
            rationale:
              'The continuous wall and retrieval plan address the time horizon, while mucus, fit, end contact, and granulation remain surveillance targets.',
            domains: ['architecture', 'complication', 'surveillance'],
          },
          {
            id: 'removal-erases-risk',
            label: 'Removability eliminates the need to plan for complications',
            rationale:
              'A removable architecture can still migrate, retain secretions, develop granulation, or become more difficult to retrieve over time.',
            domains: ['complication', 'surveillance'],
          },
          {
            id: 'thin-wall-only',
            label: 'Functional lumen is the only relevant tradeoff',
            rationale:
              'Lumen, fit, deployment, secretions, tissue response, and future removal must be considered together.',
            domains: ['architecture', 'fit'],
          },
        ],
        correctChoiceId: 'removal-with-interface-costs',
        evidenceRefs: evidenceRefs(
          'wabip-benign-stenting-2025',
          'ost-infection-granulation-2012',
          'gupta-granulation-review-2025',
        ),
      },
      {
        id: 'benign-change-and-exit',
        question: 'What would most strongly change the leading choice or end the bridge?',
        options: [
          {
            id: 'access-geometry-definitive-change',
            label:
              'A change in definitive-therapy eligibility, deployment access, fit, tolerance, or the planned removal horizon',
            rationale:
              'These findings alter the indication, architecture feasibility, expected dwell time, or ability to retrieve the device.',
            domains: ['indication', 'architecture', 'fit', 'surveillance'],
          },
          {
            id: 'unchanged-label',
            label: 'The architecture family keeps the same label',
            rationale:
              'A label does not show whether anatomy, symptoms, tissue response, or definitive options have changed.',
            domains: ['architecture'],
          },
          {
            id: 'calendar-alone',
            label: 'A calendar date without reassessing benefit or anatomy',
            rationale:
              'Timing matters, but removal or transition decisions must also address current benefit, fit, tissue response, and definitive plans.',
            domains: ['surveillance'],
          },
        ],
        correctChoiceId: 'access-geometry-definitive-change',
        evidenceRefs: evidenceRefs('wabip-benign-stenting-2025'),
      },
    ],
    physicsLens: physicsLensRegistry['coverage-interface'],
    finalTakeaway:
      'In benign complex stenosis, future removal is a present-tense architecture constraint. Temporary support should remain linked to definitive options, fit, secretion and tissue-interface burdens, surveillance, and a documented exit.',
    evidenceRefs: evidenceRefs(
      'wabip-benign-stenting-2025',
      'ost-infection-granulation-2012',
      'gupta-granulation-review-2025',
    ),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'main-carinal-whole-y-fit',
    lessonId: 'fit-behavior',
    title: 'Main-carinal disease and whole-Y fit',
    stem: 'Malignant disease spans the distal trachea and main carina after endobronchial treatment, leaving structural compromise that involves both main bronchi. Both lungs appear potentially functional. The right and left branch angles differ, and the intended landing zones must avoid crowding distal lobar orifices.',
    findings: [
      {
        id: 'disease-span',
        label: 'Disease span',
        value: 'Distal trachea, carina, and proximal portions of both main bronchi',
        emphasis: 'important',
      },
      {
        id: 'distal-function',
        label: 'Distal pathways',
        value: 'Both main-bronchial pathways lead to potentially functional lung',
      },
      {
        id: 'branch-geometry',
        label: 'Branch geometry',
        value: 'Asymmetric branch angles and different usable limb lengths',
        emphasis: 'warning',
      },
      {
        id: 'clearance',
        label: 'Clearance constraint',
        value: 'Carinal saddle and three limb ends may affect contact and secretion flow',
      },
    ],
    decisions: [
      {
        id: 'whole-y-job',
        question: 'What is the mechanical and anatomic job?',
        options: [
          {
            id: 'coupled-bifurcation-job',
            label: 'Support the distal trachea and both main bronchi as one coupled bifurcation',
            rationale:
              'The carinal saddle, branch angles, limb lengths, distal patency, and all landing zones belong to one fit problem.',
            domains: ['mechanical-job', 'fit'],
          },
          {
            id: 'tracheal-only',
            label: 'Judge the plan from the tracheal segment alone',
            rationale:
              'A satisfactory tracheal segment does not establish appropriate seating, length, or patency in either bronchial limb.',
            domains: ['fit'],
          },
          {
            id: 'two-independent-tubes',
            label: 'Treat each main bronchus as unrelated to the carina',
            rationale:
              'This ignores load sharing, the carinal saddle, device interactions, and the need to preserve both distal pathways.',
            domains: ['mechanical-job', 'fit'],
          },
        ],
        correctChoiceId: 'coupled-bifurcation-job',
        evidenceRefs: evidenceRefs('chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'),
      },
      {
        id: 'whole-y-architecture',
        question: 'Which architecture plan matches the stated job?',
        options: [
          {
            id: 'bifurcated-leading',
            label:
              'Lead with a bifurcated continuous-wall family; reconsider a tubular alternative only if one branch no longer needs support',
            rationale:
              'The leading architecture addresses all three limbs and carinal fixation. A tubular strategy becomes reasonable only if reassessment narrows the job and preserves the other branch.',
            domains: ['architecture', 'mechanical-job', 'fit'],
          },
          {
            id: 'single-tube-default',
            label: 'Use a straight tube because the tracheal lumen is the largest',
            rationale:
              'Lumen size alone does not address disease crossing the carina or the need to preserve both main bronchi.',
            domains: ['architecture', 'fit'],
          },
          {
            id: 'uncovered-any-shape',
            label: 'Use any uncovered architecture without mapping the branches',
            rationale:
              'Architecture and coverage do not remove the need to fit the saddle, branch angles, limb lengths, and distal orifices.',
            domains: ['architecture', 'fit'],
          },
        ],
        correctChoiceId: 'bifurcated-leading',
        evidenceRefs: evidenceRefs('wabip-malignant-stenting-2024'),
      },
      {
        id: 'whole-y-inspection',
        question: 'Which fit inspection is complete?',
        options: [
          {
            id: 'inspect-whole-y',
            label:
              'Inspect tracheal and bronchial diameters, limb lengths, angles, saddle seating, ends, and distal patency',
            rationale:
              'Whole-Y fit requires each dimension and pathway to be checked together rather than inferring success from one central view.',
            domains: ['fit', 'complication'],
          },
          {
            id: 'central-diameter-only',
            label: 'Inspect only the tracheal diameter',
            rationale:
              'This can miss bronchial-limb mismatch, carinal contact, and distal branch compromise.',
            domains: ['fit'],
          },
          {
            id: 'saddle-only',
            label: 'Inspect only whether the saddle sits on the carina',
            rationale:
              'Saddle seating does not establish appropriate limb direction, length, end contact, or airway patency.',
            domains: ['fit'],
          },
        ],
        correctChoiceId: 'inspect-whole-y',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ratnovsky-airway-mechanics-2015',
        ),
      },
      {
        id: 'whole-y-liabilities',
        question: 'Which advantage and liabilities belong in the plan?',
        options: [
          {
            id: 'fixation-with-costs',
            label:
              'Advantage: bifurcation fixation; liabilities: secretion pockets plus carinal, end, or branch mismatch',
            rationale:
              'Carinal geometry can stabilize position, while the saddle, junction, limb ends, and continuous surfaces create distinct clearance and contact concerns.',
            domains: ['architecture', 'complication', 'surveillance'],
          },
          {
            id: 'fixation-solves-fit',
            label: 'Carinal fixation makes limb fit and surveillance unnecessary',
            rationale:
              'Fixation can coexist with limb-angle mismatch, branch obstruction, retained secretions, or focal contact.',
            domains: ['fit', 'surveillance'],
          },
          {
            id: 'one-limb-surveillance',
            label: 'Follow only the limb that was most narrowed initially',
            rationale:
              'Both main bronchi, the saddle, all device ends, and the ongoing indication require reassessment.',
            domains: ['surveillance'],
          },
        ],
        correctChoiceId: 'fixation-with-costs',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ost-infection-granulation-2012',
        ),
      },
    ],
    physicsLens: physicsLensRegistry['bifurcation-mismatch'],
    finalTakeaway:
      'A bifurcated device must be planned and inspected as a whole geometry. Carinal fixation is useful only when both limbs, all landing zones, distal patency, secretion pathways, and future reassessment remain acceptable.',
    evidenceRefs: evidenceRefs(
      'chest-cao-guideline-2024',
      'wabip-malignant-stenting-2024',
      'ratnovsky-airway-mechanics-2015',
      'ost-infection-granulation-2012',
    ),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'curved-mainstem-fit-failure',
    lessonId: 'fit-behavior',
    title: 'A reasonable architecture with a curved-fit failure',
    stem: 'A covered tubular stent is placed for residual extrinsic compression in a curved left mainstem. The central lumen opens, but inspection shows inner-curve gapping, outer-curve contact, proximal-end motion with cough, and partial crowding of a lobar orifice. The intended treatment horizon still makes later removal important.',
    findings: [
      {
        id: 'central-lumen',
        label: 'Central appearance',
        value: 'The compressed midsection is open',
      },
      {
        id: 'curve',
        label: 'Curvature response',
        value: 'Inner-curve gap with outer-curve contact and straightening tendency',
        emphasis: 'warning',
      },
      {
        id: 'end-motion',
        label: 'Proximal end',
        value: 'Visible relative motion during cough',
        emphasis: 'warning',
      },
      {
        id: 'branch',
        label: 'Distal airway',
        value: 'A lobar orifice is partially crowded',
        emphasis: 'important',
      },
    ],
    decisions: [
      {
        id: 'curved-failure-recognition',
        question: 'What failed despite opening the central lumen?',
        options: [
          {
            id: 'geometry-and-fit',
            label:
              'The geometry and fit plan failed at the curve, device end, and branch relationship',
            rationale:
              'Central opening can coexist with gapping, focal contact, relative motion, and distal branch compromise.',
            domains: ['fit', 'complication'],
          },
          {
            id: 'insufficient-opening-only',
            label: 'Only central radial support is inadequate',
            rationale:
              'The midsection is open; the important findings are curve mismatch, end motion, and branch crowding.',
            domains: ['mechanical-job'],
          },
          {
            id: 'no-failure',
            label: 'There is no fit problem because the central lumen is open',
            rationale:
              'Lumen opening alone does not establish acceptable apposition, contact, end position, or branch patency.',
            domains: ['fit'],
          },
        ],
        correctChoiceId: 'geometry-and-fit',
        evidenceRefs: evidenceRefs(
          'ratnovsky-airway-mechanics-2015',
          'wabip-malignant-stenting-2024',
        ),
      },
      {
        id: 'curved-replan',
        question: 'Which architecture-and-fit response is most defensible?',
        options: [
          {
            id: 'replan-then-compare',
            label:
              'Re-map landing zones and branches, then compare a conforming covered scaffold with a revised removable continuous-wall alternative',
            rationale:
              'The response begins with the failed geometry. The leading covered-scaffold option and removable silicone alternative must each be judged for curve apposition, end position, secretion burden, and retrieval.',
            domains: ['fit', 'architecture', 'surveillance'],
          },
          {
            id: 'increase-support',
            label: 'Increase nominal support without changing length, position, or architecture',
            rationale:
              'This does not address the inner-curve gap, outer-curve contact, end motion, or crowded branch.',
            domains: ['fit'],
          },
          {
            id: 'extend-past-branch',
            label: 'Extend farther distally without mapping the lobar orifice',
            rationale:
              'Additional length can worsen branch compromise and move the end-contact problem rather than correct it.',
            domains: ['fit', 'complication'],
          },
        ],
        correctChoiceId: 'replan-then-compare',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ratnovsky-airway-mechanics-2015',
        ),
      },
      {
        id: 'curved-tradeoffs',
        question: 'What tradeoff must remain visible during that comparison?',
        options: [
          {
            id: 'conformity-removal-liabilities',
            label:
              'Potential curve conformity is balanced against secretion retention, migration or end contact, and later retrieval',
            rationale:
              'A covered scaffold may accommodate a curve differently, but coverage and fixation still create clearance, motion, and removal consequences. A customized removable wall may remain preferable if it produces a more acceptable whole-segment fit.',
            domains: ['architecture', 'fit', 'complication', 'surveillance'],
          },
          {
            id: 'flexibility-wins',
            label: 'Visible flexibility settles the architecture decision',
            rationale:
              'A schematic deformation does not establish airway fit, branch preservation, clinical support, secretion tolerance, or comparative outcomes.',
            domains: ['architecture'],
          },
          {
            id: 'diameter-only',
            label: 'Nominal diameter settles the fit decision',
            rationale:
              'Length, curvature, taper, landing zones, end position, and branch relationships remain unresolved.',
            domains: ['fit'],
          },
        ],
        correctChoiceId: 'conformity-removal-liabilities',
        evidenceRefs: evidenceRefs(
          'ratnovsky-airway-mechanics-2015',
          'gupta-granulation-review-2025',
        ),
      },
      {
        id: 'curved-surveillance',
        question: 'What should follow correction of the immediate fit problem?',
        options: [
          {
            id: 'targeted-reassessment',
            label:
              'Reassess branch patency, end position, symptoms, secretions, tissue response, and ongoing indication',
            rationale:
              'The same anatomy that produced the initial mismatch can contribute to recurrent obstruction, migration, or focal tissue response.',
            domains: ['surveillance', 'complication', 'indication'],
          },
          {
            id: 'central-lumen-only',
            label: 'Follow only the diameter of the central lumen',
            rationale:
              'This would miss branch compromise, end contact, secretions, position, and whether support remains necessary.',
            domains: ['surveillance'],
          },
          {
            id: 'no-reassessment',
            label: 'End surveillance once the device appears centered',
            rationale:
              'Position and interface behavior can evolve with cough, disease response, secretions, and dwell time.',
            domains: ['surveillance'],
          },
        ],
        correctChoiceId: 'targeted-reassessment',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'gupta-granulation-review-2025',
        ),
      },
    ],
    physicsLens: physicsLensRegistry['curve-end-loading'],
    finalTakeaway:
      'A device can open the target and still fail because the whole-segment fit is wrong. Curvature, gapping, focal contact, ends, branches, removability, and secretion burden must be reassessed before changing architecture.',
    evidenceRefs: evidenceRefs(
      'wabip-malignant-stenting-2024',
      'ratnovsky-airway-mechanics-2015',
      'gupta-granulation-review-2025',
    ),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'proximal-granulation-multifactorial',
    lessonId: 'complications-surveillance',
    title: 'Proximal granulation with secretions and repeated contact',
    stem: 'A patient initially improves after stenting of a curved main bronchus. Several weeks later, recurrent cough and increasing secretions develop. Bronchoscopy shows focal narrowing near the proximal device end with purulent material around the stent. The central device lumen remains open, and no single finding yet explains the entire recurrence.',
    findings: [
      {
        id: 'symptoms',
        label: 'Recognition trigger',
        value: 'Recurrent cough with increasing secretion burden',
        emphasis: 'warning',
      },
      {
        id: 'location',
        label: 'Narrowing pattern',
        value: 'Focal tissue at the proximal end in a curved segment',
        emphasis: 'important',
      },
      {
        id: 'infectious-signal',
        label: 'Associated finding',
        value: 'Purulent material around the device',
        emphasis: 'warning',
      },
      {
        id: 'uncertainty',
        label: 'Causal boundary',
        value:
          'Granulation, mucus, infection, fit, motion, disease, and host response may interact',
      },
    ],
    decisions: [
      {
        id: 'granulation-differential',
        question: 'Which interpretation is most complete?',
        options: [
          {
            id: 'coexisting-processes',
            label:
              'Granulation is likely, and mucus or infection may coexist; exclude tumor, migration, and structural failure',
            rationale:
              'The focal end tissue supports granulation, while purulence and secretions require parallel assessment. Recurrent obstruction can have more than one mechanism.',
            domains: ['complication'],
          },
          {
            id: 'mucus-only',
            label: 'Mucus plugging is the sole explanation',
            rationale:
              'Mucus may contribute, but it does not account for focal tissue at the proximal device end.',
            domains: ['complication'],
          },
          {
            id: 'granulation-only',
            label: 'Granulation is isolated from infection, fit, and motion',
            rationale:
              'The clinical pattern requires a multifactorial assessment rather than a single-cause assumption.',
            domains: ['complication'],
          },
          {
            id: 'structural-only',
            label: 'The stent must have fractured because symptoms recurred',
            rationale:
              'Structural failure remains in the differential, but recurrent symptoms alone do not establish it.',
            domains: ['complication'],
          },
        ],
        correctChoiceId: 'coexisting-processes',
        evidenceRefs: evidenceRefs(
          'ost-infection-granulation-2012',
          'hu-granulation-diameter-2011',
          'gupta-granulation-review-2025',
        ),
      },
      {
        id: 'granulation-contributors',
        question: 'Which contributor model should guide reassessment?',
        options: [
          {
            id: 'multifactorial-interface',
            label:
              'Fit, end contact, motion, secretions or infection, dwell time, and host biology may interact',
            rationale:
              'Mechanical, infectious-secretory, and biologic-time contributors form a plausible pathway, but they do not create a patient-specific risk equation or prove causation.',
            domains: ['fit', 'complication', 'surveillance'],
          },
          {
            id: 'support-alone',
            label: 'The amount of radial support alone caused the tissue response',
            rationale:
              'The cited evidence does not support a single-variable explanation or a universal clinical threshold.',
            domains: ['complication'],
          },
          {
            id: 'infection-alone',
            label: 'Purulence proves infection is the only driver',
            rationale:
              'Infection may contribute, but fit, repeated contact, tissue interface, time, disease, and host response still require evaluation.',
            domains: ['complication'],
          },
          {
            id: 'diameter-cutoff',
            label:
              'A single diameter relationship predicts the complication for every architecture',
            rationale:
              'An observational association from one stent context cannot be converted into a universal sizing cutoff or individual prediction.',
            domains: ['fit', 'complication'],
          },
        ],
        correctChoiceId: 'multifactorial-interface',
        evidenceRefs: evidenceRefs(
          'ost-infection-granulation-2012',
          'hu-granulation-diameter-2011',
          'gupta-granulation-review-2025',
        ),
      },
      {
        id: 'granulation-response',
        question: 'Which response plan addresses both obstruction and its drivers?',
        options: [
          {
            id: 'restore-and-correct',
            label:
              'Restore patency, evaluate secretions and infection, then reassess fit, position, architecture, indication, and exit',
            rationale:
              'The plan treats the immediate airway problem while asking whether repositioning, exchange, removal, or another strategy is needed to correct contributing conditions.',
            domains: ['complication', 'fit', 'architecture', 'indication', 'surveillance'],
          },
          {
            id: 'remove-tissue-only',
            label: 'Remove the obstructing tissue and leave the interface plan unchanged',
            rationale:
              'Restoring patency is incomplete if secretion, infection, end position, fit, motion, architecture, or ongoing indication remains unaddressed.',
            domains: ['complication'],
          },
          {
            id: 'antimicrobial-only',
            label: 'Treat suspected infection without restoring or reassessing airway patency',
            rationale:
              'Infectious management may be needed, but the obstructed airway and device-interface contributors require parallel attention.',
            domains: ['complication'],
          },
          {
            id: 'exchange-without-reason',
            label: 'Exchange the device without evaluating fit or ongoing need',
            rationale:
              'An exchange that preserves the same mismatch or unnecessary indication may reproduce the problem.',
            domains: ['architecture', 'indication'],
          },
        ],
        correctChoiceId: 'restore-and-correct',
        evidenceRefs: evidenceRefs(
          'ost-infection-granulation-2012',
          'gupta-granulation-review-2025',
          'wabip-malignant-stenting-2024',
        ),
      },
      {
        id: 'granulation-surveillance',
        question: 'What should surveillance specifically revisit?',
        options: [
          {
            id: 'revisit-interface-and-need',
            label:
              'Symptoms, patency, secretions, infection, end contact, position, and continuing need for the device',
            rationale:
              'Surveillance must detect recurrence while also determining whether the mechanical job, fit, architecture, and exit strategy remain appropriate.',
            domains: ['surveillance', 'complication', 'indication'],
          },
          {
            id: 'tissue-only',
            label: 'Measure only the visible granulation tissue',
            rationale:
              'A tissue measurement alone would miss secretion, infection, position, fit, disease change, and the continuing indication.',
            domains: ['surveillance'],
          },
          {
            id: 'symptoms-only',
            label: 'Use symptom improvement as the only follow-up finding',
            rationale:
              'Symptoms matter, but they do not identify interface behavior, secretion burden, airway patency, or the current need for the device.',
            domains: ['surveillance'],
          },
        ],
        correctChoiceId: 'revisit-interface-and-need',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ost-infection-granulation-2012',
          'gupta-granulation-review-2025',
        ),
      },
    ],
    physicsLens: physicsLensRegistry['cough-micromotion'],
    finalTakeaway:
      'Granulation is a multifactorial tissue response, not a one-variable mechanics result. Restore patency, assess infectious and secretory burden, correct plausible interface drivers, and revisit both surveillance and the continuing indication.',
    evidenceRefs: evidenceRefs(
      'ost-infection-granulation-2012',
      'hu-granulation-diameter-2011',
      'gupta-granulation-review-2025',
      'wabip-malignant-stenting-2024',
    ),
    clinicalReviewStatus: 'draft',
  },
  {
    id: 'post-treatment-migration-mucus-assessment',
    lessonId: 'assessment',
    title: 'Changing anatomy with migration and mucus obstruction',
    stem: 'A patient received a covered removable airway stent for malignant extrinsic compression and initially improved. After tumor-directed therapy, cough and secretion burden increase. Imaging suggests less external compression and a larger airway than at baseline. Bronchoscopy shows device migration, dependent mucus, and partial branch obstruction without an obvious fracture.',
    findings: [
      {
        id: 'treatment-response',
        label: 'Changing anatomy',
        value: 'External compression has decreased after tumor-directed therapy',
        emphasis: 'important',
      },
      {
        id: 'position',
        label: 'Device position',
        value: 'Migrated from the original landing zones',
        emphasis: 'warning',
      },
      {
        id: 'secretions',
        label: 'Airway contents',
        value: 'Dependent mucus with partial branch obstruction',
        emphasis: 'warning',
      },
      {
        id: 'structure',
        label: 'Structural inspection',
        value: 'No obvious fracture; further assessment may still be required',
      },
    ],
    decisions: [
      {
        id: 'assessment-indication',
        question: 'What is the first indication-level reassessment?',
        options: [
          {
            id: 'does-job-remain',
            label: 'Determine whether a clinically meaningful external-support job still remains',
            rationale:
              'Treatment response may have changed or removed the original load, so the current benefit of maintaining a stent must be reconsidered before reflexive replacement.',
            domains: ['indication', 'mechanical-job', 'surveillance'],
          },
          {
            id: 'replace-by-history',
            label: 'Replace the device because the original indication once existed',
            rationale:
              'A historical indication does not establish that the same mechanical job remains after anatomy changes.',
            domains: ['indication'],
          },
          {
            id: 'ignore-response',
            label: 'Ignore tumor response because a device is already present',
            rationale:
              'Changing disease burden can alter support needs, landing-zone contact, migration risk, and the exit plan.',
            domains: ['indication', 'fit'],
          },
        ],
        correctChoiceId: 'does-job-remain',
        evidenceRefs: evidenceRefs('wabip-malignant-stenting-2024'),
      },
      {
        id: 'assessment-fit',
        question: 'Which fit mechanism most plausibly links treatment response and migration?',
        options: [
          {
            id: 'lost-apposition',
            label: 'Reduced compression changed airway caliber and landing-zone apposition',
            rationale:
              'A device fitted to the earlier compressed anatomy may lose contact or anchoring as the airway remodels, permitting migration and branch malposition.',
            domains: ['fit', 'complication'],
          },
          {
            id: 'more-support-needed',
            label: 'Migration proves that more central support is needed',
            rationale:
              'The external load has decreased; the key problem may be lost apposition and a resolved or altered indication rather than insufficient support.',
            domains: ['fit', 'mechanical-job'],
          },
          {
            id: 'fracture-proven',
            label: 'Migration proves structural fracture',
            rationale:
              'Fracture remains a possible alternative, but position change can occur without visible structural failure.',
            domains: ['complication'],
          },
        ],
        correctChoiceId: 'lost-apposition',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ratnovsky-airway-mechanics-2015',
        ),
      },
      {
        id: 'assessment-complication',
        question: 'How should the recurrent obstruction be classified?',
        options: [
          {
            id: 'migration-plus-mucus',
            label:
              'Migration and mucus obstruction coexist; assess infection, tissue response, recurrence, and branch injury',
            rationale:
              'The observed position and mucus explain important parts of the recurrence, while other dangerous or treatable contributors still require evaluation.',
            domains: ['complication', 'fit'],
          },
          {
            id: 'mucus-only',
            label: 'Mucus is the only problem because material is visible',
            rationale:
              'The migrated device and branch obstruction are independent findings that change the response and ongoing device plan.',
            domains: ['complication'],
          },
          {
            id: 'tumor-only',
            label: 'Tumor recurrence is the only possible explanation',
            rationale:
              'Recurrence remains in the differential, but the available findings directly demonstrate migration and mucus after treatment response.',
            domains: ['complication'],
          },
        ],
        correctChoiceId: 'migration-plus-mucus',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ost-infection-granulation-2012',
        ),
      },
      {
        id: 'assessment-response',
        question: 'Which integrated response and exit plan is most defensible?',
        options: [
          {
            id: 'restore-reassess-exit',
            label:
              'Restore patency, address secretions and infection, then reposition, exchange, or remove according to the current job',
            rationale:
              'Immediate airway restoration is paired with correction of branch malposition, reassessment of fit and architecture, and removal if meaningful support is no longer required.',
            domains: ['complication', 'fit', 'architecture', 'indication', 'surveillance'],
          },
          {
            id: 'clear-mucus-only',
            label: 'Clear mucus and leave the migrated device in place without reassessment',
            rationale:
              'This leaves branch obstruction, altered landing-zone contact, and the possibly resolved indication unaddressed.',
            domains: ['complication'],
          },
          {
            id: 'larger-device',
            label: 'Replace it with a larger device without remapping the changed airway',
            rationale:
              'A size-only response can create new contact, branch, secretion, or removal problems and does not determine whether a stent is still needed.',
            domains: ['fit', 'architecture'],
          },
        ],
        correctChoiceId: 'restore-reassess-exit',
        evidenceRefs: evidenceRefs(
          'wabip-malignant-stenting-2024',
          'ost-infection-granulation-2012',
        ),
      },
    ],
    physicsLens: physicsLensRegistry['coverage-interface'],
    finalTakeaway:
      'Post-treatment anatomy can transform a previously appropriate fit into migration and branch obstruction. Manage immediate patency and secretions while reassessing the original job, current fit, architecture, and whether removal is now the coherent exit.',
    evidenceRefs: evidenceRefs(
      'wabip-malignant-stenting-2024',
      'ost-infection-granulation-2012',
      'ratnovsky-airway-mechanics-2015',
    ),
    clinicalReviewStatus: 'draft',
  },
] as const satisfies readonly StentClinicalCase[]

export type StentClinicalCaseId = (typeof clinicalCaseRegistry)[number]['id']

export function getClinicalCase(caseId: StentClinicalCaseId): StentClinicalCase
export function getClinicalCase(caseId: string): StentClinicalCase
export function getClinicalCase(caseId: string): StentClinicalCase {
  const clinicalCase = clinicalCaseRegistry.find((candidate) => candidate.id === caseId)
  if (!clinicalCase) {
    throw new Error(`Unknown airway-stent clinical case: ${caseId}`)
  }
  return clinicalCase
}

export function getCasesForLesson(lessonId: StentLessonId): StentClinicalCase[] {
  return clinicalCaseRegistry.filter((clinicalCase) => clinicalCase.lessonId === lessonId)
}

export function getPrimaryCaseForLesson(lessonId: StentLessonId): StentClinicalCase | undefined {
  return getCasesForLesson(lessonId)[0]
}

/**
 * Content invariants used by tests and release checks. An empty array means the
 * registry has complete, resolvable evidence references and structurally valid
 * decisions for every lesson.
 */
export function validateClinicalCaseRegistry(): string[] {
  const errors: string[] = []
  const caseIds = clinicalCaseRegistry.map((clinicalCase) => clinicalCase.id)

  if (new Set(caseIds).size !== caseIds.length) {
    errors.push('Clinical case IDs must be unique.')
  }

  for (const lessonId of STENT_LESSON_IDS) {
    if (!clinicalCaseRegistry.some((clinicalCase) => clinicalCase.lessonId === lessonId)) {
      errors.push(`${lessonId} must have at least one clinical case.`)
    }
  }

  for (const clinicalCase of clinicalCaseRegistry as readonly StentClinicalCase[]) {
    if (clinicalCase.evidenceRefs.length === 0) {
      errors.push(`${clinicalCase.id} must have case-level evidence references.`)
    }

    const caseEvidenceRefs = [
      ...clinicalCase.evidenceRefs,
      ...(clinicalCase.physicsLens?.evidenceRefs ?? []),
      ...clinicalCase.decisions.flatMap((decision) => decision.evidenceRefs),
    ]
    const missingRefs = findMissingEvidenceRefs(caseEvidenceRefs)
    if (missingRefs.length > 0) {
      errors.push(`${clinicalCase.id} has unresolved evidence: ${missingRefs.join(', ')}`)
    }

    if (clinicalCase.decisions.length === 0) {
      errors.push(`${clinicalCase.id} must contain at least one clinical decision.`)
    }

    for (const decision of clinicalCase.decisions) {
      if (decision.evidenceRefs.length === 0) {
        errors.push(`${clinicalCase.id}/${decision.id} must have evidence references.`)
      }
      if (decision.options.length < 2) {
        errors.push(`${clinicalCase.id}/${decision.id} must offer at least two options.`)
      }

      const optionIds = decision.options.map((option) => option.id)
      if (new Set(optionIds).size !== optionIds.length) {
        errors.push(`${clinicalCase.id}/${decision.id} option IDs must be unique.`)
      }
      if (!optionIds.includes(decision.correctChoiceId)) {
        errors.push(`${clinicalCase.id}/${decision.id} correctChoiceId must resolve to an option.`)
      }
    }
  }

  return errors
}

export function assertClinicalCaseEvidenceIntegrity(): void {
  const errors = validateClinicalCaseRegistry()
  if (errors.length > 0) {
    throw new Error(`Invalid airway-stent clinical case registry: ${errors.join(' ')}`)
  }
}
