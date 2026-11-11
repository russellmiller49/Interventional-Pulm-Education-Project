import type { Lesson } from './types'
import type { LinkedVariant } from '@/lib/ebus-linked-contract'
import type { ExaminationCase, RecordTask } from '../engine/examination'
import { EXAMINATION_CASE, MODEL_WINDOW_CASE } from './examination-cases'

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
    | 'prediction'
    | 'briefing'
    | 'demonstration'
    | 'application'
    | 'acquisition'
    | 'interpretation'
    | 'transfer'
    | 'debrief'
    | 'record'
  presentation: Presentation
  image: EvidenceView
  interaction: Interaction
  teaching: TeachingPart[]
  questions: QuestionSlot[]
  task?: LinkedVariant
  /**
   * This acquisition uses the unit's second lab (`Lesson.transferLab`) although it is an ordinary
   * guided task: a second station in the same lesson, with its own preset and landmarks. A task
   * other than 'guided' always uses the second lab.
   */
  secondLab?: boolean
  /**
   * The content unit this step draws on, in a lesson built from two (`Lesson.parts`). Its text,
   * lab, checks and boundary are that unit's. Absent: the unit with the lesson's own id.
   */
  from?: string
  companion?: string
  /** The figure this activity shows when `image` is 'diagram', if not the lesson's own. */
  figure?: Lesson['diagram']
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
  instruction:
    image === 'demonstration'
      ? 'Read the lead, then try the controls in the lab under it. The detail continues below the lab.'
      : 'Read this before the task that follows.',
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
  instruction: 'Follow the worked example, then try the same movements yourself in the next task.',
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
      ? 'This is the image you continued with. Interpret it, or open the explanation first.'
      : 'Use the stated situation to make your decision.',
})
/**
 * The lesson's first screen: one decision, committed before any teaching (owner-approved plan of
 * 2026-11-10, section A). The briefing and its worked example follow it, so neither can state the
 * answer first. Nothing is scored and nothing waits on it.
 */
const predict = (id: string, title: string, slot: QuestionSlot = 'question'): ActivitySpec => ({
  ...decide(id, title, [slot]),
  kind: 'prediction',
  instruction:
    'Commit to an answer from what you already know. The teaching on the next screen explains it.',
})
/**
 * The learner's own image after an acquisition, with its structures named and the lesson's key
 * points beside it. It replaces a second check that asked the prediction again in other words.
 */
const explain = (
  title = 'Read your image',
  presentation: Presentation = 'ultrasound',
): ActivitySpec => ({
  id: 'review-acquisition',
  title,
  presentation,
  image: 'held',
  kind: 'debrief',
  interaction: 'read',
  teaching: ['takeaways'],
  questions: [],
  instruction: 'Compare your image with the key points beside it.',
})
const acquire = (
  id: string,
  title: string,
  presentation: Presentation,
  task: LinkedVariant = 'guided',
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
      ? 'The scope has moved. Find the same node again from the new position.'
      : task === 'along-airway'
        ? 'The rotation is set. Now move the scope along the airway.'
        : task === 'airway-view'
          ? 'Now find both views yourself, one after the other.'
          : 'Now try it yourself.',
})
/** The lab an acquisition step works in: the unit's own, or its second one. */
export function labForActivity(
  unit: Lesson,
  activity: Pick<ActivitySpec, 'task' | 'secondLab'> | undefined,
) {
  return activity?.secondLab || (activity?.task && activity.task !== 'guided')
    ? unit.transferLab
    : unit.lab
}
const apply = (
  id: string,
  title: string,
  interaction: 'sequence' | 'matching',
  questions: QuestionSlot[] = [],
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
  instruction: questions.length
    ? 'Complete the task, then answer the check that follows it.'
    : 'Complete the task. Its explanation opens when you finish.',
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
  'Stop on the settings the instruction names, and compare the views on the way there.'
const CHANGED_WINDOW_PURPOSE =
  'Same node, new scope position. Find the landmarks and sweep again; the next check asks whether the station changes.'
/** Checks shown beside the lesson's key points are guided practice, and say so (L1-10 and others). */
const KEY_POINTS_PURPOSE: Record<'transfer' | 'review', string> = {
  transfer: 'Apply the key points beside this check to a new situation.',
  review: 'Use the key points beside this check with your image.',
}

/** Deliberate lesson flows, not a positional seven-stage adapter. Missing coverage is an error. */
export const ACTIVITY_FLOWS: Record<string, ActivitySpec[]> = {
  'clinical-question': [
    predict('first-decision', 'Decide what one result settles'),
    {
      ...brief('clinical-request', 'Define what the examination must answer', 'briefing', 'none'),
      note: 'An examination record connects the clinical request, planned coverage, specimens and unanswered questions. Sampling one target may provide a diagnosis while leaving staging or ancillary-testing needs unresolved. A non-lung-cancer adenopathy case does not automatically receive an N category.',
    },
    apply('information-needs', 'State the information needed', 'matching'),
    transfer('Consider a different diagnostic request'),
  ],
  /*
   * The scope itself (added 2026-11-10). The live example is ungated: the unit teaches what the
   * oblique lens and the tip-mounted transducer mean for driving, and its task is the matching.
   */
  'ebus-scope': [
    predict('first-decision', 'Decide why the tip missed'),
    {
      ...brief('scope-tip', 'See what the tip sees', 'linked', 'demonstration'),
      // Says which control to move and what to watch, since this lab is the lesson's point.
      instruction:
        'Read the lead, then move Tip flexion both ways in the lab under it and watch the white-light view and the ultrasound image trade places. The detail continues below the lab.',
    },
    // The two views, found in turn with flexion alone: the airway ahead, then the image.
    acquire(
      'airway-then-wall',
      'Look along the airway, then bring back the image',
      'ultrasound',
      'airway-view',
    ),
    apply('tip-parts', 'Match each part of the tip to what it does', 'matching'),
    transfer('Keep the image or the airway view'),
  ],
  'scope-orientation': [
    predict('plane-interpretation', 'Interpret a change in plane'),
    brief('distal-scope', 'Relate the scope to the ultrasound plane', 'linked', 'demonstration'),
    acquire('acquire-sweep', 'Sweep through the node', 'ultrasound'),
    // The second movement: the plane slides along the airway and the node crosses the image.
    acquire('slide-plane', 'Slide the plane along the airway', 'ultrasound', 'along-airway'),
    explain(),
    transfer('Review a different apparent size'),
  ],
  /*
   * Consolidated lessons (owner decision of 2026-11-10). Each is one lesson with two labs: the
   * steps marked `from` draw on the unit that used to be a separate lesson. One prediction opens
   * the lesson and one transfer closes it; the absorbed unit's prediction and transfer repeated
   * the parent's and stay in its content, unasked.
   */
  'acoustic-contact': [
    predict('contact-decision', 'Identify the acquisition problem'),
    brief('contact-example', 'Compare contact and brightness', 'linked', 'demonstration'),
    acquire('restore-window', 'Restore the acoustic window', 'linked'),
    explain('Compare the acquired images', 'linked'),
    {
      ...brief('contact-mechanism', 'Relate the wall, transducer and air gap', 'briefing'),
      from: 'contact-cutaway-model',
    },
    {
      ...acquire('contact-states', 'Compare the contact conditions', 'linked'),
      from: 'contact-cutaway-model',
    },
    // The one check that reads the learner's own model image: air gap against shadowing reflector.
    { ...held('Explain the contact comparison', 'linked'), from: 'contact-cutaway-model' },
    transfer('Reassess another window'),
  ],
  'station-seven': [
    predict('station-decision', 'Separate approach from station'),
    brief('subcarinal-region', 'Locate the subcarinal region', 'regional', 'reference', false),
    demo('assisted-window', 'Compare the two bronchial approaches', 'linked'),
    {
      ...acquire('bronchial-sweeps', 'Acquire both bronchial windows', 'linked'),
      purpose:
        'Two approaches, one target: this acquisition asks for your own rotation sweep from each main bronchus, so you can compare the two windows onto the same subcarinal node.',
    },
    explain('Read the acquired window'),
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
    predict('first-decision', 'Decide the next step before starting'),
    {
      ...brief('readiness', 'Resolve the readiness issue', 'briefing', 'none'),
      note: 'A readiness checklist records a team declaration; it does not certify patient safety. Pausing to resolve an unanswered medication, airway, equipment or specimen question is an appropriate outcome.',
    },
    apply('team-check', 'Agree on the next safe step', 'sequence'),
    transfer('Decide when to pause'),
  ],
  'image-depth': [
    predict('field-decision', 'Choose the control for the field'),
    brief('depth-example', 'Compare the displayed fields', 'ultrasound', 'demonstration'),
    {
      ...acquire('depth-comparison', 'Frame the target and surrounding tissue', 'ultrasound'),
      purpose: EXAMPLE_SETTINGS_PURPOSE,
    },
    explain('Compare the two recorded fields'),
    transfer('Preserve the anatomy beyond another target'),
    {
      ...brief(
        'detail-example',
        'Compare brightness and tissue detail',
        'ultrasound',
        'demonstration',
      ),
      from: 'gain-contrast',
    },
    {
      ...acquire('detail-comparison', 'Adjust one image control at a time', 'ultrasound'),
      purpose: EXAMPLE_SETTINGS_PURPOSE,
      from: 'gain-contrast',
    },
    { ...explain('Compare the retained detail'), from: 'gain-contrast' },
    // Gain against contact: the two are confused at the bedside, so this transfer is kept.
    { ...transfer('Distinguish poor contact from low gain'), from: 'gain-contrast' },
  ],
  /*
   * No prediction here: the lesson's title names the answer to its first check. The lesson is
   * rebuilt on a recorded node-and-vessel clip, where the prediction is asked on a paused frame.
   */
  doppler: [
    brief('flow-example', 'Use flow and anatomy together', 'ultrasound', 'demonstration'),
    acquire('flow-comparison', 'Compare grayscale and color recordings', 'ultrasound'),
    explain('Compare the two recordings'),
    // The owner's patient recording (2026-11-11): the node, the small vessels around it and the
    // pleura beyond it, read on a paused frame before anything is labelled.
    {
      ...decide(
        'patient-flow',
        'Read colour flow around a node on a patient recording',
        ['observation'],
        'ultrasound',
        'diagram',
      ),
      figure: 'clip-doppler',
      instruction:
        'Play the recording, then open the frame with colour flow and answer. Its labels open after you answer.',
    },
    transfer('Resolve an uncertain vascular structure'),
  ],
  capture: [
    {
      ...predict('size-decision', 'Explain a change in apparent size'),
      from: 'measurement-phantoms',
    },
    {
      ...brief('measurement-plane', 'Relate the plane to the requested axis', 'briefing'),
      from: 'measurement-phantoms',
    },
    {
      ...acquire('phantom-comparison', 'Sweep and measure the elongated shape', 'linked'),
      from: 'measurement-phantoms',
    },
    { ...explain('Read the dimension in this plane', 'linked'), from: 'measurement-phantoms' },
    brief(
      'capture-context',
      'Choose the image before the measurement',
      'ultrasound',
      'demonstration',
    ),
    acquire('capture-frame', 'Freeze, place calipers and save the frame', 'ultrasound'),
    explain('Inspect the capture record'),
    transfer('Return to live guidance before needle movement'),
  ],
  'ct-map': [
    predict('map-decision', 'Identify the basis of a station assignment'),
    // The nodal map itself, opening on station 7; its CT, airway and ultrasound views open from it.
    {
      ...brief(
        'regional-map',
        'Relate the target to its anatomical region',
        'regional',
        'diagram',
        false,
      ),
      figure: 'station-map',
    },
    demo('section-comparison', 'Compare the model section and ultrasound plane', 'linked'),
    acquire('section-sweep', 'Check landmarks and acquire a section', 'linked'),
    explain('Read the acquired section'),
    transfer('Reconsider a target near a boundary'),
  ],
  'right-paratracheal': [
    predict('right-boundary', 'Identify the relevant boundary'),
    brief(
      'right-region',
      'Locate the right paratracheal compartment',
      'regional',
      'reference',
      false,
    ),
    demo('right-landmarks', 'Use the trachea, SVC and azygos relationship', 'linked'),
    acquire('right-sweep', 'Acquire the right paratracheal window', 'linked'),
    explain('Read the acquired compartment'),
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
    predict('left-boundary', 'Distinguish the left-sided compartments'),
    brief('left-region', 'Locate 4L beside its vascular landmarks', 'regional', 'reference'),
    // A linked lab since 2026-11-10: the arch, the left pulmonary artery, then the node.
    acquire('left-assisted', 'Find 4L between the arch and the pulmonary artery', 'linked'),
    explain('Read the acquired compartment'),
    // The same lesson's upper station, from its own position in the trachea.
    {
      ...acquire('left-upper', 'Find 2L above the arch', 'ultrasound'),
      secondLab: true,
      instruction: 'Now the station above it, from a higher position in the trachea.',
    },
    transfer('Consider a lateral subaortic target'),
  ],
  'hilar-interlobar': [
    predict('first-decision', 'Name a station from its bronchi'),
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
      [],
      'regional',
    ),
    // One interlobar station on ultrasound (2026-11-10): the white-light view shows the lobar
    // bronchi that name it.
    acquire('interlobar-scan', 'Find 11Ri between the lobar bronchi', 'linked'),
    explain('Read the interlobar window'),
    transfer('Apply the primary side to another case'),
  ],
  'node-characterization': [
    {
      ...brief('description-evidence', 'Learn the six features on real images', 'briefing'),
      figure: 'node-features',
    },
    {
      id: 'feature-reading',
      title: 'Read the features on eight nodes',
      kind: 'interpretation',
      presentation: 'ultrasound',
      image: 'diagram',
      figure: 'node-reading',
      interaction: 'read',
      teaching: [],
      questions: [],
      instruction:
        'Each image was chosen to show one or two features. Answer the question beside it; the outlines appear when you check your answer.',
    },
    transfer('Interpret a different morphology report'),
  ],
  'systematic-staging': [
    predict('first-decision', 'Rank the targets by N category'),
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
    predict('first-decision', 'Choose the target for a second route'),
    brief('complementary-route', 'Identify what a second route can add', 'regional'),
    apply(
      'route-coverage',
      'Match the route to the remaining question',
      'matching',
      [],
      'regional',
    ),
    {
      ...brief('route-orientation', 'Compare the approach to the same target', 'briefing'),
      from: 'eus-b-route-model',
    },
    {
      ...acquire('route-comparison', 'Compare the airway and esophageal routes', 'linked'),
      from: 'eus-b-route-model',
    },
    { ...explain('Read the route comparison', 'linked'), from: 'eus-b-route-model' },
    transfer('Identify an unresolved regional gap'),
  ],
  'needle-safety': [
    predict('first-decision', 'Decide what to do when the tip is lost'),
    brief('sampling-states', 'Follow the sampling sequence', 'sampling'),
    apply('safe-sequence', 'Link needle actions to current guidance', 'sequence', [], 'sampling'),
    {
      ...brief('needle-components', 'Relate sheath, needle, stylet and outlet', 'briefing'),
      from: 'needle-assembly-model',
    },
    {
      ...acquire('needle-states', 'Prepare, pass and withdraw the needle', 'sampling'),
      from: 'needle-assembly-model',
    },
    { ...explain('Read the live-tip limitation', 'sampling'), from: 'needle-assembly-model' },
    transfer('Respond to resistance at a calcified target'),
  ],
  'adequacy-rose': [
    predict('first-decision', 'Separate what ROSE has settled'),
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
      [],
      'sampling',
    ),
    transfer('Plan when ROSE is unavailable'),
  ],
  'specimen-triage': [
    predict('first-decision', 'Explain why specimens stay separate'),
    brief('specimen-request', 'Connect each specimen to the requested studies', 'sampling'),
    {
      ...record('allocation-plan', 'Allocate the case specimens', 'allocation', EXAMINATION_CASE),
      purpose:
        'Guided record: each requested study shows the laboratory’s instruction for it, or says that none was supplied. Record the handling plan each one supports.',
    },
    apply('traceability', 'Preserve the source through processing', 'matching', [], 'sampling'),
    transfer('Discuss granulomas when microbiology was not sent'),
  ],
  'difficult-acquisition': [
    predict('first-decision', 'Choose the first adjustment'),
    brief('acquisition-problem', 'Classify the problem before changing controls', 'case'),
    {
      ...apply('problem-action', 'Choose the first response to each problem', 'matching'),
      purpose:
        'Guided task: the troubleshooting flow in the briefing shows these pairings. Match them here; Back rereads the flow at any time.',
    },
    transfer('Recognize the limit of the current window'),
  ],
  /* Both checks stay: the first is the immediate response, the second a separate later decision. */
  'complications-recovery': [
    predict('first-decision', 'Respond to bleeding during a pass'),
    brief(
      'patient-response',
      'Respond to the patient and communicate the limitation',
      'case',
      'none',
    ),
    apply('recovery-sequence', 'Prioritize the patient during deterioration', 'sequence', [
      'observation',
    ]),
    transfer('Plan recovery and escalation'),
  ],
  'results-reporting': [
    predict('first-decision', 'Interpret a bloody aspirate'),
    brief('report-evidence', 'Build the conclusion from the evidence', 'record', 'none'),
    record('reconciled-report', 'Construct the case report', 'report', EXAMINATION_CASE),
    apply('result-meaning', 'Reconcile the result with the clinical question', 'matching'),
    transfer('Close the loop on unresolved findings'),
  ],
}

export function activitiesForLesson(lesson: Lesson): LessonActivity[] {
  const specs = ACTIVITY_FLOWS[lesson.id]
  if (!specs) throw new Error('EBUS lesson has no activity flow: ' + lesson.id)
  /** The unit a step draws on: its text, lab, checks, sources and boundary are that unit's. */
  const unitFor = (spec: ActivitySpec): Lesson => {
    const id = spec.from ?? lesson.id
    const unit = (lesson.parts ?? [lesson]).find((part) => part.id === id)
    if (!unit) throw new Error('EBUS lesson ' + lesson.id + ' has no unit ' + id)
    return unit
  }
  const idOf = (spec: ActivitySpec) => unitFor(spec).id + ':' + spec.id
  return specs.map((spec, index) => {
    const unit = unitFor(spec)
    return {
      ...spec,
      id: idOf(spec),
      lessonId: unit.id,
      contentVersion: 1,
      objective: unit.objective,
      sourceIds: unit.sources,
      limitation: unit.boundary ?? '',
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
            : spec.image === 'held' && unit.lab?.kind === 'model'
              ? 'guided'
              : spec.questions.length
                ? 'independent'
                : 'guided',
      completion: { action: spec.interaction, responses: spec.questions },
      transitions: {
        next: specs[index + 1] ? idOf(specs[index + 1]) : null,
        retry: idOf(spec),
        review: 'read-only',
      },
    }
  })
}

export const flowAuthoring = {
  predict,
  brief,
  demo,
  decide,
  acquire,
  apply,
  explain,
  transfer,
  held,
}
