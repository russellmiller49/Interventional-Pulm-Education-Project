import { CRRT_SOURCE_ROLE_WORDS, crrtSourceDating } from '../content/sourceReviewMetadata'
import styles from './crrt-source-dating.module.css'

/**
 * One cited source's type, dates and document checks, each on its own line, so a publication
 * year, a document revision and the day someone looked at the document cannot be read as one
 * another. Renders nothing for a source outside the dated batch. Clinical and device review is
 * stated as not recorded because none is: a check against the document is not a review.
 */
export function CrrtSourceDating({
  sourceId,
  className,
}: {
  readonly sourceId: string
  readonly className?: string
}) {
  const dating = crrtSourceDating(sourceId)
  if (!dating) return null
  return (
    <ul
      className={className ? `${styles.list} ${className}` : styles.list}
      data-source-dating={sourceId}
    >
      <li>Source type: {CRRT_SOURCE_ROLE_WORDS[dating.role]}</li>
      <li>Published: {dating.published ?? 'not recorded'}</li>
      {dating.revision ? <li>Revision: {dating.revision}</li> : null}
      {dating.checks.map((check) => (
        <li key={`${check.on}:${check.recordedIn}`}>
          Checked against the document on {check.on}
          {check.by ? ` by ${check.by}` : ' (the record does not name who checked)'}: {check.scope}
        </li>
      ))}
      <li>Limit: {dating.limitation}</li>
      <li>Clinical and device review: none recorded yet.</li>
    </ul>
  )
}
