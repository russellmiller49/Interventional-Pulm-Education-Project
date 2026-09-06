'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { VentilationEvidenceReference } from '../../content/evidence'

const CLASS_LABEL: Readonly<Record<VentilationEvidenceReference['sourceClass'], string>> = {
  manufacturer: 'Manufacturer source',
  curriculum: 'Supplied curriculum',
  guideline: 'Clinical guideline',
  'clinical-reference': 'Clinical reference',
  'educational-model': 'Teaching model set for this simulation',
}

/**
 * The footnote list: one small line per source with its class, its reference, an open link and a
 * copy control. What each source is cited for, and what it does not cover, appear only when the
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
          <small>{CLASS_LABEL[record.sourceClass]}</small>
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
  )
}
