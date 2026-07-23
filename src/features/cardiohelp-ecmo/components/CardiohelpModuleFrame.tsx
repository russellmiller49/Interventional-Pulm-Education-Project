'use client'

import type { ReactNode } from 'react'
import { EyeOff, Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { HandoffContent } from '@/i18n/handoff'

import { cardiohelpEcmoPublicationStatus } from '../content/deviceProfile'
import { cardiohelpModuleNavItems } from './CardiohelpModuleNav'
import styles from './cardiohelp-ecmo.module.css'

interface CardiohelpModuleFrameProps {
  locale: string
  activeHref: string
  /** Extra header content (e.g. the player pages' track toggle). */
  headerExtra?: ReactNode
  activityMode?: boolean
  children: ReactNode
}

/**
 * Shared shell for the hub and every section page: module identity row,
 * section nav, and the safety boundary. Content-specific heroes stay in the
 * children so each page can stay focused.
 */
export function CardiohelpModuleFrame({
  locale,
  activeHref,
  headerExtra,
  activityMode = false,
  children,
}: CardiohelpModuleFrameProps) {
  const releaseLabel =
    cardiohelpEcmoPublicationStatus === 'published' ? 'Reviewed release' : 'Unlisted tester access'

  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-activity-mode={activityMode || undefined}
        data-no-handoff-translate={locale !== 'en'}
      >
        <ModuleFrameV2
          eyebrow="Adult VV and peripheral VA ECMO"
          title="ECMO Management"
          subtitle="CARDIOHELP console lab"
          releaseLabel={headerExtra ? undefined : releaseLabel}
          activeHref={activeHref}
          navItems={cardiohelpModuleNavItems}
          navAriaLabel="ECMO Management module sections"
          theme="dark"
          activityMode={activityMode}
          headerExtra={
            headerExtra ? (
              <div className={styles.frameIdentity}>
                <span className={styles.frameBadge}>
                  <EyeOff aria-hidden="true" /> {releaseLabel}
                </span>
                {headerExtra}
              </div>
            ) : undefined
          }
          safetyNotice={
            <>
              <strong>
                Professional education only—not a clinical device, digital twin, certification, or
                patient-specific guide.
              </strong>{' '}
              <span>
                This independent educational module is not manufactured, sponsored, or endorsed by
                Getinge. Follow current manufacturer instructions, ELSO guidance, local protocols,
                hands-on competency requirements, and supervised multidisciplinary judgment. All
                physiologic values are simulated.
              </span>
            </>
          }
        >
          {locale !== 'en' ? (
            <div className={styles.englishFallback} data-no-handoff-translate={true} role="note">
              <Languages aria-hidden="true" />
              Reviewed English content fallback: Spanish and Simplified Chinese clinical
              translations are not yet approved.
            </div>
          ) : null}
          {children}
        </ModuleFrameV2>
      </main>
    </HandoffContent>
  )
}
