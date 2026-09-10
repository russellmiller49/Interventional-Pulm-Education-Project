import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'

import { isSectionCompleted, type ImagingRecord } from '../engine/learnProgress'
import { imagingLearnerCopyErrors } from './learnerCopy'
import {
  peripheralImagingPathwaySections,
  peripheralImagingSectionIds,
  type ImagingSectionId,
} from './pathway'
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

/**
 * The clinical sequence the pathway is presented in: plan, localize and optimize, confirm, sample
 * and reconfirm, then radiation safety and the integrated cases.
 *
 * Each phase is a contiguous run of the canonical order, and the phases tile it exactly once, so a
 * grouped view is a presentation of the one order, never a second one. The teaching stage each
 * section carries (orientation, foundation, mechanism, application, integration) stays internal to
 * the pedagogy checks; learners see the clinical phase.
 */
export type ImagingPhaseId = 'plan' | 'localize' | 'confirm' | 'sample' | 'safety' | 'cases'

export interface ImagingPhase {
  readonly id: ImagingPhaseId
  readonly title: string
  readonly description: string
  readonly sectionIds: readonly ImagingSectionId[]
}

export const IMAGING_PHASES: readonly ImagingPhase[] = Object.freeze([
  {
    id: 'plan',
    title: 'Plan',
    description:
      'Decide what the imaging must answer — navigation, localization, tool confirmation or diagnosis — and how the fluoroscopic image that answers it is formed.',
    sectionIds: ['imaging-questions', 'chain-walk'],
  },
  {
    id: 'localize',
    title: 'Localize and optimize',
    description:
      'Account for CT-to-body divergence, then optimize the fluoroscopic image: projection and parallax, lesion conspicuity, collimation and magnification, pulse rate and pulse width.',
    sectionIds: ['good-image', 'current-anatomy', 'projection', 'signal', 'field', 'time'],
  },
  {
    id: 'confirm',
    title: 'Confirm',
    description:
      'Work through a practical 2D fluoroscopy sequence, then use digital tomosynthesis and CBCT, fixed or mobile, when 2D imaging cannot resolve the lesion–tool relationship.',
    sectionIds: [
      'two-dimensional',
      'dts-acquisition',
      'dts-interpretation',
      'cbct-acquisition',
      'fixed-suite',
      'mobile-suite',
    ],
  },
  {
    id: 'sample',
    title: 'Sample and reconfirm',
    description:
      'Confirm that the part of the biopsy tool that acquires tissue lies within the lesion, and recognize when localization has to be repeated.',
    sectionIds: ['tool-confirmation', 'changing-anatomy'],
  },
  {
    id: 'safety',
    title: 'Radiation safety',
    description:
      'Protect the team from scatter radiation, and read fluoroscopy and CBCT dose metrics correctly.',
    sectionIds: ['staff-protection', 'dose-reporting'],
  },
  {
    id: 'cases',
    title: 'Integrated cases',
    description:
      'Troubleshooting findings placed in context, then the eight case decisions on the Assess page.',
    sectionIds: ['suite-cases'],
  },
])

export function imagingPhaseOf(sectionId: ImagingSectionId): ImagingPhase {
  const phase = IMAGING_PHASES.find((candidate) => candidate.sectionIds.includes(sectionId))
  if (!phase) throw new Error(`Section ${sectionId} belongs to no phase`)
  return phase
}

export interface ImagingPathwayComposition {
  readonly total: number
  readonly minutes: number
  readonly byPhase: readonly {
    readonly phase: ImagingPhaseId
    readonly title: string
    readonly count: number
  }[]
}

export function imagingPathwayComposition(): ImagingPathwayComposition {
  return {
    total: peripheralImagingPathwaySections.length,
    minutes: peripheralImagingPathwaySections.reduce((sum, section) => sum + section.minutes, 0),
    byPhase: IMAGING_PHASES.map((phase) => ({
      phase: phase.id,
      title: phase.title,
      count: phase.sectionIds.length,
    })),
  }
}

/** "19 sections in 6 phases · 106 min". */
export function imagingCompositionLine(): string {
  const composition = imagingPathwayComposition()
  return `${composition.total} sections in ${composition.byPhase.length} phases · ${composition.minutes} min`
}

export interface ImagingPathwayGroup {
  readonly phase: ImagingPhaseId
  readonly title: string
  readonly description: string
  readonly sections: readonly LearningPathwaySection[]
}

/** The canonical order as its clinical phases. Flattening the groups reproduces the order exactly. */
export function imagingPathwayGroups(): readonly ImagingPathwayGroup[] {
  const sectionById = new Map(
    peripheralImagingPathwaySections.map((section) => [section.id, section] as const),
  )
  return IMAGING_PHASES.map((phase) => ({
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

export function validateImagingPhases(
  phases: readonly ImagingPhase[] = IMAGING_PHASES,
): readonly string[] {
  const errors: string[] = []
  const tiled = phases.flatMap((phase) => phase.sectionIds)
  if (tiled.join('|') !== peripheralImagingSectionIds.join('|')) {
    errors.push('The clinical phases do not tile the canonical order exactly once, in order.')
  }
  for (const phase of phases) {
    if (phase.sectionIds.length === 0) errors.push(`Phase ${phase.id} holds no section.`)
    errors.push(
      ...imagingLearnerCopyErrors(`Phase ${phase.id} title`, phase.title, { allowDigits: false }),
      ...imagingLearnerCopyErrors(`Phase ${phase.id} description`, phase.description),
    )
  }
  return errors
}

const phaseErrors = validateImagingPhases()
if (phaseErrors.length > 0) {
  throw new Error(`The clinical phases are invalid:\n${phaseErrors.join('\n')}`)
}
