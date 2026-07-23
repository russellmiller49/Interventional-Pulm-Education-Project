'use client'

import type { ReactNode } from 'react'

import type { CriticalCareActivityMode } from '../activity'
import styles from './learning-module-v2.module.css'

export interface TaskPanelProps {
  readonly objective: string
  readonly requiredAction: string
  readonly targets?: readonly string[]
  readonly hint?: string
  readonly mode: CriticalCareActivityMode
  readonly hintVisible?: boolean
  readonly onHintRequested?: () => void
  readonly children?: ReactNode
}

export function TaskPanel({
  objective,
  requiredAction,
  targets = [],
  hint,
  mode,
  hintVisible = false,
  onHintRequested,
  children,
}: TaskPanelProps) {
  const hintsAvailable = mode !== 'challenge' && Boolean(hint)
  return (
    <section className={styles.panelSection}>
      <h2 className={styles.panelHeading}>Current task</h2>
      <div className={styles.taskCard}>
        <strong>Objective</strong>
        <p>{objective}</p>
      </div>
      <div className={styles.taskCard}>
        <strong>Required action</strong>
        <p>{requiredAction}</p>
      </div>
      {targets.length > 0 ? (
        <div>
          <h3 className={styles.panelHeading}>Targets</h3>
          <ul className={styles.targetList}>
            {targets.map((target) => (
              <li key={target}>{target}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {hintsAvailable ? (
        hintVisible ? (
          <div className={styles.hintCard} role="status">
            <strong>Hint</strong>
            <p>{hint}</p>
          </div>
        ) : onHintRequested ? (
          <button type="button" className={styles.secondaryButton} onClick={onHintRequested}>
            Show hint
          </button>
        ) : null
      ) : null}
      <div className={styles.taskFooter}>{children}</div>
    </section>
  )
}
