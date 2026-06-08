import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'

const base = '/pleural-procedures/pleural-ultrasound'

export const pleuralUltrasoundNavItems: readonly ModuleNavItem[] = [
  { href: base, title: 'Overview', description: 'Objectives and the learning path' },
  { href: `${base}/learn`, title: 'Learn', description: 'How to read the pleural patterns' },
  {
    href: `${base}/practice`,
    title: 'Practice',
    description: 'Commit-first image and video labs',
  },
  { href: `${base}/assessment`, title: 'Assessment', description: 'Check your reasoning' },
  {
    href: `${base}/references`,
    title: 'References',
    description: 'Sources and image attributions',
  },
] as const

export function PleuralUltrasoundNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNav
      items={pleuralUltrasoundNavItems}
      activeHref={activeHref}
      ariaLabel="Pleural ultrasound module sections"
    />
  )
}
