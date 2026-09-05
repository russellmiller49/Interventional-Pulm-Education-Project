'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

import { mechanicalVentilationPublicationStatus } from '../content'
import styles from './mechanical-ventilation-module.module.css'

export const MECHANICAL_VENTILATION_NAV_BASE = mechanicalVentilationNavBase

/** Overview | Learn | Practice | Assess — the critical-care navigation grammar. */
export const mechanicalVentilationModuleNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: MECHANICAL_VENTILATION_NAV_BASE,
    description: 'Pathway map and progress',
  },
  {
    title: 'Learn',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/learn`,
    description: 'Fourteen sections on the running ventilator',
  },
  {
    title: 'Practice',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/practice`,
    description: 'Clinical cases',
  },
  {
    title: 'Assess',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/assess`,
    description: 'Knowledge check and challenge cases',
  },
]

export const MECHANICAL_VENTILATION_SAFETY_NOTICE = (
  <>
    <strong>
      Professional education only — not a clinical device, credential, or patient-specific guide.
    </strong>{' '}
    <span>
      The consoles are original functional facsimiles and are not manufactured, sponsored, or
      endorsed by any ventilator manufacturer. Every patient, waveform and response is simulated.
      Follow current manufacturer instructions, local protocols, and qualified supervision for
      patient care.
    </span>
  </>
)

const releaseLabel =
  mechanicalVentilationPublicationStatus === 'published'
    ? 'Reviewed release'
    : mechanicalVentilationPublicationStatus === 'tester-preview'
      ? 'Unlisted reviewer preview'
      : 'Authenticated draft'

/**
 * Shared shell for the hub and every section page: module identity row, section nav, and the
 * safety boundary. In activity mode the shell hands the viewport to the lesson stage inside it.
 */
export function MechanicalVentilationModuleFrame({
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
  return (
    <main className={styles.moduleShell} data-activity-mode={activityMode || undefined}>
      <ModuleFrameV2
        eyebrow="Critical care · Respiratory support"
        title="Mechanical Ventilation"
        subtitle="Read the breath. Explain the change. Reassess the patient."
        releaseLabel={releaseLabel}
        activeHref={activeHref}
        navItems={mechanicalVentilationModuleNavItems}
        navAriaLabel="Mechanical ventilation sections"
        safetyNotice={MECHANICAL_VENTILATION_SAFETY_NOTICE}
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
    </main>
  )
}
