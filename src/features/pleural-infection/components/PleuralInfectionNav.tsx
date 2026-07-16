'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { pleuralInfectionNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const sections = [
  { key: 'overview', href: pleuralInfectionNavBase },
  { key: 'learn', href: `${pleuralInfectionNavBase}/learn` },
  { key: 'practice', href: `${pleuralInfectionNavBase}/practice` },
  { key: 'assessment', href: `${pleuralInfectionNavBase}/assessment` },
  { key: 'references', href: `${pleuralInfectionNavBase}/references` },
] as const

export function PleuralInfectionNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('pleuralInfection.nav')

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
