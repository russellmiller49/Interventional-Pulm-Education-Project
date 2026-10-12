'use client'

import { type McsClaimSourceMapping } from '../content/claimSourceMap'
import { mcsSourceById } from '../content/sources'
import { MCS_SOURCE_CLASS_LABELS, mcsSourceClass } from '../content/sourceClasses'

/**
 * The claim-level source checks for one section or one case, one click away (F10).
 *
 * A list of citations says which documents a section leans on. It does not say which sentence was
 * checked against which page, or what the page did not say. This does, for the statements audited
 * in MCS-PRE-REVIEW-04, and it says in the same breath that a check is not a review.
 *
 * Plain markup: it renders the same in the dark lesson footer and on the light case page.
 */
export function McsClaimSourceChecks({
  claims,
  context,
}: {
  readonly claims: readonly McsClaimSourceMapping[]
  /** "this section" or "this case", for the summary line. */
  readonly context: string
}) {
  if (claims.length === 0) return null
  return (
    <details data-claim-source-checks>
      <summary>
        Sources behind statements in {context} ({claims.length})
      </summary>

      <ul>
        {claims.map((claim) => (
          <li key={claim.id} data-claim-check={claim.id} data-claim-disposition={claim.disposition}>
            <p>
              <strong>{claim.learnerSurface}.</strong>{' '}
              {claim.currentWording.map((line) => `“${line}”`).join(' ')}
            </p>
            <ul>
              {claim.opened.map((evidence) => (
                <li key={`${evidence.sourceId}:${evidence.locator}`} data-claim-source>
                  <em>{MCS_SOURCE_CLASS_LABELS[mcsSourceClass(evidence.sourceId)]}:</em>{' '}
                  {mcsSourceById.get(evidence.sourceId)?.title}, {evidence.locator}.{' '}
                  {evidence.passage}
                </li>
              ))}
            </ul>
            <p>
              <em>What the source supports:</em> {claim.supports}
            </p>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Visible at the point of use, including sections with no mapped claim. */
export function McsSourceReviewNotice() {
  return null
}
