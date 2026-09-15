'use client'

import { useState } from 'react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import type { BronchStageSourceRecord } from '../../content/stageSources'
import { TRANSCRIPT_SENTENCE } from '../../data/sources'

/**
 * The footnote list: one small line per source with its kind, its reference, the places the
 * section cites in it, an open link where there is one and a copy control, then what the source was
 * used for, its limit and, for an external source, the date it was accessed. Self-paced contract
 * (BF-01): these lines are always available — sources are teaching support, not an answer to be
 * withheld. A transcript always carries the fixed transcript sentence.
 */
export function BronchSourceList({
  records,
}: {
  readonly records: readonly BronchStageSourceRecord[]
}) {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <ol className={shellStyles.sourcesList} data-source-list>
      {records.map(({ source, locations }) => {
        const transcript = source.manifest.transcript !== undefined
        const citation = `${source.byline ? `${source.byline}. ` : ''}${source.title}${source.year ? ` (${source.year})` : ''}.`
        return (
          <li
            key={source.id}
            data-evidence-id={source.id}
            data-source-class={transcript ? 'transcript' : 'reference'}
          >
            <small>{source.kindLabel}</small>
            <span>
              <strong>{source.id}.</strong> {source.title}
              {source.byline ? ` ${source.byline}` : ''}
              {source.year ? ` ${source.year}` : ''}. {locations.join(' · ')}.{' '}
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer noopener">
                  Open source
                </a>
              ) : null}{' '}
              <button
                type="button"
                className={shellStyles.badge}
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
            {transcript ? <small>{TRANSCRIPT_SENTENCE}</small> : null}
            <ul className={shellStyles.sourceClaims} data-source-claims>
              <li>Used for: {source.usedFor}</li>
              <li>Limit: {source.limitation}</li>
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
