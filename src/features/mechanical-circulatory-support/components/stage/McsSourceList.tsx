'use client'

import { ExternalLink } from 'lucide-react'

import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { useStageSourcesCollected } from '@/features/learning-module/stage/StageSourcesScope'

import {
  MCS_SOURCE_CLASS_LABELS,
  mcsSourceClass,
  mcsSourceIdsByClass,
  mcsSourceVerificationLabel,
} from '../../content/sourceClasses'
import { mcsSources } from '../../content/sources'

/**
 * The sources a section rests on, as one quiet footnote list.
 *
 * One small line per source: title, reference, an open link. What each source is cited for and
 * what it does not cover appear only once the prediction is committed, because a record's
 * intended use can name the mechanism the section is asking about. Inside the stage a list
 * standing anywhere but the footer renders nothing — the footer speaks for it.
 */
export function McsSourceList({
  sourceIds,
  claimsVisible,
  inFooter = true,
}: {
  readonly sourceIds: readonly string[]
  readonly claimsVisible: boolean
  readonly inFooter?: boolean
}) {
  const collectedElsewhere = useStageSourcesCollected()
  if (collectedElsewhere && !inFooter) return null
  /*
   * Listed by what kind of source each is, and labelled (F10). A supplied synthesis used to be able
   * to stand first in this list with nothing to say it was the document the section was drafted
   * from rather than evidence for it. Order alone would not fix that, so every row now names its
   * class and says whether anyone opened the document for this module.
   */
  const sources = mcsSourceIdsByClass(sourceIds)
    .map((id) => mcsSources.find((source) => source.id === id))
    .filter((source): source is NonNullable<typeof source> => source !== undefined)
  if (sources.length === 0) return null
  return (
    <ol className={shellStyles.sourcesList} data-mcs-source-list data-density="footnote">
      {sources.map((source) => (
        <li
          key={source.id}
          data-source-id={source.id}
          data-source-type={source.sourceType}
          data-source-class={mcsSourceClass(source.id)}
        >
          <small data-source-class-label>
            {MCS_SOURCE_CLASS_LABELS[mcsSourceClass(source.id)]} ·{' '}
            {mcsSourceVerificationLabel(source.id)}.
          </small>{' '}
          <span data-source-title>{source.title}</span>
          <small data-source-reference>
            {' '}
            — {source.citation} ({source.year ?? 'date not stated'})
          </small>
          {source.url ? (
            <>
              {' '}
              <a href={source.url} target="_blank" rel="noreferrer">
                Open <ExternalLink aria-hidden="true" />
              </a>
            </>
          ) : null}
          {claimsVisible ? (
            <span className={shellStyles.sourceClaims} data-source-claims>
              <small>Cited for: {source.intendedUse}</small>
              {source.limitation ? <small> Does not cover: {source.limitation}</small> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
