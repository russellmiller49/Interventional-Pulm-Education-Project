'use client'

import { Languages } from 'lucide-react'
import type { ReactNode } from 'react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { HandoffContent } from '@/i18n/handoff'

import { baxterCrrtPublicationStatus, baxterCrrtReleaseStage } from '../content/release'
import { baxterCrrtModuleNavItems } from './BaxterCrrtModuleNav'
import styles from './baxter-crrt.module.css'

interface BaxterCrrtModuleFrameProps {
  readonly locale: string
  readonly activeHref: string
  readonly activityMode?: boolean
  readonly children: ReactNode
}

export function BaxterCrrtModuleFrame({
  locale,
  activeHref,
  activityMode = false,
  children,
}: BaxterCrrtModuleFrameProps) {
  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-release-stage={baxterCrrtReleaseStage}
        data-publication-status={baxterCrrtPublicationStatus}
        data-analytics="allowlisted"
        data-progress-write="v3"
        data-activity-mode={activityMode || undefined}
        data-no-handoff-translate={locale === 'en' ? undefined : 'true'}
      >
        <ModuleFrameV2
          eyebrow="Adult ICU renal support"
          title="CRRT"
          subtitle="PrisMax console lab"
          releaseLabel={
            baxterCrrtReleaseStage === 'published' ? 'Reviewed release' : 'Unlisted preview'
          }
          activeHref={activeHref}
          navItems={baxterCrrtModuleNavItems}
          navAriaLabel="CRRT module sections"
          theme="dark"
          activityMode={activityMode}
          safetyNotice={
            <>
              <strong>
                Education only—never patient-specific advice or a local operating policy.
              </strong>{' '}
              <span>
                Patient values, device responses, and scores are simulated. Use current manufacturer
                instructions, authorized local protocols, supervision, and clinical judgment for
                patient care. This module does not establish competency or certification.
              </span>
            </>
          }
        >
          {locale !== 'en' ? (
            <div className={styles.languageFallback} role="note" data-no-handoff-translate="true">
              <Languages aria-hidden="true" />
              <div>
                <strong>Reviewed-English fallback</strong>
                <p>English remains authoritative while localized CRRT content is unavailable.</p>
              </div>
            </div>
          ) : null}

          {children}
        </ModuleFrameV2>
      </main>
    </HandoffContent>
  )
}
