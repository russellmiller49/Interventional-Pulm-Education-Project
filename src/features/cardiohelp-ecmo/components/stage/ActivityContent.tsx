import type { ReactNode } from 'react'
import type { EcmoTaskPresentation } from './activityPresentation'
import styles from './ActivityFlow.module.css'

/** A single DOM reading order at every width; the host continues to own every real action. */
export function ActivityContent({
  presentation,
  teaching,
  visual,
  visualFirst = false,
  children,
}: {
  readonly presentation?: EcmoTaskPresentation
  readonly teaching: ReactNode
  readonly visual?: ReactNode
  readonly visualFirst?: boolean
  readonly children?: ReactNode
}) {
  if (!presentation) return <>{children}</>
  const stacked = Boolean(presentation.stacked)
  const explanation = (
    <div key="teaching" className={styles.explanation}>
      {teaching}
    </div>
  )
  const visualContent = visual ? (
    <div key="visual" className={styles.visual}>
      {visual}
    </div>
  ) : null
  return (
    <div
      className={styles.content}
      data-activity-content={presentation.kind}
      data-visual-first={visualFirst || stacked || undefined}
      data-stacked={stacked || undefined}
    >
      {visualFirst || stacked ? [visualContent, explanation] : [explanation, visualContent]}
      <div className={styles.response}>{children}</div>
    </div>
  )
}
