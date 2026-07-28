'use client'

import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

export const baxterCrrtModuleNavItems: readonly ModuleNavItem[] = [
  {
    href: baxterCrrtNavBase,
    title: 'Overview',
    description: 'Core path and progress',
  },
  {
    href: `${baxterCrrtNavBase}/learn`,
    title: 'Learn',
    description: 'Seven didactic lessons',
  },
  {
    href: `${baxterCrrtNavBase}/practice`,
    title: 'Practice',
    description: 'Cases and safety drills',
  },
  {
    href: `${baxterCrrtNavBase}/assess`,
    title: 'Challenge',
    description: 'Harder PrisMax case',
  },
]

export function BaxterCrrtModuleNav({ activeHref }: { readonly activeHref: string }) {
  return (
    <ModuleNavV2
      items={baxterCrrtModuleNavItems}
      activeHref={activeHref}
      ariaLabel="CRRT module sections"
    />
  )
}
