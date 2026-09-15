'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import {
  HEMODYNAMICS_CLINICAL_REVIEW_LINE,
  hemodynamicsSourceCheckLine,
  hemodynamicsSourceClassLabel,
  hemodynamicsSourceDateLine,
  hemodynamicsSourceReviewMetadata,
} from '../../content/sourceReviewMetadata'
import type { HemodynamicsSource } from '../../content/sources'

/**
 * The footnote list: one small line per source with its class, its reference, an open link and a
 * copy control. Since HD-03 each source also shows, at all times, its date and where that date comes
 * from, any document checks, and that no clinical review is recorded — none of that can give away an
 * answer. What each source is cited for, and what it does not cover, appear only when the caller says
 * the claims may be shown — a record's own use sentence can name the mechanism a prediction is asking
 * about.
 */
export function HemodynamicsSourceList({
  records,
  claimsVisible,
}: {
  readonly records: readonly HemodynamicsSource[]
  readonly claimsVisible: boolean
}) {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <ol className={shellStyles.sourcesList} data-source-list>
      {records.map((record) => {
        const review = hemodynamicsSourceReviewMetadata(record.id)
        return (
          <li key={record.id} data-evidence-id={record.id} data-source-class={record.sourceType}>
            <small>{hemodynamicsSourceClassLabel(record)}</small>
            <span>
              <strong>{record.title}.</strong> {record.citation}{' '}
              {record.url ? (
                <a href={record.url} target="_blank" rel="noreferrer noopener">
                  Open source
                </a>
              ) : null}{' '}
              <button
                type="button"
                className={shellStyles.badge}
                onClick={() => {
                  void navigator.clipboard?.writeText(`${record.title}. ${record.citation}`).then(
                    () => setCopied(record.id),
                    () => setCopied(null),
                  )
                }}
              >
                {copied === record.id ? 'Copied' : 'Copy citation'}
              </button>
            </span>
            <ul className={shellStyles.sourceClaims} data-source-identity>
              <li>{hemodynamicsSourceDateLine(record)}</li>
              {review.revision ? <li>Revision: {review.revision}</li> : null}
              {review.checks.map((check) => (
                <li key={`${check.on}:${check.what}`}>{hemodynamicsSourceCheckLine(check)}</li>
              ))}
              <li>{HEMODYNAMICS_CLINICAL_REVIEW_LINE}</li>
            </ul>
            {claimsVisible ? (
              <ul className={shellStyles.sourceClaims} data-source-claims>
                <li>Cited for: {record.intendedUse}</li>
                {record.limitation ? <li>Limit: {record.limitation}</li> : null}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
