import type { LabProgress } from '../engine/learningLab'
import { ventilationCasePresentationTitle } from './casePresentation'
import {
  ventilationLearningUnits,
  ventilationStages,
  ventilationUnitHref,
  type VentilationLearningUnit,
  type VentilationStage,
} from './learningCurriculum'
import { ventilationSectionSpec } from './sectionSpecs'

/**
 * The one door.
 *
 * Every primary "Continue" on every entry surface — the hub hero, the Learn landing, the pathway
 * accordion — resolves through `nextIncompleteSection`, walking the canonical order and returning
 * the first section without a completed record. A fresh learner lands on section one, never on a
 * mid-ladder section that happens to be the flagship interactive. Counts come from the registry at
 * render time; nothing here is hardcoded.
 */

export function isVentilationSectionWorked(progress: LabProgress, unitId: string): boolean {
  return Boolean(progress.units[unitId]?.completedAt)
}

export function workedVentilationSectionIds(progress: LabProgress): ReadonlySet<string> {
  return new Set(
    ventilationLearningUnits
      .filter((unit) => isVentilationSectionWorked(progress, unit.id))
      .map((u) => u.id),
  )
}

export interface VentilationNextSection {
  readonly unit: VentilationLearningUnit
  /** Zero-based position in the canonical order. */
  readonly index: number
  readonly href: string
  /** Whether the section has a saved, unfinished record. */
  readonly inProgress: boolean
}

export function nextIncompleteVentilationSection(
  progress: LabProgress,
): VentilationNextSection | null {
  const index = ventilationLearningUnits.findIndex(
    (unit) => !isVentilationSectionWorked(progress, unit.id),
  )
  if (index < 0) return null
  const unit = ventilationLearningUnits[index]
  return {
    unit,
    index,
    href: ventilationUnitHref(unit.id),
    inProgress: progress.units[unit.id] !== undefined,
  }
}

export interface VentilationPathwayComposition {
  readonly total: number
  readonly minutes: number
  readonly byStage: readonly {
    readonly stage: VentilationStage
    readonly title: string
    readonly count: number
  }[]
  readonly cases: number
}

export function ventilationPathwayComposition(): VentilationPathwayComposition {
  const byStage = ventilationStages
    .map((stage) => ({
      stage: stage.id,
      title: stage.title,
      count: ventilationLearningUnits.filter((unit) => unit.stage === stage.id).length,
    }))
    .filter((entry) => entry.count > 0)
  const cases = new Set(ventilationLearningUnits.flatMap((unit) => unit.caseIds)).size
  return {
    total: ventilationLearningUnits.length,
    minutes: ventilationLearningUnits.reduce((sum, unit) => sum + unit.minutes, 0),
    byStage,
    cases,
  }
}

/** "14 sections · 1 orientation · 2 foundations · 7 mechanisms · 3 applications · 1 capstone · 102 min". */
export function ventilationCompositionLine(): string {
  const composition = ventilationPathwayComposition()
  const stageWords: Record<VentilationStage, [string, string]> = {
    orientation: ['orientation', 'orientations'],
    foundation: ['foundation', 'foundations'],
    mechanism: ['mechanism', 'mechanisms'],
    application: ['application', 'applications'],
    integration: ['capstone', 'capstones'],
  }
  const parts = composition.byStage.map(
    (entry) => `${entry.count} ${stageWords[entry.stage][entry.count === 1 ? 0 : 1]}`,
  )
  return `${composition.total} sections · ${parts.join(' · ')} · ${composition.minutes} min`
}

export interface VentilationPathwayGroup {
  readonly stage: VentilationStage
  readonly title: string
  readonly description: string
  readonly units: readonly VentilationLearningUnit[]
  /** The Practice case paired with each unit in this group, by presentation title. */
  readonly cases: readonly {
    readonly unitId: string
    readonly caseId: string
    readonly title: string
    readonly kind: 'mechanism-match' | 'next-in-unit'
  }[]
}

/**
 * The canonical order as contiguous runs by stage. Flattening the groups reproduces the order
 * exactly, which `pathway-resolver.test.ts` asserts — a grouped view is a presentation of the one
 * order, never a second one.
 */
export function ventilationPathwayGroups(): readonly VentilationPathwayGroup[] {
  return ventilationStages
    .map((stage) => {
      const units = ventilationLearningUnits.filter((unit) => unit.stage === stage.id)
      const cases = units.flatMap((unit) => {
        const pairing = ventilationSectionSpec(unit.id).practicePairing
        return pairing
          ? [
              {
                unitId: unit.id,
                caseId: pairing.caseId,
                title: ventilationCasePresentationTitle(pairing.caseId),
                kind: pairing.kind,
              },
            ]
          : []
      })
      return { stage: stage.id, title: stage.title, description: stage.description, units, cases }
    })
    .filter((group) => group.units.length > 0)
}
