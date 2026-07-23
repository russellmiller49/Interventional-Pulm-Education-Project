'use client'

import type { ReactNode } from 'react'

import type { CriticalCareActivityMode, CriticalCareActivityPhase } from '../activity'
import { ActivityProgressStepper } from './ActivityProgressStepper'
import { SaveExitControl } from './SaveExitControl'
import styles from './learning-module-v2.module.css'

export type ActivityLayout =
  | 'native-workbench'
  | 'guided-lab'
  | 'didactic-lesson'
  | 'case-workspace'

export interface ActivityChromeProps {
  readonly breadcrumb: ReactNode
  readonly activityTitle: string
  readonly phase: CriticalCareActivityPhase
  readonly mode: CriticalCareActivityMode
  readonly progressLabel: string
  readonly stepperAriaLabel?: string
  /** Native workbenches with their own authored progress surface can suppress the shared stepper. */
  readonly showProgressStepper?: boolean
  readonly children: ReactNode
  readonly bottomContent?: ReactNode
  readonly secondaryActions?: ReactNode
  readonly onSaveAndExit: () => void
  readonly onHelp: () => void
  readonly onReset: () => void
  readonly layout: ActivityLayout
  readonly theme?: 'light' | 'dark'
  readonly maskedAssessment?: boolean
}

export function ActivityChrome({
  breadcrumb,
  activityTitle,
  phase,
  mode,
  progressLabel,
  stepperAriaLabel,
  showProgressStepper = true,
  children,
  bottomContent,
  secondaryActions,
  onSaveAndExit,
  onHelp,
  onReset,
  layout,
  theme = 'light',
  maskedAssessment = false,
}: ActivityChromeProps) {
  return (
    <section
      className={styles.activityShell}
      data-critical-care-activity-shell
      data-learning-module-v2-theme-root
      data-theme={theme}
      data-mode={mode}
      data-layout={layout}
      data-masked-assessment={maskedAssessment || undefined}
      aria-label={`${activityTitle} simulation workspace`}
    >
      <header className={styles.activityHeader}>
        <div className={styles.activityOrientation}>
          <div className={styles.breadcrumb}>{breadcrumb}</div>
          <div className={styles.activityTitleRow}>
            <h1>{activityTitle}</h1>
            <span className={styles.modeBadge}>{mode}</span>
            <span className="sr-only">{progressLabel}</span>
          </div>
        </div>
        <div className={styles.activityActions}>
          <button type="button" className={styles.utilityButton} onClick={onHelp}>
            Help
          </button>
          <button type="button" className={styles.utilityButton} onClick={onReset}>
            Reset
          </button>
          <SaveExitControl onSaveAndExit={onSaveAndExit} />
        </div>
        {showProgressStepper ? (
          <ActivityProgressStepper currentPhase={phase} ariaLabel={stepperAriaLabel} />
        ) : null}
      </header>
      {children}
      <footer className={styles.bottomBar}>
        <div className={styles.bottomContent} aria-live="polite">
          {bottomContent ?? progressLabel}
        </div>
        {secondaryActions ? <div className={styles.bottomActions}>{secondaryActions}</div> : null}
      </footer>
    </section>
  )
}
