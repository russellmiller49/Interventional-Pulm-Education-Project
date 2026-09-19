'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
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
  const shellRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (!activityMode) return
    const shell = shellRef.current
    const header = document.getElementById('main-content')?.previousElementSibling
    if (!shell || !header) return
    // Navigation can wrap under text enlargement. Scope its measured height to ECMO;
    // the global token is only a minimum and other consumers retain their own contract.
    const measure = () => {
      shell.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [activityMode])

  const releaseLabel =
    cardiohelpEcmoPublicationStatus === 'published' ? 'Public release' : 'Unlisted tester access'

  return (
    <HandoffContent>
      <main
        ref={shellRef}
        className={styles.moduleShell}
        data-activity-mode={activityMode || undefined}
        data-learning-scroll-owner={activityMode ? 'workspace' : 'document'}
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
                Professional education only—not a clinical device, digital twin, credential, or
                patient-specific guide.
              </strong>{' '}
              <span>
                This independent educational module is not manufactured, sponsored, or endorsed by
                Getinge. Follow current manufacturer instructions, ELSO guidance, local protocols,
                hands-on supervised-performance requirements, and multidisciplinary judgment. All
                physiologic values are simulated.
              </span>
            </>
          }
        >
          {locale !== 'en' ? (
            <div className={styles.englishFallback} data-no-handoff-translate={true} role="note">
              <Languages aria-hidden="true" />
              English content fallback: Spanish and Simplified Chinese clinical translations are not
              yet approved.
            </div>
          ) : null}
          {children}
        </ModuleFrameV2>
      </main>
    </HandoffContent>
  )
}
