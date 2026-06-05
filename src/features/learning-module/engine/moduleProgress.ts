/**
 * Cross-module progress for the pleural curriculum spine.
 *
 * Mirrors the localStorage pattern used by BoardReviewProgressToggle, but tracks
 * completion per module *and* per section (learn / practice / assessment) so the
 * learning-path landing page can show how far through each module a learner is.
 *
 * The pure helpers (`withSectionComplete`, `countCompletedSections`,
 * `isModuleStarted`) take all inputs as arguments so they are unit-testable
 * without a browser; the thin read/write wrappers touch localStorage.
 */

import type { ModuleSectionKey } from '../types'

export const MODULE_PROGRESS_STORAGE_KEY = 'ip-pleural-module-progress-v1'

export const MODULE_SECTIONS: readonly ModuleSectionKey[] = ['learn', 'practice', 'assessment']

export interface ModuleProgressRecord {
  learn?: boolean
  practice?: boolean
  assessment?: boolean
  updatedAt: string
}

export type ModuleProgressMap = Record<string, ModuleProgressRecord>

/** Pure: return a new map with one module's section completion set. */
export function withSectionComplete(
  map: ModuleProgressMap,
  moduleId: string,
  section: ModuleSectionKey,
  complete: boolean,
  now: string,
): ModuleProgressMap {
  const existing = map[moduleId] ?? { updatedAt: now }
  return {
    ...map,
    [moduleId]: {
      ...existing,
      [section]: complete,
      updatedAt: now,
    },
  }
}

/** Pure: how many of the three sections are complete for a module. */
export function countCompletedSections(record?: ModuleProgressRecord): number {
  if (!record) {
    return 0
  }
  return MODULE_SECTIONS.reduce((total, section) => total + (record[section] ? 1 : 0), 0)
}

/** Pure: has the learner touched any section of this module? */
export function isModuleStarted(record?: ModuleProgressRecord): boolean {
  return countCompletedSections(record) > 0
}

/** Pure: is every section complete? */
export function isModuleComplete(record?: ModuleProgressRecord): boolean {
  return countCompletedSections(record) === MODULE_SECTIONS.length
}

export function readModuleProgress(): ModuleProgressMap {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(MODULE_PROGRESS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ModuleProgressMap) : {}
  } catch {
    return {}
  }
}

export function markModuleSection(
  moduleId: string,
  section: ModuleSectionKey,
  complete: boolean,
): ModuleProgressMap {
  const current = readModuleProgress()
  const next = withSectionComplete(current, moduleId, section, complete, new Date().toISOString())

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MODULE_PROGRESS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Non-fatal: progress is a convenience, not a source of truth.
    }
  }

  return next
}
