'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { Source } from '../../types'

/**
 * The footnote list: one small line per source with its class, its reference, an open link and a
 * copy control. What each source is cited for, and its limit, appear only when the caller says the
 * claims may be shown — a record's own use sentence can name the mechanism a prediction asks about.
 */
export function ImagingSourceList({
  records,
  claimsVisible,
}: {
  readonly records: readonly Source[]
  readonly claimsVisible: boolean
}) {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <ol className={shellStyles.sourcesList} data-source-list>
      {records.map((record) => (
        <li key={record.id} data-evidence-id={record.id} data-source-class={record.kind}>
          <small>{record.kind}</small>
          <span>
            <strong>{record.title}</strong> {record.authors} {record.publication} {record.year}.{' '}
            <a href={record.url} target="_blank" rel="noreferrer noopener">
              Open source
            </a>{' '}
            <button
              type="button"
              className={shellStyles.badge}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(
                    `${record.authors} ${record.title} ${record.publication} ${record.year}.`,
                  )
                  .then(
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
              <li>Cited for: {record.supports}</li>
              <li>Limit: {record.limitation}</li>
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
