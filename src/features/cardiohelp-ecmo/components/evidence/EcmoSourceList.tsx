'use client'

import { useId } from 'react'

import { resolveEcmoEvidence } from '../../content/evidenceResolver'
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
  /** Evidence id → the claim this surface takes from that source. */
  readonly claims?: Readonly<Record<string, string>>
  readonly compact?: boolean
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
  showLimitations,
  title,
  headingLevel = 3,
  labelledBy,
  surface = 'workspace',
}: EcmoSourceListProps) {
  const ownLabelId = useId()
  const citations = resolveEcmoEvidence(evidenceIds, claims ? { claims } : {})
  if (citations.length === 0) return null

  const Heading = `h${headingLevel}` as const
  const labelId = title || !labelledBy ? ownLabelId : labelledBy

  return (
    <div
      className={surface === 'shell' ? `${styles.list} ${styles.shell}` : styles.list}
      data-ecmo-source-list
      data-density={compact ? 'compact' : 'full'}
    >
      {title ? (
        <Heading id={ownLabelId} className={styles.listTitle}>
          {title}
        </Heading>
      ) : labelledBy ? null : (
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
            showLimitations={showLimitations}
          />
        ))}
      </ol>
    </div>
  )
}
