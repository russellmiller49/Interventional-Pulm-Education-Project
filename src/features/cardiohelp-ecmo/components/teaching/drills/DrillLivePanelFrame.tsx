import type { ReactNode } from 'react'

import type { SupportMode } from '../../../engine/types'
import { ModelBoundary, styles } from '../shared'
import { StageBlock } from '../StageBlock'

/**
 * The frame of a live readings panel.
 *
 * A live panel is the half of a drill's teaching that moves with the circuit: a live picture where
 * the drill has one, what is being decided, the readings in the order they are read, and the
 * questions that separate the possibilities. It sits above the drill's written explanation, which
 * is unchanged and still open on the page; it does not replace it, and it says nothing about which
 * way the pattern has come out.
 *
 * It is short on purpose. The teaching column is about 26 rem wide, and the authored panels'
 * signal table runs to two thousand pixels there; a live panel carries the readings once, grouped,
 * and no table.
 *
 * Marked `data-drill-live-panel`, never `data-drill-panel`: that attribute belongs to the six
 * authored panels, which carry their own mechanism and response and stand in for the explanation.
 */
export function DrillLivePanelFrame({
  scenarioId,
  supportMode,
  lead,
  clinicalQuestion,
  boundary,
  children,
}: {
  readonly scenarioId: string
  readonly supportMode: SupportMode
  /** A live picture that leads the panel, above the question. */
  readonly lead?: ReactNode
  readonly clinicalQuestion: ReactNode
  /** One model limit, phrased about this simulation. */
  readonly boundary: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div
      className={styles.panel}
      data-drill-live-panel={scenarioId}
      data-drill-support-mode={supportMode}
    >
      {lead}
      <StageBlock kind="question" heading="What is being decided">
        <section className={styles.section} aria-labelledby="drill-live-question-heading">
          <h3 id="drill-live-question-heading" className={styles.heading}>
            What is being decided
          </h3>
          <p className="mt-2" data-clinical-question>
            {clinicalQuestion}
          </p>
        </section>
      </StageBlock>
      {children}
      <StageBlock kind="boundary" heading="What this simulation cannot show you">
        <section className={styles.section} aria-labelledby="drill-live-boundary-heading">
          <h3 id="drill-live-boundary-heading" className={styles.heading}>
            What this simulation cannot show you
          </h3>
          <ModelBoundary>{boundary}</ModelBoundary>
        </section>
      </StageBlock>
    </div>
  )
}
