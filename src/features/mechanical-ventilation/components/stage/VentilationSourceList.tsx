'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import {
  VENTILATION_CLINICAL_REVIEW_LINE,
  VENTILATION_SOURCE_REVIEW_STATUS,
  ventilationSourceClassLabel,
  ventilationSourceIdentityLine,
  type VentilationEvidenceReference,
} from '../../content/evidence'

/**
 * The footnote list: one small line per source with its class, its reference, an open link and a
 * copy control. What each source is cited for, and what it does not cover, appear only when the
 * caller says the claims may be shown — a record's own supports sentence can name the mechanism a
 * prediction is asking about.
 *
 * MV-PRE-REVIEW-04 (T3): the review status is stated once above the list instead of under every
 * citation, and the file-identity checks and snapshot hashes sit in one audit disclosure under it.
 * Nothing is removed: every record's identity line and the no-clinical-review statement are still
 * on the page, one click away, and the status sentence is always visible.
 */
export function VentilationSourceList({
  records,
  claimsVisible,
}: {
  readonly records: readonly VentilationEvidenceReference[]
  readonly claimsVisible: boolean
}) {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <>
      <p data-source-review-status>{VENTILATION_SOURCE_REVIEW_STATUS}</p>
      <ol className={shellStyles.sourcesList} data-source-list>
        {records.map((record) => (
          <li key={record.id} data-evidence-id={record.id} data-source-class={record.sourceClass}>
            <small>{ventilationSourceClassLabel[record.sourceClass]}</small>
            <span>
              <strong>{record.title}.</strong> {record.citation}
              {record.pages ? ` Pages ${record.pages}.` : ''}{' '}
              {record.sourceUrl ? (
                <a href={record.sourceUrl} target="_blank" rel="noreferrer noopener">
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
            {claimsVisible ? (
              <ul className={shellStyles.sourceClaims} data-source-claims>
                {record.supports.map((claim) => (
                  <li key={claim}>Supports: {claim}</li>
                ))}
                <li>Limit: {record.limitations}</li>
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      <details data-source-audit>
        <summary>Source audit: identity checks and review status ({records.length})</summary>
        <ul className={shellStyles.sourceClaims}>
          {records.map((record) => (
            <li key={record.id} data-source-identity={record.id}>
              <strong>{record.title}.</strong>{' '}
              {record.identity
                ? ventilationSourceIdentityLine(record.identity)
                : 'No identity check is recorded for this source.'}{' '}
              {record.audit ? `${record.audit} ` : ''}
              {VENTILATION_CLINICAL_REVIEW_LINE}
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}
