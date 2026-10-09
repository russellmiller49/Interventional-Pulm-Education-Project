import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'

/**
 * The canonical order: the one ordering authority every surface lists sections from.
 *
 * The order follows the scope's path, in the five phases of the rewrite plan (2026-10-08): prepare,
 * handle, navigate, describe and sample, respond. The rewrite ends at fifteen sections. Until each
 * absorbing section is re-authored, the section it absorbs stays here beside it; when it goes, its
 * id moves to `RETIRED_SECTION_FORWARD` (`sectionMigration.ts`), which already knows where it leads.
 * Section ids are stable: the learner record keys on them. Everything that counts, numbers or
 * groups sections derives from this array at render.
 */
export const BRONCH_SECTION_IDS = [
  'clinical-question',
  'pre-use-check',
  'sedation-and-monitoring',
  'five-controls',
  'reference-frames',
  'larynx-and-entry',
  'right-side',
  'left-side',
  'view-loss',
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
    'clinical-question': 'foundation',
    'pre-use-check': 'foundation',
    'sedation-and-monitoring': 'mechanism',
    'five-controls': 'foundation',
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
export type BronchPhaseId = 'prepare' | 'handle' | 'navigate' | 'describe-and-sample' | 'respond'

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
      'Decide whether this patient should have a bronchoscopy today, check the scope, and plan topical anesthesia, sedation and monitoring.',
    sectionIds: ['clinical-question', 'pre-use-check', 'sedation-and-monitoring'],
  },
  {
    id: 'handle',
    title: 'Handle',
    description: 'Drive the scope on the bench, then cross the larynx and reach the carina.',
    sectionIds: ['five-controls', 'reference-frames', 'larynx-and-entry'],
  },
  {
    id: 'navigate',
    title: 'Navigate',
    description:
      'Learn each lung by its branches, recover a lost view, and survey the whole tree in the same order every time.',
    sectionIds: ['right-side', 'left-side', 'view-loss', 'systematic-survey'],
  },
  {
    id: 'describe-and-sample',
    title: 'Describe and sample',
    description:
      'Describe what you see and report it, then wash, lavage, biopsy and send each specimen to its test.',
    sectionIds: [
      'describe-findings',
      'washing-and-lavage',
      'poor-return',
      'protected-accessories',
      'specimen-pathway',
    ],
  },
  {
    id: 'respond',
    title: 'Respond',
    description:
      'Your first moves when the patient deteriorates or bleeds, and bronchoscopy in a ventilated patient.',
    sectionIds: [
      'deterioration',
      'bleeding-priorities',
      'scope-in-a-tube',
      'icu-physiology',
      'honest-report',
      'what-completion-means',
    ],
  },
]

export function phaseOfSection(sectionId: BronchSectionId): BronchPhase {
  const phase = BRONCH_PHASES.find((candidate) => candidate.sectionIds.includes(sectionId))
  if (!phase) throw new Error(`Section ${sectionId} belongs to no phase`)
  return phase
}
