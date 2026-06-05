import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'

const base = '/pleural-procedures/pneumothorax-pathway'

export const pneumothoraxNavItems: readonly ModuleNavItem[] = [
  { href: base, title: 'Overview', description: 'Objectives and the learning path' },
  {
    href: `${base}/learn`,
    title: 'Learn',
    description: 'Stability, PSP vs SSP, ACCP vs BTS, air leak',
  },
  {
    href: `${base}/practice`,
    title: 'Practice',
    description: 'Run a case through both frameworks side by side',
  },
  { href: `${base}/assessment`, title: 'Assessment', description: 'Check your reasoning' },
  { href: `${base}/references`, title: 'References', description: 'Guideline sources' },
] as const

export function PneumothoraxNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNav
      items={pneumothoraxNavItems}
      activeHref={activeHref}
      ariaLabel="Pneumothorax module sections"
    />
  )
}
