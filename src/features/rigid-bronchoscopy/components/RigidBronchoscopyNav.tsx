'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { rigidBronchoscopyNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const sections = [
  { key: 'overview', href: rigidBronchoscopyNavBase },
  { key: 'learn', href: `${rigidBronchoscopyNavBase}/learn` },
  { key: 'practice', href: `${rigidBronchoscopyNavBase}/practice` },
  { key: 'assessment', href: `${rigidBronchoscopyNavBase}/assessment` },
  { key: 'references', href: `${rigidBronchoscopyNavBase}/references` },
] as const

export function RigidBronchoscopyNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('rigidBronchoscopy.nav')

  const items: ModuleNavItem[] = sections.map((section) => ({
    href: section.href,
    title: t(`${section.key}.title`),
    description: t(`${section.key}.description`),
  }))

  return (
    <HandoffContent>
      {<ModuleNav items={items} activeHref={activeHref} ariaLabel={t('ariaLabel')} />}
    </HandoffContent>
  )
}
