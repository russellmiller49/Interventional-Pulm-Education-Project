import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

import styles from './stage/hemodynamics-stage.module.css'

export const ICU_HEMODYNAMICS_SAFETY_NOTICE = (
  <>
    <strong>Teaching simulator.</strong> The patients, tracings and responses here are simulated for
    teaching. Do not use them to make decisions about a real patient.
  </>
)

/**
 * Overview | Learn | Practice | Applied case. The fourth tab keeps the `/assess` address of the
 * critical-care navigation grammar so saved links still work; since HD-01 it opens an optional
 * applied case rather than a challenge.
 */
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
    title: 'Applied case',
    href: `${icuHemodynamicsNavBase}/assess`,
    description: 'An optional harder case, with help throughout',
  },
]

/**
 * Shared shell for the hub and every section page: module identity row, section nav, and the
 * safety boundary. In activity mode the shell hands the viewport to the lesson stage inside it.
 *
 * `documentFlow` stages scroll the document. `desktopWorkspace` (Learn) keeps that below a desktop
 * viewport and, on one, is the fixed workspace again: the page does not scroll and the stage's
 * text and visual panes scroll on their own (owner, 2026-10-16, as for mechanical ventilation).
 */
export function IcuHemodynamicsModuleFrameV2({
  activeHref,
  locale = 'en',
  activityMode = false,
  documentFlow = false,
  desktopWorkspace = false,
  children,
}: {
  readonly activeHref: string
  readonly locale?: string
  readonly activityMode?: boolean
  readonly documentFlow?: boolean
  readonly desktopWorkspace?: boolean
  readonly children: ReactNode
}) {
  return (
    <div
      className={activityMode ? styles.moduleShell : undefined}
      data-activity-mode={activityMode || undefined}
      data-document-flow={documentFlow || undefined}
      data-desktop-workspace={desktopWorkspace || undefined}
      data-learning-scroll-owner={
        activityMode ? (desktopWorkspace || !documentFlow ? 'workspace' : 'document') : undefined
      }
    >
      <ModuleFrameV2
        eyebrow="Critical care · Hemodynamic reasoning"
        title="ICU Hemodynamics Lab"
        subtitle="Read the signal before treating the number."
        releaseLabel="Unlisted preview"
        activeHref={activeHref}
        navItems={icuHemodynamicsModuleNavItems}
        navAriaLabel="ICU hemodynamics sections"
        safetyNotice={ICU_HEMODYNAMICS_SAFETY_NOTICE}
        theme={activityMode ? 'dark' : 'light'}
        activityMode={activityMode}
      >
        {locale !== 'en' ? (
          <div className={styles.englishFallback} role="note">
            <Languages aria-hidden="true" />
            English content fallback: Spanish and Simplified Chinese clinical translations are not
            yet approved for this module.
          </div>
        ) : null}
        {children}
      </ModuleFrameV2>
    </div>
  )
}
