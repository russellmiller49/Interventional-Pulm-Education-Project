import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'

import { isSectionCompleted, type BronchRecord } from '../engine/learnProgress'
import { bronchPathwaySections, BRONCH_SECTION_IDS } from './pathway'
import { BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF } from './routes'
import { BRONCH_PHASES, type BronchPhase, type BronchPhaseId } from './sectionIds'

/**
 * The one door.
 *
 * Every primary "Continue" on every entry surface — the hub, the Learn landing, the pathway
 * accordion's "Up next" — resolves through `nextIncompleteBronchSection`, which walks the canonical
 * order and returns the first section without a completed record. A fresh learner lands on section
 * one. Counts come from the registry at render; nothing here is written down.
 */
export function bronchSectionHref(sectionId: string): string {
  return `${BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF}?section=${sectionId}`
}

export function bronchSectionLinkTarget(sectionId: string): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF, query: { section: sectionId } }
}

export interface BronchNextSection {
  readonly section: LearningPathwaySection
  /** Zero-based position in the canonical order. */
  readonly index: number
  readonly total: number
  readonly href: string
  /** Whether this is the section the learner was in most recently. */
  readonly resumed: boolean
}

export function nextIncompleteBronchSection(record: BronchRecord): BronchNextSection | null {
  const index = bronchPathwaySections.findIndex(
    (section) => !isSectionCompleted(record, section.id),
  )
  if (index < 0) return null
  const section = bronchPathwaySections[index]
  return {
    section,
    index,
    total: bronchPathwaySections.length,
    href: bronchSectionHref(section.id),
    resumed: record.lastSectionId === section.id,
  }
}

export function workedBronchSectionIds(record: BronchRecord): ReadonlySet<string> {
  return new Set(
    bronchPathwaySections
      .filter((section) => isSectionCompleted(record, section.id))
      .map((section) => section.id),
  )
}

export interface BronchPathwayComposition {
  readonly total: number
  readonly minutes: number
  readonly byPhase: readonly {
    readonly phase: BronchPhaseId
    readonly title: string
    readonly count: number
  }[]
}

export function bronchPathwayComposition(): BronchPathwayComposition {
  return {
    total: bronchPathwaySections.length,
    minutes: bronchPathwaySections.reduce((sum, section) => sum + section.minutes, 0),
    byPhase: BRONCH_PHASES.map((phase) => ({
      phase: phase.id,
      title: phase.title,
      count: phase.sectionIds.length,
    })),
  }
}

/** "23 sections in 9 phases · 186 min". */
export function bronchCompositionLine(): string {
  const composition = bronchPathwayComposition()
  return `${composition.total} sections in ${composition.byPhase.length} phases · ${composition.minutes} min`
}

export interface BronchPathwayGroup {
  readonly phase: BronchPhaseId
  readonly title: string
  readonly description: string
  readonly sections: readonly LearningPathwaySection[]
}

/** The canonical order as its procedure phases. Flattening the groups reproduces the order. */
export function bronchPathwayGroups(): readonly BronchPathwayGroup[] {
  const sectionById = new Map(
    bronchPathwaySections.map((section) => [section.id, section] as const),
  )
  return BRONCH_PHASES.map((phase) => ({
    phase: phase.id,
    title: phase.title,
    description: phase.description,
    sections: phase.sectionIds.map((id) => {
      const section = sectionById.get(id)
      if (!section) throw new Error(`Phase ${phase.id} names an unknown section ${id}`)
      return section
    }),
  }))
}

export function validateBronchPhases(
  phases: readonly BronchPhase[] = BRONCH_PHASES,
): readonly string[] {
  const errors: string[] = []
  const tiled = phases.flatMap((phase) => phase.sectionIds)
  if (tiled.join('|') !== BRONCH_SECTION_IDS.join('|')) {
    errors.push('The procedure phases do not tile the canonical order exactly once, in order.')
  }
  for (const phase of phases) {
    if (phase.sectionIds.length === 0) errors.push(`Phase ${phase.id} holds no section.`)
  }
  return errors
}

const phaseErrors = validateBronchPhases()
if (phaseErrors.length > 0) {
  throw new Error(`The procedure phases are invalid:\n${phaseErrors.join('\n')}`)
}
