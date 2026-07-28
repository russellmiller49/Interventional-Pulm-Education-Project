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
  headerExtra,
  children,
  theme = 'light',
  activityMode = false,
}: ModuleFrameV2Props) {
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
      {activityMode ? <div className={styles.activityFrameBody}>{children}</div> : children}
    </div>
  )
}
