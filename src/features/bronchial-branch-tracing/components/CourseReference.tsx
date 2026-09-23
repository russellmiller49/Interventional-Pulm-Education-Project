import { Link } from '@/i18n/navigation'
import {
  DIRECTION_CHANGE,
  NAMING_KEY,
  NAMING_USE,
  PATTERNS,
  SUBSEGMENT_NOTE,
  TERMS,
  lessonHref,
  lessonNumber,
  patternSource,
  targetNaming,
} from '../content/course-guide'
import type { CtNoduleTarget } from '../content/ct-types'
import styles from './branch-tracing.module.css'

type Part = 'naming' | 'patterns' | 'terms'

/**
 * One small local reference for the course (BBT-PRE-REVIEW-04): the B/S naming key, the four
 * tracing patterns and the terms used before they are taught. It is reused, not repeated: the
 * overview shows it open, lessons offer it as a disclosure. Opening it records nothing.
 */
export function CourseReference({
  parts = ['naming', 'patterns', 'terms'],
  target,
  currentLessonId,
  disclosure = true,
  summary = 'Course reference: naming, the four patterns and key terms',
}: {
  parts?: Part[]
  target?: CtNoduleTarget
  currentLessonId?: string
  disclosure?: boolean
  summary?: string
}) {
  const H = disclosure ? 'h4' : 'h3'
  const body = (
    <div className={styles.courseReference} data-course-reference={parts.join(' ')}>
      {parts.includes('naming') && (
        <section aria-label="Airway naming">
          <H>Airway naming</H>
          <p>
            {NAMING_KEY} {NAMING_USE}
          </p>
          {target && <p data-target-naming>{targetNaming(target).sentence}</p>}
          <p className={styles.small}>{SUBSEGMENT_NOTE}</p>
        </section>
      )}
      {parts.includes('patterns') && (
        <section aria-label="The four tracing patterns">
          <H>The four tracing patterns</H>
          <ul className={styles.patternList}>
            {PATTERNS.map((p) => (
              <li key={p.lessonId} aria-current={p.lessonId === currentLessonId || undefined}>
                <strong>{p.name}</strong>{' '}
                <Link href={lessonHref(p.lessonId)}>(Lesson {lessonNumber(p.lessonId)})</Link>
                {p.definition.map((sentence) => (
                  <span key={sentence}> {sentence}</span>
                ))}
              </li>
            ))}
          </ul>
          <p>
            <strong>Related, not a fifth pattern: {DIRECTION_CHANGE.name.toLowerCase()}</strong>{' '}
            <Link href={lessonHref(DIRECTION_CHANGE.lessonId)}>
              (Lesson {lessonNumber(DIRECTION_CHANGE.lessonId)})
            </Link>
            {DIRECTION_CHANGE.definition.map((sentence) => (
              <span key={sentence}> {sentence}</span>
            ))}
          </p>
          <p className={styles.small}>
            Each description is taken from its lesson. The four names are the Chapter 1 concepts
            recorded from Kurimoto &amp; Morita; the book’s figures are not reproduced, and one
            route can combine several patterns. Page pointers are the lessons’ own and are pending
            faculty review:{' '}
            {PATTERNS.map((p) => `Lesson ${lessonNumber(p.lessonId)}, ${patternSource(p)}`).join(
              '; ',
            )}
            .
          </p>
        </section>
      )}
      {parts.includes('terms') && (
        <section aria-label="Terms used in this course">
          <H>Terms used in this course</H>
          <dl className={styles.termList}>
            {TERMS.map((t) => (
              <div key={t.term}>
                <dt>{t.term}</dt>
                <dd>{t.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
  return disclosure ? (
    <details className={styles.courseReferenceDisclosure}>
      <summary>{summary}</summary>
      {body}
    </details>
  ) : (
    body
  )
}
