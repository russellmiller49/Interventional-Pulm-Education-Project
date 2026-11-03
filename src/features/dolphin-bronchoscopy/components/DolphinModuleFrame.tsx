'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import type { ModuleNavItem } from '@/features/learning-module/types'

import { DOLPHIN_BRONCHOSCOPY_RELEASE_STAGE } from '../content/release'
import {
  DOLPHIN_ASSESS_HREF,
  DOLPHIN_BRONCHOSCOPY_NAV_BASE,
  DOLPHIN_LEARN_HREF,
  DOLPHIN_PRACTICE_HREF,
  DOLPHIN_REFERENCE_HREF,
} from '../content/routes'
import styles from './dolphin-module.module.css'

const NAV_KEYS = [
  ['overview', DOLPHIN_BRONCHOSCOPY_NAV_BASE],
  ['learn', DOLPHIN_LEARN_HREF],
  ['practice', DOLPHIN_PRACTICE_HREF],
  ['assess', DOLPHIN_ASSESS_HREF],
  ['reference', DOLPHIN_REFERENCE_HREF],
] as const

/** The five tabs, in the learner's language. Content below stays English (see the fallback note). */
export function useDolphinNavItems(): readonly ModuleNavItem[] {
  const t = useTranslations('dolphinBronchoscopy.nav')
  return NAV_KEYS.map(([key, href]) => ({
    title: t(`${key}.title`),
    href,
    description: t(`${key}.description`),
  }))
}

/**
 * Shared shell for the hub and every Dolphin Bronchoscopy page: module identity, the five tabs and
 * the one-line supervision notice. In activity mode the shell hands the viewport to the lesson
 * stage. The module's one boundary statement is on the hub, in Help and on the closing screen.
 *
 * Keep the release label to a few words: the shared frame renders it `white-space: nowrap`.
 */
export function DolphinModuleFrame({
  locale = 'en',
  activeHref,
  activityMode = false,
  children,
}: {
  readonly locale?: string
  readonly activeHref: string
  readonly activityMode?: boolean
  readonly children: ReactNode
}) {
  const t = useTranslations('dolphinBronchoscopy')
  const navItems = useDolphinNavItems()
  return (
    <main className={styles.moduleShell} data-activity-mode={activityMode || undefined}>
      <ModuleFrameV2
        eyebrow={t('frame.eyebrow')}
        title={t('frame.title')}
        subtitle={t('frame.subtitle')}
        releaseLabel={
          DOLPHIN_BRONCHOSCOPY_RELEASE_STAGE === 'unlisted-preview'
            ? t('frame.releaseLabel.unlisted')
            : t('frame.releaseLabel.published')
        }
        activeHref={activeHref}
        navItems={navItems}
        navAriaLabel={t('nav.label')}
        safetyNotice={<strong>{t('frame.safetyNotice')}</strong>}
        theme="dark"
        activityMode={activityMode}
      >
        {locale !== 'en' ? (
          <div className={styles.englishFallback} role="note" data-english-fallback>
            <Languages aria-hidden="true" />
            {t('frame.englishFallback')}
          </div>
        ) : null}
        {children}
      </ModuleFrameV2>
    </main>
  )
}
