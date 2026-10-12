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
  readonly focusedLesson?: boolean
  readonly children: ReactNode
}

export function BaxterCrrtModuleFrame({
  locale,
  activeHref,
  activityMode = false,
  focusedLesson = false,
  children,
}: BaxterCrrtModuleFrameProps) {
  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-focused-lesson={focusedLesson || undefined}
        // Every CRRT surface scrolls the document. Practice and Challenge used to scroll an
        // inner workspace box; see the activity-mode rules in baxter-crrt.module.css.
        data-learning-scroll-owner="document"
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
            baxterCrrtReleaseStage === 'published' ? 'Public release' : 'Unlisted preview'
          }
          activeHref={activeHref}
          navItems={baxterCrrtModuleNavItems}
          navAriaLabel="CRRT module sections"
          theme="dark"
          activityMode={activityMode}
          safetyNotice={
            <>
              <strong>A teaching simulator, not a clinical device.</strong>{' '}
              <span>
                Patients and device responses are simulated. Alarm names and limits follow the
                PrisMax operator’s manual.
              </span>
            </>
          }
        >
          {locale !== 'en' ? (
            <div className={styles.languageFallback} role="note" data-no-handoff-translate="true">
              <Languages aria-hidden="true" />
              <div>
                <strong>English fallback</strong>
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
