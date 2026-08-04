import { mcsLessons } from '../content/lessons'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'

import type { McsDeviceKind, McsModuleSection, McsSimulationState } from './types'
import { hasMcsMastery } from './reducer'

/*
 * These two modules import only `engine/types`, so importing them here introduces no cycle. The
 * barrel is deliberately not used: `content/index.ts` reaches the shared derived-value registry,
 * which is a much larger graph than a progress helper needs.
 */

const STORAGE_KEY = 'interventionalpulm:mcs-progress:v1'

export interface McsProgressV1 {
  version: 1
  completedLessonIds: readonly string[]
  completedCaseIds: readonly string[]
  masteredCaseIds: readonly string[]
  completedCapstoneIds: readonly string[]
  bestScores: Readonly<Record<string, number>>
  criticalErrorStatus: Readonly<Record<string, boolean>>
  lastDevice: McsDeviceKind
  lastSection: McsModuleSection
  lastActivityId: string | null
}

export function createDefaultMcsProgress(): McsProgressV1 {
  return {
    version: 1,
    completedLessonIds: [],
    completedCaseIds: [],
    masteredCaseIds: [],
    completedCapstoneIds: [],
    bestScores: {},
    criticalErrorStatus: {},
    lastDevice: 'iabp',
    lastSection: 'learn',
    lastActivityId: null,
  }
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function readMcsProgress(): McsProgressV1 {
  if (typeof window === 'undefined') return createDefaultMcsProgress()
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<McsProgressV1> | null
    if (!parsed || parsed.version !== 1) return createDefaultMcsProgress()
    return {
      ...createDefaultMcsProgress(),
      ...parsed,
      completedLessonIds: stringArray(parsed.completedLessonIds),
      completedCaseIds: stringArray(parsed.completedCaseIds),
      masteredCaseIds: stringArray(parsed.masteredCaseIds),
      completedCapstoneIds: stringArray(parsed.completedCapstoneIds),
      bestScores: parsed.bestScores ?? {},
      criticalErrorStatus: parsed.criticalErrorStatus ?? {},
      lastDevice:
        parsed.lastDevice === 'impella' || parsed.lastDevice === 'lvad'
          ? parsed.lastDevice
          : 'iabp',
      lastSection:
        parsed.lastSection === 'practice' || parsed.lastSection === 'assess'
          ? parsed.lastSection
          : 'learn',
    }
  } catch {
    return createDefaultMcsProgress()
  }
}

export function writeMcsProgress(progress: McsProgressV1): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function recordMcsLessonComplete(
  progress: McsProgressV1,
  lessonId: string,
  device: McsDeviceKind,
): McsProgressV1 {
  return {
    ...progress,
    completedLessonIds: [...new Set([...progress.completedLessonIds, lessonId])],
    lastDevice: device,
    lastSection: 'learn',
    lastActivityId: lessonId,
  }
}

export function recordMcsScenarioResult(
  progress: McsProgressV1,
  state: McsSimulationState,
): McsProgressV1 {
  if (!state.scenario || !state.score) return progress
  const id = state.scenario.id
  const mastered = hasMcsMastery(state)
  const isCapstone = state.scenario.kind === 'capstone'
  return {
    ...progress,
    completedCaseIds: [...new Set([...progress.completedCaseIds, id])],
    masteredCaseIds: mastered
      ? [...new Set([...progress.masteredCaseIds, id])]
      : progress.masteredCaseIds,
    completedCapstoneIds:
      mastered && isCapstone
        ? [...new Set([...progress.completedCapstoneIds, id])]
        : progress.completedCapstoneIds,
    bestScores: {
      ...progress.bestScores,
      [id]: Math.max(progress.bestScores[id] ?? 0, state.score.total),
    },
    criticalErrorStatus: {
      ...progress.criticalErrorStatus,
      [id]: state.criticalErrors.length > 0,
    },
    lastDevice: state.deviceKind,
    lastSection: state.section,
    lastActivityId: id,
  }
}

/**
 * Everything a learner can work through: every guided section, plus every practice and challenge
 * case, because `masteredCaseIds` accumulates both.
 *
 * Derived rather than written down. The previous hard-coded 20 was correct for an eight-section
 * pathway and silently became wrong when the ninth landed, so a learner reached a reported hundred
 * with one activity still untouched and every intermediate value was over-reported — including the
 * `percentComplete` sent to analytics.
 */
export const MCS_COMPLETABLE_ITEM_COUNT =
  mcsLessons.length + mcsPracticeScenarios.length + mcsCapstoneScenarios.length

export function mcsProgressPercent(progress: McsProgressV1): number {
  const completed = progress.completedLessonIds.length + progress.masteredCaseIds.length
  if (MCS_COMPLETABLE_ITEM_COUNT === 0) return 0
  return Math.min(100, Math.round((completed / MCS_COMPLETABLE_ITEM_COUNT) * 100))
}
