'use client'

import { useId } from 'react'

import { resolveEcmoEvidence } from '../../content/evidenceResolver'
import { useStageSourcesCollected } from '../stage/StageSourcesScope'
import { EcmoCitation } from './EcmoCitation'
import styles from './evidence.module.css'

/**
 * The list every citing surface renders: an ordered list of `EcmoCitation` rows resolved from
 * registry ids.
 *
 * Three ways to name it, because the hosts differ. A `title` renders a heading at `headingLevel`
 * that labels the list. `labelledBy` hands labelling to a heading the host already has, so a grouped
 * panel does not print "Sources" under a heading that says the same thing. With neither, the list
 * carries its own short visible "Sources" label, which is the compact card case.
 *
 * `surface` selects the colour tokens: the hub's dark module shell declares literal colours, while
 * the Learn workspaces declare shadcn triples, and `evidence.module.css` maps each once.
 */

export type EcmoSourceListHeadingLevel = 2 | 3 | 4 | 5 | 6

export interface EcmoSourceListProps {
  readonly evidenceIds: readonly string[]
  /** Evidence id → the claim, or claims, this surface takes from that source. */
  readonly claims?: Readonly<Record<string, string | readonly string[]>>
  readonly compact?: boolean
  /**
   * How loudly the list reads.
   *
   * `card` is the default and the only one there used to be: a bordered row per source with its
   * class badge, for a surface whose subject is provenance. `footnote` is the stage footer's — no
   * borders, no badges, one small line per source with its claim and its controls as text links,
   * because the lesson is the subject there and the sources are what it can be checked against.
   */
  readonly density?: 'card' | 'footnote'
  /** See `EcmoCitation`: false names each source without saying what it is cited for. */
  readonly supportsVisible?: boolean
  readonly showLimitations?: boolean
  readonly title?: string
  readonly headingLevel?: EcmoSourceListHeadingLevel
  /** Id of a host heading that names this list. Ignored when `title` is given. */
  readonly labelledBy?: string
  readonly surface?: 'workspace' | 'shell'
}

export function EcmoSourceList({
  evidenceIds,
  claims,
  compact = false,
  density = 'card',
  supportsVisible = true,
  showLimitations,
  title,
  headingLevel = 3,
  labelledBy,
  surface = 'workspace',
}: EcmoSourceListProps) {
  const ownLabelId = useId()
  const collectedElsewhere = useStageSourcesCollected()
  const citations = resolveEcmoEvidence(evidenceIds, claims ? { claims } : {})
  // Inside the lesson stage the footer cites this surface's sources for it. See StageSourcesScope.
  if (collectedElsewhere && density !== 'footnote') return null
  if (citations.length === 0) return null
  const footnote = density === 'footnote'

  const Heading = `h${headingLevel}` as const
  const labelId = title || !labelledBy ? ownLabelId : labelledBy

  return (
    <div
      className={[
        styles.list,
        surface === 'shell' ? styles.shell : '',
        footnote ? styles.footnoteList : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-ecmo-source-list
      data-density={footnote ? 'footnote' : compact ? 'compact' : 'full'}
    >
      {title ? (
        <Heading id={ownLabelId} className={styles.listTitle}>
          {title}
        </Heading>
      ) : labelledBy || footnote ? null : (
        <span id={ownLabelId} className={styles.listLabel}>
          Sources
        </span>
      )}
      <ol className={styles.items} role="list" aria-labelledby={labelId}>
        {citations.map((citation) => (
          <EcmoCitation
            key={citation.id}
            citation={citation}
            compact={compact}
            density={density}
            supportsVisible={supportsVisible}
            showLimitations={showLimitations}
          />
        ))}
      </ol>
    </div>
  )
}
