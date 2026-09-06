'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import styles from './lesson-shell.module.css'

/**
 * The lesson's sources, below the module and folded away.
 *
 * Provenance is not the lesson; it is what the lesson can be checked against. So it sits in the
 * footer, in one place, shut until someone wants it, at the shell's own small type — complete, by
 * title with the claim each source is cited for, and copyable. Rendered closed on every step: it
 * is not progress and it is not a step's content. Opened, it floats over the bottom of the panes;
 * Escape shuts it.
 */
export function StageSourcesFooter({
  count,
  label = 'Sources for this section',
  claimsVisible,
  children,
}: {
  readonly count: number
  readonly label?: string
  /**
   * Whether each source may say what it is cited for. False until the learner has committed the
   * prediction those claims would answer — a record's own supports sentence can name the mechanism.
   */
  readonly claimsVisible: boolean
  readonly children: ReactNode
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const details = detailsRef.current
    if (!details) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.open) return
      details.open = false
      details.querySelector<HTMLElement>('summary')?.focus()
    }
    details.addEventListener('keydown', onKeyDown)
    return () => details.removeEventListener('keydown', onKeyDown)
  }, [])

  if (count === 0) return null
  return (
    <details
      ref={detailsRef}
      className={styles.sources}
      data-stage-sources
      data-stage-sources-claims={claimsVisible}
    >
      <summary className={styles.sourcesSummary}>
        {label} <span className={styles.sourcesCount}>{count}</span>
      </summary>
      <div className={styles.sourcesBody}>
        {children}
        {claimsVisible ? null : (
          <p className={styles.sourcesNote} data-stage-sources-note>
            What each source is cited for, and what it does not cover, appear once you have
            committed your prediction.
          </p>
        )}
      </div>
    </details>
  )
}
