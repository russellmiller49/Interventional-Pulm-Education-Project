import type { ReactNode } from 'react'
import type { McsPresentationKind } from '../../content/taskPresentation'
import styles from './mcs-flow.module.css'

/** The task is one reading/action surface. Each mechanism gives its visual a different role. */
export function McsTaskPresentation({
  kind,
  teaching,
  visual,
  action,
  explaining,
  reference,
}: {
  kind: McsPresentationKind
  teaching: ReactNode
  visual: ReactNode
  action: ReactNode
  explaining: boolean
  reference: boolean
}) {
  const explanation = <div className={styles.explanation}>{teaching}</div>
  const observation = <div className={styles.observation}>{visual}</div>
  const decision = <div className={styles.decision}>{action}</div>
  return (
    <div
      className={styles.presentation}
      data-presentation={kind}
      data-explaining={explaining || undefined}
    >
      {explaining ? (
        <>
          {decision}
          {explanation}
          <details>
            <summary>Revisit the current circulation</summary>
            {observation}
          </details>
        </>
      ) : kind === 'timing-lab' ? (
        <>
          {observation}
          <div className={styles.timingDiscussion}>
            {reference ? explanation : null}
            {decision}
            {!reference ? (
              <details>
                <summary>Mechanism explanation</summary>
                {explanation}
              </details>
            ) : null}
          </div>
        </>
      ) : kind === 'mechanism-comparison' ? (
        reference ? (
          <>
            {explanation}
            {decision}
            <details>
              <summary>Live reference patient and optional views</summary>
              {observation}
            </details>
          </>
        ) : (
          <>
            {decision}
            <details>
              <summary>Current pathway and readings</summary>
              {observation}
            </details>
            <details>
              <summary>Mechanism explanation</summary>
              {explanation}
            </details>
          </>
        )
      ) : kind === 'circulation-reader' ? (
        <>
          <div className={styles.reader}>
            {explanation}
            {observation}
          </div>
          {decision}
        </>
      ) : kind === 'parameter-reader' && reference ? (
        <>
          {explanation}
          {decision}
          <details>
            <summary>Patient observations and support pathway</summary>
            {observation}
          </details>
        </>
      ) : kind === 'pump-loading-lab' ? (
        <>
          {reference ? explanation : null}
          <div className={styles.loading}>
            {observation}
            {decision}
          </div>
          {!reference ? (
            <details>
              <summary>Mechanism explanation</summary>
              {explanation}
            </details>
          ) : null}
        </>
      ) : (
        <>
          {decision}
          {observation}
          {explanation}
        </>
      )}
    </div>
  )
}
