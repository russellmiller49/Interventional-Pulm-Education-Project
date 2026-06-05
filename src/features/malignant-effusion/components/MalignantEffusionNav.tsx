import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'

const base = '/pleural-procedures/malignant-effusion'

export const malignantEffusionNavItems: readonly ModuleNavItem[] = [
  { href: base, title: 'Overview', description: 'Objectives and the learning path' },
  {
    href: `${base}/learn`,
    title: 'Learn',
    description: 'Cytology, expandability, IPC vs pleurodesis',
  },
  {
    href: `${base}/practice`,
    title: 'Practice',
    description: 'Escalate the diagnosis and choose a management arm',
  },
  { href: `${base}/assessment`, title: 'Assessment', description: 'Check your reasoning' },
  {
    href: `${base}/references`,
    title: 'References',
    description: 'Guideline, trial, and image sources',
  },
] as const

export function MalignantEffusionNav({ activeHref }: { activeHref: string }) {
  return (
    <ModuleNav
      items={malignantEffusionNavItems}
      activeHref={activeHref}
      ariaLabel="Malignant pleural effusion module sections"
    />
  )
}
