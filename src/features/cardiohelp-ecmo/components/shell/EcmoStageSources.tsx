'use client'

import { useEffect, useRef } from 'react'

import { EcmoSourceList } from '../evidence/EcmoSourceList'
import type { EcmoStageSources } from '../../content/stageSources'
import styles from './EcmoActivityShell.module.css'

/**
 * The lesson's sources, below the module and folded away.
 *
 * An owner review found nine bordered citation cards spread through the panes — under the walk
 * card, under the narrative, under the explorer, and one set between the learner's answers and the
 * button that commits them. Provenance is not the lesson; it is what the lesson can be checked
 * against. So it sits in the footer, in one place, shut until someone wants it, at the shell's own
 * small type — and it is still complete, still by title with the claim each source is cited for,
 * and still copyable, because a learner who wants to look something up needs all of that.
 *
 * Rendered closed on every step. It is not progress and it is not a step's content: reopening
 * itself as the learner moves would put it back in the way it was taken out of.
 */
export function EcmoStageSources({
  sources,
  label = 'Sources for this section',
  claimsVisible,
}: {
  readonly sources: EcmoStageSources
  readonly label?: string
  /**
   * Whether each source may say what it is cited for.
   *
   * False until the learner has committed the prediction those claims would answer. A record's own
   * supports sentence names the mechanism it is registered for, and one record's limitation names
   * it too, so before the commitment the footer gives titles and references and stops there.
   */
  readonly claimsVisible: boolean
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  /*
   * Escape shuts it. Opened, the list floats over the bottom of the panes, and a panel that covers
   * content is expected to close the way every other overlay does — the summary is still the way
   * to toggle it, and this only listens while it is open.
   */
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

  const count = sources.evidenceIds.length
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
        <EcmoSourceList
          density="footnote"
          surface="shell"
          evidenceIds={sources.evidenceIds}
          claims={claimsVisible ? sources.claims : undefined}
          supportsVisible={claimsVisible}
          // The limit line goes with the claim: one record's registered limitation names the very
          // mechanism its drill is asking about ("unloading-device selection"), so before the
          // commitment this list is titles and references and nothing else.
          showLimitations={claimsVisible}
        />
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
