'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { HandoffContent } from '@/i18n/handoff'

const base = '/pleural-procedures/pleural-ultrasound'

/** Section base href, exported for pages that need the overview's activeHref. */
export const pleuralUltrasoundNavBase = base

const sections = [
  { key: 'overview', href: base },
  { key: 'learn', href: `${base}/learn` },
  { key: 'practice', href: `${base}/practice` },
  { key: 'assessment', href: `${base}/assessment` },
  { key: 'references', href: `${base}/references` },
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
