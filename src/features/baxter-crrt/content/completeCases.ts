import { baxterCrrtAuthoredCaseTemplates } from './phase7ReviewCases'
import { baxterCrrtSupplementalSourceReferences } from './phase7ReviewSources'
import { baxterCrrtPilotCases } from './pilotCases'
import { baxterCrrtPilotSourceReferences } from './provenance'
import {
  CRRT_ALL_CASE_IDS,
  collectCrrtCaseSemanticIssues,
  runtimeCrrtCaseRegistrySchema,
  validateCrrtCaseRegistry,
  type CrrtCaseId,
  type RuntimeCrrtCase,
  type SourceReference,
} from './schema'
import { BAXTER_CRRT_CONTENT_VERSION } from './versions'
import { getCrrtWorkedCaseExample } from './workedCaseExamples'
import { CRRT_NUMBERS } from './teachingNumbers'

const N = CRRT_NUMBERS.value

interface CaseNarrative {
  readonly id: CrrtCaseId
  readonly templateId: CrrtCaseId
  readonly title: string
  readonly stationId: RuntimeCrrtCase['stationId']
  readonly difficulty: RuntimeCrrtCase['difficulty']
  readonly patientDescription: string
  readonly learningObjectives: readonly string[]
  readonly goal: string
  readonly mechanism: string
  readonly safeAction: string
  readonly acceptedAlternative: string
  /** Response when the accepted alternative records a different plan from the safe action. */
  readonly acceptedAlternativeResponse?: string
  readonly unsafeAction: string
  readonly expectedResponse: string
  /**
   * The correct prediction's label. Defaults to "Expect a linked response, then verify it", which
   * is wrong for a case whose correct expectation is that no new clinical data appears.
   */
  readonly responseOptionLabel?: string
  /**
   * The debrief's trend paragraph: worked teaching shown after every run, including one that did
   * nothing. It is authored on its own and never defaults to `expectedResponse`, which is an
   * action response and reads as something the learner did (CRRT-FELLOW-06 F06-01, F06-R02).
   * Write it as what a review would look at, not as a result this run produced.
   */
  readonly trendReview: string
  readonly reassessment: string
  readonly openingFinding: string
  readonly causalChain: readonly string[]
  readonly transferQuestion: string
  readonly clinicalSourceIds: readonly string[]
  /** Why the keyed first move is right; shown with the accepted path. */
  readonly alternativeWhy: string
  /** What goes wrong with the unsafe action; shown in the debrief once it is performed. */
  readonly unsafeWhy: string
  /** The tempting wrong goal, as a fellow would phrase it. */
  readonly goalDistractor: string
  /** The tempting wrong mechanism, as a fellow would phrase it. */
  readonly mechanismDistractor: string
  /** Case-start laboratory values the stem quotes, so the monitor and the stem agree. */
  readonly patient?: {
    readonly urineOutputMlPerHour?: number
    readonly solutes?: Partial<RuntimeCrrtCase['initialPatient']['solutes']>
  }
}

type MutableRuntimeCrrtCase = {
  -readonly [Key in keyof RuntimeCrrtCase]: RuntimeCrrtCase[Key]
}

const sourceById = new Map<string, SourceReference>(
  [...baxterCrrtPilotSourceReferences, ...baxterCrrtSupplementalSourceReferences].map((source) => [
    source.id,
    source,
  ]),
)

const sourceCases = [...baxterCrrtPilotCases, ...baxterCrrtAuthoredCaseTemplates]
const sourceCaseById = new Map(sourceCases.map((definition) => [definition.id, definition]))

const clinicalTitleByCaseId: Partial<Record<CrrtCaseId, string>> = {
  'CRRT-01': 'Set CRRT priorities in septic shock, AKI, and fluid accumulation',
  'CRRT-02': 'Prioritize hyperkalemia and acidemia during hemodynamic instability',
  'CRRT-05': 'Compare pre- and post-filter replacement flow in CVVH',
  'CRRT-07': 'Verify weight and hematocrit entries before treatment',
  'CRRT-11': 'Respond to hemodynamic intolerance during fluid removal',
  'CRRT-15': 'Localize rising filter and effluent pressure trends',
}

const clinicalPatientDescriptionByCaseId: Partial<Record<CrrtCaseId, string>> = {
  'CRRT-01':
    'An adult ICU patient with septic shock and AKI has accumulated fluid while receiving ongoing resuscitation and vasoactive support. Define the immediate CRRT goals and how you will reassess them.',
  'CRRT-02':
    'An unstable adult ICU patient with AKI has persistent hyperkalemia and severe acidemia despite initial management. Identify the urgent kidney-support goal, confirm actual treatment delivery, and plan serial reassessment.',
  'CRRT-04':
    'An adult ICU patient with AKI needs CRRT for solute and acid-base control. Build a CVVHD prescription, start treatment through the simulated device workflow, and compare prescribed with delivered therapy after an interruption.',
  'CRRT-05':
    'A patient is receiving CVVH. Total replacement flow will remain unchanged while you compare pre- and post-filter delivery. Identify the dilution and filter-concentration tradeoffs without treating either split as universally best.',
  'CRRT-06':
    'A patient is receiving CVVHDF with dialysate plus pre- and post-filter replacement. A treatment interruption reduces delivered therapy even though the prescription itself does not change.',
  'CRRT-07':
    'During pre-treatment verification, the entered weight and hematocrit do not match the case information. Correct them and observe how these inputs affect the weight-normalized dose display and filter-risk calculations.',
  'CRRT-10':
    'An adult ICU patient remains net positive even though machine PFR is active. Reconcile ongoing inputs, non-machine outputs, actual CRRT removal, downtime, and hemodynamic tolerance before changing the plan.',
  'CRRT-11':
    'A patient receiving CRRT shows worsening hemodynamic tolerance while machine fluid removal continues. Decide whether to reduce or pause removal, then reassess the patient and treatment delivery.',
  'CRRT-13':
    'During a simulated CVVHD treatment, access pressure becomes progressively more negative and a generic obstruction alert appears. Use a cause-first sequence and confirm restored delivery.',
  'CRRT-15':
    'During CRRT, filter and effluent pressure trends are rising while effective flow is reduced. Localize plausible contributors, change one factor at a time, and avoid labeling every trend as anticoagulation failure.',
}

const clinicalVisibleFindingsByCaseId: Partial<Record<CrrtCaseId, readonly string[]>> = {
  'CRRT-01': [
    'Septic shock, AKI, fluid accumulation, ongoing resuscitation, and vasoactive support are present together.',
    'Machine fluid removal is only one part of the complete patient fluid balance.',
    'The plan must include a clear goal, assessment of tolerance, team communication, and reassessment.',
  ],
  'CRRT-02': [
    'Hyperkalemia and severe acidemia persist during hemodynamic instability.',
    'The current prescription and actual treatment delivery are available for review.',
    'Define the urgent treatment goal and serial reassessment before assuming the patient response.',
  ],
  'CRRT-04': [
    'The immediate treatment goal is solute and acid-base control with CVVHD.',
    'Prescription fields begin blank and must be reviewed before treatment starts.',
    'A treatment interruption will separate prescribed from delivered therapy.',
  ],
  'CRRT-05': [
    'Total replacement flow remains constant while the pre- and post-filter split changes.',
    'Pre-filter replacement dilutes blood before it enters the filter; post-filter replacement does not.',
    'Compare the tradeoffs without treating either split as universally best.',
  ],
  'CRRT-06': [
    'Dialysate plus pre- and post-filter replacement are active in the CVVHDF prescription.',
    'An interruption reduces actual treatment delivery without changing the prescribed settings.',
    'Use downtime and delivered-dose data to explain the difference.',
  ],
  'CRRT-07': [
    'The entered weight and hematocrit do not match the patient information.',
    'Both entries affect downstream displays or calculations.',
    'Verify and correct the inputs before relying on the displayed results.',
  ],
  'CRRT-10': [
    'Machine PFR is active, but the cumulative whole-patient fluid balance remains positive.',
    'Patient inputs, non-machine outputs, actual CRRT removal, and downtime all remain relevant.',
    'Assess hemodynamic tolerance before changing removal or coordinating other fluid inputs.',
  ],
  'CRRT-11': [
    'Hemodynamic tolerance worsens while machine fluid removal continues.',
    'The prescription display does not establish that the patient is tolerating the current plan.',
    'Compare reducing with pausing removal, then reassess the patient and treatment delivery.',
  ],
  'CRRT-13': [
    'Access pressure becomes progressively more negative at the same prescribed blood-flow rate.',
    'Filter and return pressure trends remain available for localization.',
    'Assess the patient and access path before changing blood flow or attributing the pattern to anticoagulation.',
  ],
  'CRRT-15': [
    'Filter and effluent pressure trends rise while effective blood flow has been intermittently reduced.',
    'Access, return, treatment-delivery, and downtime information remain available for localization.',
    'Reassess the whole circuit before assigning anticoagulation failure or changing therapy.',
  ],
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function replaceStrings(
  value: unknown,
  replacements: readonly (readonly [string, string])[],
): unknown {
  if (typeof value === 'string') {
    return replacements.reduce(
      (result, [search, replacement]) => result.split(search).join(replacement),
      value,
    )
  }
  if (Array.isArray(value)) return value.map((item) => replaceStrings(item, replacements))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, replaceStrings(nested, replacements)]),
    )
  }
  return value
}

function rewriteLearnerFacingString(value: string): string {
  if (!value.includes(' ')) return value

  const rewritten = (
    [
      [
        'Every patient value and setting is synthetic teaching calibration informational provenance.',
        'All patient values and treatment responses are simulated for this exercise and are not treatment targets.',
      ],
      [
        'Every patient value and setting is synthetic teaching calibration pending review.',
        'All patient values and treatment responses are simulated for this exercise and are not treatment targets.',
      ],
      [
        'The displayed values are synthetic teaching calibration, not patient-care targets.',
        'All displayed values are simulated for education and are not patient-care targets.',
      ],
      [
        'All patient values are labeled simulated and review-pending.',
        'All patient values are simulated for education and are not clinical targets.',
      ],
      [
        'All patient values are labeled simulated and simulated.',
        'All patient values are simulated for education and are not clinical targets.',
      ],
      [
        'The candidate is available only to reviewers and cannot record learner progress.',
        'Use the clinical information to choose a plan, take action, and reassess the response.',
      ],
      ['Assess the complete synthetic scenario', 'Complete the initial clinical assessment'],
      [
        'Review all authored patient, circuit, delivery, and hemodynamic signals without importing a bedside threshold.',
        'Review the patient, access, circuit, treatment delivery, and hemodynamic trends before changing therapy.',
      ],
      [
        'The learner assessment gate is recorded; it does not issue a clinical recommendation.',
        'Assessment complete. Choose an action that addresses the goal and includes reassessment.',
      ],
      [
        'The reviewer assessment gate is recorded; it does not issue a clinical recommendation.',
        'Assessment complete. Choose an action that addresses the goal and includes reassessment.',
      ],
      [
        'Communicate the candidate plan and uncertainty',
        'Communicate the plan and reassessment needs',
      ],
      [
        'State the authored goal, pending evidence status, selected candidate path, and reassessment plan.',
        'State the clinical goal, selected action, unresolved concerns, and reassessment plan.',
      ],
      [
        'Communication is recorded without implying approval, competency, or local protocol alignment.',
        'The plan and unresolved concerns are communicated to the care team.',
      ],
      [
        'Use the whole authored scenario and preserve explicit uncertainty; no isolated value becomes a clinical threshold.',
        'Use the full clinical picture and acknowledge uncertainty; no single value should be treated as a universal threshold.',
      ],
      [
        'This omits the broader authored context and reassessment requirement.',
        'This ignores the rest of the clinical picture and the need for reassessment.',
      ],
      ['Use the candidate causal mechanism', 'Choose the mechanism that best links the findings'],
      [
        'Pending learning case with synthetic values and a required reassessment.',
        'Clinically reasonable option when followed by verification and reassessment.',
      ],
      [
        'Separate pending SME alternative with synthetic values and the same reassessment requirement.',
        'Reasonable alternative that preserves the same verification and reassessment steps.',
      ],
      [
        'Pending unsafe candidate retained only for learning scoring validation.',
        'Unsafe option because it bypasses a required safety step.',
      ],
      [
        'Expect the authored synthetic response and reassess it',
        'Predict the immediate change and follow-up response',
      ],
      [
        'This bypasses the authored delivery and reassessment signals.',
        'This ignores treatment delivery and the need to verify the patient response.',
      ],
      [
        'Review the authored machine, patient, delivery, and timeline signals before the debrief.',
        'Review the patient, circuit, treatment-delivery, and trend data before debriefing.',
      ],
      ['Do not reassess after the candidate action', 'Do not reassess after the intervention'],
      [
        'This omits the required reassessment gate.',
        'The next routine bloods may be many hours away.',
      ],
      [
        'Compare the prediction with the authored synthetic mechanism and response.',
        'Compare your prediction with the observed mechanism and response.',
      ],
      [
        'Inspect the synthetic engine trend and delivery timeline; do not infer an unreviewed clinical threshold.',
        'Review the patient, treatment-delivery, and trend data; these case values are not clinical thresholds.',
      ],
      [
        'The required learning path contains assessment, the candidate action, communication, and reassessment.',
        'The safe sequence includes assessment, action, team communication, and reassessment.',
      ],
      [
        'The required reviewer path contains assessment, the candidate action, communication, and reassessment.',
        'The safe sequence includes assessment, action, team communication, and reassessment.',
      ],
      [
        'Any displayed critical error is a pending synthetic scoring candidate, not an approved clinical rule.',
        'A critical error identifies an omitted safety step in this exercise; it is not a competency determination.',
      ],
      [
        'Translate the canonical state through the selected device adapter; screen order and vocabulary remain device-specific.',
        'Apply the clinical reasoning through the PrisMax screen order and terminology; screens support rather than replace the reasoning.',
      ],
      [
        'The problem this patient needs solved.',
        'Frames the full clinical picture before choosing a treatment or device action.',
      ],
      [
        'A simulated adult ICU scenario combines septic shock, AKI, accumulated fluid, and ongoing support. Review the complete context and define a option treatment goal.',
        'An adult ICU patient has septic shock, AKI, accumulated fluid, and ongoing support needs. Review the full clinical picture and determine the immediate CRRT priorities.',
      ],
      [
        'Apply the clinical exercise simulated removal option',
        'Adjust machine fluid removal after assessment',
      ],
      [
        'Set only the simulated machine-removal value after the required assessment.',
        'Make the case fluid-removal change only after reviewing hemodynamic tolerance and the complete fluid balance.',
      ],
      [
        'Preserve the current simulated setting while escalating the unresolved goal for review.',
        'Keep the current setting while clarifying the treatment goal with the care team.',
      ],
      [
        'The action is recorded as a pending synthetic critical-error candidate.',
        'This action is unsafe because it bypasses a required assessment or verification step.',
      ],
      [
        'The action is recorded as a pending simulated critical-error option.',
        'This action is unsafe because it bypasses a required assessment or verification step.',
      ],
      [
        'The prescription controls begin blank even though a simulated case simulation is loaded.',
        'Prescription fields begin blank so the learner must build the treatment plan.',
      ],
      ['Enter simulated BFR first', 'Enter the case blood-flow rate first'],
      [
        'Enter the simulated case BFR before downstream flow controls.',
        'Enter blood flow before completing the downstream flow settings.',
      ],
      ['Enter primary simulated dialysate flow', 'Enter the primary dialysate-flow option'],
      ['Enter alternative simulated dialysate flow', 'Enter the alternative dialysate-flow option'],
      [
        'Apply one accepted simulated dialysate exercise.',
        'Apply the first accepted dialysate-flow option for this case.',
      ],
      [
        'Apply a second accepted teaching exercise rather than one exact answer.',
        'Apply the second accepted dialysate-flow option and compare the displayed result.',
      ],
      ['Enter simulated machine PFR', 'Enter the case machine PFR'],
      [
        'Complete prime and prescription review',
        'Confirm prime and prescription review on the machine',
      ],
      [
        'Complete the source-mapped educational setup gates before starting.',
        'Prime and prescription review are completed on the machine, on its Prime and Review steps. This card records that you have done them; it does not perform them, and it is refused until the machine has recorded both.',
      ],
      [
        'The device workflow is ready for a reviewed educational start.',
        'The machine has recorded prime and prescription review, and your confirmation is recorded alongside them.',
      ],
      [
        'Dose, downtime, trends, and simulated solutes advance deterministically.',
        'Dose, downtime, trends, and simulated solutes update as case time passes.',
      ],
      ['Synthetic bounded treatment interruption', 'Treatment interruption begins'],
      [
        'Unsafe option retained for scoring validation; the interface should block it.',
        'This action is unsafe because it skips prime and prescription review.',
      ],
      [
        'The start is rejected and recorded as a pending option critical-error choice.',
        'The start is blocked because prime and prescription review are incomplete.',
      ],
      [
        'The case records a consequential reasoning error without altering simulation truth.',
        'The debrief identifies the error while leaving the case state unchanged.',
      ],
      [
        'Apply a cautious simulated PFR adjustment after assessment',
        'Make a cautious PFR adjustment after assessment',
      ],
      [
        'Use the case-only accepted removal exercise after reviewing tolerance.',
        'Use the case fluid-removal change only after reviewing hemodynamic tolerance.',
      ],
      [
        'Coordinate a simulated maintenance-input reduction',
        'Coordinate a maintenance-fluid reduction',
      ],
      [
        'Review the need for maintenance input with the simulated team before changing it.',
        'Review the need for maintenance fluid with the care team before changing it.',
      ],
      [
        'Coordinate simulated medication-carrier consolidation',
        'Coordinate medication-carrier consolidation',
      ],
      [
        'Review medication-carrier inputs with the simulated multidisciplinary team.',
        'Review medication-carrier inputs with the multidisciplinary care team.',
      ],
      [
        'Apply an unsafe option change without the required required assessment.',
        'Change PFR without first assessing hemodynamic tolerance.',
      ],
      [
        'During a simulated CVVHD treatment, access resistance rises and produces an increasingly negative model-derived access pressure with a generic simulation obstruction alert.',
        'During a simulated CVVHD treatment, access pressure becomes progressively more negative and a generic obstruction alert appears.',
      ],
      [
        'The alarm remains a generic training alert; unmapped device priority and automatic reaction are not inferred.',
        'The alert is simplified for training and does not reproduce device-specific priority or automatic responses.',
      ],
      [
        'Access resistance rises, pressure becomes more negative, and the generic obstruction alert derives from the simulated circuit state.',
        'Access resistance rises, pressure becomes more negative, and the generic obstruction alert appears.',
      ],
      [
        'Apply a pending option critical-error action while the access cause remains unresolved.',
        'Increase blood flow while the access obstruction remains unresolved.',
      ],
      [
        'Choose a disabled medication-first response to an mechanical problem.',
        'Choose medication escalation before correcting the mechanical problem.',
      ],
      [
        'No medication effect executes; the access resistance remains unchanged.',
        'The mechanical access problem remains unresolved.',
      ],
      [
        'The worsening access-pressure pattern arose from an resistance change and resolved only after cause-first mechanical correction.',
        'The worsening access-pressure pattern arose from increased access resistance and improved only after the mechanical cause was corrected.',
      ],
      [
        'This collapses prescribed therapy, delivered therapy, and patient response into one signal.',
        'This treats the prescription, actual treatment delivery, and patient response as if they were the same thing.',
      ],
      [
        'Separate the prescription signal from delivery and patient response.',
        'Separate the prescription from actual treatment delivery and patient response.',
      ],
      [
        'Pending clinical option with simulated values and a required reassessment.',
        'Clinically reasonable option when followed by verification and reassessment.',
      ],
      [
        'Pending unsafe option retained only for practice scoring validation.',
        'Unsafe option because it bypasses a required safety step.',
      ],
      [
        'This is retained only as a pending option critical-error choice.',
        'This option is unsafe because it bypasses a required safety step.',
      ],
      [
        'The action is recorded as a pending option critical error.',
        'This action is unsafe because it bypasses a required assessment or verification step.',
      ],
      [
        'The claim is recorded as a pending simulated critical-error option.',
        'This choice is unsafe because it turns a teaching comparison into an unsupported clinical claim.',
      ],
      [
        'Show pending option errors without implying validated competency or a patient-specific recommendation.',
        'Review the unsafe choices without treating the exercise score as a competency decision or patient recommendation.',
      ],
      [
        'Show pending option errors for unreassessed removal escalation and ignoring the visible whole-patient ledger.',
        'Review the unsafe choices: escalating removal without reassessment and ignoring the whole-patient fluid balance.',
      ],
      [
        'Show pending option errors for increasing BFR, declaring resolution after acknowledgement alone, or choosing anticoagulation before mechanical correction.',
        'Review why increasing BFR, declaring resolution after acknowledgement alone, or escalating anticoagulation before mechanical correction are unsafe in this case.',
      ],
      [
        'Act on one isolated signal',
        'Act on one finding without assessing the full clinical picture',
      ],
      [
        'Maintain the bounded setting while escalating multidisciplinary review',
        'Keep the current setting while seeking multidisciplinary review',
      ],
      [
        'Hold the bounded simulation state while escalating incomplete domain information',
        'Keep the current treatment unchanged while clarifying missing clinical information',
      ],
      [
        'Continue bounded support while obtaining missing recovery or transition information',
        'Continue current support while obtaining missing recovery or transition information',
      ],
      [
        'Apply the bounded simulated split option',
        'Change the pre/post replacement split while keeping total replacement flow unchanged',
      ],
      [
        'Convert a bounded qualitative teaching comparison into an unsupported universal recommendation.',
        'Treat a qualitative teaching comparison as a universal clinical recommendation.',
      ],
      [
        'Test a bounded reduction or pause without asserting a universal rate.',
        'Compare a cautious reduction with a pause without asserting a universal rate.',
      ],
      [
        'Apply the bounded option reduction, then advance the observation interval.',
        'Reduce machine fluid removal, then observe the patient and treatment response.',
      ],
      [
        'Change only the bounded simulated low-effective-flow term, then advance the review window.',
        'Change one low-flow contributor at a time, then observe the pressure and delivery trends.',
      ],
      [
        'The hemodynamic stress index is a bounded educational signal, not a blood-pressure prediction.',
        'The hemodynamic-tolerance trend is an educational cue, not a blood-pressure prediction.',
      ],
      [
        'Choose among explicit accepted alternatives based on the simulated tolerance signal.',
        'Compare reasonable options using the patient assessment, complete fluid balance, and hemodynamic-tolerance trend.',
      ],
      [
        'The accepted endpoint joins the cumulative ledger and tolerance abstraction.',
        'The endpoint combines whole-patient fluid balance with hemodynamic reassessment.',
      ],
      [
        'Review the bounded tolerance signal before changing removal.',
        'Review blood pressure, vasoactive support, and the hemodynamic-tolerance trend before changing removal.',
      ],
      [
        'The case records that tolerance was assessed before a plan change.',
        'Hemodynamic tolerance has been assessed before the plan change.',
      ],
      [
        'Machine removal increases while the bounded tolerance model remains available for reassessment.',
        'Machine removal increases; reassess the patient and hemodynamic trend before making another change.',
      ],
      [
        'The case records a consequential whole-balance reasoning error.',
        'The debrief identifies the error of equating machine removal with whole-patient balance.',
      ],
      [
        'The prescription signal changes and remains requires clinical verification.',
        'The prescription setting changes; verify actual delivery and reassess the patient response.',
      ],
      [
        'Identify every active CVVHDF source-flow term and its simulated source bag.',
        'Identify every active CVVHDF fluid stream and its corresponding bag.',
      ],
      [
        'Reassess the corrected inputs before interpreting any downstream model output.',
        'Reassess the corrected inputs before interpreting any downstream calculation.',
      ],
      [
        'The simulated body-weight entry changes weight-normalized dose display arithmetic, while hematocrit participates in the filter-risk model; neither entry is an alarm threshold.',
        'The entered weight changes the weight-normalized dose display, while hematocrit affects the filter-risk estimate; neither entry is an alarm threshold.',
      ],
      [
        'At constant blood flow, increased access resistance makes the modeled access pressure more negative.',
        'At constant blood flow, increased access resistance makes access pressure more negative in this exercise.',
      ],
      [
        'The model responds immediately to the corrected mechanical term; delivered therapy then requires confirmation.',
        'Access pressure changes after the mechanical cause is corrected; actual treatment delivery then requires confirmation.',
      ],
      [
        'The directional model predicts the opposite when resistance is unresolved.',
        'With unresolved resistance, increasing blood flow makes access pressure more negative.',
      ],
      [
        'The blood and fluid pumps resume in the simulated model.',
        'The blood and fluid pumps resume after cause correction.',
      ],
      [
        'The directional pressure model makes access pressure more negative.',
        'Access pressure becomes more negative while the obstruction remains unresolved.',
      ],
      [
        'The underlying fault and model-derived pressure pattern remain unresolved.',
        'The access problem and abnormal pressure pattern remain unresolved.',
      ],
      [
        'At the same blood flow, the model makes access pressure more negative when access resistance rises.',
        'At the same blood flow, rising access resistance makes access pressure more negative.',
      ],
      [
        'Compare the committed mechanism and expected direction with the model-derived pressure response.',
        'Compare the predicted mechanism and direction with the observed pressure response.',
      ],
      [
        'At the same BFR, the flow-resistance model produces a more-negative access pressure.',
        'At the same BFR, increased access resistance produces a more-negative access pressure.',
      ],
      [
        'Repositioning restores the resistance term, resolves the fault, and permits delivery confirmation.',
        'Repositioning relieves the access resistance, resolves the alert, and permits confirmation of treatment delivery.',
      ],
      [
        'The filter model integrates low effective flow and procoagulant burden over time; changing one simulated contributor alters the future direction without proving a bedside diagnosis.',
        'Low effective flow and procoagulant burden can contribute to rising filter burden over time; changing one contributor can alter the trend without proving a bedside diagnosis.',
      ],
      [
        'The selected risk term changes immediately, while filter burden and pressure signals evolve only through scheduled time advancement.',
        'The selected contributor changes immediately, while filter burden and pressure trends evolve as treatment time passes.',
      ],
      [
        'No scale fault is authored in this case; the external ledger is sufficient.',
        'No scale problem is present; the external fluid ledger explains the discrepancy.',
      ],
      [
        'Separate pending reviewer alternative with synthetic values and the same reassessment requirement.',
        'Reasonable alternative when uncertainty is communicated and the same reassessment steps are preserved.',
      ],
      [
        'The authored removal-flow signal changes immediately, while patient and cumulative balance signals require reassessment over time.',
        'The machine fluid-removal setting changes immediately; treatment delivery, whole-patient balance, and hemodynamic tolerance require reassessment over time.',
      ],
      [
        'delivery, whole-patient balance, and synthetic tolerance',
        'treatment delivery, whole-patient balance, and hemodynamic tolerance',
      ],
      [
        'Apply the synthetic diffusive-flow candidate',
        'Increase dialysate flow and verify treatment delivery',
      ],
      [
        'The candidate increases a synthetic diffusive-flow signal, but actual delivery and patient response remain time-dependent and require reassessment.',
        'Increasing dialysate flow increases prescribed diffusive clearance, but actual delivery and the patient response still require reassessment over time.',
      ],
      [
        'The prescription signal changes immediately; cumulative delivery and simulated solute direction do not become guaranteed outcomes.',
        'The dialysate-flow setting changes immediately; delivered therapy and electrolyte and acid-base responses must be reassessed over time.',
      ],
      [
        'Apply the authored value only after the complete assessment gate.',
        'Change dialysate flow only after confirming the clinical goal, current prescription, and actual treatment delivery.',
      ],
      [
        'Record an unsafe candidate that dismisses the whole authored context.',
        'Fail to address the urgent instability or escalate the unresolved treatment problem.',
      ],
      [
        'Improve the simulated small-solute and acid-base trajectory',
        'Improve the solute and acid-base trajectory',
      ],
      ['Define the simulated clearance goal', 'Define the solute and acid-base treatment goal'],
      [
        'Immediate normalization of all simulated laboratories',
        'Assume immediate normalization of all laboratory values',
      ],
      [
        'Review delivered dose, downtime, and delayed simulated laboratory direction',
        'Review delivered dose and downtime, and name the laboratory measurements to obtain',
      ],
      [
        'Delayed simulated response cannot be assessed without elapsed case time.',
        'Delivered dose and downtime cannot be compared without allowing case time to pass.',
      ],
      ['Advance six simulated hours', 'Observe six hours of treatment'],
      // CRRT-FELLOW-06 F06-R01: CRRT-04 runs a real delivery record and supplies laboratory values
      // once. These five strings promised a laboratory response over time, which no case models.
      [
        'Predict the immediate prescribed-dose display and the delayed direction of laboratory response.',
        'Predict the immediate prescribed-dose display, and name the laboratory measurements that would need reassessment over time; this case does not model them.',
      ],
      [
        'CVVHD changes the device clearance signal immediately, while simulated solute response is delayed and actual delivery falls during interruption.',
        'A CVVHD prescription changes the prescribed-dose display immediately, while actual delivery falls during the interruption. The laboratory response is not modeled here and would need serial clinical measurements.',
      ],
      [
        'The learner reassesses both machine delivery and delayed simulated laboratory direction.',
        'Reassessment covers the delivery record this run provides; solute and acid-base values would have to be measured and reviewed separately.',
      ],
      [
        'Immediate device-dose change, delayed laboratory direction',
        'Immediate device-dose change; delivered dose falls with downtime',
      ],
      [
        'Compare the committed prediction with the immediate dose display, delayed laboratory direction, and interruption effect.',
        'Compare the committed prediction with the immediate dose display and the effect of the interruption on delivered therapy.',
      ],
      [
        'The machine display reacts at prescription commit while the transparent solute model changes with elapsed delivered therapy.',
        'The machine display reacts when the prescription is committed, while delivered dose accumulates only with elapsed delivered therapy. Laboratory values are not modeled over time.',
      ],
      [
        'Compare the prescription with actual delivery and delayed response.',
        'Compare the prescription with actual delivery, and identify which clinical measurements would need reassessment.',
      ],
      [
        'Observe the delayed model response across the bounded interruption.',
        'Observe how the interruption changes actual treatment delivery. Laboratory values are not modeled over time.',
      ],
      [
        'Reassess dose, downtime, and simulated laboratory direction',
        'Reassess delivered dose and downtime, and name the laboratory values to recheck',
      ],
      [
        'Start the synthetic treatment only after the interface gates are complete.',
        'Start treatment only after prime and prescription review are complete. The machine keeps its own start interlock: this card is refused whenever the machine is not ready to start.',
      ],
      [
        'Review whether the learner defined the simulated small-solute and acid-base goal rather than chasing a machine number.',
        'Review whether the learner defined the solute and acid-base goal rather than chasing a machine number.',
      ],
      [
        'Delivered clearance drives delayed simulated solute direction.',
        'The solute and acid-base response would depend on the therapy actually delivered, not on the prescription alone; that response is not modeled here and needs serial clinical measurements.',
      ],
      [
        'Review prescribed dose, delivered dose, downtime, actual effluent, and the accessible delayed simulated laboratory summary.',
        'Review prescribed dose, delivered dose, downtime, and actual effluent. This case supplies laboratory values once, at case start; serial solute and acid-base measurements would have to be obtained and reviewed separately.',
      ],
      [
        'Explain that both authored synthetic dialysate paths can satisfy the case; neither is a universal clinical prescription.',
        'Explain that both dialysate-flow options can satisfy the case; neither is a universal clinical prescription.',
      ],
      [
        'Moving an authored portion of replacement flow upstream changes the synthetic dilution context while total replacement flow remains constant; this candidate does not calculate or prescribe a patient clearance target.',
        'Moving part of the replacement flow upstream changes blood dilution before the filter while total replacement flow remains constant; this comparison does not prescribe a preferred split.',
      ],
      [
        'The split changes in the synthetic prescription; no quantitative clinical advantage is asserted.',
        'The pre/post split changes while total replacement flow remains constant; reassess delivery and filter conditions before drawing a clinical conclusion.',
      ],
      ['Observe the complete synthetic delivery window', 'Observe the full delivery window'],
      [
        'Advance through the authored interruption and resumption before reassessment.',
        'Observe the interruption and resumption before reassessing actual delivery.',
      ],
      ['Assess simulated hemodynamic tolerance', 'Assess hemodynamic tolerance'],
      [
        'Multiple synthetic external input categories remain active while therapy runs.',
        'Maintenance fluid, medication carriers, nutrition, and other patient inputs continue while therapy runs.',
      ],
      [
        'Improve whole-patient balance while preserving simulated tolerance',
        'Improve whole-patient balance while preserving hemodynamic tolerance',
      ],
      [
        'Whole-patient balance improves without excessive simulated stress',
        'Whole-patient balance improves without worsening hemodynamic tolerance',
      ],
      ['Advance two simulated hours', 'Observe the next two hours of treatment'],
      [
        'Machine PFR is one ledger term; whole-patient balance is the net of every patient input and output, constrained by simulated tolerance.',
        'Machine PFR is one part of the fluid ledger; whole-patient balance is the net of every patient input and output and must be interpreted alongside hemodynamic tolerance.',
      ],
      [
        'When the authored machine-removal rate no longer fits the synthetic refill and reserve model, reducing or pausing it permits the bounded tolerance index to recover.',
        "When fluid removal exceeds the patient's plasma refill and cardiovascular reserve, reducing or pausing removal may improve tolerance; reassessment is required to confirm the response.",
      ],
      [
        'The flow changes immediately, while the synthetic tolerance index changes only after the authored observation interval.',
        'The machine-removal setting changes immediately; the patient response is reassessed after an observation interval.',
      ],
      [
        'Reduce the synthetic removal setting and observe',
        'Reduce machine fluid removal and observe',
      ],
      ['Pause synthetic removal and observe', 'Pause machine fluid removal and observe'],
      [
        'The removal signal changes and the synthetic tolerance trend is recomputed.',
        'The machine fluid-removal setting decreases; reassess hemodynamics, support needs, and whole-patient fluid balance.',
      ],
      [
        'Set the authored removal signal to zero for the same observation interval.',
        'Pause machine fluid removal for the observation interval, then reassess the patient.',
      ],
      [
        'The synthetic tolerance trend is recomputed with machine removal paused.',
        'Machine fluid removal is paused; reassess hemodynamics, support needs, and whole-patient fluid balance.',
      ],
      [
        'Apply the unsafe synthetic candidate without first resolving tolerance.',
        'Increase fluid removal without first assessing the cause of hemodynamic intolerance.',
      ],
      ['Assess the simulated patient and device state', 'Assess the patient and treatment'],
      [
        'Check immediate simulated safety before manipulating the access path.',
        'Review immediate patient safety and treatment status before manipulating the access path.',
      ],
      [
        'The assessment step is recorded without inventing a device priority.',
        'Immediate patient safety and treatment status are reviewed before the circuit is manipulated.',
      ],
      [
        'Advance thirty simulated minutes to the authored access event.',
        'Observe the next 30 minutes as the access-pressure pattern develops.',
      ],
      [
        'Pause the synthetic treatment while correcting the access path',
        'Pause treatment while correcting the access path',
      ],
      [
        'Reposition the synthetic access and relieve resistance',
        'Reposition the access and relieve the obstruction',
      ],
      [
        'Access resistance returns toward its synthetic baseline and the obstruction fault resolves.',
        'Access resistance falls toward its prior level and the obstruction alert resolves.',
      ],
      [
        'The authored event increases synthetic access resistance.',
        'The event increases access resistance.',
      ],
      [
        'The case authors a mechanical cause and keeps anticoagulation outside the active pilot.',
        'The pressure pattern points to a mechanical access problem; anticoagulation is not the first correction.',
      ],
      [
        'Introduce the authored low-flow contributor and observe',
        'Address the verified low-flow contributor and observe',
      ],
      [
        'The future filter-risk trajectory is recomputed; no alarm threshold or bedside diagnosis is supplied.',
        'The low-flow contributor improves; reassess pressure trends and actual treatment delivery before assigning a cause.',
      ],
      [
        'Preserve the synthetic state while requesting device and clinical review of the complete trend.',
        'Keep treatment unchanged while requesting review of the complete patient, access, circuit, and delivery trend.',
      ],
      ['without changing engine truth', 'without changing the case state'],
      ['The engine produces', 'The display shows'],
      ['The engine begins integrating', 'The simulation begins tracking'],
      ['source-mapped device math', 'the manufacturer-manual calculation'],
      ['source-mapped', 'manufacturer-referenced'],
      ['generic engine alert', 'generic training alert'],
      ['Generic engine alert', 'Generic training alert'],
      ['engine state', 'the simulated circuit state'],
      ['assessment gate', 'required assessment'],
      ['tolerance gate', 'assessment of tolerance'],
      ['verification gate', 'verification step'],
      ['interface gates', 'setup and review steps'],
      ['Private learning', 'Clinical exercise'],
      ['private learning', 'clinical exercise'],
      ['Reviewer-only', 'Clinical exercise'],
      ['reviewer-only', 'clinical exercise'],
      ['reviewer candidate', 'clinical option'],
      ['reviewer Candidate', 'clinical option'],
      ['reviewer assessment', 'clinical assessment'],
      ['reviewer path', 'clinical path'],
      ['reviewer scoring', 'practice scoring'],
      ['reviewer fixture', 'case setup'],
      ['reviewer draft', 'educational case'],
      ['pending reviewer', 'provisional'],
      ['pending clinical review', 'requires clinical verification'],
      ['pending independent review', 'requires independent verification'],
      ['pending review', 'under review'],
      ['review-pending', 'pending clinical review'],
      ['protected pilot', 'clinical curriculum'],
      ['Protected pilot', 'Clinical curriculum'],
      ['three-case pilot', 'v1 curriculum'],
      ['pilot interface', 'device interface'],
      ['pilot surface', 'device surface'],
      ['pilot values', 'case values'],
      ['pilot controls', 'device controls'],
      ['pilot workflow', 'device workflow'],
      ['Phase 7', 'v1'],
      ['phase 7', 'v1'],
    ] as const
  ).reduce((result, [search, replacement]) => result.split(search).join(replacement), value)

  return rewritten
    .replace(
      /Clinical exercise causal debrief for the pending (CRRT-\d+) candidate\./g,
      'Causal debrief for $1. Connect the goal, action, response, and reassessment.',
    )
    .replace(
      /Private learning causal debrief for the pending (CRRT-\d+) candidate\./g,
      'Causal debrief for $1. Connect the goal, action, response, and reassessment.',
    )
    .replace(
      /Reassessment of (.+) determined whether the candidate endpoint was reached\./g,
      // CRRT-FELLOW-06 F06-R02: prospective. This line is worked teaching shown after every run,
      // including one that reassessed nothing, so it cannot report a reassessment result.
      'Reassessing $1 would show whether the intended response occurred.',
    )
    .replace(/Start by stating the candidate (.+)\./g, 'Start by stating the clinical goal: $1.')
    .replace(
      /Compare the stated goal with the authored (.+); no numeric case value is a bedside target\./g,
      'Compare the stated goal with the case goal: $1. No single case value is a bedside target.',
    )
    .replace(
      /Authored context framed the candidate (.+)\./g,
      'The clinical context frames the goal: $1.',
    )
    .replace(/\bDefine the candidate /g, 'Define the ')
    .replace(/\bCandidate: /g, 'Unsafe action: ')
    .replace(/\bauthored\s+/gi, '')
    .replace(/\bsynthetic\b/g, 'simulated')
    .replace(/\bSynthetic\b/g, 'Simulated')
    .replace(/\bcandidate\b/g, 'option')
    .replace(/\bCandidate\b/g, 'Option')
    .replace(/\bdeterministic\b/g, 'scheduled')
    .replace(/\bcanonical\b/g, 'shared')
    .replace(/\bdevice adapter\b/g, 'device interface')
    .replace(/\bengine fixture\b/g, 'case simulation')
    .replace(/\bengine\b/g, 'simulation')
    .replace(/\bcalibration\b/g, 'exercise')
    .replace(/\bprojection\b/g, 'display')
    .replace(/\ba option\b/g, 'an option')
    .replace(/\ba assessment\b/g, 'an assessment')
    .replace(/\ban mechanical\b/g, 'a mechanical')
    .replace(/\bAn positional\b/g, 'A positional')
    .replace(/\ban resistance\b/g, 'a resistance')
    .replace(/\brequired required\b/g, 'required')
    .replace(/^The reviewer first defines the option (.+)\.$/, 'Define the $1.')
    .replace(
      /^The reviewer reassesses (.+) before interpreting the option path\.$/,
      'Reassess $1 before interpreting the response.',
    )
}

function rewriteLearnerFacingStrings(value: unknown): unknown {
  if (typeof value === 'string') return rewriteLearnerFacingString(value)
  if (Array.isArray(value)) return value.map(rewriteLearnerFacingStrings)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        // Wording is presentation only. Source records, review facts and simulation inputs
        // must never be promoted or rewritten by a prose substitution.
        [
          'sourceBasis',
          'reviewStatus',
          'engineFixtureConfiguration',
          'engineModelConfiguration',
          'initialPatient',
          'initialAccess',
          'initialPrescription',
          'effects',
        ].includes(key)
          ? nested
          : rewriteLearnerFacingStrings(nested),
      ]),
    )
  }
  return value
}

function learnerWording(value: unknown): unknown {
  return rewriteLearnerFacingStrings(value)
}

function mutableClone(definition: RuntimeCrrtCase): MutableRuntimeCrrtCase {
  return learnerWording(JSON.parse(JSON.stringify(definition))) as MutableRuntimeCrrtCase
}

function promoteExistingCase(definition: RuntimeCrrtCase): MutableRuntimeCrrtCase {
  const promoted = mutableClone(definition)
  promoted.title = clinicalTitleByCaseId[promoted.id as CrrtCaseId] ?? promoted.title
  promoted.patientDescription =
    clinicalPatientDescriptionByCaseId[promoted.id as CrrtCaseId] ?? promoted.patientDescription
  promoted.visibleFindings = [
    ...(clinicalVisibleFindingsByCaseId[promoted.id as CrrtCaseId] ?? promoted.visibleFindings),
  ]
  promoted.compatibleDevices = ['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx']
  promoted.contentVersion = BAXTER_CRRT_CONTENT_VERSION
  promoted.engineModelConfiguration.version = BAXTER_CRRT_CONTENT_VERSION
  promoted.debrief.machineNavigationPoint =
    'Apply the clinical reasoning through the PrisMax screen order and terminology; screens support rather than replace the reasoning.'
  return promoted
}

/**
 * Every v1 case includes a deterministic timed observation. Some of the former
 * review fixtures intentionally had no scheduled event; learner cases need the
 * same predict-run-reassess loop even when their source template did not.
 */
function ensureTimedResponse(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  if (definition.timedEvents.length > 0) return definition

  const syntheticSource = definition.sourceBasis.find(({ id }) => id.startsWith('SYNTH-'))
  if (!syntheticSource) {
    throw new Error(`Missing synthetic source for timed response in ${definition.id}.`)
  }

  const compactId = definition.id.toLowerCase().replace('-', '')
  const eventId = `${compactId}-event-reassessment-checkpoint`
  definition.timedEvents = [
    {
      id: eventId,
      atSimulationSeconds: 60,
      jitterSeconds: null,
      eventType: 'state-change',
      label: 'Timed response checkpoint before reassessment',
      effects: [
        {
          target: 'device.deliveryState',
          operation: 'set',
          valueType: 'enum',
          value: 'running',
          sourceId: syntheticSource.id,
        },
      ],
      sourceIds: [syntheticSource.id],
      reviewStatus: definition.hiddenMechanism.reviewStatus,
    },
  ]
  definition.engineFixtureConfiguration.timedEventMappings = [
    ...definition.engineFixtureConfiguration.timedEventMappings,
    {
      timedEventId: eventId,
      action: { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
    },
  ]
  return definition
}

function updateOption(
  options: RuntimeCrrtCase['goalOptions'],
  id: string,
  label: string,
  description: string,
  sourceIds: readonly string[],
): void {
  const option = options.find((candidate) => candidate.id === id)
  if (!option) throw new Error(`Unable to find CRRT option ${id}.`)
  option.label = label
  option.description = description
  option.sourceIds = [...sourceIds]
}

/**
 * CRRT-FELLOW-04 (F-07): what an action card says before it is performed.
 *
 * A card's description says what the action does, not whether it is the right choice. Several
 * printed their own verdict before the learner chose ("This action is unsafe because…", "This
 * path intentionally bypasses a required safety or verification step for debriefing", "Use the
 * explicit accepted pause-correct-resume alternative"), so the case answered itself. Each
 * replacement describes the same action — its effect in this simulation, or that it only records
 * a plan — without a verdict, and without making a dangerous action look safe: the labels, which
 * name what is unsafe about each one, are unchanged. The authored verdicts and explanations still
 * appear once an action is performed, in "Explain this case" and in the debrief.
 */
const ADAPTED_ACTION_DESCRIPTION =
  'Records this as your move. The machine beside the case keeps running as it is.'

const learnerActionDescriptionById: Readonly<Record<string, string>> = Object.freeze({
  'crrt01-action-unsafe-candidate':
    'Raise machine fluid removal now, before hemodynamic tolerance has been assessed and with no reassessment planned.',
  'crrt02-action-alternative-candidate':
    'Keep the current settings and ask the multidisciplinary team to review the incomplete treatment context urgently.',
  'crrt04-enter-dialysate-primary': 'Enter the case’s first example dialysate flow.',
  'crrt04-enter-dialysate-alternative':
    'Enter the case’s second example dialysate flow and compare the displayed result.',
  'crrt04-start-before-review':
    'Try to start treatment before prime and prescription review are recorded on the machine.',
  'crrt07-action-safe-candidate':
    'Replace the weight and hematocrit entries with the values given in the case information.',
  'crrt07-action-alternative-candidate':
    'Stop and ask for an independent check of the entries before going on.',
  'crrt10-increase-pfr-without-reassessment':
    'Raise machine PFR (patient fluid removal) before hemodynamic tolerance has been assessed.',
  'crrt13-pause-treatment': 'Pause blood and fluid delivery while the access path is corrected.',
  'crrt13-resume-treatment':
    'Resume blood and fluid delivery once the access path has been corrected.',
  'crrt13-escalate-anticoagulation-first':
    'Escalate anticoagulation before the mechanical access problem is corrected. The simulation applies no medication effect.',
})

/**
 * CRRT-FELLOW-04 (F-19): the safety explanations a learner reads in the debrief and in "Explain
 * this case", restated without build vocabulary ("pending option critical error", "scoring
 * records", "retained only as…"). Each keeps its meaning and its review status; where the
 * original gave no reason, none is added — the action's own label names what is unsafe.
 * Matched on the exact final wording, so a changed source string fails the copy test instead
 * of passing through silently.
 */
const learnerSafetyCopyByText: Readonly<Record<string, string>> = Object.freeze({
  'This exact unsafe option is simulated, under review, and must not be generalized to patient care.':
    'Unsafe here: it acts before the assessment this case depends on, or skips the check afterwards.',
  'Pending simulated critical-error option': 'Unsafe action in this case',
  'Clinical exercise scoring option; it is not an approved clinical critical-error rule.':
    'A safety step was skipped: the assessment before the action, or the reassessment after it.',
  'Attempting to bypass prime and prescription review is a pending option critical error; the device workflow blocks execution.':
    'Starting before prime and prescription review skips the setup check; the machine refuses the start.',
  'Pending clinical/device review; scoring records the unsafe choice even though the simulator blocks the device transition.':
    'The run records the unsafe choice even though the machine refuses the start.',
  'Pending clinical review; this case requires actual delivered-dose reassessment rather than reliance on the prescription alone.':
    'This case requires reassessing the dose actually delivered rather than relying on the prescription alone.',
  'Increasing removal without first assessing the tolerance signal is a pending option critical error.':
    'Increasing removal without first assessing hemodynamic tolerance skips the assessment this case requires.',
  'Pending clinical review; the simulator records this unsafe choice but does not generalize its case value to patient care.':
    'Removal was increased before blood pressure and vasopressor need were checked.',
  'Pending clinical review; visible external inputs and outputs must not be collapsed into the machine PFR setting.':
    'Visible external inputs and outputs must not be folded into the machine PFR setting.',
  'Pending clinical/device review; the model demonstrates the directional consequence without creating a universal threshold.':
    'More blood flow through a fixed resistance makes the access pressure more negative, not less.',
  'Pending clinical/device review; acknowledgement alone leaves the resistance and fault active.':
    'Acknowledgement alone leaves the resistance and the fault active.',
  'The case authors a mechanical cause; medication escalation is disabled and does not correct it.':
    'This case sets up a mechanical cause; escalating medication has no effect in the simulation and does not correct it.',
  'Pending clinical review; the pilot has no active anticoagulation protocol and the mechanical cause remains correctable independently.':
    'This case has no active anticoagulation protocol, and the mechanical cause can be corrected on its own.',
})

function plainSafetyCopy(value: string): string {
  return learnerSafetyCopyByText[value] ?? value
}

/** Post-action responses that contradicted the laboratory containment (F-19). */
const learnerActionResponseById: Readonly<Record<string, string>> = Object.freeze({
  'crrt04-advance-six-hours':
    'Dose, downtime, and the pressure and fluid trends update as case time passes. Laboratory values are not modeled over time.',
})

/**
 * Teaching-first pass (2026-10-08) over the ten cases promoted from the earlier registries.
 * Each pair replaces a deferral, a review-status phrase or a per-case boundary note with the
 * teaching it stood in for. Matched on the final wording; a pair that no longer matches fails
 * the copy test in `__tests__/teachingFirstCases.test.ts`.
 */
export const CRRT_TEACHING_FIRST_CASE_COPY: readonly (readonly [string, string])[] = Object.freeze([
  // CRRT-01
  [
    'Defer a numeric change and coordinate the goal',
    'Hold net removal where it is until the vasopressor dose is coming down',
  ],
  [
    'Escalate removal without assessment or reassessment',
    'Raise net removal now, before checking blood pressure and vasopressor need',
  ],
  [
    'Which local review and patient-specific reassessment would be required before using any numeric fluid-removal plan?',
    'This patient is 5.6 L positive on a stable vasopressor dose. What net removal per hour would you start with, and what would make you slow it?',
  ],
  [
    'The machine-removal setting changes; no bedside target is implied.',
    'The machine-removal setting changes.',
  ],
  // CRRT-02
  [
    'Preserve the setting and escalate urgent multidisciplinary review',
    'Give calcium, insulin and glucose now, then confirm the circuit is delivering before changing flows',
  ],
  [
    'Keep the current settings and ask the multidisciplinary team to review the incomplete treatment context urgently.',
    'Treat the potassium medically first. The dialysate flow stays where it is for now.',
  ],
  [
    'Escalate uncertainty rather than infer a universal setting.',
    `Raise the dose into the ${N('dose-delivered')} range and confirm it is being delivered.`,
  ],
  [
    'Fail to address the urgent instability or escalate the unresolved treatment problem.',
    'Leave the potassium of 6.9 mmol/L and the pH of 7.08 as they are and wait for the next routine bloods.',
  ],
  [
    'How would your local team verify indication, prescription, delivery, and response without relying on one isolated laboratory value?',
    'At 74 kg, what dialysate flow delivers 25 mL/kg/h, and when would you recheck the potassium?',
  ],
  // CRRT-04, CRRT-07
  ['The goal is documented without creating a patient-specific target.', 'The goal is recorded.'],
  [
    'Corrected inputs update the source-backed arithmetic immediately, while patient and filter trajectories still require time and review.',
    'Correcting the weight and hematocrit updates the dose in mL/kg/h and the filtration fraction at once. The patient and the filter respond over hours.',
  ],
  // CRRT-05
  [
    'Keep the original split and defer quantitative interpretation',
    'Keep the original split and compare filter life over the next day',
  ],
  [
    'The prescription remains unchanged and the uncertainty is explicit.',
    'The prescription is unchanged.',
  ],
  [
    'Preserve the flow split while documenting the unresolved calculation and review gates.',
    'Leave the split as it is.',
  ],
  [
    'This choice is unsafe because it turns a teaching comparison into an unsupported clinical claim.',
    'Neither conclusion follows. Pre-filter fluid protects the filter and costs some clearance; post-filter fluid does the reverse. And a rising filter pressure has several causes besides anticoagulation.',
  ],
  // CRRT-06
  [
    'Which prescribed, delivered, interruption, and bag signals would your local review require before judging treatment adequacy?',
    'A patient prescribed 25 mL/kg/h is off the machine for 5 hours in 24. What dose was delivered, and what would you prescribe tomorrow?',
  ],
  [
    'Observe the interruption onset and preserve uncertainty',
    'Watch only the start of the interruption',
  ],
  // CRRT-10
  [
    'Tolerance-guided simulated removal adjustment',
    'Raise net removal in a small step once blood pressure is checked',
  ],
  [
    'Multidisciplinary external-input coordination',
    'Cut the fluid going in: maintenance fluid and drug carriers',
  ],
  ['Coordinate a maintenance-fluid reduction', 'Stop or reduce the maintenance fluid'],
  [
    'Coordinate medication-carrier consolidation',
    'Concentrate the infusions to cut carrier volume',
  ],
  [
    'Review the need for maintenance fluid with the care team before changing it.',
    'Maintenance fluid in a patient on CRRT is volume the machine then has to remove.',
  ],
  [
    'Review medication-carrier inputs with the multidisciplinary care team.',
    'Ask the pharmacist which infusions can be concentrated; carrier volume adds up over a day.',
  ],
  [
    'This ignores hemodynamic reassessment and is not a patient-specific recommendation.',
    'This ignores what the blood pressure will tolerate.',
  ],
  // CRRT-13, CRRT-14
  [
    'During a simulated CVVHD treatment, access pressure becomes progressively more negative and a generic obstruction alert appears. Use a cause-first sequence and confirm restored delivery.',
    `A 70 kg patient on CVVHD at a blood flow of 120 mL/min. Access pressure becomes steadily more negative and the Access Extremely Negative alarm appears (PrisMax limit: ${N('access-low-limit')}). Find the cause, fix it, and confirm delivery is restored.`,
  ],
  ['Acknowledge the generic training alert', 'Silence the alarm'],
  [
    'Escalate anticoagulation before correcting the mechanical cause',
    'Add an anticoagulant before fixing the access',
  ],
  [
    'Escalate anticoagulation before the mechanical access problem is corrected. The simulation applies no medication effect.',
    'Treat the pressure change as clotting and add an anticoagulant, leaving the access as it is.',
  ],
  [
    'Unsafe action: escalate anticoagulation before correcting a mechanical cause',
    'Unsafe action: anticoagulant added before the access was fixed',
  ],
  [
    'This case sets up a mechanical cause; escalating medication has no effect in the simulation and does not correct it.',
    'The cause is mechanical: a catheter against the vessel wall or a kinked line. An anticoagulant does nothing for it and adds bleeding risk.',
  ],
  [
    'This case has no active anticoagulation protocol, and the mechanical cause can be corrected on its own.',
    'An access pressure problem is fixed at the catheter, and an anticoagulant does not help it.',
  ],
  [
    'Correct the mechanical cause before acknowledging resolution or escalating anticoagulation.',
    'Fix the mechanical cause before you silence the alarm or add an anticoagulant.',
  ],
  [
    'Escalate anticoagulation before correcting the return-path problem',
    'Add an anticoagulant before fixing the return line',
  ],
  [
    'Choose medication escalation before completing the mechanical return-path assessment.',
    'Treat the pressure change as clotting and add an anticoagulant, leaving the return line as it is.',
  ],
  [
    'The manual supports operating-point context, not a universal clinical normal.',
    'Access pressure depends on blood flow and the catheter, so read it against its own starting value.',
  ],
  // CRRT-15, CRRT-16
  [
    'Hold the current state and escalate trend review',
    'Leave the settings and recheck the pressure drop and TMP in an hour',
  ],
  [
    'Keep treatment unchanged while requesting review of the complete patient, access, circuit, and delivery trend.',
    'Change nothing now and look again at the same readings after an hour.',
  ],
  [
    'No causal label or corrective sequence is asserted.',
    'Nothing changes; you have a second reading to compare with the first.',
  ],
  [
    'Label the trend as anticoagulation failure and escalate blindly',
    'Call it anticoagulation failure and add an anticoagulant',
  ],
  [
    'Preserve device and clinical uncertainty when alarm thresholds and corrective workflow are not reviewed.',
    `Know when the filter is clotting: PrisMax advises at ${N('clotting-advisory')}, and alarms on TMP ${N('tmp-alarm')}.`,
  ],
  // Shared
  ['; these case values are not clinical thresholds.', '.'],
  [
    'A critical error identifies an omitted safety step in this exercise; it is not a competency determination.',
    'A critical error marks a safety step that was skipped.',
  ],
  [
    'A separate pending clinical path that preserves assessment, communication, and reassessment while avoiding an unsupported universal setting.',
    'Another acceptable route to the same endpoint.',
  ],
  [
    'Frames the whole simulated scenario before choosing a device or clinical control.',
    'The problem this patient needs solved.',
  ],
  [
    'Assume the response is immediate and guaranteed',
    'Expect the laboratory values to correct within minutes',
  ],
  [
    'This ignores treatment delivery and the need to verify the patient response.',
    'A setting changes at once; the patient changes over hours, and only if the treatment is delivered.',
  ],
  ['Do not reassess after the intervention', 'Wait for the next routine bloods'],
])

function applyTeachingFirstCopy(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  const { initialPatient, initialAccess, initialPrescription, sourceBasis, ...copy } = definition
  return {
    ...(replaceStrings(copy, CRRT_TEACHING_FIRST_CASE_COPY) as typeof copy),
    initialPatient,
    initialAccess,
    initialPrescription,
    sourceBasis,
  } as MutableRuntimeCrrtCase
}

function applyLearnerActionCopy(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  for (const intervention of definition.interventions) {
    const description = learnerActionDescriptionById[intervention.id]
    if (description) intervention.description = description
    const response = learnerActionResponseById[intervention.id]
    if (response) intervention.response = response
  }
  for (const unsafe of definition.unsafeActions) {
    unsafe.explanation = plainSafetyCopy(unsafe.explanation)
  }
  for (const criticalError of definition.criticalErrors) {
    criticalError.label = plainSafetyCopy(criticalError.label)
    criticalError.explanation = plainSafetyCopy(criticalError.explanation)
  }
  return definition
}

function buildAdaptedCase(narrative: CaseNarrative): MutableRuntimeCrrtCase {
  const template = sourceCaseById.get(narrative.templateId)
  if (!template) throw new Error(`Missing CRRT case template ${narrative.templateId}.`)

  const oldCompact = narrative.templateId.toLowerCase().replace('-', '')
  const newCompact = narrative.id.toLowerCase().replace('-', '')
  const cloned = replaceStrings(mutableClone(template), [
    [narrative.templateId, narrative.id],
    [oldCompact, newCompact],
  ]) as MutableRuntimeCrrtCase
  const syntheticId = `SYNTH-${narrative.id}`
  const narrativeSourceIds = unique([syntheticId, ...narrative.clinicalSourceIds])

  cloned.id = narrative.id
  cloned.sourceCaseId = narrative.id
  cloned.title = narrative.title
  cloned.stationId = narrative.stationId
  cloned.difficulty = narrative.difficulty
  cloned.compatibleDevices = ['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx']
  cloned.patientDescription = narrative.patientDescription
  cloned.learningObjectives = [...narrative.learningObjectives]
  cloned.visibleFindings = [narrative.openingFinding]
  if (narrative.patient) {
    cloned.initialPatient = {
      ...cloned.initialPatient,
      ...(narrative.patient.urineOutputMlPerHour === undefined
        ? {}
        : { urineOutputMlPerHour: narrative.patient.urineOutputMlPerHour }),
      solutes: { ...cloned.initialPatient.solutes, ...narrative.patient.solutes },
    }
    const totalCalciumMgPerDl = narrative.patient.solutes?.totalCalciumMgPerDl
    if (typeof totalCalciumMgPerDl === 'number') {
      // 1 mmol/L of calcium is 4.008 mg/dL; the engine fixture mirrors the authored value.
      cloned.engineFixtureConfiguration.patient.totalCalciumMmolL =
        Math.round((totalCalciumMgPerDl / 4.008) * 100) / 100
    }
  }
  cloned.contentVersion = BAXTER_CRRT_CONTENT_VERSION
  cloned.engineModelConfiguration.version = BAXTER_CRRT_CONTENT_VERSION

  cloned.hiddenMechanism.summary = narrative.mechanism
  cloned.hiddenMechanism.causalChain = [...narrative.causalChain]
  cloned.hiddenMechanism.sourceIds = [...narrativeSourceIds]

  updateOption(
    cloned.goalOptions,
    cloned.hiddenMechanism.correctGoalOptionId,
    narrative.goal,
    'Frames the whole synthetic scenario before choosing a device or clinical control.',
    narrativeSourceIds,
  )
  const incorrectGoal = cloned.goalOptions.find(
    (option) => option.id !== cloned.hiddenMechanism.correctGoalOptionId,
  )
  if (incorrectGoal) {
    incorrectGoal.label = narrative.goalDistractor
    incorrectGoal.description = 'A common first reading of this patient.'
    incorrectGoal.sourceIds = [syntheticId]
  }

  updateOption(
    cloned.mechanismOptions,
    cloned.hiddenMechanism.correctMechanismOptionId,
    narrative.mechanism,
    'The mechanism at work in this patient.',
    narrativeSourceIds,
  )
  const incorrectMechanism = cloned.mechanismOptions.find(
    (option) => option.id !== cloned.hiddenMechanism.correctMechanismOptionId,
  )
  if (incorrectMechanism) {
    incorrectMechanism.label = narrative.mechanismDistractor
    incorrectMechanism.description = 'A common first reading of this patient.'
    incorrectMechanism.sourceIds = [syntheticId]
  }

  const safeControlId = cloned.hiddenMechanism.correctControlOptionIds[0]
  updateOption(
    cloned.controlOptions,
    safeControlId,
    narrative.safeAction,
    'The first move, in order.',
    narrativeSourceIds,
  )
  const alternativeControlIds = cloned.acceptedAlternativePaths.flatMap(
    (path) => path.predictionControlOptionIds,
  )
  for (const alternativeControlId of alternativeControlIds) {
    if (alternativeControlId === safeControlId) continue
    updateOption(
      cloned.controlOptions,
      alternativeControlId,
      narrative.acceptedAlternative,
      narrative.alternativeWhy,
      narrativeSourceIds,
    )
  }
  const unsafeActionIds = new Set(cloned.unsafeActions.map((unsafe) => unsafe.actionId))
  const unsafeIntervention = cloned.interventions.find((action) => unsafeActionIds.has(action.id))
  const unsafeControl = cloned.controlOptions.find(
    (option) => option.id !== safeControlId && !alternativeControlIds.includes(option.id),
  )
  if (unsafeControl) {
    unsafeControl.label = narrative.unsafeAction
    unsafeControl.description = narrative.unsafeWhy
    unsafeControl.sourceIds = [syntheticId]
  }

  updateOption(
    cloned.responseOptions,
    cloned.hiddenMechanism.correctResponseOptionId,
    narrative.responseOptionLabel ?? 'Expect a linked response, then verify it',
    narrative.expectedResponse,
    narrativeSourceIds,
  )
  const correctReassessmentId = cloned.hiddenMechanism.correctReassessmentOptionIds[0]
  updateOption(
    cloned.reassessmentOptions,
    correctReassessmentId,
    narrative.reassessment,
    'What to look at again, and when.',
    narrativeSourceIds,
  )

  const requiredSafeAction = cloned.interventions.find(
    (action) =>
      cloned.requiredActionIds.includes(action.id) &&
      action.category !== 'assessment' &&
      action.category !== 'communication',
  )
  if (requiredSafeAction) {
    requiredSafeAction.label = narrative.safeAction
    requiredSafeAction.description = ADAPTED_ACTION_DESCRIPTION
    requiredSafeAction.response = narrative.expectedResponse
    requiredSafeAction.sourceIds = [...narrativeSourceIds]
  }
  for (const path of cloned.acceptedAlternativePaths) {
    path.label = narrative.acceptedAlternative
    path.explanation = narrative.alternativeWhy
    path.sourceIds = [...narrativeSourceIds]
    // The alternative's own card. Some templates file it under communication, so match the id
    // before falling back to the category.
    const alternativeIntervention =
      cloned.interventions.find(
        (action) =>
          path.actionIds.includes(action.id) && action.id.endsWith('action-alternative-candidate'),
      ) ??
      cloned.interventions.find(
        (action) =>
          path.actionIds.includes(action.id) &&
          !cloned.requiredActionIds.includes(action.id) &&
          action.category !== 'assessment' &&
          action.category !== 'communication',
      )
    if (alternativeIntervention) {
      alternativeIntervention.label = narrative.acceptedAlternative
      alternativeIntervention.description = ADAPTED_ACTION_DESCRIPTION
      alternativeIntervention.response =
        narrative.acceptedAlternativeResponse ?? narrative.expectedResponse
      alternativeIntervention.sourceIds = [...narrativeSourceIds]
    }
  }
  if (unsafeIntervention) {
    unsafeIntervention.label = narrative.unsafeAction
    unsafeIntervention.description = ADAPTED_ACTION_DESCRIPTION
    unsafeIntervention.response = `Recorded; the machine beside the case does not change. ${narrative.unsafeWhy}`
    unsafeIntervention.sourceIds = [syntheticId]
  }
  // A template can carry several unsafe actions (CRRT-14 has three). The narrative explains one
  // of them; the others keep their own explanations.
  const single = cloned.unsafeActions.length === 1
  for (const unsafe of cloned.unsafeActions) {
    if (!single && unsafe.actionId !== unsafeIntervention?.id) continue
    unsafe.explanation = narrative.unsafeWhy
    unsafe.sourceIds = [syntheticId]
  }
  for (const criticalError of cloned.criticalErrors) {
    if (!single && !(unsafeIntervention && criticalError.actionIds.includes(unsafeIntervention.id)))
      continue
    criticalError.label = narrative.unsafeAction
    criticalError.explanation = narrative.unsafeWhy
    criticalError.sourceIds = [syntheticId]
  }

  if (cloned.timedEvents[0]) {
    cloned.timedEvents[0].label = `Timed response: ${narrative.expectedResponse}`
    cloned.timedEvents[0].sourceIds = [...narrativeSourceIds]
    cloned.timedEvents[0].effects[0].sourceId = syntheticId
  }
  cloned.hintLadder.forEach((hint, index) => {
    hint.text =
      [
        `Start with the goal: ${narrative.goal}`,
        `The mechanism: ${narrative.mechanism}`,
        `The first move: ${narrative.safeAction}`,
      ][index] ?? narrative.reassessment
    hint.sourceIds = [...narrativeSourceIds]
  })

  cloned.debrief.summary = `${narrative.id}: ${narrative.title}`
  cloned.debrief.statedGoalReview = narrative.goal
  cloned.debrief.predictionReview = narrative.mechanism
  cloned.debrief.actionTimelineReview =
    'Read your run in order: what you expected, what you did first, and what you checked afterwards.'
  cloned.debrief.causalChain = [...narrative.causalChain]
  cloned.debrief.trendReview = narrative.trendReview
  cloned.debrief.requiredActionsReview = narrative.safeAction
  cloned.debrief.criticalErrorsReview = narrative.unsafeAction
  cloned.debrief.acceptedAlternativesReview = narrative.acceptedAlternative
  cloned.debrief.machineNavigationPoint =
    'On PrisMax, the Prescription screen shows the flows you set and the History screen shows what was delivered. Read both before you change either.'
  cloned.debrief.transferQuestion = narrative.transferQuestion
  cloned.debrief.sourceIds = [...narrativeSourceIds]

  const existingSourceIds = new Set(cloned.sourceBasis.map((source) => source.id))
  for (const sourceId of narrative.clinicalSourceIds) {
    if (existingSourceIds.has(sourceId)) continue
    const source = sourceById.get(sourceId)
    if (!source) throw new Error(`Missing source ${sourceId} for ${narrative.id}.`)
    cloned.sourceBasis.push({ ...source })
    existingSourceIds.add(sourceId)
  }
  const syntheticSource = cloned.sourceBasis.find((source) => source.id === syntheticId)
  if (!syntheticSource) throw new Error(`Missing synthetic source ${syntheticId}.`)
  syntheticSource.claim = `Every patient value, flow, timing, event magnitude, condition, and engine coefficient in ${narrative.id} is synthetic teaching calibration.`
  syntheticSource.value =
    'Not a patient-care target, device limit, alarm threshold, local protocol, or treatment recommendation.'
  syntheticSource.sourceTitle = 'Baxter CRRT v1 synthetic calibration record'
  syntheticSource.documentVersion = BAXTER_CRRT_CONTENT_VERSION
  syntheticSource.pageOrSection = `${narrative.id} private learning fixture`
  syntheticSource.implementationLocation = `content/completeCases.ts · ${narrative.id}`

  const unreferencedSourceIds = new Set(
    collectCrrtCaseSemanticIssues(cloned)
      .filter((issue) => issue.startsWith('Unreferenced source basis ID: '))
      .map((issue) => issue.replace('Unreferenced source basis ID: ', '')),
  )
  cloned.sourceBasis = cloned.sourceBasis.filter((source) => !unreferencedSourceIds.has(source.id))

  return cloned
}

/**
 * Adapted cases reuse a validated interaction sequence, but not the template's
 * physiologic intervention. Keeping a copied dialysate, weight, hematocrit, or
 * fluid-removal effect behind an unrelated clinical action would teach the
 * wrong causal relationship. Completion remains tied to the required actions
 * and reassessment while the adapted case presents its own clinical concept.
 */
function removeInheritedTemplatePhysiology(
  definition: MutableRuntimeCrrtCase,
): MutableRuntimeCrrtCase {
  for (const intervention of definition.interventions) intervention.effects = []
  for (const condition of definition.successConditions) {
    condition.metric = 'simulationTimeSeconds'
    condition.comparator = 'gte'
    condition.value = 0
    condition.unit = 'case completion check'
  }
  return definition
}

/**
 * CRRT-15 starts with no low-effective-flow term, so the former correction (set the term to 0.1,
 * and 0.6 before that) created the contributor it claimed to relieve and slightly steepened the
 * filter trend. The action keeps its one-hour observation and no longer changes filter risk; the
 * dormant completion condition keeps its bound, which the untouched starting value meets.
 */
function customizeFilterPressureCase(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  const check = definition.interventions.find((intervention) =>
    intervention.id.endsWith('action-safe-candidate'),
  )
  if (check) {
    check.effects = check.effects.filter(
      (effect) => effect.target !== 'circuit.filter.lowEffectiveBloodFlowFraction',
    )
  }

  const lowFlowCondition = definition.successConditions.find(
    (condition) => condition.metric === 'circuit.filter.lowEffectiveBloodFlowFraction',
  )
  if (lowFlowCondition) {
    lowFlowCondition.comparator = 'lte'
    lowFlowCondition.value = 0.2
  }

  return definition
}

/**
 * CRRT-05's template hangs a source bag only for flows running at the start. Moving replacement
 * before the filter then asked for a pre-filter flow with no bag, and the fluid model stopped every
 * pump while the machine still read running. Hang the pre-filter source the split needs.
 */
function customizeReplacementSplitCase(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  const bags = definition.engineFixtureConfiguration.bags
  if (bags.some((bag) => bag.flowTerm === 'pre-replacement')) return definition
  const postFilterSource = bags.find((bag) => bag.flowTerm === 'post-replacement')
  if (!postFilterSource) {
    throw new Error('CRRT-05 requires its post-filter replacement source.')
  }
  definition.engineFixtureConfiguration.bags = bags.flatMap((bag) =>
    bag === postFilterSource
      ? [
          {
            ...postFilterSource,
            id: 'pre-replacement-bag',
            label: 'Synthetic pre-replacement source',
            flowTerm: 'pre-replacement' as const,
            sourceIds: [...postFilterSource.sourceIds],
          },
          bag,
        ]
      : [bag],
  )
  return definition
}

/**
 * CRRT-02 worked cases replace generic goal, hint, reassessment and debrief copy with the
 * case-specific teaching in `workedCaseExamples.ts`, so the case and its worked example agree.
 */
function applyWorkedCaseRevision(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  const example = getCrrtWorkedCaseExample(definition.id)
  if (!example) return definition
  const { revision } = example

  definition.hiddenMechanism.summary = example.learningPoint
  definition.hiddenMechanism.causalChain = [...revision.debrief.causalChain]
  const goal = definition.goalOptions.find(
    (option) => option.id === definition.hiddenMechanism.correctGoalOptionId,
  )
  if (!goal) throw new Error(`Missing goal option for ${definition.id}.`)
  goal.label = revision.goal
  if (revision.patientDescription) definition.patientDescription = revision.patientDescription
  if (revision.visibleFindings) definition.visibleFindings = [...revision.visibleFindings]

  const hints = [...definition.hintLadder].sort((left, right) => left.sequence - right.sequence)
  if (hints.length !== revision.hints.length) {
    throw new Error(`${definition.id} hint ladder no longer matches its worked-case hints.`)
  }
  hints.forEach((hint, index) => {
    hint.text = revision.hints[index]
  })

  for (const [suffix, copy] of Object.entries(revision.interventions)) {
    const matches = definition.interventions.filter(({ id }) => id.endsWith(suffix))
    if (matches.length !== 1) {
      throw new Error(`${definition.id} has no single intervention ending in ${suffix}.`)
    }
    const [intervention] = matches
    if (copy.label) intervention.label = copy.label
    if (copy.description) intervention.description = copy.description
    if (copy.response) intervention.response = copy.response
  }

  const reassessments = definition.reassessmentOptions.filter(({ id }) =>
    definition.requiredReassessmentIds.includes(id),
  )
  if (reassessments.length !== 1) {
    throw new Error(`${definition.id} needs exactly one required reassessment option.`)
  }
  reassessments[0].label = revision.reassessmentLabel

  definition.debrief.summary = revision.debrief.summary
  definition.debrief.statedGoalReview = revision.goal
  definition.debrief.predictionReview = example.learningPoint
  definition.debrief.trendReview = revision.debrief.trendReview
  definition.debrief.causalChain = [...revision.debrief.causalChain]
  definition.debrief.transferQuestion = revision.debrief.transferQuestion
  return definition
}

function customizeReturnPressureCase(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  const bySuffix = (suffix: string) =>
    definition.interventions.find((intervention) => intervention.id.endsWith(suffix))

  definition.mechanismOptions = definition.mechanismOptions.slice(0, 2)

  const advance = bySuffix('advance-to-pattern')
  if (advance) {
    advance.label = 'Advance to the return-pressure change'
    advance.description = 'Advance case time until the return-path obstruction appears.'
    advance.response =
      'Return-path resistance rises, return pressure climbs, and the return-pressure alarm appears.'
  }

  const inspect = bySuffix('inspect-access-path')
  if (inspect) {
    inspect.label = 'Pause, assess the patient, and inspect the return path'
    inspect.description =
      'Inspect the return catheter and line for position, kinking, clamps, connections, and other visible causes.'
    inspect.response =
      'The pressure direction and circuit inspection localize the problem to the return path.'
  }

  const acknowledge = bySuffix('acknowledge-alert')
  if (acknowledge) {
    acknowledge.description = 'Silence the alarm. The cause is still there.'
    acknowledge.response =
      'The alert is acknowledged, but return-path resistance and the abnormal pressure remain.'
  }

  const pause = bySuffix('pause-treatment')
  if (pause) {
    pause.label = 'Keep the pump paused and flush or reposition the return lumen'
    pause.description =
      'For a line that is straight, unclamped and connected: the resistance is then at the catheter.'
    pause.response =
      'Treatment stays paused while the return lumen is flushed or the catheter repositioned.'
  }

  const correct = bySuffix('reposition-access')
  if (correct) {
    correct.label = 'Straighten the kinked return line'
    correct.description = 'Remove the kink you found when you traced the return line.'
    correct.response =
      'Return-path resistance falls, return pressure moves toward its prior trend, and the obstruction alert resolves.'
    correct.effects = correct.effects.map((effect) => {
      if (effect.target === 'access.accessResistanceMmHgPerMlMin') {
        return { ...effect, target: 'access.returnResistanceMmHgPerMlMin' }
      }
      if (effect.target === 'scenario.activeFaults.access-obstruction') {
        return { ...effect, target: 'scenario.activeFaults.return-obstruction' }
      }
      return effect
    })
  }

  const resume = bySuffix('resume-treatment')
  if (resume) {
    resume.description = 'Restart blood and fluid delivery once the return line is clear.'
    resume.response = 'Treatment resumes after the return path and pressure trend are reassessed.'
  }

  const confirm = bySuffix('confirm-restored-delivery')
  if (confirm) {
    confirm.label = 'Confirm return-pressure recovery and treatment delivery'
    confirm.description =
      'Reassess the patient, return path, return-pressure trend, alert state, and actual delivery.'
    confirm.response =
      'The case closes only after cause correction and restored delivery are verified.'
  }

  const increaseFlow = bySuffix('increase-bfr-through-obstruction')
  if (increaseFlow) {
    increaseFlow.label = 'Increase BFR through unresolved return-path resistance'
    increaseFlow.description =
      'Increase blood flow without correcting the return-path obstruction or reassessing the patient.'
    increaseFlow.response =
      'Return pressure rises further while the mechanical obstruction remains unresolved.'
  }

  const acknowledgeOnly = bySuffix('declare-resolved-after-ack')
  if (acknowledgeOnly) {
    acknowledgeOnly.response =
      'The return-path problem and abnormal pressure trend remain unresolved.'
  }

  const medicationFirst = bySuffix('escalate-anticoagulation-first')
  if (medicationFirst) {
    medicationFirst.label = 'Escalate anticoagulation before correcting the return-path problem'
    medicationFirst.description =
      'Choose medication escalation before completing the mechanical return-path assessment.'
    medicationFirst.response = 'The mechanical return-path problem remains unresolved.'
  }

  for (const event of definition.timedEvents) {
    if (event.id.endsWith('obstruction-flag')) {
      event.label = 'Return-path obstruction appears'
      event.effects = event.effects.map((effect) => ({
        ...effect,
        target: 'scenario.activeFaults.return-obstruction',
      }))
    }
    if (event.id.endsWith('resistance-rise')) {
      event.label = 'Return-path resistance rises'
      event.effects = event.effects.map((effect) => ({
        ...effect,
        target: 'access.returnResistanceMmHgPerMlMin',
      }))
    }
  }

  definition.engineFixtureConfiguration.timedEventMappings =
    definition.engineFixtureConfiguration.timedEventMappings.map((mapping) => {
      if (mapping.timedEventId.endsWith('obstruction-flag')) {
        return {
          ...mapping,
          action: {
            type: 'SET_FAULT' as const,
            fault: 'return-obstruction' as const,
            active: true,
          },
        }
      }
      if (mapping.timedEventId.endsWith('resistance-rise')) {
        return {
          ...mapping,
          action: { type: 'SET_RETURN_RESISTANCE' as const, resistanceMmHgPerMlMin: 1.2 },
        }
      }
      return mapping
    })

  for (const condition of definition.successConditions) {
    if (condition.metric === 'access.accessResistanceMmHgPerMlMin') {
      condition.metric = 'access.returnResistanceMmHgPerMlMin'
      condition.unit = 'simulated mmHg per mL/min completion boundary'
    }
    if (condition.metric === 'circuit.pressures.accessPressureMmHg') {
      condition.metric = 'circuit.pressures.returnPressureMmHg'
      condition.comparator = 'lt'
      condition.value = 100
      condition.unit = 'simulated mmHg completion boundary'
    }
  }

  return definition
}

const authoredNarratives: readonly CaseNarrative[] = [
  {
    id: 'CRRT-03',
    templateId: 'CRRT-02',
    title: 'Clearing solute when the brain is at risk',
    stationId: 'define-goal',
    difficulty: 'advanced',
    patientDescription:
      'A 74 kg adult with acute liver failure and grade 3 encephalopathy develops oliguric AKI. Potassium is 6.9 mmol/L, pH 7.08, bicarbonate 10 mmol/L, and urea (the small-solute marker on the monitor) 38 mmol/L. CRRT is running as CVVHD with dialysate at 1,000 mL/h and no net fluid removal. The night team asks whether to switch to intermittent hemodialysis "to fix the numbers faster".',
    learningObjectives: [
      'Explain why a fast fall in urea is dangerous when the brain is already swollen.',
      'Work out the delivered dose in mL/kg/h and compare it with the target.',
      'Choose continuous therapy at an adequate dose over a faster intermittent treatment.',
    ],
    goal: 'Correct the potassium and acidosis steadily, without a rapid fall in urea',
    goalDistractor: 'Bring the urea and potassium down as fast as the machine allows',
    mechanism:
      'Urea leaves blood faster than it leaves brain. A fast fall in blood urea pulls water into the brain; a swollen brain has no room for it',
    mechanismDistractor:
      'Urea is itself the toxin, so the encephalopathy improves in step with how fast urea falls',
    safeAction: `Stay on CRRT and raise the dialysate so the dose reaches ${N('dose-delivered')}, then recheck potassium, pH and sodium`,
    acceptedAlternative:
      'Stay on CRRT at the present dose, treat the potassium medically now, and recheck before changing the dose',
    alternativeWhy:
      'Also reasonable. Continuous therapy is kept, the potassium is treated at once with calcium, insulin and glucose, and the dose question is settled by the next set of results. The dose still needs to come up: 1,000 mL/h in a 74 kg patient is about 13.5 mL/kg/h.',
    unsafeAction: 'Switch to intermittent hemodialysis to correct the numbers faster',
    unsafeWhy:
      'Intermittent hemodialysis drops blood urea and osmolality in hours. In acute liver failure or brain injury that gradient moves water into the brain and can raise intracranial pressure. KDIGO suggests continuous therapy for patients with acute brain injury or raised intracranial pressure for this reason.',
    expectedResponse:
      'Your plan is recorded. At 74 kg, 1,000 mL/h is about 13.5 mL/kg/h; the target range needs roughly 1,500 to 1,850 mL/h. The machine beside the case keeps its settings, and its laboratory values are the case-start set.',
    responseOptionLabel: 'Potassium and pH improve over hours, and urea falls slowly',
    trendReview: `Check the arithmetic first: effluent ÷ weight. Here 1,000 ÷ 74 is about 13.5 mL/kg/h, below the ${N('dose-delivered')} that KDIGO recommends as delivered dose, so the answer to slow correction is more dialysate, and the answer is never a faster modality. Then follow potassium, pH, sodium and urea every few hours. What you want to see is a steady fall, with the neurological examination unchanged or better.`,
    reassessment:
      'Recheck potassium, pH, sodium and urea in a few hours, with a neurological examination each time',
    openingFinding:
      'Potassium 6.9 mmol/L, pH 7.08, urea 38 mmol/L, and a brain that cannot tolerate swelling. Dose now: about 13.5 mL/kg/h.',
    causalChain: [
      'Hyperkalemia and acidosis need correcting now, and CRRT at an adequate dose corrects both over hours.',
      'The brain is the limit on speed: a fast fall in blood urea leaves the brain relatively hyperosmolar, and water follows.',
      `So keep the treatment continuous and make the dose adequate: ${N('dose-delivered')} delivered, which means prescribing ${N('dose-prescribed')}.`,
    ],
    transferQuestion:
      'The same patient has a sodium of 124 mmol/L. How does that change the fluids you hang and how often you check?',
    clinicalSourceIds: ['GUID-KDIGO-AKI-2012', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-08',
    templateId: 'CRRT-07',
    title: 'The bag does not match the order',
    stationId: 'setup-start',
    difficulty: 'intermediate',
    patientDescription:
      'You are doing the second check before connecting a 120 kg patient whose potassium is 5.0 mmol/L. The order reads CVVHD with a 4 mmol/L potassium dialysate. The bag hanging on the dialysate scale is potassium-free. The set is primed and the nurse is ready to connect. The machine shown beside this case is an example circuit that is already running.',
    learningObjectives: [
      'Run the pre-connection check in a fixed order: patient, set, each bag against the order, lines, prime, prescription.',
      'Stop at the first mismatch and settle which is right, the order or the bag.',
      'Explain why the machine cannot catch a wrong solution.',
    ],
    goal: 'Connect only when every bag matches the order',
    goalDistractor: 'Get the treatment started, and correct the bag at the first bag change',
    mechanism:
      'The machine weighs bags; it does not read them. A wrong solution runs at the set rate with no alarm',
    mechanismDistractor:
      'The machine checks each bag against the prescription during prime, so a primed set has been verified',
    safeAction:
      'Stop before connecting, hang the ordered dialysate, and repeat the check from the top',
    acceptedAlternative:
      'Stop before connecting and ask the prescriber which is right, the order or the bag',
    alternativeWhy:
      'Also right. A mismatch has two possible errors, and with a potassium of 5.0 the potassium-free bag may be what was meant. Settle it before you change either one.',
    unsafeAction: 'Connect now and change the bag at the first bag change',
    unsafeWhy:
      'A 5 L bag at 1.5 L/h is more than three hours of potassium-free dialysate against a prescription written for 4 mmol/L. The potassium will fall faster and further than anyone planned, and no alarm will say so.',
    expectedResponse:
      'Your plan is recorded. The machine beside this case is an example that is already running; it does not model the pause before connection.',
    responseOptionLabel: 'Connection waits until the bag and the order agree',
    trendReview:
      'Nothing on the screen would have warned you. PrisMax tracks each bag by weight, so the only safeguard against a wrong solution is a person reading the label against the order. After any correction, repeat the whole check, because the interruption is when the next item gets skipped.',
    reassessment:
      'After the bag is corrected, repeat the whole check: set, every bag, lines, prime, prescription',
    openingFinding:
      'The order says 4 mmol/L potassium dialysate. The bag on the scale is potassium-free. The patient’s potassium is 5.0 mmol/L.',
    causalChain: [
      'The check has an order so that nothing is skipped: patient, set, each bag against the order, lines, prime, prescription.',
      'A mismatch stops the sequence. Decide which is right, the order or the bag, then fix the wrong one.',
      'Then start the check again from the top and connect when it is clean.',
    ],
    transferQuestion:
      'The same check finds a calcium-containing replacement bag on a circuit ordered for citrate. Why does that matter more than the potassium mismatch?',
    clinicalSourceIds: ['DEV-PM-005', 'DEV-PM-013'],
  },
  {
    id: 'CRRT-09',
    templateId: 'CRRT-07',
    title: 'Choosing anticoagulation for the circuit',
    stationId: 'setup-start',
    difficulty: 'advanced',
    patientDescription:
      'A 120 kg patient is starting CRRT on the first day after an emergency laparotomy. The surgeons are worried about bleeding. Liver function is normal and lactate is 1.8 mmol/L. Hematocrit is 46%. The machine offers no anticoagulant, a heparin syringe, or regional citrate with calcium. The machine shown beside this case is an example circuit already running without anticoagulant.',
    learningObjectives: [
      'Choose regional citrate as the first option when there is no contraindication.',
      'Name the two contraindications to check before citrate: severe liver failure and shock with a rising lactate.',
      'State what has to be set and timed before a citrate circuit starts.',
    ],
    goal: 'Keep the filter open without anticoagulating a patient who may bleed',
    goalDistractor: 'Get the longest possible filter life, whatever the method',
    mechanism:
      'Citrate binds calcium in the circuit, so blood cannot clot in the filter; calcium is replaced before the blood returns, so the patient is not anticoagulated',
    mechanismDistractor:
      'Citrate anticoagulates the patient more weakly than heparin, so it is the gentler systemic option',
    safeAction:
      'Choose regional citrate, then set the citrate and calcium rates and the first calcium sample times before starting',
    acceptedAlternative:
      'Run without anticoagulant, with a higher blood flow and pre-filter replacement, and accept a shorter filter life',
    alternativeWhy: `A reasonable choice when citrate is not available or not safe. Higher blood flow (the usual range is ${N('blood-flow-range')}) and pre-filter replacement both reduce clotting. Expect more filter changes and more downtime.`,
    unsafeAction: 'Start systemic heparin through the syringe pump',
    unsafeWhy:
      'Systemic heparin anticoagulates the patient as well as the circuit, on the first day after a laparotomy. KDIGO suggests regional citrate over heparin when there is no contraindication to citrate, and this patient has none.',
    expectedResponse:
      'Your choice is recorded. The machine beside this case runs without anticoagulant and does not change.',
    responseOptionLabel: 'The filter stays open and the patient’s clotting is unchanged',
    trendReview: `On citrate you follow two calcium values that answer two questions. Post-filter ionized calcium says whether the circuit is anticoagulated: the target is ${N('postfilter-ica')}, and a second text gives ${N('postfilter-ica-ceiling')}. Systemic ionized calcium says whether the patient is safe: the calcium infusion is titrated to ${N('systemic-ica')}. Check ${N('citrate-monitoring')}.`,
    reassessment: `Check post-filter and systemic ionized calcium on schedule: ${N('citrate-monitoring')}`,
    openingFinding:
      'First day after a laparotomy with a bleeding concern. Liver function normal, lactate 1.8 mmol/L. Three options on the machine.',
    causalChain: [
      'Bleeding risk rules out systemic heparin as the first choice.',
      'Normal liver function and a normal lactate mean this patient can metabolize citrate.',
      'So citrate is the choice, and what makes it safe is the calcium monitoring you set up before you start.',
    ],
    transferQuestion:
      'The same patient has an ALT in the thousands and a lactate of 7 mmol/L. What changes, and what would you watch if citrate were used anyway?',
    clinicalSourceIds: ['GUID-KDIGO-AKI-2012', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-12',
    templateId: 'CRRT-11',
    title: 'What CRRT removes besides urea',
    stationId: 'monitor-dose-fluid',
    difficulty: 'advanced',
    patientDescription:
      'Day 3 of CRRT in a 68 kg patient with septic shock. This morning: phosphate 1.4 mg/dL, magnesium 1.5 mg/dL, potassium 3.3 mmol/L, temperature 35.8 °C with the blood warmer off. Meropenem was reduced on day 1 "for renal failure" and has not been reviewed since. Enteral feeding is running at a low-protein renal formula.',
    learningObjectives: [
      'List what a CRRT circuit removes or cools: phosphate, potassium, magnesium, heat, water-soluble drugs and amino acids.',
      'Replace the electrolytes and warm the circuit as the first moves.',
      'Recognize antibiotic underdosing when a dose chosen for kidney failure is continued on CRRT.',
    ],
    goal: 'Replace what the circuit is taking out, and dose drugs and feeding for a patient on CRRT',
    goalDistractor: 'Treat the low values as markers of worsening sepsis',
    mechanism:
      'CRRT clears small water-soluble molecules without regard to whether they are wanted: phosphate, potassium, magnesium, antibiotics and amino acids all leave with the effluent, and the blood cools in the circuit',
    mechanismDistractor:
      'Low phosphate, magnesium and potassium on day 3 reflect refeeding, which CRRT does not affect',
    safeAction:
      'Replace phosphate, potassium and magnesium, turn the blood warmer on, then review the antibiotic dose and the feed',
    acceptedAlternative:
      'Replace the electrolytes and change to a phosphate-containing CRRT solution, then review the antibiotic dose and the feed',
    alternativeWhy:
      'Also right, and it deals with the cause as well as the result. A phosphate-containing dialysate or replacement fluid stops the daily loss, where a bolus only repays it.',
    unsafeAction: 'Put the low values down to sepsis and repeat the bloods tomorrow',
    unsafeWhy:
      'Every one of these has a circuit explanation and a fix. Severe hypophosphatemia weakens the diaphragm and delays weaning; a meropenem dose chosen for an anuric patient is too low once CRRT is clearing the drug; a temperature of 35.8 °C can hide a fever.',
    expectedResponse:
      'Your plan is recorded. The machine beside the case keeps running; its laboratory values are the case-start set and do not change.',
    responseOptionLabel: 'The electrolytes correct and stay corrected once the loss is replaced',
    trendReview:
      'Read these as one pattern. Anything small and water-soluble crosses the membrane, so by day 3 the circuit has removed phosphate, potassium and magnesium, cleared a meaningful share of a renally excreted antibiotic, and taken amino acids with the effluent. Blood also loses heat in the circuit. Replace, warm, and re-dose: antibiotics for CRRT clearance with the pharmacist, protein raised with the dietitian.',
    reassessment:
      'Repeat phosphate, potassium and magnesium after replacement, and the temperature with the warmer on',
    openingFinding:
      'Phosphate 1.4 mg/dL, magnesium 1.5 mg/dL, potassium 3.3 mmol/L, temperature 35.8 °C, a reduced antibiotic dose and a low-protein feed.',
    causalChain: [
      'The circuit removes small solutes whether or not the patient can spare them.',
      'Replace the deficits and stop the loss where you can: phosphate-containing fluid, the blood warmer.',
      'Then correct the two prescriptions written for a patient without clearance: the antibiotic dose and the protein in the feed.',
    ],
    transferQuestion:
      'The dose is raised from 25 to 35 mL/kg/h. Which of these problems get worse, and does the patient gain anything?',
    clinicalSourceIds: ['REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026'],
    patient: { solutes: { phosphateMgPerDl: 1.4, magnesiumMgPerDl: 1.5, potassiumMmolPerL: 3.3 } },
  },
  {
    id: 'CRRT-14',
    templateId: 'CRRT-13',
    title: 'High return pressure versus return disconnection',
    stationId: 'pressures-troubleshooting',
    difficulty: 'advanced',
    patientDescription:
      'A 70 kg patient on CVVHD is turned for pressure care. Minutes later the return pressure starts to move. Work out from its direction whether blood is meeting an obstruction on the way back or leaving the circuit.',
    learningObjectives: [
      'Read the direction of a return-pressure change: up for obstruction, down for disconnection.',
      `Know the two PrisMax limits: Return Extremely Positive ${N('return-high-limit')} and Return Disconnection ${N('return-disconnect-limit')}.`,
      'Trace the return line from the chamber to the catheter before touching the blood flow.',
    ],
    goal: 'Find where the return path is blocked or open, and fix it',
    goalDistractor: 'Bring the return pressure back into range by adjusting the blood flow',
    mechanism:
      'Return pressure is flow times the resistance downstream of the sensor. A kink, clamp or clot raises it; a line that has come apart drops it toward zero',
    mechanismDistractor:
      'Return pressure follows filter clotting, so a rising value means the filter is failing',
    safeAction:
      'Pause, check the patient, then trace the return line from the chamber to the catheter',
    acceptedAlternative:
      'Keep the pump paused and flush or reposition the return lumen when the line itself is clear',
    alternativeWhy:
      'The next step when the line is straight, unclamped and connected: the resistance is then at the catheter. Flush the return lumen or reposition the patient or catheter, and swap the lumens only as a temporary measure.',
    unsafeAction: 'Increase blood flow to push through the resistance',
    unsafeWhy: `More flow through the same resistance raises the pressure further. Once return pressure is ${N('return-high-limit')} PrisMax stops the pump, and a forced return against a clot can dislodge it.`,
    expectedResponse:
      'With the kink relieved, return pressure falls back toward where it started and the alarm clears.',
    trendReview: `Direction is the whole diagnosis here. A return pressure climbing toward the Return Extremely Positive limit (${N('return-high-limit')}) is resistance downstream: look for a kink under the patient, a closed clamp, or a clotting return lumen. A return pressure falling ${N('return-disconnect-limit')} is the Return Disconnection alarm: look at the connection and the bed for blood before anything else.`,
    reassessment: 'Recheck the return pressure trend, the catheter site and the time off treatment',
    openingFinding: 'Return pressure changed within minutes of the patient being turned.',
    causalChain: [
      'Turning the patient kinked the return line, so resistance downstream of the sensor rose.',
      'Return pressure rose with it: same flow, more resistance.',
      'Straightening the line removes the resistance, and the pressure returns to its earlier value at the same blood flow.',
    ],
    transferQuestion:
      'Return pressure falls to +5 mmHg and the alarm reads Return Disconnection. What do you look at first, and what do you not do?',
    clinicalSourceIds: ['DEV-PM-009', 'DEV-PM-010'],
  },
  {
    id: 'CRRT-16',
    templateId: 'CRRT-15',
    title: 'Three filters lost in two days',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'An 80 kg patient on CVVHDF without anticoagulant has lost three filters in 36 hours, none lasting 12. Blood flow is 130 mL/min through a catheter that alarms on access pressure when the patient is turned. Replacement runs 400 mL/h before the filter and 400 mL/h after it, net removal is 50 mL/h, and hematocrit is 36%.',
    learningObjectives: [
      'Work through early filter loss in a fixed order: access and blood flow, filtration fraction, downtime, then anticoagulation.',
      `Calculate filtration fraction and compare it with the ${N('filtration-fraction-ceiling')} ceiling.`,
      'Fix the mechanical causes before adding an anticoagulant.',
    ],
    goal: 'Find why the filters are clotting, mechanical causes first',
    goalDistractor: 'Add an anticoagulant so the next filter lasts',
    mechanism:
      'Blood clots in a filter when it stops, slows or is over-concentrated. A poor catheter does the first two; a high filtration fraction does the third',
    mechanismDistractor:
      'Filters clot early because the patient is hypercoagulable, so the circuit history adds little',
    safeAction:
      'Check the catheter and the alarm history, calculate filtration fraction, then decide on anticoagulation',
    acceptedAlternative:
      'Have the catheter replaced or repositioned and start regional citrate with the next filter',
    alternativeWhy:
      'Reasonable when the catheter is plainly the problem and nothing contraindicates citrate: fix the access and anticoagulate the next circuit together, so the fourth filter is not spent finding out.',
    unsafeAction: 'Start a new filter on the same settings and catheter',
    unsafeWhy:
      'Nothing has changed, so the fourth filter will last as long as the third. Each lost filter costs the blood in the circuit and hours of treatment.',
    expectedResponse:
      'The access-pressure alarms and stops point to the catheter. Filtration fraction here is about 16%, so over-concentration is not the cause.',
    // Replaced by the CRRT-16 worked-case revision.
    trendReview: `Take the causes in order. Access: a blood flow of 130 mL/min is at the bottom of the usual ${N('blood-flow-range')}, and every access alarm stops the pump, so blood sits in the fibers. Filtration: plasma flow is 130 × 60 × (1 − 0.36), about 5,000 mL/h; fluid removed across the membrane is 400 + 400 + 50 = 850 mL/h; with the pre-filter fluid added to the denominator the fraction is about 16%, well under ${N('filtration-fraction-ceiling')}. Downtime: add up the stops. Anticoagulation comes last, once the catheter works.`,
    reassessment:
      'With the next filter, watch access pressure, the number of pump stops, and the filter pressure drop and TMP trend',
    openingFinding:
      'Three filters in 36 hours, blood flow 130 mL/min, and an access pressure alarm at every turn.',
    causalChain: [
      'The catheter cannot supply the set blood flow when the patient moves, so the pump stops repeatedly.',
      'Stopped blood clots in the fibers; each stop takes a little more of the filter.',
      'Filtration fraction is about 16%, so the fix is the access and the blood flow, and then an anticoagulant.',
    ],
    transferQuestion:
      'The catheter is replaced and blood flow is 200 mL/min, and all 800 mL/h of replacement is moved after the filter. What is the filtration fraction now?',
    clinicalSourceIds: ['DEV-PM-009', 'DEV-PM-010', 'REVIEW-CKRT-CORE-2025'],
  },
  {
    id: 'CRRT-17',
    templateId: 'CRRT-11',
    title: 'Citrate accumulation',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'A 68 kg patient in septic shock with ischemic hepatitis has been on regional citrate for 18 hours. The calcium infusion has been increased three times overnight. Now: systemic ionized calcium 0.88 mmol/L, total calcium 11.0 mg/dL (2.75 mmol/L), pH 7.22, bicarbonate 14 mmol/L with a widening anion gap, lactate 6.8 mmol/L and rising. Post-filter ionized calcium is 0.30 mmol/L.',
    learningObjectives: [
      `Calculate the total-to-ionized calcium ratio and recognize accumulation ${N('calcium-ratio')}.`,
      'Tell the two calcium samples apart: post-filter for the circuit, systemic for the patient.',
      'Reduce or stop citrate as the first move, and keep replacing calcium.',
    ],
    goal: 'Stop citrate building up in a patient who cannot metabolize it',
    goalDistractor: 'Get the systemic ionized calcium back into range with more calcium',
    mechanism:
      'A liver in shock cannot convert citrate to bicarbonate. Citrate stays in the blood bound to calcium: total calcium rises, ionized calcium falls, and the missing bicarbonate shows as an anion-gap acidosis',
    mechanismDistractor:
      'The circuit is removing too much calcium across the filter, so the calcium infusion is simply set too low',
    safeAction: 'Reduce or stop the citrate, keep replacing calcium, and recheck the ratio and pH',
    acceptedAlternative:
      'Lower the blood flow and citrate rate together, raise the dialysate flow, and recheck the ratio and pH',
    alternativeWhy:
      'The same move in its graded form. Less blood flow needs less citrate, and more dialysate clears more of the citrate-calcium complex. If the ratio does not fall, stop citrate.',
    unsafeAction: 'Increase the calcium infusion again and leave the citrate rate alone',
    unsafeWhy:
      'The fourth increase treats the number and feeds the problem. The ionized calcium is low because citrate is holding it, and an escalating calcium requirement is itself a sign of accumulation. The acidosis will keep worsening until the citrate load comes down.',
    expectedResponse:
      'Your plan is recorded. The machine beside the case keeps running; its laboratory values are the case-start set and do not change.',
    responseOptionLabel: 'The ratio and the acidosis improve once the citrate load falls',
    trendReview: `Do the ratio in the same units: 2.75 ÷ 0.88 is 3.1, ${N('calcium-ratio')}. With an anion-gap acidosis and a calcium infusion that keeps going up, that is citrate accumulation. The post-filter value of 0.30 mmol/L is inside its ${N('postfilter-ica')} target, which tells you the circuit is anticoagulated and tells you nothing about the patient. Cut the citrate load, replace calcium to keep systemic ionized calcium at ${N('systemic-ica')}, and repeat total and ionized calcium and a blood gas.`,
    reassessment:
      'Repeat total and ionized calcium, the ratio, pH and lactate after the citrate load is reduced',
    openingFinding:
      'Ionized calcium 0.88 mmol/L and total calcium 2.75 mmol/L after three increases in the calcium infusion; pH 7.22; lactate 6.8 mmol/L.',
    causalChain: [
      'Shock liver stops citrate metabolism, so citrate-calcium complexes build up in the blood.',
      'Total calcium rises while ionized calcium falls: the ratio is 3.1.',
      'Citrate that is not metabolized yields no bicarbonate, so an anion-gap acidosis develops. The treatment is less citrate.',
    ],
    transferQuestion:
      'A different patient on citrate has a ratio of 2.1, pH 7.52 and bicarbonate 34 mmol/L. What is this, and which way do you move the citrate and the dialysate?',
    clinicalSourceIds: ['REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026'],
    patient: {
      solutes: {
        systemicIonizedCalciumMmolPerL: 0.88,
        totalCalciumMgPerDl: 11,
        pH: 7.22,
        bicarbonateMmolPerL: 14,
      },
    },
  },
  {
    id: 'CRRT-18',
    templateId: 'CRRT-11',
    title: 'Coming off CRRT',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'Day 6 of CRRT in a 68 kg patient recovering from septic shock, now off vasopressors and 1.5 L negative over two days. Urine output has risen to 620 mL over the last 24 hours with no diuretic. Potassium and pH are normal on CRRT. The filter is due to be changed in a few hours.',
    learningObjectives: [
      `Use urine output to judge readiness: ${N('liberation-urine-output')}.`,
      'Explain why creatinine measured on CRRT does not show kidney recovery.',
      'Plan a trial off CRRT: when to stop, what to measure, and when to restart.',
    ],
    goal: 'Decide whether the kidneys can take over, and test it',
    goalDistractor: 'Continue CRRT until the creatinine is back to baseline',
    mechanism:
      'On CRRT the machine sets the creatinine, so it cannot show recovery. Urine output is the kidney’s own work, and it is the best predictor of staying off',
    mechanismDistractor:
      'A creatinine that is falling on CRRT shows the kidneys are recovering, so it is the value to follow',
    safeAction:
      'Stop at the filter change, leave the catheter in, and follow urine output, potassium and creatinine daily',
    acceptedAlternative:
      'Let this filter run to the end of its life without a replacement, then follow the same measurements',
    alternativeWhy: `The same trial with a different stopping point. PrisMax allows a set to run ${N('set-life')}; a planned stop at the end of the filter costs nothing.`,
    unsafeAction: 'Keep CRRT running until the creatinine is normal',
    unsafeWhy:
      'Creatinine on CRRT reflects the dose, so this waits for a signal that will not come. Every extra day on the circuit is another day of a dialysis catheter, anticoagulation, immobility and lost phosphate, drugs and amino acids.',
    expectedResponse:
      'Your plan is recorded. The machine beside the case keeps running; this case does not model the days after stopping.',
    responseOptionLabel: 'Off CRRT, urine output holds and potassium stays in range',
    trendReview: `Urine output of 620 mL/day without a diuretic clears the bar that predicted sustained weaning in the BEST Kidney cohort: ${N('liberation-urine-output')}. Stop at a natural point, keep the catheter for a day or two, and measure what the kidneys now have to do alone: urine volume, potassium, bicarbonate, and the daily rise in creatinine. A creatinine that rises and then levels off is recovery. Restart for hyperkalemia, acidosis or fluid overload that medical treatment does not control.`,
    reassessment:
      'Each day off: urine volume, fluid balance, potassium, bicarbonate and creatinine',
    openingFinding:
      'Urine output 620 mL in 24 hours without a diuretic, off vasopressors, filter change due.',
    causalChain: [
      'Rising urine output without a diuretic is the kidney recovering.',
      'Creatinine cannot confirm it while the machine is clearing creatinine.',
      'So the test is a trial off: stop, measure daily, and restart for potassium, acid or fluid the patient cannot handle.',
    ],
    transferQuestion:
      'Two days off CRRT: urine output 900 mL/day, potassium 5.9 mmol/L, creatinine still rising. Restart or wait, and why?',
    clinicalSourceIds: ['GUID-NICE-NG148-2024', 'GUID-RRT-ICU-2026'],
    patient: { urineOutputMlPerHour: 26 },
  },
]

const adaptedCases = authoredNarratives
  .map(buildAdaptedCase)
  .map((definition) =>
    definition.id === 'CRRT-14'
      ? customizeReturnPressureCase(definition)
      : removeInheritedTemplatePhysiology(definition),
  )
  .map(ensureTimedResponse)
  .map(applyWorkedCaseRevision)
const adaptedCaseIds = new Set(adaptedCases.map((definition) => definition.id))
const promotedCases = sourceCases
  .filter((definition) => !adaptedCaseIds.has(definition.id))
  .map(promoteExistingCase)
  .map((definition) => {
    if (definition.id === 'CRRT-05') return customizeReplacementSplitCase(definition)
    if (definition.id === 'CRRT-15') return customizeFilterPressureCase(definition)
    return definition
  })
  .map(ensureTimedResponse)
  .map(applyWorkedCaseRevision)

const parsedCases = runtimeCrrtCaseRegistrySchema.parse(
  [...promotedCases, ...adaptedCases]
    .map((definition) => learnerWording(definition) as MutableRuntimeCrrtCase)
    .map(applyLearnerActionCopy)
    .map(applyTeachingFirstCopy)
    .sort((left, right) => left.id.localeCompare(right.id)),
)
const registryIssues = validateCrrtCaseRegistry(parsedCases, {
  expectedCaseIds: CRRT_ALL_CASE_IDS,
  registryLabel: 'Baxter CRRT v1 learner',
})
for (const [index, expectedId] of CRRT_ALL_CASE_IDS.entries()) {
  if (parsedCases[index]?.id !== expectedId) {
    registryIssues.push(
      `Baxter CRRT v1 case order mismatch at ${index}: expected ${expectedId}, received ${parsedCases[index]?.id ?? 'missing'}`,
    )
  }
}
if (registryIssues.length > 0) {
  throw new Error(`Invalid Baxter CRRT v1 learner registry: ${registryIssues.join('; ')}`)
}

export const baxterCrrtCases: readonly RuntimeCrrtCase[] = deepFreeze(parsedCases)

const caseById = new Map(baxterCrrtCases.map((definition) => [definition.id, definition]))

export function getBaxterCrrtCase(caseId: CrrtCaseId): RuntimeCrrtCase {
  const definition = caseById.get(caseId)
  if (!definition) throw new Error(`Unknown Baxter CRRT case: ${caseId}`)
  return definition
}
