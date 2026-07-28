'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { HandoffContent } from '@/i18n/handoff'

import { MCS_RELEASE_STAGE } from '../content'
import { mcsModuleNavItems } from './McsModuleNav'
import styles from './mechanical-circulatory-support.module.css'

export function McsModuleFrame({
  locale,
  activeHref,
  activityMode = false,
  children,
}: {
  locale: string
  activeHref: string
  activityMode?: boolean
  children: ReactNode
}) {
  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-activity-mode={activityMode || undefined}
        data-no-handoff-translate={locale !== 'en'}
      >
        <ModuleFrameV2
          eyebrow="Adult ICU"
          title="Mechanical Circulatory Support"
          subtitle="IABP, Impella, and durable LVAD device labs"
          releaseLabel={MCS_RELEASE_STAGE.replace('-', ' ')}
          activeHref={activeHref}
          navItems={mcsModuleNavItems}
          navAriaLabel="Mechanical circulatory support module sections"
          theme="light"
          activityMode={activityMode}
          safetyNotice={
            <>
              <strong>
                Educational model—not a clinical device, digital twin, credential, or
                patient-specific guide.
              </strong>{' '}
              <span>
                Use current manufacturer instructions, local policy, direct examination and imaging,
                and the responsible shock/LVAD team. Insertion, anticoagulation dosing, device
                selection, and supervised operational performance are outside this lab.
              </span>
            </>
          }
        >
          {locale !== 'en' ? (
            <div className={styles.englishFallback} role="note" data-no-handoff-translate>
              <Languages aria-hidden="true" />
              <span>
                <strong>Reviewed-English fallback.</strong> Localized clinical content remains
                pending until specialty review is complete.
              </span>
            </div>
          ) : null}
          {children}
        </ModuleFrameV2>
      </main>
    </HandoffContent>
  )
}
