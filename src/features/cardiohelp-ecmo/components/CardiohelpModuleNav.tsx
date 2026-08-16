'use client'

import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

export const cardiohelpModuleNavItems: readonly ModuleNavItem[] = [
  // The four titles are pinned by `criticalCareShellConvergence.test.tsx`, which keeps the module
  // shells reading alike. Only the descriptions carry module vocabulary, and they now use the same
  // word for a pathway entry that the landing, the rail and the hub use: section.
  {
    href: cardiohelpEcmoNavBase,
    title: 'Overview',
    description: 'Pathway map, tracks, and progress',
  },
  {
    href: `${cardiohelpEcmoNavBase}/learn`,
    title: 'Learn',
    description: 'Sections and drills',
  },
  {
    href: `${cardiohelpEcmoNavBase}/practice`,
    title: 'Practice',
    description: 'Clinical cases',
  },
  {
    href: `${cardiohelpEcmoNavBase}/assess`,
    title: 'Challenge',
    description: 'Harder cases · open now',
  },
]

interface CardiohelpModuleNavProps {
  activeHref: string
}

export function CardiohelpModuleNav({ activeHref }: CardiohelpModuleNavProps) {
  return (
    <ModuleNavV2
      items={cardiohelpModuleNavItems}
      activeHref={activeHref}
      ariaLabel="ECMO Management module sections"
    />
  )
}
