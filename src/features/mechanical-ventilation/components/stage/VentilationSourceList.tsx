'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import {
  VENTILATION_CLINICAL_REVIEW_LINE,
  ventilationSourceClassLabel,
  ventilationSourceIdentityLine,
  type VentilationEvidenceReference,
} from '../../content/evidence'

/**
 * The footnote list: one small line per source with its class, its reference, an open link and a
 * copy control. What is known of the source's identity, and that no clinical review is recorded,
 * is always shown. What each source is cited for, and what it does not cover, appear only when the
 * caller says the claims may be shown — a record's own supports sentence can name the mechanism a
 * prediction is asking about.
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
          <ul className={shellStyles.sourceClaims} data-source-identity>
            {record.identity ? <li>{ventilationSourceIdentityLine(record.identity)}</li> : null}
            <li>{VENTILATION_CLINICAL_REVIEW_LINE}</li>
          </ul>
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
  )
}
