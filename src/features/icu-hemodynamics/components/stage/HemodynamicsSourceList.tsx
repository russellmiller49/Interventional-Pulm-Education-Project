'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { HemodynamicsSource } from '../../content/sources'

const CLASS_LABEL: Readonly<Record<HemodynamicsSource['sourceType'], string>> = {
  guideline: 'Clinical guideline',
  review: 'Review',
  'original-research': 'Primary study',
  'manufacturer-labeling': 'Manufacturer instructions',
  'reference-package': 'Supplied reference',
  'workflow-manual': 'Supplied monitoring workflow',
  'educational-model': 'Teaching model set for this simulation',
}

/**
 * The footnote list: one small line per source with its class, its reference, an open link and a
 * copy control. What each source is cited for, and what it does not cover, appear only when the
 * caller says the claims may be shown — a record's own use sentence can name the mechanism a
 * prediction is asking about.
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
      {records.map((record) => (
        <li key={record.id} data-evidence-id={record.id} data-source-class={record.sourceType}>
          <small>{CLASS_LABEL[record.sourceType]}</small>
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
          {claimsVisible ? (
            <ul className={shellStyles.sourceClaims} data-source-claims>
              <li>Cited for: {record.intendedUse}</li>
              {record.limitation ? <li>Limit: {record.limitation}</li> : null}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
