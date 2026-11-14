'use client'

import { useRef, type ReactNode } from 'react'

import { useEcmoFocusClearance } from './useEcmoFocusClearance'
import { useEcmoLessonBar } from './useEcmoLessonBar'

import styles from './EcmoActivityShell.module.css'

export type EcmoShellSection = 'learn' | 'practice' | 'assess'

/**
 * The root of every lean ECMO activity surface.
 *
 * Four rows — header, context strip, body, footer — with the body the only row that grows. It
 * carries `data-critical-care-activity-shell` so the shared module frame's activity-mode sizing
 * rule hands it the viewport, and `data-stage` so every stage or step change is observable on the
 * root rather than inferred from what happens to be on screen.
 *
 * In a flowing activity the shell is the one scroller, and the header row is its lesson bar: on a
 * desktop window it stays at the top of the view while the task scrolls under it. The site menu is
 * hidden while an activity is open (`CardiohelpModuleFrame`), so this bar is where Sections and
 * Save & exit are, and it has to be on screen wherever the learner has scrolled to.
 */
export function EcmoActivityShell({
  section,
  stage,
  label,
  header,
  contextStrip,
  footer,
  children,
  flowing = false,
}: {
  readonly section: EcmoShellSection
  /** The current step or stage id, rewritten on every progression change. */
  readonly stage: string
  readonly label: string
  readonly header: ReactNode
  readonly contextStrip?: ReactNode
  readonly footer?: ReactNode
  readonly children: ReactNode
  readonly flowing?: boolean
}) {
  const shellRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  useEcmoLessonBar(shellRef, barRef, flowing)
  useEcmoFocusClearance(shellRef, section === 'learn' && flowing, stage)

  return (
    <section
      ref={shellRef}
      className={styles.shell}
      data-critical-care-activity-shell="true"
      data-ecmo-shell={section}
      data-stage={stage}
      data-flowing={flowing || undefined}
      aria-label={label}
      tabIndex={flowing ? 0 : undefined}
    >
      <div ref={barRef} className={styles.header} data-ecmo-lesson-bar>
        {header}
      </div>
      <div className={styles.strip} data-ecmo-context-strip>
        {contextStrip}
      </div>
      <div className={styles.body}>{children}</div>
      <div className={styles.footer}>{footer}</div>
    </section>
  )
}
