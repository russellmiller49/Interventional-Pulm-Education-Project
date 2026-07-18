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
  readonly unsafeAction: string
  readonly expectedResponse: string
  readonly reassessment: string
  readonly openingFinding: string
  readonly causalChain: readonly string[]
  readonly transferQuestion: string
  readonly clinicalSourceIds: readonly string[]
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
        'This misses a required safety step: confirming the patient and treatment response.',
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
        'Apply the same clinical reasoning on either device while accounting for differences in screen order and terminology.',
      ],
      [
        'Frames the whole synthetic scenario before choosing a device or clinical control.',
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
        'Complete the source-mapped educational setup gates before starting.',
        'Complete prime and prescription review before starting treatment.',
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
        'Review delivered dose, downtime, and delayed laboratory trends',
      ],
      [
        'Delayed simulated response cannot be assessed without elapsed case time.',
        'A delayed patient response cannot be assessed without allowing case time to pass.',
      ],
      ['Advance six simulated hours', 'Observe six hours of treatment'],
      [
        'Observe the delayed model response across the bounded interruption.',
        'Observe how the interruption changes actual treatment delivery and later laboratory trends.',
      ],
      [
        'Reassess dose, downtime, and simulated laboratory direction',
        'Reassess dose, downtime, and laboratory trends',
      ],
      [
        'Start the synthetic treatment only after the interface gates are complete.',
        'Start treatment only after prime and prescription review are complete.',
      ],
      [
        'Review whether the learner defined the simulated small-solute and acid-base goal rather than chasing a machine number.',
        'Review whether the learner defined the solute and acid-base goal rather than chasing a machine number.',
      ],
      [
        'Delivered clearance drives delayed simulated solute direction.',
        'Delivered clearance drives the later solute and acid-base trends.',
      ],
      [
        'Review prescribed dose, delivered dose, downtime, actual effluent, and the accessible delayed simulated laboratory summary.',
        'Review prescribed dose, delivered dose, downtime, actual effluent, and the later laboratory trends.',
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
      ['review-pending', 'simulated'],
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
      'Reassessing $1 showed whether the intended response occurred.',
    )
    .replace(/Start by stating the candidate (.+)\./g, 'Start by stating the clinical goal: $1.')
    .replace(
      /Compare the stated goal with the authored (.+); no numeric case value is a bedside target\./g,
      'Compare the stated goal with the case goal: $1. No single case value is a bedside target.',
    )
    .replace(
      /Authored context framed the candidate (.+)\./g,
      'The clinical context framed the goal: $1.',
    )
    .replace(/\bDefine the candidate /g, 'Define the ')
    .replace(/\bCandidate: /g, 'Unsafe action: ')
    .replace(/\bauthored\s+/gi, '')
    .replace(/\bsynthetic\b/g, 'simulated')
    .replace(/\bSynthetic\b/g, 'Simulated')
    .replace(/\bcandidate\b/g, 'option')
    .replace(/\bCandidate\b/g, 'Option')
    .replace(/\breviewer\b/g, 'learner')
    .replace(/\bReviewer\b/g, 'Learner')
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
    .replace(/\ban resistance\b/g, 'a resistance')
    .replace(/\brequired required\b/g, 'required')
}

function rewriteLearnerFacingStrings(value: unknown): unknown {
  if (typeof value === 'string') return rewriteLearnerFacingString(value)
  if (Array.isArray(value)) return value.map(rewriteLearnerFacingStrings)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, rewriteLearnerFacingStrings(nested)]),
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
    'Apply the same clinical reasoning on either device while accounting for differences in screen order and terminology.'
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
  cloned.visibleFindings = [
    narrative.openingFinding,
    'The displayed values are synthetic teaching calibration, not patient-care targets.',
    'Before acting, predict the expected machine and patient response and identify what you will reassess.',
  ]
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
    incorrectGoal.label = 'Act on one isolated signal'
    incorrectGoal.description = 'This bypasses the whole-scenario assessment and uncertainty.'
    incorrectGoal.sourceIds = [syntheticId]
  }

  updateOption(
    cloned.mechanismOptions,
    cloned.hiddenMechanism.correctMechanismOptionId,
    'Use the linked causal pattern',
    narrative.mechanism,
    narrativeSourceIds,
  )
  const incorrectMechanism = cloned.mechanismOptions.find(
    (option) => option.id !== cloned.hiddenMechanism.correctMechanismOptionId,
  )
  if (incorrectMechanism) {
    incorrectMechanism.label = 'Assume the device display proves the cause'
    incorrectMechanism.description =
      'A display is one observation and does not replace patient, circuit, and delivery assessment.'
    incorrectMechanism.sourceIds = [syntheticId]
  }

  const safeControlId = cloned.hiddenMechanism.correctControlOptionIds[0]
  updateOption(
    cloned.controlOptions,
    safeControlId,
    narrative.safeAction,
    'Safe educational path with an explicit verification and reassessment endpoint.',
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
      'Accepted alternative that preserves assessment, escalation, and reassessment.',
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
    unsafeControl.description =
      'Unsafe because it bypasses verification or invents an unsupported rule.'
    unsafeControl.sourceIds = [syntheticId]
  }

  updateOption(
    cloned.responseOptions,
    cloned.hiddenMechanism.correctResponseOptionId,
    'Expect a linked response, then verify it',
    narrative.expectedResponse,
    narrativeSourceIds,
  )
  const correctReassessmentId = cloned.hiddenMechanism.correctReassessmentOptionIds[0]
  updateOption(
    cloned.reassessmentOptions,
    correctReassessmentId,
    narrative.reassessment,
    'Required reassessment of patient, circuit, device, delivery, and recurrence as applicable.',
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
    requiredSafeAction.description =
      'Complete the assessment first, then take this action and verify the patient and treatment response.'
    requiredSafeAction.response = narrative.expectedResponse
    requiredSafeAction.sourceIds = [...narrativeSourceIds]
  }
  for (const path of cloned.acceptedAlternativePaths) {
    path.label = narrative.acceptedAlternative
    path.explanation =
      'This accepted alternative preserves the same safety checks, communication, and required reassessment.'
    path.sourceIds = [...narrativeSourceIds]
    const alternativeIntervention = cloned.interventions.find(
      (action) =>
        path.actionIds.includes(action.id) &&
        !cloned.requiredActionIds.includes(action.id) &&
        action.category !== 'assessment' &&
        action.category !== 'communication',
    )
    if (alternativeIntervention) {
      alternativeIntervention.label = narrative.acceptedAlternative
      alternativeIntervention.description =
        'Use this alternative with the same safety checks, team communication, and reassessment.'
      alternativeIntervention.response = narrative.expectedResponse
      alternativeIntervention.sourceIds = [...narrativeSourceIds]
    }
  }
  if (unsafeIntervention) {
    unsafeIntervention.label = narrative.unsafeAction
    unsafeIntervention.description =
      'This path intentionally bypasses a required safety or verification step for debriefing.'
    unsafeIntervention.response = 'The attempt is stopped and flagged for causal debrief.'
    unsafeIntervention.sourceIds = [syntheticId]
  }
  for (const unsafe of cloned.unsafeActions) {
    unsafe.explanation =
      'The selected action bypasses verification, escalation, or reassessment and is retained only as an educational unsafe path.'
    unsafe.sourceIds = [syntheticId]
  }
  for (const criticalError of cloned.criticalErrors) {
    criticalError.label = 'Critical safety-step omission'
    criticalError.explanation =
      'The action omits a required assessment, verification, or escalation step; no clinical threshold is implied.'
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
        `State the goal: ${narrative.goal}`,
        `Link the observations before acting: ${narrative.mechanism}`,
        `Name the reassessment endpoint: ${narrative.reassessment}`,
      ][index] ?? narrative.reassessment
    hint.sourceIds = [...narrativeSourceIds]
  })

  cloned.debrief.summary = `${narrative.id}: ${narrative.title}`
  cloned.debrief.statedGoalReview = narrative.goal
  cloned.debrief.predictionReview = narrative.mechanism
  cloned.debrief.actionTimelineReview =
    'Compare prediction, assessment, selected action, timed response, communication, and reassessment in order.'
  cloned.debrief.causalChain = [...narrative.causalChain]
  cloned.debrief.trendReview = narrative.expectedResponse
  cloned.debrief.requiredActionsReview = narrative.safeAction
  cloned.debrief.criticalErrorsReview = narrative.unsafeAction
  cloned.debrief.acceptedAlternativesReview = narrative.acceptedAlternative
  cloned.debrief.machineNavigationPoint =
    'Apply the same clinical reasoning on either device while accounting for differences in screen order and terminology.'
  cloned.debrief.transferQuestion = narrative.transferQuestion
  cloned.debrief.sourceIds = [...narrativeSourceIds]

  const existingSourceIds = new Set(cloned.sourceBasis.map((source) => source.id))
  for (const sourceId of narrative.clinicalSourceIds) {
    if (existingSourceIds.has(sourceId)) continue
    const source = sourceById.get(sourceId)
    if (!source) throw new Error(`Missing source ${sourceId} for ${narrative.id}.`)
    cloned.sourceBasis.push(learnerWording({ ...source }) as SourceReference)
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

function customizeFilterPressureCase(definition: MutableRuntimeCrrtCase): MutableRuntimeCrrtCase {
  const lowFlowAction = definition.interventions.find((intervention) =>
    intervention.id.endsWith('action-safe-candidate'),
  )
  const lowFlowEffect = lowFlowAction?.effects.find(
    (effect) => effect.target === 'circuit.filter.lowEffectiveBloodFlowFraction',
  )
  if (lowFlowEffect?.valueType === 'number') lowFlowEffect.value = 0.1

  const lowFlowCondition = definition.successConditions.find(
    (condition) => condition.metric === 'circuit.filter.lowEffectiveBloodFlowFraction',
  )
  if (lowFlowCondition) {
    lowFlowCondition.comparator = 'lte'
    lowFlowCondition.value = 0.2
  }

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
      'Return-path resistance rises, return pressure increases, and a generic obstruction alert appears.'
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
    acknowledge.description =
      'Acknowledge awareness without treating it as correction of the cause.'
    acknowledge.response =
      'The alert is acknowledged, but return-path resistance and the abnormal pressure remain.'
  }

  const pause = bySuffix('pause-treatment')
  if (pause) {
    pause.label = 'Keep therapy paused and escalate if the return-path cause is unclear'
    pause.description =
      'Maintain a safe paused state while obtaining help when inspection does not identify a correctable cause.'
    pause.response =
      'Treatment remains paused while the unresolved return-path problem is escalated.'
  }

  const correct = bySuffix('reposition-access')
  if (correct) {
    correct.label = 'Relieve the verified return-path obstruction'
    correct.description = 'Correct the identified mechanical return-path cause after inspection.'
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
    resume.description =
      'Resume only after the return-path cause is corrected and safety is verified.'
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
    title: 'Controlled solute trajectory in acute brain or liver failure',
    stationId: 'define-goal',
    difficulty: 'advanced',
    patientDescription:
      'An adult ICU patient with AKI also has a neurologic vulnerability, making the pace of solute change an explicit coordination concern.',
    learningObjectives: [
      'Define a controlled trajectory rather than reacting to one isolated result.',
      'Coordinate kidney-support goals with the broader neurocritical or liver-failure plan.',
      'Reassess the patient and serial trends after any change in delivery.',
    ],
    goal: 'Coordinate a controlled solute trajectory with the whole critical-care plan',
    mechanism:
      'Therapy delivery, interruptions, and changing patient production jointly shape the observed trajectory.',
    safeAction: 'Pause and coordinate the intended trajectory before changing the prescription',
    acceptedAlternative: 'Maintain the bounded setting while escalating multidisciplinary review',
    unsafeAction: 'Chase one value with an abrupt unverified change',
    expectedResponse:
      'The serial synthetic trend changes gradually and remains subject to delivery checks.',
    reassessment: 'Reassess neurologic context, serial solute trends, delivery, and interruptions',
    openingFinding: 'A serial solute trend and a neurologic vulnerability are visible together.',
    causalChain: [
      'The whole clinical context defines the intended trajectory.',
      'The selected modality and actual delivery influence the rate of change.',
      'Serial reassessment determines whether coordination remains appropriate.',
    ],
    transferQuestion:
      'How would you preserve the same controlled-trajectory reasoning while locating delivery and history data on the other device?',
    clinicalSourceIds: ['GUID-NICE-NG148-2024', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-08',
    templateId: 'CRRT-07',
    title: 'Verify the set, bags, solutions, lines, prime, and prescription',
    stationId: 'setup-start',
    difficulty: 'intermediate',
    patientDescription:
      'Before connection, one item in the set, bag, solution, line, prime, and prescription verification sequence does not match the treatment plan.',
    learningObjectives: [
      'Use a deliberate pre-connection verification sequence.',
      'Separate manual-reference workflow from local stock and policy.',
      'Stop and escalate when an exact local expression is unavailable.',
    ],
    goal: 'Verify the complete setup before simulated connection',
    mechanism:
      'A mismatch in set, bag, solution, line, or entered data can propagate into later device behavior and displayed calculations.',
    safeAction:
      'Stop the sequence, identify the mismatched domain, and complete an independent check',
    acceptedAlternative:
      'Keep the setup paused and escalate the unresolved local-configuration item',
    unsafeAction: 'Connect first and plan to correct the mismatch later',
    expectedResponse:
      'The setup remains paused until the mismatch is explicitly resolved or escalated.',
    reassessment: 'Repeat the setup review and verify readiness before simulated connection',
    openingFinding: 'One verification item does not match the authored setup plan.',
    causalChain: [
      'Manual-reference steps define the verification domains.',
      'The unresolved mismatch prevents a safe readiness conclusion.',
      'Independent verification precedes simulated connection.',
    ],
    transferQuestion:
      'Which screen sequence and bag/scale topology change on Prismaflex while the verification domains stay the same?',
    clinicalSourceIds: ['DEV-PM-005', 'DEV-PM-013'],
  },
  {
    id: 'CRRT-09',
    templateId: 'CRRT-07',
    title: 'Anticoagulation protocol selection and verification',
    stationId: 'setup-start',
    difficulty: 'advanced',
    patientDescription:
      'Before treatment starts, an anticoagulation option is visible but no authorized, versioned local protocol has been verified. Medication quantities and adjustment rules are intentionally not shown.',
    learningObjectives: [
      'Verify protocol identity, version, contraindication review, and responsible team before use.',
      'Recognize when no applicable protocol is available and stop for escalation.',
      'Keep medication-specific instructions outside this general educational module.',
    ],
    goal: 'Verify an applicable authorized protocol before enabling an anticoagulation workflow',
    mechanism:
      'A protocol label alone is insufficient unless its scope, version, patient applicability, and responsible oversight are confirmed.',
    safeAction:
      'Verify protocol identity, applicability, responsible oversight, and independent check',
    acceptedAlternative:
      'Leave anticoagulation unselected and escalate when verification is incomplete',
    unsafeAction: 'Infer a medication plan from a generic device option',
    expectedResponse:
      'The workflow records verification or remains unavailable; it never invents medication instructions.',
    reassessment:
      'Reassess protocol applicability, team communication, and the documented verification state',
    openingFinding: 'A generic device option is visible, but no verified protocol is attached.',
    causalChain: [
      'Clinical and local policy determine whether a protocol applies.',
      'Version and responsibility checks precede any device workflow.',
      'Missing verification leads to stopping and escalation.',
    ],
    transferQuestion:
      'How would you verify the same protocol identity and responsibility boundaries on a device with different setup screens?',
    clinicalSourceIds: ['GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-12',
    templateId: 'CRRT-11',
    title: 'Electrolyte, temperature, medication, and nutrition consequences',
    stationId: 'monitor-dose-fluid',
    difficulty: 'advanced',
    patientDescription:
      'During ongoing CRRT, electrolyte, temperature, medication-delivery, and nutrition trends change alongside a period of interrupted treatment.',
    learningObjectives: [
      'Integrate patient trends with actual therapy delivery and interruptions.',
      'Identify when pharmacist, dietitian, nursing, or prescriber coordination is needed.',
      'Avoid treating the device display as the whole patient assessment.',
    ],
    goal: 'Integrate multidisciplinary consequences with actual treatment delivery',
    mechanism:
      'Continuous extracorporeal therapy, critical illness, inputs, and interruptions can influence linked monitoring domains over time.',
    safeAction:
      'Review linked trends and coordinate the appropriate multidisciplinary reassessment',
    acceptedAlternative:
      'Hold the bounded simulation state while escalating incomplete domain information',
    unsafeAction: 'Attribute every change to the filter and act without cross-domain review',
    expectedResponse:
      'The linked trends and delivery timeline become available for coordinated interpretation.',
    reassessment:
      'Reassess electrolytes, temperature, medication exposure, nutrition, and delivered therapy',
    openingFinding:
      'Several linked monitoring domains change during a period of interrupted delivery.',
    causalChain: [
      'Patient inputs and critical illness create a changing baseline.',
      'Therapy delivery and downtime alter exposure over time.',
      'Multidisciplinary reassessment distinguishes plausible contributors.',
    ],
    transferQuestion:
      'Where would you find the device history and delivered-therapy context needed for the same multidisciplinary review on Prismaflex?',
    clinicalSourceIds: ['REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-14',
    templateId: 'CRRT-13',
    title: 'High return pressure versus return disconnection',
    stationId: 'pressures-troubleshooting',
    difficulty: 'advanced',
    patientDescription:
      'A return-pressure change appears during CRRT. Use its direction and circuit inspection to distinguish return-path obstruction from disconnection.',
    learningObjectives: [
      'Predict pressure direction before revealing the placed fault.',
      'Inspect the corresponding return-path domain rather than treating every signal alike.',
      'Verify cause correction and patient safety before simulated resumption.',
    ],
    goal: 'Localize the return-path problem from direction, context, and circuit inspection',
    mechanism:
      'Added return-path resistance and a disconnected return path change the return-pressure relationship in different directions.',
    safeAction:
      'Pause, assess patient safety, inspect the return path, and verify the identified cause',
    acceptedAlternative:
      'Keep therapy paused and escalate when the return-path cause cannot be verified',
    unsafeAction: 'Increase BFR before resolving the return-path problem',
    expectedResponse:
      'Correction of the authored fault restores the directional pattern before reassessment.',
    reassessment: 'Reassess patient, return path, pressure trend, delivery, and recurrence',
    openingFinding: 'A return-pressure change appears with an incomplete view of the return path.',
    causalChain: [
      'The placed return-path condition changes resistance or connection state.',
      'The pressure pattern supplies a directional localization clue.',
      'Circuit inspection and reassessment verify the cause.',
    ],
    transferQuestion:
      'How do Prismaflex alarm/help presentation and pressure labels differ while the return-path localization logic remains canonical?',
    clinicalSourceIds: ['DEV-PM-009', 'DEV-PM-010'],
  },
  {
    id: 'CRRT-16',
    templateId: 'CRRT-15',
    title: 'Recurrent filter loss across access, filtration, downtime, and policy domains',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'Several CRRT circuits have failed prematurely. The access, pressure, delivery, downtime, and protocol history contains more than one plausible contributor.',
    learningObjectives: [
      'Use trend history to evaluate mechanical and delivery contributors before assigning one cause.',
      'Separate general causal reasoning from medication or local-policy instructions.',
      'Escalate repeated loss with a structured multidisciplinary summary.',
    ],
    goal: 'Explain recurrent filter loss using the complete access, circuit, delivery, and policy context',
    mechanism:
      'Access dysfunction, concentration effects, interruptions, and other patient or protocol factors can combine rather than act alone.',
    safeAction:
      'Review the complete history, correct verified mechanical contributors, and escalate the residual pattern',
    acceptedAlternative:
      'Preserve the circuit state and escalate before making an unsupported attribution',
    unsafeAction: 'Assume one medication-related cause and bypass mechanical review',
    expectedResponse:
      'The debrief separates verified contributors from unresolved policy-dependent questions.',
    reassessment: 'Reassess access, filter trends, effective delivery, downtime, and recurrence',
    openingFinding:
      'The filter history shows repeated loss with more than one plausible contributor.',
    causalChain: [
      'Multiple patient, access, circuit, and delivery factors influence filter burden.',
      'History and trend localization narrow the verified contributors.',
      'Unresolved protocol questions are escalated without invented instructions.',
    ],
    transferQuestion:
      'Which history, pressure, and delivered-therapy views would you compare on each device before presenting the same causal summary?',
    clinicalSourceIds: ['DEV-PM-009', 'DEV-PM-010', 'REVIEW-CKRT-CORE-2025'],
  },
  {
    id: 'CRRT-17',
    templateId: 'CRRT-11',
    title: 'Recognize and escalate a citrate-calcium safety concern',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'Linked calcium, acid-base, circuit, and treatment-delivery trends raise a citrate-calcium safety concern. Medication quantities and protocol instructions are intentionally not shown.',
    learningObjectives: [
      'Recognize linked trend directions that warrant a citrate-calcium safety review.',
      'Verify sampling, delivery, circuit, and protocol context before interpretation.',
      'Stop and escalate to the responsible clinical team without generating instructions.',
    ],
    goal: 'Recognize a linked citrate-calcium safety pattern and escalate it',
    mechanism:
      'Calcium, acid-base, circuit, and delivery observations are interpreted together; no single observation establishes the explanation.',
    safeAction:
      'Verify linked observations, pause unsupported inference, and escalate to the responsible team',
    acceptedAlternative:
      'Maintain a safe treatment state while obtaining missing protocol and sampling context',
    unsafeAction: 'Change therapy from one isolated calcium observation',
    expectedResponse:
      'The conceptual dashboard reveals direction and linkage only, followed by escalation.',
    reassessment:
      'Reassess linked trend direction, sampling validity, delivery context, and escalation response',
    openingFinding:
      'Linked calcium and acid-base observations change while delivery context is incomplete.',
    causalChain: [
      'Sampling, patient state, circuit delivery, and protocol context shape the observations.',
      'Linked directions prompt verification rather than a one-value conclusion.',
      'The responsible team receives a structured escalation and reassessment summary.',
    ],
    transferQuestion:
      'How would you communicate the same conceptual trend and escalation boundary when device vocabulary changes?',
    clinicalSourceIds: ['REVIEW-CKRT-CORE-2025', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'CRRT-18',
    templateId: 'CRRT-11',
    title: 'Renal recovery, discontinuation, and transition',
    stationId: 'anticoagulation-complications-liberation',
    difficulty: 'advanced',
    patientDescription:
      'Several recovery signals are improving during CRRT, but the plan for stopping or transitioning kidney support is incomplete.',
    learningObjectives: [
      'Reassess whether kidney support remains needed using the whole trajectory.',
      'Separate a clinical discontinuation decision from device stop/end workflow.',
      'Communicate transition, monitoring, and escalation responsibilities.',
    ],
    goal: 'Reassess ongoing kidney-support need and coordinate a supervised transition',
    mechanism:
      'Changing kidney function, fluid status, solute control, hemodynamics, and delivered therapy jointly inform the transition discussion.',
    safeAction:
      'Review the recovery trajectory and coordinate the clinical and device transition plans separately',
    acceptedAlternative:
      'Continue bounded support while obtaining missing recovery or transition information',
    unsafeAction: 'End treatment from one favorable observation without a transition plan',
    expectedResponse:
      'The simulation separates the clinical decision, device workflow, disposition, and follow-up reassessment.',
    reassessment:
      'Reassess recovery trajectory, patient status, transition monitoring, and escalation ownership',
    openingFinding: 'Several recovery signals improve, but the transition plan is incomplete.',
    causalChain: [
      'Serial patient and delivery data frame the ongoing need for support.',
      'The clinical transition decision is distinct from device stop/end controls.',
      'Post-transition monitoring and escalation close the loop.',
    ],
    transferQuestion:
      'How do stop/end and disposition controls differ between PrisMax and Prismaflex while the clinical transition decision remains device-neutral?',
    clinicalSourceIds: ['GUID-NICE-NG148-2024', 'GUID-RRT-ICU-2026'],
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
const adaptedCaseIds = new Set(adaptedCases.map((definition) => definition.id))
const promotedCases = sourceCases
  .filter((definition) => !adaptedCaseIds.has(definition.id))
  .map(promoteExistingCase)
  .map((definition) =>
    definition.id === 'CRRT-15' ? customizeFilterPressureCase(definition) : definition,
  )
  .map(ensureTimedResponse)

const parsedCases = runtimeCrrtCaseRegistrySchema.parse(
  [...promotedCases, ...adaptedCases]
    .map((definition) => learnerWording(definition) as MutableRuntimeCrrtCase)
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
