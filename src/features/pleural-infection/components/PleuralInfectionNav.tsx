import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'

const base = '/pleural-procedures/pleural-infection'

export const pleuralInfectionNavItems: readonly ModuleNavItem[] = [
  { href: base, title: 'Overview', description: 'Objectives and the learning path' },
  { href: `${base}/learn`, title: 'Learn', description: 'Staging, drainage, tPA + DNase, surgery' },
  {
    href: `${base}/practice`,
    title: 'Practice',
    description: 'Stage a case and choose the source-control pathway',
  },
  { href: `${base}/assessment`, title: 'Assessment', description: 'Check your reasoning' },
  { href: `${base}/references`, title: 'References', description: 'Guideline and trial sources' },
] as const

export function PleuralInfectionNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNav
      items={pleuralInfectionNavItems}
      activeHref={activeHref}
      ariaLabel="Pleural infection module sections"
    />
  )
}
