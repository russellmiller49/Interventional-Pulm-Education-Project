'use client'

import type { ReactNode } from 'react'
import { Info, Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { HandoffContent } from '@/i18n/handoff'

import { MCS_RELEASE_STAGE } from '../content'
import { mcsModuleNavItems } from './McsModuleNav'
import styles from './mechanical-circulatory-support.module.css'

/**
 * The module frame. The overview and the Learn page are dark, like the lessons they lead into and
 * like the other four critical care modules (owner, 2026-11-10); they were the one light hub of
 * the five. The practice workbench and the case surfaces still pass `theme="light"` and move in
 * their own change.
 */
export function McsModuleFrame({
  locale,
  activeHref,
  activityMode = false,
  flowing = false,
  theme = 'dark',
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
          hideSiteHeader
          safetyNotice={
            /*
              The module's one boundary statement, as a disclosure (ECMO tester feedback,
              2026-10-13, carried here 2026-10-17).

              It was a full-width banner above the first thing a learner reads. The statement is
              unchanged and stays on every page the frame draws it on; it opens from its own name
              rather than standing in front of the content.
            */
            <details className={styles.boundaryDisclosure} data-mcs-boundary>
              <summary>
                <strong>Teaching simulator</strong>
                <Info aria-hidden="true" />
                <span className="sr-only">About this simulator</span>
              </summary>
              <p>
                Its numbers come from a model, not from a patient or a real console. At the bedside,
                work from the patient and the device&rsquo;s instructions for use.
              </p>
            </details>
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
