import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

import styles from './stage/hemodynamics-stage.module.css'

export const ICU_HEMODYNAMICS_SAFETY_NOTICE = (
  <>
    <strong>Educational model—not a clinical device.</strong> Values and responses are synthetic and
    must not be used for patient-specific decisions. Use bedside evaluation, validated monitoring,
    current institutional protocols, manufacturer instructions, and qualified clinical supervision.
  </>
)

/** Overview | Learn | Practice | Assess — the critical-care navigation grammar. */
export const icuHemodynamicsModuleNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: icuHemodynamicsNavBase,
    description: 'Pathway map and progress',
  },
  {
    title: 'Learn',
    href: `${icuHemodynamicsNavBase}/learn`,
    description: 'Nine sections on the running monitor',
  },
  {
    title: 'Practice',
    href: `${icuHemodynamicsNavBase}/practice`,
    description: 'Eight clinical cases',
  },
  {
    title: 'Assess',
    href: `${icuHemodynamicsNavBase}/assess`,
    description: 'A harder case with less help',
  },
]

/**
 * Shared shell for the hub and every section page: module identity row, section nav, and the
 * safety boundary. In activity mode the shell hands the viewport to the lesson stage inside it.
 */
export function IcuHemodynamicsModuleFrameV2({
  activeHref,
  locale = 'en',
  activityMode = false,
  children,
}: {
  readonly activeHref: string
  readonly locale?: string
  readonly activityMode?: boolean
  readonly children: ReactNode
}) {
  return (
    <div className={styles.moduleShell} data-activity-mode={activityMode || undefined}>
      <ModuleFrameV2
        eyebrow="Critical care · Hemodynamic reasoning"
        title="ICU Hemodynamics Lab"
        subtitle="Read the signal before treating the number."
        releaseLabel="Unlisted preview"
        activeHref={activeHref}
        navItems={icuHemodynamicsModuleNavItems}
        navAriaLabel="ICU hemodynamics sections"
        safetyNotice={ICU_HEMODYNAMICS_SAFETY_NOTICE}
        theme="dark"
        activityMode={activityMode}
      >
        {locale !== 'en' ? (
          <div className={styles.englishFallback} role="note">
            <Languages aria-hidden="true" />
            Reviewed English content fallback: Spanish and Simplified Chinese clinical translations
            are not yet approved for this module.
          </div>
        ) : null}
        {children}
      </ModuleFrameV2>
    </div>
  )
}
