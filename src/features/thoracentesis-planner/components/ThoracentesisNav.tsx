import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'

const base = '/pleural-procedures/thoracentesis-planner'

export const thoracentesisNavItems: readonly ModuleNavItem[] = [
  { href: base, title: 'Overview', description: 'Objectives and the learning path' },
  {
    href: `${base}/learn`,
    title: 'Learn',
    description: 'Safe access, manometry, and stopping rules',
  },
  {
    href: `${base}/practice`,
    title: 'Practice',
    description: 'Plan a safe tap and predict the drainage curve',
  },
  { href: `${base}/assessment`, title: 'Assessment', description: 'Check your reasoning' },
  {
    href: `${base}/references`,
    title: 'References',
    description: 'Guideline and manometry sources',
  },
] as const

export function ThoracentesisNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNav
      items={thoracentesisNavItems}
      activeHref={activeHref}
      ariaLabel="Thoracentesis module sections"
    />
  )
}
