import type { ReactNode } from 'react'
import type { McsPresentationKind } from '../../content/taskPresentation'
import styles from './mcs-flow.module.css'

/**
 * The task card's text: the teaching and the task, in the order each kind of task reads.
 *
 * The simulator is not in here. It used to be, arranged differently for each kind of task — beside
 * the reading, under the question, inside a "Revisit the current circulation" or "Current pathway
 * and readings" disclosure — and it now has the right-hand pane on every task, as in the ICU
 * hemodynamics and mechanical ventilation sections. What stays per kind is the reading order of
 * the text:
 *
 * - A reading task (a guided example, the walk) teaches first and then offers its controls.
 * - A comparison or an explanation (Observe, Explain) puts the comparison first and the
 *   explanation under it.
 * - A question on a lab (timing, pump loading, the mechanism comparison) asks first; its mechanism
 *   explanation is one click away beneath, so the question is met before its answer.
 * - A patient case asks first and teaches after.
 */
export function McsTaskPresentation({
  kind,
  teaching,
  action,
  explaining,
  reference,
}: {
  kind: McsPresentationKind
  teaching: ReactNode
  action: ReactNode
  explaining: boolean
  reference: boolean
}) {
  const explanation = <div className={styles.explanation}>{teaching}</div>
  const decision = <div className={styles.decision}>{action}</div>
  const labWithQuestion =
    !reference &&
    (kind === 'timing-lab' || kind === 'pump-loading-lab' || kind === 'mechanism-comparison')
  const teachesFirst =
    !explaining &&
    (reference || kind === 'circulation-reader') &&
    kind !== 'patient-case' &&
    !(kind === 'parameter-reader' && !reference)
  return (
    <div
      className={styles.presentation}
      data-presentation={kind}
      data-explaining={explaining || undefined}
    >
      {kind === 'unloading-comparison' ? (
        explanation
      ) : explaining ? (
        <>
          {decision}
          {explanation}
        </>
      ) : labWithQuestion ? (
        <>
          {decision}
          <details data-mechanism-explanation>
            <summary>Mechanism explanation</summary>
            {explanation}
          </details>
        </>
      ) : teachesFirst ? (
        <>
          {explanation}
          {decision}
        </>
      ) : (
        <>
          {decision}
          {explanation}
        </>
      )}
    </div>
  )
}
