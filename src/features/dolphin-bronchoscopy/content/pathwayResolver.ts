import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'

import type { DolphinProgress } from '../engine/selfPacedProgress'
import { dolphinLearnerCopyErrors } from './learnerCopy'
import { dolphinPathwaySections, dolphinSectionIds, type DolphinSectionId } from './pathway'
import { dolphinSectionHref } from './routes'

/**
 * The one door.
 *
 * Every primary Start, Resume or Continue on every entry surface resolves through
 * `recommendedDolphinSection`. It recommends, never locks: every section is always open. A learner
 * who left a section before finishing it is offered it back; otherwise the first section, in the
 * canonical order, not yet marked reviewed. Answers and simulation work never enter it.
 */
export interface DolphinNextSection {
  readonly section: LearningPathwaySection
  /** Zero-based position in the canonical order. */
  readonly index: number
  readonly total: number
  readonly href: string
  readonly resumed: boolean
}

export function recommendedDolphinSection(progress: DolphinProgress): DolphinNextSection | null {
  const reviewed = new Set(progress.reviewedSectionIds)
  const lastId = progress.lastLocation?.kind === 'section' ? progress.lastLocation.id : null
  const lastIndex = lastId === null ? -1 : dolphinPathwaySections.findIndex((s) => s.id === lastId)
  const resumed = lastIndex >= 0 && lastId !== null && !reviewed.has(lastId)
  const index = resumed ? lastIndex : dolphinPathwaySections.findIndex((s) => !reviewed.has(s.id))
  if (index < 0) return null
  const section = dolphinPathwaySections[index]
  return {
    section,
    index,
    total: dolphinPathwaySections.length,
    href: dolphinSectionHref(section.id),
    resumed,
  }
}

function knownSectionIds(ids: readonly string[]): ReadonlySet<string> {
  const listed = new Set(ids)
  return new Set(dolphinSectionIds.filter((id) => listed.has(id)))
}

export function visitedDolphinSectionIds(progress: DolphinProgress): ReadonlySet<string> {
  return knownSectionIds(progress.visitedSectionIds)
}

export function reviewedDolphinSectionIds(progress: DolphinProgress): ReadonlySet<string> {
  return knownSectionIds(progress.reviewedSectionIds)
}

export function reviewLaterDolphinSections(
  progress: DolphinProgress,
): readonly LearningPathwaySection[] {
  const saved = knownSectionIds(progress.reviewLaterSectionIds)
  return dolphinPathwaySections.filter((section) => saved.has(section.id))
}

/**
 * The phases the pathway is presented in. Each is a contiguous run of the canonical order and the
 * phases tile it exactly once, so a grouped view is a presentation of the one order.
 *
 * Recorded deviation from the stage ladder: "Finding a named branch" and "Trouble during the
 * procedure" are integration units placed beside the teaching they exercise, not at the end.
 */
export type DolphinPhaseId = 'why' | 'map' | 'view' | 'plan' | 'procedure' | 'trouble' | 'beyond'

export interface DolphinPhase {
  readonly id: DolphinPhaseId
  readonly title: string
  readonly description: string
  readonly sectionIds: readonly DolphinSectionId[]
}

export const DOLPHIN_PHASES: readonly DolphinPhase[] = Object.freeze([
  {
    id: 'why',
    title: 'Why look',
    description: 'What a blow sample can and cannot say about the lungs.',
    sectionIds: ['why-scope-a-dolphin'],
  },
  {
    id: 'map',
    title: 'The map',
    description:
      'An airway apart from the mouth, the passage from blowhole to carina, and the numbered branches.',
    sectionIds: [
      'an-airway-apart-from-the-mouth',
      'from-blowhole-to-spout',
      'below-the-larynx',
      'the-numbered-map',
      'same-in-every-dolphin',
    ],
  },
  {
    id: 'view',
    title: 'Reading the view',
    description: 'Which way is up on the screen, and finding a branch by name.',
    sectionIds: ['reading-the-picture', 'finding-a-named-branch'],
  },
  {
    id: 'plan',
    title: 'Planning the procedure',
    description: 'The instrument, the workup, the room and team, sedation and topical lidocaine.',
    sectionIds: [
      'choosing-the-instrument',
      'before-the-day',
      'the-room-and-the-team',
      'sedation-and-numbing',
    ],
  },
  {
    id: 'procedure',
    title: 'The procedure',
    description:
      'Passing the spout, the survey and its record, lavage, the tools through the channel, brush and biopsy.',
    sectionIds: [
      'entering-the-blowhole',
      'the-survey-and-the-record',
      'lavage',
      'tools-through-the-channel',
      'brush-and-biopsy',
    ],
  },
  {
    id: 'trouble',
    title: 'Trouble and recovery',
    description: 'The earliest sign and the first move for each complication, then recovery.',
    sectionIds: ['trouble-during-the-procedure', 'recovery-and-return'],
  },
  {
    id: 'beyond',
    title: 'Beyond and closing',
    description: 'Work beyond the diagnostic survey, and what these sections establish.',
    sectionIds: ['beyond-the-survey', 'what-this-module-can-say'],
  },
])

export function dolphinPhaseOf(sectionId: DolphinSectionId): DolphinPhase {
  const phase = DOLPHIN_PHASES.find((candidate) => candidate.sectionIds.includes(sectionId))
  if (!phase) throw new Error(`Section ${sectionId} belongs to no phase`)
  return phase
}

export interface DolphinPathwayGroup {
  readonly phase: DolphinPhaseId
  readonly title: string
  readonly description: string
  readonly sections: readonly LearningPathwaySection[]
}

export function dolphinPathwayGroups(): readonly DolphinPathwayGroup[] {
  const byId = new Map(dolphinPathwaySections.map((section) => [section.id, section] as const))
  return DOLPHIN_PHASES.map((phase) => ({
    phase: phase.id,
    title: phase.title,
    description: phase.description,
    sections: phase.sectionIds.map((id) => {
      const section = byId.get(id)
      if (!section) throw new Error(`Phase ${phase.id} names an unknown section ${id}`)
      return section
    }),
  }))
}

/** "20 sections in 7 parts · 195 min", counted from the registry. */
export function dolphinCompositionLine(): string {
  const minutes = dolphinPathwaySections.reduce((sum, section) => sum + section.minutes, 0)
  return `${dolphinPathwaySections.length} sections in ${DOLPHIN_PHASES.length} parts · ${minutes} min`
}

export function validateDolphinPhases(
  phases: readonly DolphinPhase[] = DOLPHIN_PHASES,
): readonly string[] {
  const errors: string[] = []
  if (phases.flatMap((phase) => phase.sectionIds).join('|') !== dolphinSectionIds.join('|')) {
    errors.push('The phases do not tile the canonical order exactly once, in order.')
  }
  for (const phase of phases) {
    if (phase.sectionIds.length === 0) errors.push(`Phase ${phase.id} holds no section.`)
    errors.push(
      ...dolphinLearnerCopyErrors(`Phase ${phase.id} title`, phase.title, { allowDigits: false }),
      ...dolphinLearnerCopyErrors(`Phase ${phase.id} description`, phase.description),
    )
  }
  return errors
}

const phaseErrors = validateDolphinPhases()
if (phaseErrors.length > 0) {
  throw new Error(`The dolphin bronchoscopy phases are invalid:\n${phaseErrors.join('\n')}`)
}
