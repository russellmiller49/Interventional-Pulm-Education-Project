import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'
import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'

import { isSectionCompleted, type IcuHemodynamicsLearnRecord } from '../engine/learnProgress'
import { hemodynamicsPracticePairing } from './sectionSpecs'

/**
 * The one door.
 *
 * Every primary "Continue" on every entry surface — the Overview hero, the Learn landing, the
 * pathway accordion's "Up next" — resolves through `nextIncompleteHemodynamicsSection`, which
 * walks the canonical order and returns the first section without a completed record. A fresh
 * learner lands on section one, never on a mid-ladder section that happens to be the flagship
 * interactive. Counts come from the registry at render; nothing here is written down.
 */
export const hemodynamicsPathway = criticalCareLearningPathway('icu-hemodynamics')

export const hemodynamicsPathwaySections: readonly LearningPathwaySection[] =
  hemodynamicsPathway.sections

export function hemodynamicsSectionHref(sectionId: string): string {
  return `${icuHemodynamicsNavBase}/learn?activity=${sectionId}`
}

export function hemodynamicsSectionLinkTarget(sectionId: string): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: `${icuHemodynamicsNavBase}/learn`, query: { activity: sectionId } }
}

export interface HemodynamicsNextSection {
  readonly section: LearningPathwaySection
  /** Zero-based position in the canonical order. */
  readonly index: number
  readonly total: number
  readonly href: string
  /** Whether this is the section the learner was in most recently. */
  readonly resumed: boolean
}

export function nextIncompleteHemodynamicsSection(
  record: IcuHemodynamicsLearnRecord,
): HemodynamicsNextSection | null {
  const index = hemodynamicsPathwaySections.findIndex(
    (section) => !isSectionCompleted(record, section.id),
  )
  if (index < 0) return null
  const section = hemodynamicsPathwaySections[index]
  return {
    section,
    index,
    total: hemodynamicsPathwaySections.length,
    href: hemodynamicsSectionHref(section.id),
    resumed: record.lastSectionId === section.id,
  }
}

export function workedHemodynamicsSectionIds(
  record: IcuHemodynamicsLearnRecord,
): ReadonlySet<string> {
  return new Set(
    hemodynamicsPathwaySections
      .filter((section) => isSectionCompleted(record, section.id))
      .map((section) => section.id),
  )
}

const STAGE_ORDER: readonly CriticalCareCurriculumStage[] = [
  'orientation',
  'foundation',
  'mechanism',
  'application',
  'integration',
]

const STAGE_TITLES: Readonly<Record<CriticalCareCurriculumStage, string>> = {
  orientation: 'Why this exists',
  foundation: 'The line and the places',
  mechanism: 'One measurement at a time',
  application: 'Numbers made of numbers',
  integration: 'One screen, every row',
}

const STAGE_DESCRIPTIONS: Readonly<Record<CriticalCareCurriculumStage, string>> = {
  orientation:
    'What a pressure line adds to the bedside picture, and what it cannot say on its own.',
  foundation:
    'Walk the line from the tip to the number, then the four places the tip can sit, and learn where the catheter is from what it writes.',
  mechanism:
    'Read the waves inside a named place, take a wedge and prove the occlusion ended, and measure flow with a technique you can see.',
  application: 'Trace every calculated value back to its inputs before it is read.',
  integration:
    'One patient whose screen changed while they did not: every row of the table, in order.',
}

const STAGE_WORDS: Readonly<Record<CriticalCareCurriculumStage, readonly [string, string]>> = {
  orientation: ['orientation', 'orientations'],
  foundation: ['foundation', 'foundations'],
  mechanism: ['mechanism', 'mechanisms'],
  application: ['application', 'applications'],
  integration: ['capstone', 'capstones'],
}

export interface HemodynamicsPathwayComposition {
  readonly total: number
  readonly minutes: number
  readonly byStage: readonly {
    readonly stage: CriticalCareCurriculumStage
    readonly title: string
    readonly count: number
  }[]
}

export function hemodynamicsPathwayComposition(): HemodynamicsPathwayComposition {
  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    title: STAGE_TITLES[stage],
    count: hemodynamicsPathwaySections.filter((section) => section.stage === stage).length,
  })).filter((entry) => entry.count > 0)
  return {
    total: hemodynamicsPathwaySections.length,
    minutes: hemodynamicsPathwaySections.reduce((sum, section) => sum + section.minutes, 0),
    byStage,
  }
}

/** "9 sections · 1 orientation · 2 foundations · 4 mechanisms · 1 application · 1 capstone · 121 min". */
export function hemodynamicsCompositionLine(): string {
  const composition = hemodynamicsPathwayComposition()
  const parts = composition.byStage.map(
    (entry) => `${entry.count} ${STAGE_WORDS[entry.stage][entry.count === 1 ? 0 : 1]}`,
  )
  return `${composition.total} sections · ${parts.join(' · ')} · ${composition.minutes} min`
}

export interface HemodynamicsPathwayGroup {
  readonly stage: CriticalCareCurriculumStage
  readonly title: string
  readonly description: string
  readonly sections: readonly LearningPathwaySection[]
  /** The Practice case each section in this group pairs to, by its presentation title. */
  readonly cases: readonly {
    readonly sectionId: string
    readonly caseId: string
    readonly title: string
    readonly kind: 'mechanism-match' | 'next-in-unit'
  }[]
}

/**
 * The canonical order as contiguous runs by stage. Flattening the groups reproduces the order
 * exactly, which `pathway-resolver.test.ts` asserts — a grouped view is a presentation of the one
 * order, never a second one. The hemodynamics pathway interleaves a foundation section between
 * two mechanism sections on purpose (naming a place from its shape is taught before the tip is
 * moved against it), so a stage may appear as more than one run.
 */
export function hemodynamicsPathwayGroups(): readonly HemodynamicsPathwayGroup[] {
  const groups: HemodynamicsPathwayGroup[] = []
  for (const section of hemodynamicsPathwaySections) {
    const last = groups.at(-1)
    const pairing = hemodynamicsPracticePairing(section.id)
    const entry = {
      sectionId: section.id,
      caseId: pairing.caseId,
      title: pairing.title,
      kind: pairing.kind,
    }
    if (last && last.stage === section.stage) {
      groups[groups.length - 1] = {
        ...last,
        sections: [...last.sections, section],
        cases: [...last.cases, entry],
      }
    } else {
      groups.push({
        stage: section.stage,
        title: STAGE_TITLES[section.stage],
        description: STAGE_DESCRIPTIONS[section.stage],
        sections: [section],
        cases: [entry],
      })
    }
  }
  return groups
}
