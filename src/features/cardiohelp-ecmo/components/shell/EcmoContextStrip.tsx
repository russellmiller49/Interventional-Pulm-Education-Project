'use client'

import type { ReactNode } from 'react'

import styles from './EcmoActivityShell.module.css'

export type EcmoAlarmPriority = 'none' | 'low' | 'medium' | 'high'

export interface EcmoContextStripLine {
  readonly mode: string
  readonly flow: string
  readonly rpm: string
  readonly sweep: string
  readonly alarm: { readonly priority: EcmoAlarmPriority; readonly text: string }
}

/*
 * The priority word, scoped to what this chip actually describes.
 *
 * Every builder of this line filters `alarms` to `source === 'device'`, so the chip is a statement
 * about the CARDIOHELP and about nothing else. "No alarm" over a patient monitor raising a
 * high-priority independent alert — right-arm oxygenation at 82% on the VA integrated case, IA-4 in
 * the September 2026 walkthrough — reads as "no concern", which is not what the chip knows. The
 * console's own status bar continues to show independent-monitor alerts, which carry their source
 * in their message; the two surfaces describe different sets and are deliberately not synchronised.
 */
const PRIORITY_WORD: Readonly<Record<EcmoAlarmPriority, string>> = {
  none: 'No device alarm',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/**
 * One line of context and an optional disclosure holding the rest.
 *
 * The line carries what a learner glances at between actions — support mode, flow and speed,
 * sweep, and the device's alarm state with its priority as a word — and never a fault name, a gas
 * source state or a scenario title, because the line is visible before every prediction. The
 * disclosure holds the full item list, the authored case data and the standing constraints.
 */
export function EcmoContextStrip({
  line,
  details,
  constraints,
  badge,
  detailsLabel = 'Patient context',
  onOpenConsole,
  children,
}: {
  readonly line: EcmoContextStripLine
  readonly details?: readonly { readonly label: string; readonly value: string }[]
  readonly constraints?: readonly string[]
  readonly badge?: string
  readonly detailsLabel?: string
  readonly onOpenConsole?: () => void
  readonly children?: ReactNode
}) {
  const hasDetails =
    (details && details.length > 0) || (constraints && constraints.length > 0) || children
  return (
    <>
      <div className={styles.stripLine} data-context-line>
        <span className={styles.stripItem}>
          <small>Mode</small>
          <span>{line.mode}</span>
        </span>
        <span className={styles.stripItem}>
          <small>Flow</small>
          <span>{line.flow}</span>
        </span>
        <span className={styles.stripItem}>
          <small>Speed</small>
          <span>{line.rpm}</span>
        </span>
        <span className={styles.stripItem}>
          <small>Sweep</small>
          <span>{line.sweep}</span>
        </span>
        <span className={styles.alarmChip} data-alarm-priority={line.alarm.priority}>
          <span className={styles.badge}>{PRIORITY_WORD[line.alarm.priority]}</span>
          <span>{line.alarm.text}</span>
        </span>
        {onOpenConsole && line.alarm.priority !== 'none' ? (
          <button type="button" className={styles.stripButton} onClick={onOpenConsole}>
            Open console
          </button>
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
