'use client'

import type { ReactNode } from 'react'

import styles from './lesson-shell.module.css'

export type AlarmPriority = 'none' | 'low' | 'medium' | 'high'

export interface ContextStripItem {
  readonly label: string
  readonly value: string
}

const PRIORITY_WORD: Readonly<Record<AlarmPriority, string>> = {
  none: 'No alarm',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/**
 * One line of context and an optional disclosure holding the rest.
 *
 * The line carries what a learner glances at between actions — the few settings they can change,
 * and the device's alarm state with its priority as a word — and never a fault name, a scenario
 * title or a uniquely identifying state, because the line is visible before every prediction.
 */
export function ContextStrip({
  items,
  alarm,
  badge,
  details,
  constraints,
  detailsLabel = 'Patient context',
  children,
}: {
  readonly items: readonly ContextStripItem[]
  readonly alarm?: { readonly priority: AlarmPriority; readonly text: string }
  readonly badge?: string
  readonly details?: readonly ContextStripItem[]
  readonly constraints?: readonly string[]
  readonly detailsLabel?: string
  readonly children?: ReactNode
}) {
  const hasDetails =
    (details && details.length > 0) || (constraints && constraints.length > 0) || children
  return (
    <>
      <div className={styles.stripLine} data-context-line>
        {items.map((item) => (
          <span key={item.label} className={styles.stripItem}>
            <small>{item.label}</small>
            <span>{item.value}</span>
          </span>
        ))}
        {alarm ? (
          <span className={styles.alarmChip} data-alarm-priority={alarm.priority}>
            <span className={styles.badge}>{PRIORITY_WORD[alarm.priority]}</span>
            <span>{alarm.text}</span>
          </span>
        ) : null}
        {badge ? <span className={styles.badge}>{badge}</span> : null}
      </div>
      {hasDetails ? (
        <details className={styles.stripDetails} data-context-details>
          <summary>{detailsLabel}</summary>
          {details && details.length > 0 ? (
            <dl className={styles.stripDetailsBody}>
              {details.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {children}
          {constraints && constraints.length > 0 ? (
            <ul className={styles.stripConstraints}>
              {constraints.map((constraint) => (
                <li key={constraint}>{constraint}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </>
  )
}
