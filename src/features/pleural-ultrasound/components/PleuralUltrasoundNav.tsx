'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { pleuralUltrasoundNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const sections = [
  { key: 'overview', href: pleuralUltrasoundNavBase },
  { key: 'learn', href: `${pleuralUltrasoundNavBase}/learn` },
  { key: 'practice', href: `${pleuralUltrasoundNavBase}/practice` },
  { key: 'assessment', href: `${pleuralUltrasoundNavBase}/assessment` },
  { key: 'references', href: `${pleuralUltrasoundNavBase}/references` },
] as const

export function PleuralUltrasoundNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('pleuralUltrasound.nav')

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
