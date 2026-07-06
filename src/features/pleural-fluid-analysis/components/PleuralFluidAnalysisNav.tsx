'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { pleuralFluidAnalysisNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const sections = [
  { key: 'overview', href: pleuralFluidAnalysisNavBase },
  { key: 'learn', href: `${pleuralFluidAnalysisNavBase}/learn` },
  { key: 'practice', href: `${pleuralFluidAnalysisNavBase}/practice` },
  { key: 'assessment', href: `${pleuralFluidAnalysisNavBase}/assessment` },
  { key: 'references', href: `${pleuralFluidAnalysisNavBase}/references` },
] as const

export function PleuralFluidAnalysisNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('pleuralFluidAnalysis.nav')

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
