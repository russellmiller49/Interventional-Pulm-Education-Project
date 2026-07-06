'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { pleuroscopyNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const sections = [
  { key: 'overview', href: pleuroscopyNavBase },
  { key: 'learn', href: `${pleuroscopyNavBase}/learn` },
  { key: 'practice', href: `${pleuroscopyNavBase}/practice` },
  { key: 'assessment', href: `${pleuroscopyNavBase}/assessment` },
  { key: 'references', href: `${pleuroscopyNavBase}/references` },
] as const

export function PleuroscopyNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('pleuroscopy.nav')

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
