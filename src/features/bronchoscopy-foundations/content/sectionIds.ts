import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'

/**
 * The canonical order: the one ordering authority every surface lists sections from.
 *
 * Twenty-three core sections carry the eighteen core modules of the knowledge specification in its
 * own curriculum order (§19), with five modules split in two where one section would carry two new
 * concepts (M05, M06, M12, M15, M16). Section ids are stable: the learner record keys on them.
 * Everything that counts, numbers or groups sections derives from this array at render.
 */
export const BRONCH_SECTION_IDS = [
  'shared-airway',
  'clinical-question',
  'pre-use-check',
  'sedation-and-monitoring',
  'five-controls',
  'branch-entry',
  'reference-frames',
  'view-loss',
  'larynx-and-entry',
  'right-side',
  'left-side',
  'systematic-survey',
  'describe-findings',
  'washing-and-lavage',
  'poor-return',
  'protected-accessories',
  'specimen-pathway',
  'deterioration',
  'bleeding-priorities',
  'scope-in-a-tube',
  'icu-physiology',
  'honest-report',
  'what-completion-means',
] as const

export type BronchSectionId = (typeof BRONCH_SECTION_IDS)[number]

export function isBronchSectionId(value: unknown): value is BronchSectionId {
  return typeof value === 'string' && (BRONCH_SECTION_IDS as readonly string[]).includes(value)
}

/** The teaching stage of each section: internal to the pedagogy checks; learners see the phase. */
export const BRONCH_SECTION_STAGE: Readonly<Record<BronchSectionId, CriticalCareCurriculumStage>> =
  {
    'shared-airway': 'orientation',
    'clinical-question': 'foundation',
    'pre-use-check': 'foundation',
    'sedation-and-monitoring': 'mechanism',
    'five-controls': 'foundation',
    'branch-entry': 'mechanism',
    'reference-frames': 'mechanism',
    'view-loss': 'mechanism',
    'larynx-and-entry': 'application',
    'right-side': 'application',
    'left-side': 'application',
    'systematic-survey': 'application',
    'describe-findings': 'mechanism',
    'washing-and-lavage': 'mechanism',
    'poor-return': 'application',
    'protected-accessories': 'mechanism',
    'specimen-pathway': 'application',
    deterioration: 'application',
    'bleeding-priorities': 'application',
    'scope-in-a-tube': 'mechanism',
    'icu-physiology': 'application',
    'honest-report': 'integration',
    'what-completion-means': 'integration',
  }

/**
 * The procedure timeline the pathway is presented in. Each phase is a contiguous run of the
 * canonical order, and the phases tile it exactly once (validated at import), so a grouped view is
 * a presentation of the one order, never a second one.
 */
export type BronchPhaseId =
  | 'prepare'
  | 'handle'
  | 'orient'
  | 'enter'
  | 'survey'
  | 'describe'
  | 'sample'
  | 'respond'
  | 'close'

export interface BronchPhase {
  readonly id: BronchPhaseId
  readonly title: string
  readonly description: string
  readonly sectionIds: readonly BronchSectionId[]
}

export const BRONCH_PHASES: readonly BronchPhase[] = [
  {
    id: 'prepare',
    title: 'Prepare',
    description:
      'Ask the clinical question, ready the instrument and plan for the patient: what bronchoscopy should add, the four functional systems of the scope, and a shared airway under topical anesthesia and sedation.',
    sectionIds: ['shared-airway', 'clinical-question', 'pre-use-check', 'sedation-and-monitoring'],
  },
  {
    id: 'handle',
    title: 'Handle',
    description:
      'The five things you control at the scope, one at a time, and then together at a branch.',
    sectionIds: ['five-controls', 'branch-entry'],
  },
  {
    id: 'orient',
    title: 'Orient',
    description:
      'Know where you are before you move: three reference frames, and what to do when the view is lost.',
    sectionIds: ['reference-frames', 'view-loss'],
  },
  {
    id: 'enter',
    title: 'Enter',
    description: 'Examine the larynx before crossing it, and enter the trachea without force.',
    sectionIds: ['larynx-and-entry'],
  },
  {
    id: 'survey',
    title: 'Survey',
    description:
      'Right and left airways by parentage, then a systematic examination whose record claims only what was seen.',
    sectionIds: ['right-side', 'left-side', 'systematic-survey'],
  },
  {
    id: 'describe',
    title: 'Describe',
    description: 'Describe structure, mucosa and contents before offering a diagnosis.',
    sectionIds: ['describe-findings'],
  },
  {
    id: 'sample',
    title: 'Sample',
    description:
      'Washing and lavage, poor return, protected accessories, and the specimen pathway from question to laboratory.',
    sectionIds: ['washing-and-lavage', 'poor-return', 'protected-accessories', 'specimen-pathway'],
  },
  {
    id: 'respond',
    title: 'Respond',
    description:
      'Deterioration, bleeding, the scope inside an artificial airway, and ventilated-patient physiology.',
    sectionIds: ['deterioration', 'bleeding-priorities', 'scope-in-a-tube', 'icu-physiology'],
  },
  {
    id: 'close',
    title: 'Close',
    description: 'An honest report, and what each record in a training program shows.',
    sectionIds: ['honest-report', 'what-completion-means'],
  },
]

export function phaseOfSection(sectionId: BronchSectionId): BronchPhase {
  const phase = BRONCH_PHASES.find((candidate) => candidate.sectionIds.includes(sectionId))
  if (!phase) throw new Error(`Section ${sectionId} belongs to no phase`)
  return phase
}
