import type { CriticalCareActivityDefinition, CriticalCareResumePointer } from './types'
import { parseResumePointer } from './schema'

export interface ResolvedCriticalCareResume {
  readonly pointer: CriticalCareResumePointer
  readonly activity: CriticalCareActivityDefinition
  readonly href: string
}

function queryMatchesDefinition(
  pointer: CriticalCareResumePointer,
  activity: CriticalCareActivityDefinition,
): boolean {
  if (!activity.query) return true
  return Object.entries(activity.query).every(([key, value]) => pointer.query?.[key] === value)
}

export function resolveCriticalCareResumePointer(
  pointer: CriticalCareResumePointer,
  activities: readonly CriticalCareActivityDefinition[],
): ResolvedCriticalCareResume | null {
  const parsedPointer = parseResumePointer(pointer)
  if (!parsedPointer) return null

  const activity = activities.find((candidate) => candidate.id === parsedPointer.activityId)
  if (
    !activity ||
    activity.pathname !== parsedPointer.pathname ||
    !queryMatchesDefinition(parsedPointer, activity)
  ) {
    return null
  }
  if (!activity.supportedModes.includes(parsedPointer.mode)) return null

  const query = new URLSearchParams(parsedPointer.query ?? {}).toString()
  return {
    pointer: parsedPointer,
    activity,
    href: query ? `${parsedPointer.pathname}?${query}` : parsedPointer.pathname,
  }
}

export function newestValidCriticalCareResume(
  pointers: readonly CriticalCareResumePointer[],
  activities: readonly CriticalCareActivityDefinition[],
): ResolvedCriticalCareResume | null {
  return (
    pointers
      .map((pointer) => resolveCriticalCareResumePointer(pointer, activities))
      .filter((candidate): candidate is ResolvedCriticalCareResume => candidate !== null)
      .sort(
        (left, right) => Date.parse(right.pointer.updatedAt) - Date.parse(left.pointer.updatedAt),
      )[0] ?? null
  )
}
