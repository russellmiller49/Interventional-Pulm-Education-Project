'use client'

import { ModuleNavV2 } from '@/features/learning-module/components/ModuleNavV2'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

export const cardiohelpModuleNavItems: readonly ModuleNavItem[] = [
  {
    href: cardiohelpEcmoNavBase,
    title: 'Overview',
    description: 'Curriculum map, tracks, and progress',
  },
  {
    href: `${cardiohelpEcmoNavBase}/learn`,
    title: 'Learn',
    description: 'Guided lessons',
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
