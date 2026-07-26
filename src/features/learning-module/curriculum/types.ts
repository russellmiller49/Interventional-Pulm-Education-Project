import type { CriticalCareCurriculumStage } from '../activity/types'

/**
 * One ordered station of a module's Learn pathway. A section is a presentation of an activity that
 * already exists in the catalog: `activityId` must resolve, and `stage` must match that activity's
 * `curriculumStage`.
 */
export interface LearningPathwaySection {
  readonly id: string
  /** Rail label. Short enough to read at a glance: "Advance", "Validate setup". */
  readonly shortTitle: string
  readonly title: string
  readonly minutes: number
  /** One sentence. Later sections may reference artifacts built in earlier ones. */
  readonly description: string
  readonly stage: CriticalCareCurriculumStage
  readonly activityId: string
}

/**
 * A module's authored learning order. Nothing here gates: the pathway is an ordering and a
 * wayfinding aid, and every section stays directly reachable by URL.
 */
export interface LearningPathway {
  readonly moduleId: string
  /** Set where a module teaches parallel tracks — ECMO's `vv` and `va` support modes. */
  readonly trackId?: string
  /** The Learn landing H1: the module's verbs, in order. */
  readonly arcSentence: string
  readonly sections: readonly LearningPathwaySection[]
}

export function pathwaySectionIndex(pathway: LearningPathway, sectionId: string): number {
  return pathway.sections.findIndex((section) => section.id === sectionId)
}

export function pathwaySection(
  pathway: LearningPathway,
  sectionId: string,
): LearningPathwaySection | null {
  return pathway.sections.find((section) => section.id === sectionId) ?? null
}

export function isPathwaySectionId(pathway: LearningPathway, value: unknown): value is string {
  return typeof value === 'string' && pathway.sections.some((section) => section.id === value)
}

export function firstPathwaySectionId(pathway: LearningPathway): string {
  const first = pathway.sections[0]
  if (!first) throw new Error(`Learning pathway ${pathway.moduleId} has no sections`)
  return first.id
}

/** The next authored section, or null at the end of the pathway. Order-based, never gated. */
export function nextPathwaySection(
  pathway: LearningPathway,
  sectionId: string,
): LearningPathwaySection | null {
  const index = pathwaySectionIndex(pathway, sectionId)
  if (index < 0) return null
  return pathway.sections[index + 1] ?? null
}

export function pathwayTotalMinutes(pathway: LearningPathway): number {
  return pathway.sections.reduce((total, section) => total + section.minutes, 0)
}

export function stageLabel(stage: CriticalCareCurriculumStage): string {
  switch (stage) {
    case 'orientation':
      return 'Orientation'
    case 'foundation':
      return 'Foundation'
    case 'mechanism':
      return 'Mechanism'
    case 'application':
      return 'Application'
    case 'integration':
      return 'Integration capstone'
  }
}
