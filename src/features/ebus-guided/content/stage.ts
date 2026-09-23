import type { Lesson } from './types'
import type { ExaminationCase, RecordTask } from '../engine/examination'
import { DESCRIPTION_CASE, EXAMINATION_CASE, MODEL_WINDOW_CASE } from './examination-cases'

export type QuestionSlot = 'question' | 'observation' | 'transfer'
export type Presentation =
  | 'briefing'
  | 'linked'
  | 'ultrasound'
  | 'regional'
  | 'case'
  | 'sampling'
  | 'record'
export type EvidenceView = 'none' | 'diagram' | 'reference' | 'demonstration' | 'live' | 'held'
export type Interaction = 'read' | 'questions' | 'matching' | 'sequence' | 'acquire' | 'record'
export type TeachingPart = 'foundation' | 'worked' | 'takeaways'
export interface ActivitySpec {
  id: string
  title: string
  instruction: string
  kind:
    | 'briefing'
    | 'demonstration'
    | 'application'
    | 'acquisition'
    | 'interpretation'
    | 'transfer'
    | 'record'
  presentation: Presentation
  image: EvidenceView
  interaction: Interaction
  teaching: TeachingPart[]
  questions: QuestionSlot[]
  task?: 'guided' | 'changed-window'
  companion?: string
  note?: string
  /**
   * What the activity is for, said plainly where the task is scaffolded (EBUS-PRE-REVIEW-04, part
   * H). A check shown beside the lesson's key points, an acquisition whose instruction names the
   * example settings, a record whose supplied instruction states the handling: each is guided
   * practice, and says so instead of looking like an examination. Nothing is hidden to make it
   * one. Transfers and key-point checks take the default in `activitiesForLesson`.
   */
  purpose?: string
  recordTask?: RecordTask
  caseData?: ExaminationCase
}
export interface LessonActivity extends ActivitySpec {
  lessonId: string
  contentVersion: number
  objective: string
  sourceIds: string[]
  limitation: string
  support: 'worked' | 'guided' | 'independent'
  /** What performing this activity means. Descriptive only: nothing waits on it (EBUS-01). */
  completion: { action: Interaction; responses: QuestionSlot[] }
  transitions: { next: string | null; retry: string; review: 'read-only' }
}
const brief = (
  id: string,
  title: string,
  presentation: Presentation,
  image: EvidenceView = 'diagram',
  worked = true,
): ActivitySpec => ({
  id,
  title,
  presentation,
  image,
  kind: 'briefing',
  interaction: 'read',
  instruction: 'Use this explanation to prepare for the task that follows.',
  teaching: worked ? ['foundation', 'worked'] : ['foundation'],
  questions: [],
})
const demo = (id: string, title: string, presentation: Presentation): ActivitySpec => ({
  id,
  title,
  presentation,
  image: 'demonstration',
  kind: 'demonstration',
  interaction: 'read',
  instruction:
    'Follow the worked example. You will start a separate acquisition next; this demonstration is an example, not your acquisition.',
  teaching: ['worked'],
  questions: [],
})
const decide = (
  id: string,
  title: string,
  questions: QuestionSlot[],
  presentation: Presentation = 'case',
  image: EvidenceView = 'none',
): ActivitySpec => ({
  id,
  title,
  questions,
  presentation,
  image,
  kind: 'interpretation',
  interaction: 'questions',
  teaching: [],
  instruction:
    image === 'held'
      ? 'This is the image you acquired. Interpret it, or open the explanation first.'
      : 'Use the stated situation to make your decision.',
})
const acquire = (
  id: string,
  title: string,
  presentation: Presentation,
  task: 'guided' | 'changed-window' = 'guided',
): ActivitySpec => ({
  id,
  title,
  presentation,
  task,
  kind: 'acquisition',
  image: 'live',
  interaction: 'acquire',
  teaching: [],
  questions: [],
  instruction:
    task === 'changed-window'
      ? 'Now acquire a fresh window at a changed position in the same model case.'
      : 'Now try the activity yourself. The assisted start alone does not complete this task.',
})
const apply = (
  id: string,
  title: string,
  interaction: 'sequence' | 'matching',
  questions: QuestionSlot[] = ['question', 'observation'],
  presentation: Presentation = 'case',
): ActivitySpec => ({
  id,
  title,
  interaction,
  questions,
  presentation,
  kind: 'application',
  image: 'none',
  teaching: [],
  instruction: 'Complete the task, then interpret what your decisions establish.',
})
const transfer = (
  title: string,
  image: EvidenceView = 'none',
  presentation: Presentation = 'case',
): ActivitySpec => ({
  ...decide('apply-another-situation', title, ['transfer'], presentation, image),
  kind: 'transfer',
  teaching: ['takeaways'],
})
const held = (
  title = 'Review this image',
  presentation: Presentation = 'ultrasound',
): ActivitySpec => ({
  ...decide('review-acquisition', title, ['observation'], presentation, 'held'),
  teaching: ['takeaways'],
})

const record = (
  id: string,
  title: string,
  task: RecordTask,
  caseData: ExaminationCase,
  image: EvidenceView = 'none',
): ActivitySpec => ({
  id,
  title,
  kind: 'record',
  presentation: 'record',
  image,
  interaction: 'record',
  teaching: [],
  questions: [],
  recordTask: task,
  caseData,
  instruction:
    'Reconcile the supplied evidence with your entries. The record distinguishes plans, observations, specimens and unresolved findings.',
})

/*
 * Purposes shared by more than one activity (EBUS-PRE-REVIEW-04, H and N). Each says what the
 * activity asks and why, from the lab's own instruction and gate; none adds a clinical claim.
 */
const EXAMPLE_SETTINGS_PURPOSE =
  'Guided acquisition: the instruction names the teaching example’s settings to stop on. Compare the views on the way there. The numbers belong to this recorded teaching library, not to a patient.'
const CHANGED_WINDOW_PURPOSE =
  'Repeated on purpose, from a changed scope position: the same modeled target and landmarks, a different start. The landmark checks and the sweep are asked again because this is a new acquisition; the check that follows asks whether the station assignment changes.'
/** Checks shown beside the lesson's key points are guided practice, and say so (L1-10 and others). */
const KEY_POINTS_PURPOSE: Record<'transfer' | 'review', string> = {
  transfer:
    'Guided practice: the lesson’s key points stay beside this check on purpose. Use them to reason through a situation the lesson has not shown you yet.',
  review:
    'Guided practice: the lesson’s key points stay beside this check on purpose. Use them with the evidence beside you.',
}

/** Deliberate lesson flows, not a positional seven-stage adapter. Missing coverage is an error. */
export const ACTIVITY_FLOWS: Record<string, ActivitySpec[]> = {
  'clinical-question': [
    {
      ...brief('clinical-request', 'Define what the examination must answer', 'briefing', 'none'),
      note: 'An examination record connects the clinical request, planned coverage, specimens and unanswered questions. Sampling one target may provide a diagnosis while leaving staging or ancillary-testing needs unresolved. A non-lung-cancer adenopathy case does not automatically receive an N category.',
    },
    apply('information-needs', 'State the information needed', 'matching'),
    transfer('Consider a different diagnostic request'),
  ],
  'scope-orientation': [
    brief('distal-scope', 'Identify the transducer', 'linked', 'demonstration', false),
    demo('plane-demonstration', 'Relate the scope to the ultrasound plane', 'linked'),
    decide('plane-interpretation', 'Interpret a change in plane', ['question']),
    acquire('acquire-sweep', 'Acquire a gradual sweep', 'ultrasound'),
    held(),
    transfer('Review a different apparent size'),
  ],
  'acoustic-contact': [
    {
      ...brief('contact-example', 'Compare contact and brightness', 'linked', 'demonstration'),
      companion: 'contact-cutaway-model',
    },
    decide('contact-decision', 'Identify the acquisition problem', ['question']),
    acquire('restore-window', 'Restore the acoustic window', 'linked'),
    held('Compare the acquired images', 'linked'),
    transfer('Reassess another window'),
  ],
  'station-seven': [
    brief('subcarinal-region', 'Locate the subcarinal region', 'regional', 'reference', false),
    demo('assisted-window', 'Compare the two bronchial approaches', 'linked'),
    {
      ...decide('station-decision', 'Separate approach from station', ['question']),
      purpose:
        'This check separates the approach from the station. The stem names the node’s compartment; what it asks is whether the bronchus the scope is in changes the station you record.',
    },
    {
      ...acquire('bronchial-sweeps', 'Acquire both bronchial windows', 'linked'),
      purpose:
        'Two approaches, one target: this acquisition asks for your own rotation sweep from each main bronchus, so you can compare the two windows onto the same subcarinal node.',
    },
    held('Interpret the acquired window'),
    {
      ...acquire('changed-position', 'Compare another window', 'ultrasound', 'changed-window'),
      purpose: CHANGED_WINDOW_PURPOSE,
    },
    transfer('Interpret the changed window', 'held', 'ultrasound'),
    record(
      'record-window',
      'Record what this window establishes',
      'station-window',
      MODEL_WINDOW_CASE,
      'held',
    ),
  ],
  preparation: [
    {
      ...brief('readiness', 'Resolve the readiness issue', 'briefing', 'none'),
      note: 'A readiness checklist records a team declaration; it does not certify patient safety. Pausing to resolve an unanswered medication, airway, equipment or specimen question is an appropriate outcome.',
    },
    apply('team-check', 'Agree on the next safe step', 'sequence'),
    transfer('Decide when to pause'),
  ],
  'contact-cutaway-model': [
    {
      ...brief(
        'contact-mechanism',
        'Relate the wall, transducer and air gap',
        'linked',
        'demonstration',
      ),
      companion: 'acoustic-contact',
    },
    acquire('contact-states', 'Compare the supported contact states', 'linked'),
    { ...held('Explain the contact comparison', 'linked'), questions: ['question', 'observation'] },
    transfer('Apply the contact principle'),
  ],
  'image-depth': [
    brief('depth-example', 'Compare the displayed fields', 'ultrasound', 'demonstration'),
    decide('field-decision', 'Choose the control for the field', ['question']),
    {
      ...acquire('depth-comparison', 'Frame the target and surrounding tissue', 'ultrasound'),
      purpose: EXAMPLE_SETTINGS_PURPOSE,
    },
    held('Interpret the two recorded fields'),
    transfer('Preserve the anatomy beyond another target'),
  ],
  'gain-contrast': [
    brief('detail-example', 'Compare brightness and tissue detail', 'ultrasound', 'demonstration'),
    decide('brightness-decision', 'Explain a brightness change', ['question']),
    {
      ...acquire('detail-comparison', 'Adjust one image control at a time', 'ultrasound'),
      purpose: EXAMPLE_SETTINGS_PURPOSE,
    },
    held('Compare the retained detail'),
    transfer('Distinguish poor contact from low gain'),
  ],
  doppler: [
    brief('flow-example', 'Use flow and anatomy together', 'ultrasound', 'demonstration'),
    decide('path-assessment', 'Choose the additional assessment', ['question']),
    acquire('flow-comparison', 'Compare grayscale and color recordings', 'ultrasound'),
    held('Interpret the recorded flow'),
    transfer('Resolve an uncertain vascular structure'),
  ],
  'measurement-phantoms': [
    brief('measurement-plane', 'Relate the plane to the requested axis', 'linked', 'demonstration'),
    acquire('phantom-comparison', 'Sweep and measure the analytic shapes', 'linked'),
    {
      ...held('Explain the dimension in this plane', 'linked'),
      questions: ['question', 'observation'],
    },
    transfer('Apply the axis limitation to a node'),
  ],
  capture: [
    brief(
      'capture-context',
      'Choose the image before the measurement',
      'ultrasound',
      'demonstration',
    ),
    decide('plane-decision', 'Explain the choice of plane', ['question']),
    acquire('capture-frame', 'Freeze, place calipers and save the frame', 'ultrasound'),
    held('Inspect the capture record'),
    transfer('Return to live guidance before needle movement'),
  ],
  'ct-map': [
    brief(
      'regional-map',
      'Relate the target to its anatomical region',
      'regional',
      'reference',
      false,
    ),
    demo('section-comparison', 'Compare the model section and ultrasound plane', 'linked'),
    decide('map-decision', 'Identify the basis of a station assignment', ['question']),
    acquire('section-sweep', 'Check landmarks and acquire a section', 'linked'),
    held('Identify what determines a station name'),
    transfer('Reconsider a target near a boundary'),
  ],
  'right-paratracheal': [
    brief(
      'right-region',
      'Locate the right paratracheal compartment',
      'regional',
      'reference',
      false,
    ),
    demo('right-landmarks', 'Use the trachea, SVC and azygos relationship', 'linked'),
    decide('right-boundary', 'Identify the relevant boundary', ['question']),
    acquire('right-sweep', 'Acquire the right paratracheal window', 'linked'),
    held('Interpret the acquired compartment'),
    {
      ...acquire(
        'right-changed',
        'Acquire a changed right paratracheal position',
        'ultrasound',
        'changed-window',
      ),
      purpose: CHANGED_WINDOW_PURPOSE,
    },
    transfer('Compare the changed window', 'held', 'ultrasound'),
  ],
  'left-paratracheal': [
    brief('left-region', 'Locate 4L beside its vascular landmarks', 'regional', 'reference'),
    decide('left-boundary', 'Distinguish the left-sided compartments', ['question']),
    acquire('left-assisted', 'Explore the supported 4L window', 'regional'),
    {
      ...decide(
        'left-relationships',
        'Interpret the vascular relationships',
        ['observation'],
        'regional',
      ),
      teaching: ['takeaways'],
    },
    transfer('Consider a lateral subaortic target'),
  ],
  'hilar-interlobar': [
    brief(
      'bronchial-relations',
      'Locate targets by bronchial relationships',
      'regional',
      'reference',
    ),
    apply(
      'regional-identity',
      'Match bronchial relationships to interlobar stations',
      'matching',
      ['question', 'observation'],
      'regional',
    ),
    transfer('Apply the primary side to another case'),
  ],
  'node-characterization': [
    brief(
      'description-evidence',
      'Describe the appearance before its implications',
      'briefing',
      'none',
    ),
    record(
      'node-description',
      'Choose the description the vignette supports',
      'node-description',
      DESCRIPTION_CASE,
    ),
    apply('description-reasoning', 'Separate description from pathology', 'matching'),
    transfer('Interpret a different morphology report'),
  ],
  'systematic-staging': [
    brief('staging-purpose', 'Define the coverage needed for staging', 'case'),
    record('case-plan', 'Plan the examination for this primary side', 'plan', EXAMINATION_CASE),
    {
      ...apply('sampling-order', 'Reconcile order with the examination plan', 'sequence'),
      purpose:
        'Guided ordering: each step names that target’s N category for this left lung primary. The task is to put the targets in the order the lesson describes; you can choose to hide the categories and try it yourself.',
    },
    transfer('Count stations and nodes separately'),
  ],
  'eus-b': [
    {
      ...brief('complementary-route', 'Identify what a second route can add', 'regional'),
      companion: 'eus-b-route-model',
    },
    apply(
      'route-coverage',
      'Match the route to the remaining question',
      'matching',
      ['question', 'observation'],
      'regional',
    ),
    transfer('Identify an unresolved regional gap'),
  ],
  'eus-b-route-model': [
    {
      ...brief(
        'route-orientation',
        'Compare the approach to the same target',
        'linked',
        'demonstration',
      ),
      companion: 'eus-b',
    },
    acquire('route-comparison', 'Compare supported and unsupported locators', 'linked'),
    { ...held('Explain the route comparison', 'linked'), questions: ['question', 'observation'] },
    transfer('Preserve an unexamined region in the plan'),
  ],
  'needle-safety': [
    {
      ...brief('sampling-states', 'Follow the sampling sequence', 'sampling'),
      companion: 'needle-assembly-model',
    },
    apply(
      'safe-sequence',
      'Link needle actions to current guidance',
      'sequence',
      ['question', 'observation'],
      'sampling',
    ),
    transfer('Respond to resistance at a calcified target'),
  ],
  'needle-assembly-model': [
    {
      ...brief(
        'needle-components',
        'Relate sheath, needle, stylet and outlet',
        'linked',
        'demonstration',
      ),
      companion: 'needle-safety',
    },
    acquire('needle-states', 'Practice the supported assembly states', 'sampling'),
    {
      ...held('Interpret the live-tip limitation', 'sampling'),
      questions: ['question', 'observation'],
    },
    transfer('Respond to resistance with the tip visible'),
  ],
  'adequacy-rose': [
    brief(
      'adequacy-endpoints',
      'Separate representation, diagnosis and study suitability',
      'sampling',
    ),
    record(
      'specimen-evidence',
      'Reconcile the written ROSE communication',
      'adequacy',
      EXAMINATION_CASE,
    ),
    apply(
      'adequacy-reasoning',
      'Identify which endpoint remains unresolved',
      'matching',
      ['question', 'observation'],
      'sampling',
    ),
    transfer('Plan when ROSE is unavailable'),
  ],
  'specimen-triage': [
    brief('specimen-request', 'Connect each specimen to the requested studies', 'sampling'),
    {
      ...record('allocation-plan', 'Allocate the case specimens', 'allocation', EXAMINATION_CASE),
      purpose:
        'Guided record: each requested study shows the laboratory’s instruction for it, or says that none was supplied. Record the handling plan each one supports.',
    },
    apply(
      'traceability',
      'Preserve the source through processing',
      'matching',
      ['question', 'observation'],
      'sampling',
    ),
    transfer('Discuss granulomas when microbiology was not sent'),
  ],
  'difficult-acquisition': [
    brief('acquisition-problem', 'Classify the problem before changing controls', 'case'),
    {
      ...apply('problem-action', 'Choose the first response to each problem', 'matching'),
      purpose:
        'Guided task: the troubleshooting flow in the briefing shows these pairings. Match them here; Back rereads the flow at any time.',
    },
    transfer('Recognize the limit of the current window'),
  ],
  'complications-recovery': [
    brief(
      'patient-response',
      'Respond to the patient and communicate the limitation',
      'case',
      'none',
    ),
    apply('recovery-sequence', 'Prioritize the patient during deterioration', 'sequence'),
    transfer('Plan recovery and escalation'),
  ],
  'results-reporting': [
    brief('report-evidence', 'Build the conclusion from the evidence', 'record', 'none'),
    record('reconciled-report', 'Construct the case report', 'report', EXAMINATION_CASE),
    apply('result-meaning', 'Reconcile the result with the clinical question', 'matching'),
    transfer('Close the loop on unresolved findings'),
  ],
}

export function activitiesForLesson(lesson: Lesson): LessonActivity[] {
  const specs = ACTIVITY_FLOWS[lesson.id]
  if (!specs) throw new Error('EBUS flow has not been authored: ' + lesson.id)
  return specs.map((spec, index) => ({
    ...spec,
    id: lesson.id + ':' + spec.id,
    lessonId: lesson.id,
    contentVersion: 1,
    objective: lesson.objective,
    sourceIds: lesson.sources,
    limitation: lesson.boundary,
    purpose:
      spec.purpose ??
      (spec.teaching.includes('takeaways') && spec.questions.length
        ? KEY_POINTS_PURPOSE[spec.kind === 'transfer' ? 'transfer' : 'review']
        : undefined),
    /*
     * A check with the key points beside it, or with a stated purpose, is guided: it used to be
     * called independent whenever it had questions (EBUS-PRE-REVIEW-04, H). Descriptive only.
     */
    support:
      spec.image === 'demonstration'
        ? 'worked'
        : spec.purpose || spec.teaching.includes('takeaways')
          ? 'guided'
          : spec.image === 'held' && lesson.lab?.kind === 'model'
            ? 'guided'
            : spec.questions.length
              ? 'independent'
              : 'guided',
    completion: { action: spec.interaction, responses: spec.questions },
    transitions: {
      next: specs[index + 1] ? lesson.id + ':' + specs[index + 1].id : null,
      retry: lesson.id + ':' + spec.id,
      review: 'read-only',
    },
  }))
}

export const flowAuthoring = { brief, demo, decide, acquire, apply, transfer, held }
