'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { BronchStageSourceRecord } from '../../content/stageSources'
import { PDF_PAGE_LOCATOR_NOTE, TRANSCRIPT_SENTENCE } from '../../data/sources'

/**
 * The footnote list: one small line per source with its kind, its reference, the places the
 * section cites in it, an open link where there is one and a copy control, then what the source was
 * used for, its limit and, for an external source, the date it was accessed. Self-paced contract
 * (BF-01): these lines are always available — sources are teaching support, not an answer to be
 * withheld.
 *
 * The class comes from `source.sourceClass`, derived once in the registry from a validated
 * transcript record (fellow walkthrough A8). A lecture transcript carries the fixed transcript
 * sentence exactly once, as its limit — the same place the Reference puts it; a textbook, manual or
 * guideline never carries it. Where the section cites PDF pages, the list says what a PDF page is
 * rather than implying a printed page (SUP-02).
 */
export function BronchSourceList({
  records,
}: {
  readonly records: readonly BronchStageSourceRecord[]
}) {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <ol className={shellStyles.sourcesList} data-source-list>
      {records.map(({ source, locations, pdfPages }) => {
        const transcript = source.sourceClass === 'transcript'
        const citation = `${source.byline ? `${source.byline}. ` : ''}${source.title}${source.year ? ` (${source.year})` : ''}.`
        return (
          <li key={source.id} data-evidence-id={source.id} data-source-class={source.sourceClass}>
            <small data-source-kind>{source.kindLabel}</small>
            <span>
              <strong>{source.id}.</strong> {source.title}
              {source.byline ? ` ${source.byline}` : ''}
              {source.year ? ` ${source.year}` : ''}. {locations.join(' · ')}.{' '}
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Open source ${source.id} (opens in a new tab)`}
                  data-source-open
                >
                  Open source
                </a>
              ) : null}{' '}
              <button
                type="button"
                className={shellStyles.badge}
                aria-label={
                  copied === source.id
                    ? `Citation for ${source.id} copied`
                    : `Copy citation for ${source.id}`
                }
                data-source-copy
                onClick={() => {
                  void navigator.clipboard?.writeText(citation).then(
                    () => setCopied(source.id),
                    () => setCopied(null),
                  )
                }}
              >
                {copied === source.id ? 'Copied' : 'Copy citation'}
              </button>
            </span>
            <ul className={shellStyles.sourceClaims} data-source-claims>
              <li>Used for: {source.usedFor}</li>
              <li data-source-limit data-source-transcript-note={transcript || undefined}>
                Limit: {transcript ? TRANSCRIPT_SENTENCE : source.limitation}
              </li>
              {transcript && source.limitation !== TRANSCRIPT_SENTENCE ? (
                <li>{source.limitation}</li>
              ) : null}
              {pdfPages ? <li data-source-locator-note>{PDF_PAGE_LOCATOR_NOTE}</li> : null}
              {source.manifest.accessedDate ? (
                <li data-source-accessed>Accessed: {source.manifest.accessedDate}</li>
              ) : null}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
