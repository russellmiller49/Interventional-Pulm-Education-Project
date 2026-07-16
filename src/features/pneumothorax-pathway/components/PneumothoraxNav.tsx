'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { pneumothoraxNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const sections = [
  { key: 'overview', href: pneumothoraxNavBase },
  { key: 'learn', href: `${pneumothoraxNavBase}/learn` },
  { key: 'practice', href: `${pneumothoraxNavBase}/practice` },
  { key: 'assessment', href: `${pneumothoraxNavBase}/assessment` },
  { key: 'references', href: `${pneumothoraxNavBase}/references` },
] as const

export function PneumothoraxNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('pneumothoraxPathway.nav')

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
