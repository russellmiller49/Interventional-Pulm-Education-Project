'use client'

import type { ReactNode } from 'react'

import type { CriticalCareActivityMode, CriticalCareActivityPhase } from '../activity'
import { ActivityStepper } from './ActivityStepper'
import styles from './learning-module-v2.module.css'

export interface ActivityShellProps {
  readonly breadcrumb: ReactNode
  readonly activityTitle: string
  readonly phase: CriticalCareActivityPhase
  readonly mode: CriticalCareActivityMode
  readonly progressLabel: string
  readonly stepperAriaLabel?: string
  readonly patientContext: ReactNode
  readonly viewport: ReactNode
  readonly currentTask: ReactNode
  readonly bottomContent?: ReactNode
  readonly secondaryActions?: ReactNode
  readonly onSaveAndExit: () => void
  readonly onHelp: () => void
  readonly onReset: () => void
  readonly theme?: 'light' | 'dark'
  readonly maskedAssessment?: boolean
}

export function ActivityShell({
  breadcrumb,
  activityTitle,
  phase,
  mode,
  progressLabel,
  stepperAriaLabel,
  patientContext,
  viewport,
  currentTask,
  bottomContent,
  secondaryActions,
  onSaveAndExit,
  onHelp,
  onReset,
  theme = 'light',
  maskedAssessment = false,
}: ActivityShellProps) {
  return (
    <section
      className={styles.activityShell}
      data-critical-care-activity-shell
      data-learning-module-v2-theme-root
      data-theme={theme}
      data-mode={mode}
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
          <button type="button" className={styles.primaryButton} onClick={onSaveAndExit}>
            Save &amp; exit
          </button>
        </div>
        <ActivityStepper currentPhase={phase} ariaLabel={stepperAriaLabel} />
      </header>
      <div className={styles.workspace}>
        <aside className={styles.contextPanel} aria-label="Patient context">
          {patientContext}
        </aside>
        <section className={styles.viewport} aria-label="Simulation viewport">
          {viewport}
        </section>
        <aside className={styles.taskPanel} aria-label="Current task">
          {currentTask}
        </aside>
      </div>
      <footer className={styles.bottomBar}>
        <div className={styles.bottomContent} aria-live="polite">
          {bottomContent ?? progressLabel}
        </div>
        {secondaryActions ? <div className={styles.bottomActions}>{secondaryActions}</div> : null}
      </footer>
    </section>
  )
}
