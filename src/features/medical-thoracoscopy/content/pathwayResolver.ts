import type { ThoracoscopyProgress } from '../engine/selfPacedProgress'
import {
  curriculumChapters,
  curriculumSections,
  type CurriculumChapter,
  type CurriculumSection,
} from './curriculum'
import { MEDICAL_THORACOSCOPY_LEARN_HREF } from './routes'
import type { ThoracoscopySectionId } from './sectionIds'

/**
 * The one door, and the outline it sits on.
 *
 * Every Start, Resume or Continue resolves through `nextStep` and nothing else. It recommends and
 * never locks. It only ever points at a section a learner can open: a section in preparation is
 * never a link, never resumed, and never counted as opened or reviewed, whatever a stored record
 * says. Answers and simulation work never enter it.
 */
export function sectionLinkTarget(sectionId: ThoracoscopySectionId): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: MEDICAL_THORACOSCOPY_LEARN_HREF, query: { section: sectionId } }
}

export function isOpenable(section: CurriculumSection): boolean {
  return section.state === 'available'
}

export type NextStep =
  /** No section can be opened yet. */
  | { readonly kind: 'none-open' }
  | {
      readonly kind: 'section'
      readonly section: CurriculumSection
      /** The learner left this section before finishing it. */
      readonly resumed: boolean
      /** Nothing opened or reviewed yet. */
      readonly fresh: boolean
    }
  /** Every section that can be opened is marked reviewed. */
  | { readonly kind: 'all-reviewed' }

export function nextStep(
  progress: ThoracoscopyProgress,
  sections: readonly CurriculumSection[] = curriculumSections,
): NextStep {
  const openable = sections.filter(isOpenable)
  if (openable.length === 0) return { kind: 'none-open' }
  const reviewed = reviewedSectionIds(progress, sections)
  const visited = visitedSectionIds(progress, sections)
  const lastId = progress.lastLocation?.kind === 'section' ? progress.lastLocation.id : null
  const last = openable.find((section) => section.id === lastId)
  if (last && !reviewed.has(last.id)) {
    return { kind: 'section', section: last, resumed: true, fresh: false }
  }
  const first = openable.find((section) => !reviewed.has(section.id))
  if (!first) return { kind: 'all-reviewed' }
  return {
    kind: 'section',
    section: first,
    resumed: false,
    fresh: visited.size === 0 && reviewed.size === 0,
  }
}

function openableIds(
  ids: readonly string[],
  sections: readonly CurriculumSection[],
): ReadonlySet<ThoracoscopySectionId> {
  const listed = new Set(ids)
  return new Set(
    sections.filter((section) => isOpenable(section) && listed.has(section.id)).map((s) => s.id),
  )
}

/** Sections opened on this device. Opening a section is not doing its work. */
export function visitedSectionIds(
  progress: ThoracoscopyProgress,
  sections: readonly CurriculumSection[] = curriculumSections,
): ReadonlySet<ThoracoscopySectionId> {
  return openableIds(progress.visitedSectionIds, sections)
}

/** Sections the learner finished and marked reviewed. */
export function reviewedSectionIds(
  progress: ThoracoscopyProgress,
  sections: readonly CurriculumSection[] = curriculumSections,
): ReadonlySet<ThoracoscopySectionId> {
  return openableIds(progress.reviewedSectionIds, sections)
}

/** Sections saved to review later, in the canonical order. */
export function reviewLaterSections(
  progress: ThoracoscopyProgress,
  sections: readonly CurriculumSection[] = curriculumSections,
): readonly CurriculumSection[] {
  const saved = openableIds(progress.reviewLaterSectionIds, sections)
  return sections.filter((section) => saved.has(section.id))
}

export interface ChapterGroup {
  readonly chapter: CurriculumChapter
  readonly index: number
  readonly sections: readonly CurriculumSection[]
  readonly minutes: number
  readonly openCount: number
}

/** The chapters with their sections. Flattening them gives the canonical order back. */
export function chapterGroups(
  sections: readonly CurriculumSection[] = curriculumSections,
): readonly ChapterGroup[] {
  const byId = new Map(sections.map((section) => [section.id, section]))
  return curriculumChapters.map((chapter, index) => {
    const members = chapter.sectionIds.map((id) => {
      const section = byId.get(id)
      if (!section) throw new Error(`Chapter ${chapter.id} names unknown section ${id}`)
      return section
    })
    return {
      chapter,
      index,
      sections: members,
      minutes: members.reduce((total, section) => total + section.minutes, 0),
      openCount: members.filter(isOpenable).length,
    }
  })
}

/** "Sections 3–6 · 4 sections · about 34 min", every number counted from the registry. */
export function chapterSummaryLine(group: ChapterGroup): string {
  const numbers = group.sections.map((section) => section.number)
  const first = Math.min(...numbers)
  const last = Math.max(...numbers)
  const span = first === last ? `Section ${first}` : `Sections ${first}–${last}`
  const count = `${group.sections.length} section${group.sections.length === 1 ? '' : 's'}`
  return [span, count, `about ${group.minutes} min`].join(' · ')
}
