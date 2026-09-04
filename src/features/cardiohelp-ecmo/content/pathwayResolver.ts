import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import type { ProgressV2, SupportMode } from '../engine/types'
import { cardiohelpCurriculum, type CurriculumUnit } from './curriculum'
import { isEcmoInteractiveFoundationSectionId } from './foundationLessonRuntime'

/**
 * One answer to "where does this learner go next", for every entry surface.
 *
 * The module had two orderings and they disagreed. `learningPathways.ts` runs seventeen sections
 * per track from oxygen delivery through the circuit, the normal state and the controls, and
 * only then the console and the failures. `curriculum.ts` groups seven units over the ten drills
 * and seven cases, and knows nothing about the other seven sections. The hub resolved its primary
 * call to action through the second one and so opened a fresh learner on the console tour —
 * section seven — while the Learn landing told the same learner to start with the physiology and
 * apologised in a footnote for the disagreement.
 *
 * Everything here reads the pathway. `curriculum.ts` keeps its units, its Practice pairing and its
 * own recommendation walker, which the Practice debrief still uses; what it no longer does is
 * decide where the module begins. The seven units survive as a *presentation* of the canonical
 * order — see `ecmoPathwayGroups`.
 *
 * Pure functions over explicit inputs: no storage access, no React. The surfaces read progress and
 * pass it in, which is what lets one unit test prove the hub and the landing agree.
 */

const MODULE_ID = 'cardiohelp-ecmo'

/**
 * Which runtime a section opens in.
 *
 * Deliberately not derived from `section.stage`: both `why-extracorporeal-support` and
 * `startup-sensor-orientation` carry the `orientation` stage, and they are the first and the
 * seventh sections respectively. Stage describes a section's teaching job; this describes which
 * component renders it and, with it, where completion is recorded.
 */
export type EcmoPathwaySectionKind = 'foundation-workspace' | 'drill'

export function ecmoPathwaySectionKind(sectionId: string): EcmoPathwaySectionKind {
  return isEcmoInteractiveFoundationSectionId(sectionId) ? 'foundation-workspace' : 'drill'
}

/**
 * The sections this learner has worked, from both halves of the envelope.
 *
 * Drills record their scenario id in `completedLearnLessonIds`; foundation sections record their
 * section id in `completedFoundationSectionIds`. The two never collide — a section is exactly one
 * kind — so a single set is enough to answer the question, and looking each id up under its own
 * kind means a hand-edited envelope cannot mark a foundation section complete by putting it in the
 * drill list.
 */
export function ecmoWorkedSectionIds(progress: ProgressV2): ReadonlySet<string> {
  const worked = new Set<string>()
  for (const id of progress.completedLearnLessonIds) {
    if (ecmoPathwaySectionKind(id) === 'drill') worked.add(id)
  }
  for (const id of progress.completedFoundationSectionIds ?? []) {
    if (ecmoPathwaySectionKind(id) === 'foundation-workspace') worked.add(id)
  }
  return worked
}

export function isEcmoPathwaySectionWorked(sectionId: string, progress: ProgressV2): boolean {
  return ecmoWorkedSectionIds(progress).has(sectionId)
}

export interface EcmoNextSection {
  readonly section: LearningPathwaySection
  /** Zero-based position in the canonical order. */
  readonly index: number
  readonly total: number
}

/**
 * The first section of the canonical order this learner has not worked, or `null` when every
 * section is done.
 *
 * First incomplete, with no other tie-break. Not "furthest reached", and not the last thing they
 * opened: a learner who jumped ahead to a drill and left sections three and five behind is offered
 * section three, because the pathway's claim is that section three is what makes section eight
 * legible. Nothing is withheld either way — every section stays one click away on the landing, and
 * no route is gated.
 *
 * Stored ids that no longer exist in the registry are inert: this walks the registry and asks the
 * set, so a retired id can never be returned, and a malformed envelope has already become a
 * default one by the time it reaches here.
 */
export function resolveNextIncompleteSection(
  track: SupportMode,
  progress: ProgressV2,
): EcmoNextSection | null {
  const { sections } = criticalCareLearningPathway(MODULE_ID, track)
  const worked = ecmoWorkedSectionIds(progress)
  const index = sections.findIndex((section) => !worked.has(section.id))
  if (index === -1) return null
  return { section: sections[index]!, index, total: sections.length }
}

/** The deep link for a section, in the shape every ECMO surface already uses. */
export function ecmoLearnSectionHref(sectionId: string, track: SupportMode): string {
  return `${cardiohelpEcmoNavBase}/learn?lesson=${sectionId}&track=${track}`
}

/** The same link as a `next/link` target, for surfaces that pass an object to `Link`. */
export function ecmoLearnSectionLinkTarget(
  sectionId: string,
  track: SupportMode,
): { readonly pathname: string; readonly query: Record<string, string> } {
  return {
    pathname: `${cardiohelpEcmoNavBase}/learn`,
    query: { lesson: sectionId, track },
  }
}

export interface EcmoNextSectionLink extends EcmoNextSection {
  readonly href: string
  readonly linkTarget: { readonly pathname: string; readonly query: Record<string, string> }
}

/**
 * The one function every primary entry call to action calls.
 *
 * The hub and the Learn landing both render from this, so "continue" cannot mean two things in one
 * session. Returns `null` when the track is finished, which the surfaces render as a terminal
 * state rather than as a link to nowhere.
 */
export function nextIncompleteSectionLink(
  track: SupportMode,
  progress: ProgressV2,
): EcmoNextSectionLink | null {
  const next = resolveNextIncompleteSection(track, progress)
  if (!next) return null
  return {
    ...next,
    href: ecmoLearnSectionHref(next.section.id, track),
    linkTarget: ecmoLearnSectionLinkTarget(next.section.id, track),
  }
}

export interface EcmoPathwayComposition {
  readonly total: number
  /** Foundation-workspace sections, excluding the integration capstone. */
  readonly foundations: number
  /** Drill sections carrying the orientation stage: the console tour. */
  readonly consoleOrientation: number
  /** Drill sections carrying the application stage: one fault each. */
  readonly drills: number
  readonly capstone: number
}

/**
 * What the track is made of, counted from the registry every time it is rendered.
 *
 * The hub used to say "Ten lessons per track" in prose beside a landing page that said
 * "17 sections". Both were true of their own registry and the pair read as a broken curriculum.
 * Counts that are written down drift; these cannot.
 *
 * The four parts sum to the total by construction, so the line can never describe a shape the
 * pathway does not have.
 */
export function ecmoPathwayComposition(track: SupportMode): EcmoPathwayComposition {
  const { sections } = criticalCareLearningPathway(MODULE_ID, track)
  const foundationSections = sections.filter(
    (section) => ecmoPathwaySectionKind(section.id) === 'foundation-workspace',
  )
  const drillSections = sections.filter((section) => ecmoPathwaySectionKind(section.id) === 'drill')
  const capstone = sections.filter((section) => section.stage === 'integration').length
  const consoleOrientation = drillSections.filter(
    (section) => section.stage === 'orientation',
  ).length

  return {
    total: sections.length,
    foundations: foundationSections.length - capstone,
    consoleOrientation,
    drills: drillSections.length - consoleOrientation,
    capstone,
  }
}

export interface EcmoPathwayGroup {
  readonly unitId: string
  readonly title: string
  readonly summary: string
  /** A contiguous run of the canonical order. */
  readonly sections: readonly LearningPathwaySection[]
  readonly caseScenarioIds: readonly string[]
  readonly capstoneScenarioId?: string
}

/**
 * The seven curriculum units, expressed as contiguous runs of the canonical order.
 *
 * This is what stops the unit view from being a second table of contents. Each drill belongs to the
 * unit that already lists it; the sections before it — physiology the unit's drills depend on —
 * attach forward to that same unit, so the runway is visible on the hub instead of being skipped
 * by it. The trailing integration section attaches to the capstone unit, putting the Learn
 * capstone beside the challenge it leads to.
 *
 * Flattening the groups reproduces the pathway exactly; `pathway-resolver.test.ts` asserts that,
 * along with each section appearing once and the first group opening on section one. Those are the
 * properties that make this a presentation rather than a rival ordering, and they are the ones
 * that would break first if either registry moved.
 */
export function ecmoPathwayGroups(track: SupportMode): readonly EcmoPathwayGroup[] {
  const { sections } = criticalCareLearningPathway(MODULE_ID, track)
  const units = cardiohelpCurriculum[track]

  const unitIdByDrillId = new Map<string, string>()
  for (const unit of units) {
    for (const drillId of unit.lessonScenarioIds) unitIdByDrillId.set(drillId, unit.id)
  }

  const sectionsByUnitId = new Map<string, LearningPathwaySection[]>()
  const append = (unitId: string, run: readonly LearningPathwaySection[]) => {
    const bucket = sectionsByUnitId.get(unitId) ?? []
    bucket.push(...run)
    sectionsByUnitId.set(unitId, bucket)
  }

  let pending: LearningPathwaySection[] = []
  for (const section of sections) {
    pending.push(section)
    const unitId = unitIdByDrillId.get(section.id)
    if (unitId === undefined) continue
    append(unitId, pending)
    pending = []
  }

  if (pending.length > 0) {
    // Whatever follows the last drill — the integration section — belongs with the capstone unit.
    const trailingUnit: CurriculumUnit | undefined =
      units.find((unit) => unit.capstoneScenarioId !== undefined) ?? units[units.length - 1]
    if (trailingUnit) append(trailingUnit.id, pending)
  }

  return units.map((unit) => ({
    unitId: unit.id,
    title: unit.title,
    summary: unit.summary,
    sections: sectionsByUnitId.get(unit.id) ?? [],
    caseScenarioIds: unit.caseScenarioIds,
    ...(unit.capstoneScenarioId === undefined
      ? {}
      : { capstoneScenarioId: unit.capstoneScenarioId }),
  }))
}
