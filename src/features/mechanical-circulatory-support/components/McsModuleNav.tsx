'use client'

import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

import { mcsCapstoneScenarios, mcsLessons, mcsPracticeScenarios } from '../content'

/**
 * Nav counts are derived from the content arrays.
 *
 * This nav is rendered on all four MCS pages, so a hand-written count here is the most visible copy
 * in the module — and it had drifted: it read "Eight guided lessons" while the pathway rail
 * immediately below it listed nine. Deriving the numbers makes that class of drift impossible.
 */
export const mcsModuleNavItems: readonly ModuleNavItem[] = [
  {
    href: mechanicalCirculatorySupportNavBase,
    title: 'Overview',
    description: 'Tracks, boundaries, and progress',
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/learn`,
    title: 'Learn',
    description: `${mcsLessons.length} guided sections`,
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/practice`,
    title: 'Practice',
    description: `Mechanism Studio + ${mcsPracticeScenarios.length} cases`,
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/assess`,
    title: 'Challenge',
    description: `${mcsCapstoneScenarios.length} harder cases`,
  },
] as const

export function McsModuleNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNavV2
      items={mcsModuleNavItems}
      activeHref={activeHref}
      ariaLabel="Mechanical circulatory support module sections"
    />
  )
}
