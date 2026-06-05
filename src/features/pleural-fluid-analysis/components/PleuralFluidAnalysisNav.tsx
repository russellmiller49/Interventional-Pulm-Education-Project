import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'

const base = '/pleural-procedures/pleural-fluid-analysis'

export const pleuralFluidAnalysisNavItems: readonly ModuleNavItem[] = [
  { href: base, title: 'Overview', description: 'Objectives and the learning path' },
  {
    href: `${base}/learn`,
    title: 'Learn',
    description: "Light's criteria, pseudoexudates, targeted tests",
  },
  {
    href: `${base}/practice`,
    title: 'Practice',
    description: 'Interactive differential cockpit',
  },
  {
    href: `${base}/assessment`,
    title: 'Assessment',
    description: 'Match the findings to the disease',
  },
  { href: `${base}/references`, title: 'References', description: 'Guideline sources' },
] as const

export function PleuralFluidAnalysisNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNav
      items={pleuralFluidAnalysisNavItems}
      activeHref={activeHref}
      ariaLabel="Pleural fluid analysis module sections"
    />
  )
}
