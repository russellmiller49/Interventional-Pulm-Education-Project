'use client'

import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

export const mcsModuleNavItems: readonly ModuleNavItem[] = [
  {
    href: mechanicalCirculatorySupportNavBase,
    title: 'Overview',
    description: 'Tracks, boundaries, and progress',
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/learn`,
    title: 'Learn',
    description: 'Eight guided lessons',
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/practice`,
    title: 'Practice',
    description: 'Mechanism Studio + nine cases',
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/assess`,
    title: 'Challenge',
    description: 'Three harder cases',
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
