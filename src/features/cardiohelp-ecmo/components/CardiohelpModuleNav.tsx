'use client'

import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

export const cardiohelpModuleNavItems: readonly ModuleNavItem[] = [
  // Existing route identities; former Assess is an optional integrated case.
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
    title: 'Integrated cases',
    description: 'Self-paced case exploration',
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
