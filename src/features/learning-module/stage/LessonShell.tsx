'use client'

import type { ReactNode } from 'react'

import styles from './lesson-shell.module.css'

export type LessonShellSection = 'learn' | 'practice' | 'assess'

/**
 * The root of a lean lesson surface.
 *
 * Four rows — header, context strip, body, footer — with the body the only row that grows. It
 * carries `data-critical-care-activity-shell` so the shared module frame's activity-mode sizing
 * rule hands it the viewport, and `data-stage` so every step change is observable on the root
 * rather than inferred from what happens to be on screen.
 */
export function LessonShell({
  section,
  stage,
  label,
  module,
  header,
  contextStrip,
  footer,
  children,
}: {
  readonly section: LessonShellSection
  /** The current step or stage id, rewritten on every progression change. */
  readonly stage: string
  readonly label: string
  /** The owning module's id, stamped for tests and stylesheets. */
  readonly module: string
  readonly header: ReactNode
  readonly contextStrip?: ReactNode
  readonly footer?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section
      className={styles.shell}
      data-critical-care-activity-shell="true"
      data-lesson-shell={section}
      data-lesson-module={module}
      data-stage={stage}
      aria-label={label}
    >
      <div className={styles.header}>{header}</div>
      <div className={styles.strip} data-context-strip>
        {contextStrip}
      </div>
      <div className={styles.body}>{children}</div>
      <div className={styles.footer}>{footer}</div>
    </section>
  )
}
