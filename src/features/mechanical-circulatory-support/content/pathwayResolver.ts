import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import {
  pathwayTotalMinutes,
  type LearningPathway,
  type LearningPathwaySection,
} from '@/features/learning-module/curriculum/types'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import type { McsDeviceKind, McsScenarioDefinition } from '../engine/types'
import { mcsLessons } from './lessons'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from './scenarios'

/**
 * One door, one map.
 *
 * The hub, the Learn landing and the accordion's "up next" all resolve the learner's next section
 * through the functions here, and nowhere else: the first section of the canonical order without
 * a completed record — section one for a fresh learner. Counts and groups are derived from the
 * registries at render, so no surface carries a number that can drift. Pure over explicit inputs;
 * no storage, no React.
 */

export interface McsProgressView {
  readonly completedLessonIds: readonly string[]
  readonly masteredCaseIds: readonly string[]
}

export function mcsPathway(): LearningPathway {
  return criticalCareLearningPathway('mechanical-circulatory-support')
}

export function mcsWorkedSectionIds(progress: McsProgressView): ReadonlySet<string> {
  const order = new Set(mcsPathway().sections.map((section) => section.id))
  return new Set(progress.completedLessonIds.filter((id) => order.has(id)))
}

export function isMcsSectionWorked(progress: McsProgressView, sectionId: string): boolean {
  return mcsWorkedSectionIds(progress).has(sectionId)
}

/** The first incomplete section in the one order, or null when every section is worked. */
export function resolveNextIncompleteMcsSection(
  progress: McsProgressView,
): LearningPathwaySection | null {
  const worked = mcsWorkedSectionIds(progress)
  return mcsPathway().sections.find((section) => !worked.has(section.id)) ?? null
}

export function mcsLearnSectionHref(sectionId: string): string {
  return `${mechanicalCirculatorySupportNavBase}/learn?lesson=${encodeURIComponent(sectionId)}`
}

export interface McsContinueLink {
  readonly href: string
  readonly label: string
  readonly section: LearningPathwaySection | null
  readonly state: 'start' | 'resume' | 'complete'
}

/** The one Continue every primary call to action renders. */
export function nextIncompleteMcsSectionLink(progress: McsProgressView): McsContinueLink {
  const next = resolveNextIncompleteMcsSection(progress)
  const worked = mcsWorkedSectionIds(progress)
  if (!next) {
    const first = mcsPathway().sections[0]
    return {
      href: mcsLearnSectionHref(first.id),
      label: `Every section is worked through · revisit ${first.title}`,
      section: null,
      state: 'complete',
    }
  }
  const state = worked.size === 0 ? 'start' : 'resume'
  return {
    href: mcsLearnSectionHref(next.id),
    label: `${state === 'start' ? 'Start' : 'Continue'} — ${next.title}`,
    section: next,
    state,
  }
}

export interface McsPathwayComposition {
  readonly total: number
  readonly foundations: number
  readonly mechanisms: number
  readonly applications: number
  readonly integrations: number
  readonly minutes: number
  readonly sentence: string
}

export function mcsPathwayComposition(): McsPathwayComposition {
  const pathway = mcsPathway()
  const count = (stage: LearningPathwaySection['stage']) =>
    pathway.sections.filter((section) => section.stage === stage).length
  const foundations = count('foundation')
  const mechanisms = count('mechanism')
  const applications = count('application')
  const integrations = count('integration')
  const minutes = pathwayTotalMinutes(pathway)
  const total = pathway.sections.length
  return {
    total,
    foundations,
    mechanisms,
    applications,
    integrations,
    minutes,
    sentence: `${total} sections · ${foundations} foundations · ${mechanisms} mechanisms · ${applications} applications · ${integrations} integration · ${minutes} min`,
  }
}

export interface McsPathwayGroup {
  readonly id: string
  readonly title: string
  readonly device: McsDeviceKind | null
  /** A contiguous run of the canonical order. */
  readonly sections: readonly LearningPathwaySection[]
  readonly cases: readonly McsScenarioDefinition[]
  readonly capstone: McsScenarioDefinition | null
}

const GROUP_TITLES: Readonly<Record<McsDeviceKind, string>> = {
  iabp: 'Counterpulsation',
  impella: 'The transvalvular pump',
  lvad: 'The durable pump',
}

/**
 * The pathway as five contiguous runs of the one order: the shared foundations, one run per
 * device track with its Practice cases and Challenge case attached, and the choosing section.
 * `pathway-resolver.test.ts` asserts that flattening the groups reproduces the canonical order.
 */
export function mcsPathwayGroups(): readonly McsPathwayGroup[] {
  const pathway = mcsPathway()
  const deviceOf = new Map(mcsLessons.map((lesson) => [lesson.id, lesson.device]))
  const groups: McsPathwayGroup[] = []
  for (const section of pathway.sections) {
    const device = deviceOf.get(section.id) ?? 'shared'
    const stage = section.stage
    const id = device === 'shared' ? (stage === 'integration' ? 'choosing' : 'foundations') : device
    const last = groups[groups.length - 1]
    if (last && last.id === id) {
      groups[groups.length - 1] = { ...last, sections: [...last.sections, section] }
      continue
    }
    const kind: McsDeviceKind | null = device === 'shared' ? null : device
    groups.push({
      id,
      title:
        id === 'foundations'
          ? 'The common model'
          : id === 'choosing'
            ? 'Choosing among them'
            : GROUP_TITLES[device as McsDeviceKind],
      device: kind,
      sections: [section],
      cases: kind ? mcsPracticeScenarios.filter((scenario) => scenario.device === kind) : [],
      capstone: kind
        ? (mcsCapstoneScenarios.find((scenario) => scenario.device === kind) ?? null)
        : null,
    })
  }
  return groups
}

/** "Sections 3–4 · 2 sections · 3 cases · 24 min", every number counted. */
export function mcsGroupSummaryLine(group: McsPathwayGroup): string {
  const pathway = mcsPathway()
  const first = pathway.sections.findIndex((section) => section.id === group.sections[0]?.id) + 1
  const last = first + group.sections.length - 1
  const minutes = group.sections.reduce((total, section) => total + section.minutes, 0)
  const parts = [
    first === last ? `Section ${first}` : `Sections ${first}–${last}`,
    `${group.sections.length} ${group.sections.length === 1 ? 'section' : 'sections'}`,
  ]
  if (group.cases.length > 0) {
    parts.push(`${group.cases.length} ${group.cases.length === 1 ? 'case' : 'cases'}`)
  }
  if (group.capstone) parts.push('1 challenge')
  parts.push(`${minutes} min`)
  return parts.join(' · ')
}
