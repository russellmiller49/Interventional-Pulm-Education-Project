import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'

/**
 * Neutral console used when a learner opens a ventilation case directly from
 * a catalog. Exact resume links replace it with the learner's last console.
 */
export const CRITICAL_CARE_DEFAULT_VENTILATOR_DEVICE_ID = 'hamilton-c6' as const

export function criticalCareActivityQuery(
  activity: CriticalCareActivityDefinition,
): Readonly<Record<string, string>> | undefined {
  const query = { ...(activity.query ?? {}) }
  if (
    activity.moduleId === 'mechanical-ventilation' &&
    activity.id.startsWith('ventilation:practice:')
  ) {
    query.device = CRITICAL_CARE_DEFAULT_VENTILATOR_DEVICE_ID
    query.mode = 'practice'
  }
  return Object.keys(query).length > 0 ? query : undefined
}

export function criticalCareCatalogActivityHref(activity: CriticalCareActivityDefinition): string {
  const query = new URLSearchParams(criticalCareActivityQuery(activity) ?? {}).toString()
  return query ? `${activity.pathname}?${query}` : activity.pathname
}
