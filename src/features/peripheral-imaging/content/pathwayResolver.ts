import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'
import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'

import { isSectionCompleted, type ImagingRecord } from '../engine/learnProgress'
import { peripheralImagingPathwaySections } from './pathway'
import { PERIPHERAL_IMAGING_NAV_BASE } from './routes'

/**
 * The one door.
 *
 * Every primary "Continue" on every entry surface — the hub hero, the Learn landing, the pathway
 * accordion's "Up next" — resolves through `nextIncompleteImagingSection`, which walks the
 * canonical order and returns the first section without a completed record. A fresh learner lands
 * on section one, never on a mid-ladder section that happens to be the flagship interactive.
 * Counts come from the registry at render; nothing here is written down.
 */
export function imagingSectionHref(sectionId: string): string {
  return `${PERIPHERAL_IMAGING_NAV_BASE}/learn?section=${sectionId}`
}

export function imagingSectionLinkTarget(sectionId: string): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: `${PERIPHERAL_IMAGING_NAV_BASE}/learn`, query: { section: sectionId } }
}

export interface ImagingNextSection {
  readonly section: LearningPathwaySection
  /** Zero-based position in the canonical order. */
  readonly index: number
  readonly total: number
  readonly href: string
  /** Whether this is the section the learner was in most recently. */
  readonly resumed: boolean
}

export function nextIncompleteImagingSection(record: ImagingRecord): ImagingNextSection | null {
  const index = peripheralImagingPathwaySections.findIndex(
    (section) => !isSectionCompleted(record, section.id),
  )
  if (index < 0) return null
  const section = peripheralImagingPathwaySections[index]
  return {
    section,
    index,
    total: peripheralImagingPathwaySections.length,
    href: imagingSectionHref(section.id),
    resumed: record.lastSectionId === section.id,
  }
}

export function workedImagingSectionIds(record: ImagingRecord): ReadonlySet<string> {
  return new Set(
    peripheralImagingPathwaySections
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
  orientation: 'What the image is for',
  foundation: 'The chain, and what you can change on it',
  mechanism: 'One stop at a time',
  application: 'The suite, one decision at a time',
  integration: 'Every row of the table',
}

const STAGE_DESCRIPTIONS: Readonly<Record<CriticalCareCurriculumStage, string>> = {
  orientation: 'Four questions an image can be asked, and why no display answers all of them.',
  foundation:
    'Walk the six stops on a running suite, meet the five things you can change, then the map and the ray.',
  mechanism:
    'Why a target is hard to see, what a field and a clock decide, what a sweep and an orbit add, and where the dose numbers come from.',
  application:
    'A fixed room, a mobile scanner, the actual sampling component, and what to do when the anatomy has changed.',
  integration:
    'Every finding placed on the chain, then the eight case decisions on the Assess page.',
}

const STAGE_WORDS: Readonly<Record<CriticalCareCurriculumStage, readonly [string, string]>> = {
  orientation: ['orientation', 'orientations'],
  foundation: ['foundation', 'foundations'],
  mechanism: ['mechanism', 'mechanisms'],
  application: ['application', 'applications'],
  integration: ['capstone', 'capstones'],
}

export interface ImagingPathwayComposition {
  readonly total: number
  readonly minutes: number
  readonly byStage: readonly {
    readonly stage: CriticalCareCurriculumStage
    readonly title: string
    readonly count: number
  }[]
}

export function imagingPathwayComposition(): ImagingPathwayComposition {
  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    title: STAGE_TITLES[stage],
    count: peripheralImagingPathwaySections.filter((section) => section.stage === stage).length,
  })).filter((entry) => entry.count > 0)
  return {
    total: peripheralImagingPathwaySections.length,
    minutes: peripheralImagingPathwaySections.reduce((sum, section) => sum + section.minutes, 0),
    byStage,
  }
}

/** "19 sections · 1 orientation · 4 foundations · 9 mechanisms · 4 applications · 1 capstone · 111 min". */
export function imagingCompositionLine(): string {
  const composition = imagingPathwayComposition()
  const parts = composition.byStage.map(
    (entry) => `${entry.count} ${STAGE_WORDS[entry.stage][entry.count === 1 ? 0 : 1]}`,
  )
  return `${composition.total} sections · ${parts.join(' · ')} · ${composition.minutes} min`
}

export interface ImagingPathwayGroup {
  readonly stage: CriticalCareCurriculumStage
  readonly title: string
  readonly description: string
  readonly sections: readonly LearningPathwaySection[]
}

/**
 * The canonical order as contiguous runs by stage. Flattening the groups reproduces the order
 * exactly — a grouped view is a presentation of the one order, never a second one. The ladder
 * returns to mechanism when a new modality is introduced, so a stage may appear as more than one
 * run.
 */
export function imagingPathwayGroups(): readonly ImagingPathwayGroup[] {
  const groups: ImagingPathwayGroup[] = []
  for (const section of peripheralImagingPathwaySections) {
    const last = groups.at(-1)
    if (last && last.stage === section.stage) {
      groups[groups.length - 1] = { ...last, sections: [...last.sections, section] }
    } else {
      groups.push({
        stage: section.stage,
        title: STAGE_TITLES[section.stage],
        description: STAGE_DESCRIPTIONS[section.stage],
        sections: [section],
      })
    }
  }
  return groups
}
