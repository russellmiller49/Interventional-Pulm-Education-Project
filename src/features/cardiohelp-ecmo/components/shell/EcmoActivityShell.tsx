'use client'

import type { ReactNode } from 'react'

import styles from './EcmoActivityShell.module.css'

export type EcmoShellSection = 'learn' | 'practice' | 'assess'

/**
 * The root of every lean ECMO activity surface.
 *
 * Four rows — header, context strip, body, footer — with the body the only row that grows. It
 * carries `data-critical-care-activity-shell` so the shared module frame's activity-mode sizing
 * rule hands it the viewport, and `data-stage` so every stage or step change is observable on the
 * root rather than inferred from what happens to be on screen.
 */
export function EcmoActivityShell({
  section,
  stage,
  label,
  header,
  contextStrip,
  footer,
  children,
}: {
  readonly section: EcmoShellSection
  /** The current step or stage id, rewritten on every progression change. */
  readonly stage: string
  readonly label: string
  readonly header: ReactNode
  readonly contextStrip?: ReactNode
  readonly footer?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section
      className={styles.shell}
      data-critical-care-activity-shell="true"
      data-ecmo-shell={section}
      data-stage={stage}
      aria-label={label}
    >
      <div className={styles.header}>{header}</div>
      <div className={styles.strip} data-ecmo-context-strip>
        {contextStrip}
      </div>
      <div className={styles.body}>{children}</div>
      <div className={styles.footer}>{footer}</div>
    </section>
  )
}
