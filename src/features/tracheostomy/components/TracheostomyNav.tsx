'use client'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { tracheostomyNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

const items: ModuleNavItem[] = [
  {
    href: tracheostomyNavBase,
    title: 'Overview',
    description: 'Goals and learning path',
  },
  {
    href: `${tracheostomyNavBase}/learn`,
    title: 'Learn',
    description: 'Anatomy, tubes, care, rescue',
  },
  {
    href: `${tracheostomyNavBase}/practice`,
    title: 'Practice',
    description: 'Sequence and decision labs',
  },
  {
    href: `${tracheostomyNavBase}/assessment`,
    title: 'Assessment',
    description: 'Commit-first knowledge check',
  },
  {
    href: `${tracheostomyNavBase}/references`,
    title: 'References',
    description: 'Evidence and source notes',
  },
]

export function TracheostomyNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNav items={items} activeHref={activeHref} ariaLabel="Tracheostomy module sections" />
  )
}
