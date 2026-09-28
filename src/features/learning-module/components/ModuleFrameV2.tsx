import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'

import type { ModuleNavItem } from '../types'
import { ModuleNavV2 } from './ModuleNavV2'
import styles from './learning-module-v2.module.css'

export interface ModuleFrameV2Props {
  readonly eyebrow: string
  readonly title: string
  readonly subtitle?: string
  readonly releaseLabel?: string
  readonly activeHref: string
  readonly navItems: readonly ModuleNavItem[]
  readonly navAriaLabel?: string
  readonly safetyNotice: ReactNode
  /**
   * A sponsorship disclosure, printed under the safety notice. Leave it out and the frame
   * renders exactly as it did before the slot existed.
   *
   * It is an `<aside>`, never a `div`: module stylesheets reach the activity body as
   * `[data-activity-frame] > div`. In activity mode the frame's chrome is hidden, so the
   * disclosure is not rendered here either, and the lesson prints its own.
   */
  readonly sponsorNotice?: ReactNode
  readonly headerExtra?: ReactNode
  readonly children: ReactNode
  readonly theme?: 'light' | 'dark'
  readonly activityMode?: boolean
}

export function ModuleFrameV2({
  eyebrow,
  title,
  subtitle,
  releaseLabel,
  activeHref,
  navItems,
  navAriaLabel,
  safetyNotice,
  sponsorNotice,
  headerExtra,
  children,
  theme = 'light',
  activityMode = false,
}: ModuleFrameV2Props) {
  const showSponsorNotice =
    !activityMode &&
    sponsorNotice !== undefined &&
    sponsorNotice !== null &&
    sponsorNotice !== false &&
    sponsorNotice !== ''

  return (
    <div
      className={styles.moduleFrame}
      data-learning-module-v2-theme-root
      data-theme={theme}
      data-activity-frame={activityMode || undefined}
    >
      <header className={styles.moduleHeader}>
        <div className={styles.moduleIdentity}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <span className={styles.moduleTitle}>{title}</span>
          {subtitle ? <p className={styles.moduleSubtitle}>{subtitle}</p> : null}
        </div>
        {headerExtra ??
          (releaseLabel ? <span className={styles.releaseBadge}>{releaseLabel}</span> : null)}
      </header>
      <ModuleNavV2 items={navItems} activeHref={activeHref} ariaLabel={navAriaLabel} />
      <section className={styles.safetyNotice} role="note" aria-label="Educational safety notice">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div>{safetyNotice}</div>
      </section>
      {showSponsorNotice ? (
        <aside
          className={styles.sponsorNotice}
          role="note"
          aria-label="Sponsorship disclosure"
          data-sponsor-notice
        >
          {sponsorNotice}
        </aside>
      ) : null}
      {activityMode ? <div className={styles.activityFrameBody}>{children}</div> : children}
    </div>
  )
}
