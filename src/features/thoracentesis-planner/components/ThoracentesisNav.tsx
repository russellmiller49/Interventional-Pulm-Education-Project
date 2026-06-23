'use client'

import { useTranslations } from 'next-intl'

import { ModuleNav } from '@/features/learning-module/components/ModuleNav'
import type { ModuleNavItem } from '@/features/learning-module/types'

const base = '/pleural-procedures/thoracentesis-planner'

/** Section base href, exported for pages that need the overview's activeHref. */
export const thoracentesisNavBase = base

const sections = [
  { key: 'overview', href: base },
  { key: 'learn', href: `${base}/learn` },
  { key: 'practice', href: `${base}/practice` },
  { key: 'assessment', href: `${base}/assessment` },
  { key: 'references', href: `${base}/references` },
] as const

export function ThoracentesisNav({ activeHref }: { activeHref: string }) {
  const t = useTranslations('thoracentesisPlanner.nav')

  const items: ModuleNavItem[] = sections.map((section) => ({
    href: section.href,
    title: t(`${section.key}.title`),
    description: t(`${section.key}.description`),
  }))

  return <ModuleNav items={items} activeHref={activeHref} ariaLabel={t('ariaLabel')} />
}
