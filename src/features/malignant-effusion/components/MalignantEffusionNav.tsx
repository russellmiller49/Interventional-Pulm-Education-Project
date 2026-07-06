'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import { malignantEffusionNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const sections = [
  { key: 'overview', href: malignantEffusionNavBase },
  { key: 'learn', href: `${malignantEffusionNavBase}/learn` },
  { key: 'practice', href: `${malignantEffusionNavBase}/practice` },
  { key: 'assessment', href: `${malignantEffusionNavBase}/assessment` },
  { key: 'references', href: `${malignantEffusionNavBase}/references` },
] as const

export function MalignantEffusionNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('malignantEffusion.nav')

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
