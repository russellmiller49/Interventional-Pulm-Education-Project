'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { HandoffContent } from '@/i18n/handoff'

import { MCS_RELEASE_STAGE } from '../content'
import { mcsModuleNavItems } from './McsModuleNav'
import styles from './mechanical-circulatory-support.module.css'

/**
 * The module frame. The hub and the case surfaces keep the module's light theme; a lesson on the
 * stage runs on the dark palette its device surfaces already use, and the frame's chrome follows
 * it so the header and the workspace read as one surface.
 */
export function McsModuleFrame({
  locale,
  activeHref,
  activityMode = false,
  flowing = false,
  theme = activityMode ? 'dark' : 'light',
  children,
}: {
  locale: string
  activeHref: string
  activityMode?: boolean
  flowing?: boolean
  theme?: 'light' | 'dark'
  children: ReactNode
}) {
  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-activity-mode={activityMode || undefined}
        data-flowing={flowing || undefined}
        data-learning-scroll-owner={activityMode && !flowing ? 'workspace' : 'document'}
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
          theme={theme}
          activityMode={activityMode}
          safetyNotice={
            <>
              <strong>Teaching simulator.</strong>{' '}
              <span>
                Its numbers come from a model, not from a patient or a real console. At the bedside,
                work from the patient and the device&rsquo;s instructions for use.
              </span>
            </>
          }
        >
          {locale !== 'en' ? (
            <div className={styles.englishFallback} role="note" data-no-handoff-translate>
              <Languages aria-hidden="true" />
              <span>
                <strong>Shown in English.</strong> A translation of this module is not available
                yet.
              </span>
            </div>
          ) : null}
          {children}
        </ModuleFrameV2>
      </main>
    </HandoffContent>
  )
}
