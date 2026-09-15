import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity/types'

/** Only MCS consumers change; historical IDs and routes stay valid. */
export function mcsSelfPacedActivity(
  activity: CriticalCareActivityDefinition,
): CriticalCareActivityDefinition {
  const base = { ...activity }
  delete base.masteryRuleId
  return {
    ...base,
    title: activity.title.replace('Unseen ', '').replace(' capstone', ' integrated walkthrough'),
    description: activity.id.includes(':assess:')
      ? 'Optional integrated case: explore supported controls and open the worked explanation at any time.'
      : activity.description,
    kind: activity.id.includes(':learn:') ? activity.kind : 'practice-case',
    supportedModes: [...new Set([...activity.supportedModes, 'guided' as const])],
    prerequisiteActivityIds: [],
    creditPolicy: 'non-credit',
    completionEvidenceAuthority: 'none',
    completionRuleId: 'mcs:location-only',
  }
}
