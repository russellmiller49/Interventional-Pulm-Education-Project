import type { ReactNode } from 'react'

import styles from './FlowContent.module.css'

/**
 * The body of a flowing task: the teaching column and the step's visual side by side on a wide
 * window, one column on a narrow one, and the step's response under both.
 *
 * Lifted from the ECMO module's `ActivityContent` (which keeps its own copy) so the other
 * critical-care modules can take the same anatomy: one DOM reading order at every width, and the
 * host continues to own every real action. `kind` is presentation metadata only; it names the
 * layout for a module's stylesheet and for tests and never selects content.
 *
 * - `visualFirst` puts the visual ahead of the teaching, in DOM order and on screen — for steps
 *   whose work is on the visual (act, observe, transfer).
 * - `stacked` gives the visual the task's full width, then the teaching under it.
 * - A step without a visual is a single reading column.
 */
export function FlowContent({
  kind,
  teaching,
  visual,
  visualFirst = false,
  stacked = false,
  children,
}: {
  readonly kind: string
  readonly teaching: ReactNode
  readonly visual?: ReactNode
  readonly visualFirst?: boolean
  readonly stacked?: boolean
  readonly children?: ReactNode
}) {
  const explanation = (
    <div key="teaching" className={styles.explanation} data-flow-teaching>
      {teaching}
    </div>
  )
  const visualContent = visual ? (
    <div key="visual" className={styles.visual} data-flow-visual>
      {visual}
    </div>
  ) : null
  const visualAhead = Boolean(visualContent) && (visualFirst || stacked)
  return (
    <div
      className={styles.content}
      data-flow-content={kind}
      data-has-visual={visualContent ? true : undefined}
      data-visual-first={visualAhead || undefined}
      data-stacked={stacked || undefined}
    >
      {visualAhead ? [visualContent, explanation] : [explanation, visualContent]}
      <div className={styles.response}>{children}</div>
    </div>
  )
}
