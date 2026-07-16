import type { IntroBronchoscopySectionKey } from '../types'

export const INTRO_BRONCHOSCOPY_PROGRESS_KEY = 'ip-intro-bronchoscopy-progress-v1'
export const INTRO_BRONCHOSCOPY_PROGRESS_EVENT = 'ip-intro-bronchoscopy-progress-change'

export const INTRO_BRONCHOSCOPY_SECTIONS: readonly IntroBronchoscopySectionKey[] = [
  'learn',
  'practice',
  'assessment',
]

export interface IntroBronchoscopyProgressRecord {
  learn?: boolean
  practice?: boolean
  assessment?: boolean
  updatedAt: string
}

export type IntroBronchoscopyProgressMap = Record<string, IntroBronchoscopyProgressRecord>

export const EMPTY_INTRO_BRONCHOSCOPY_PROGRESS: IntroBronchoscopyProgressMap = Object.freeze({})

let cachedRawProgress: string | null | undefined
let cachedProgressMap: IntroBronchoscopyProgressMap = EMPTY_INTRO_BRONCHOSCOPY_PROGRESS

export function emptyIntroBronchoscopyProgress(): IntroBronchoscopyProgressMap {
  return EMPTY_INTRO_BRONCHOSCOPY_PROGRESS
}

export function withIntroSectionComplete(
  map: IntroBronchoscopyProgressMap,
  moduleId: string,
  section: IntroBronchoscopySectionKey,
  complete: boolean,
  now: string,
): IntroBronchoscopyProgressMap {
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

export function countIntroCompletedSections(record?: IntroBronchoscopyProgressRecord): number {
  if (!record) return 0
  return INTRO_BRONCHOSCOPY_SECTIONS.reduce(
    (total, section) => total + (record[section] ? 1 : 0),
    0,
  )
}

export function isIntroModuleComplete(record?: IntroBronchoscopyProgressRecord): boolean {
  return countIntroCompletedSections(record) === INTRO_BRONCHOSCOPY_SECTIONS.length
}

export function readIntroBronchoscopyProgress(): IntroBronchoscopyProgressMap {
  if (typeof window === 'undefined') return EMPTY_INTRO_BRONCHOSCOPY_PROGRESS

  try {
    const raw = window.localStorage.getItem(INTRO_BRONCHOSCOPY_PROGRESS_KEY)
    if (!raw) {
      cachedRawProgress = raw
      cachedProgressMap = EMPTY_INTRO_BRONCHOSCOPY_PROGRESS
      return cachedProgressMap
    }

    if (raw === cachedRawProgress) {
      return cachedProgressMap
    }

    cachedRawProgress = raw
    cachedProgressMap = JSON.parse(raw) as IntroBronchoscopyProgressMap
    return cachedProgressMap
  } catch {
    cachedRawProgress = undefined
    cachedProgressMap = EMPTY_INTRO_BRONCHOSCOPY_PROGRESS
    return cachedProgressMap
  }
}

export function markIntroBronchoscopySection(
  moduleId: string,
  section: IntroBronchoscopySectionKey,
  complete: boolean,
): IntroBronchoscopyProgressMap {
  const current = readIntroBronchoscopyProgress()
  const next = withIntroSectionComplete(
    current,
    moduleId,
    section,
    complete,
    new Date().toISOString(),
  )

  if (typeof window !== 'undefined') {
    try {
      const raw = JSON.stringify(next)
      cachedRawProgress = raw
      cachedProgressMap = next
      window.localStorage.setItem(INTRO_BRONCHOSCOPY_PROGRESS_KEY, raw)
      window.dispatchEvent(new Event(INTRO_BRONCHOSCOPY_PROGRESS_EVENT))
    } catch {
      // Progress is a convenience and should never block learning.
    }
  }

  return next
}

export function subscribeIntroBronchoscopyProgress(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('storage', onStoreChange)
  window.addEventListener(INTRO_BRONCHOSCOPY_PROGRESS_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(INTRO_BRONCHOSCOPY_PROGRESS_EVENT, onStoreChange)
  }
}
