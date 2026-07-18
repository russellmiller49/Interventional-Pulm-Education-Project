'use client'

import type { ReactNode } from 'react'
import { EyeOff, Languages, ShieldAlert } from 'lucide-react'

import { HandoffContent } from '@/i18n/handoff'

import { cardiohelpEcmoPublicationStatus } from '../content/deviceProfile'
import { CardiohelpModuleNav } from './CardiohelpModuleNav'
import styles from './cardiohelp-ecmo.module.css'

interface CardiohelpModuleFrameProps {
  locale: string
  activeHref: string
  /** Extra header content (e.g. the player pages' track toggle). */
  headerExtra?: ReactNode
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
  children,
}: CardiohelpModuleFrameProps) {
  return (
    <HandoffContent>
      <main className={styles.moduleShell} data-no-handoff-translate={locale !== 'en'}>
        <header className={styles.frameHeader}>
          <div className={styles.frameIdentity}>
            <span className={styles.kicker}>CARDIOHELP-i · Adult VV & peripheral VA ECMO</span>
            <span className={styles.frameBadge}>
              <EyeOff aria-hidden="true" />
              {cardiohelpEcmoPublicationStatus === 'published'
                ? 'Reviewed release'
                : 'Unlisted tester access'}
            </span>
          </div>
          {headerExtra}
        </header>
        {locale !== 'en' ? (
          <div className={styles.englishFallback} data-no-handoff-translate={true} role="note">
            <Languages aria-hidden="true" />
            Reviewed English content fallback: Spanish and Simplified Chinese clinical translations
            are not yet approved.
          </div>
        ) : null}
        <CardiohelpModuleNav activeHref={activeHref} />
        <section className={styles.safetyBanner} aria-label="Educational safety boundary">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>
              Professional education only—not a clinical device, digital twin, certification, or
              patient-specific guide.
            </strong>
            <span>
              This independent educational module is not manufactured, sponsored, or endorsed by
              Getinge. Follow current manufacturer instructions, ELSO guidance, local protocols,
              hands-on competency requirements, and supervised multidisciplinary judgment. All
              physiologic values are simulated.
            </span>
          </div>
        </section>
        {children}
      </main>
    </HandoffContent>
  )
}
