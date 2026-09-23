import { Link } from '@/i18n/navigation'
import { LESSONS, lessonHref } from '../content/curriculum'
import type { GlossaryEntry } from '../content/glossary'
import styles from './course.module.css'

/**
 * Glossary entries as disclosures (EBUS-PRE-REVIEW-04, NAV-3). Each opens to the course's own
 * definition, says where in the course the wording comes from, and links the lesson that teaches
 * the term in full — unless that is the lesson already open. Every entry is a native `details`
 * element, so it is reachable and operable from the keyboard and announced as expandable; nothing
 * is recorded about which terms are opened.
 */
export function GlossaryTerms({
  entries,
  heading,
  intro,
  currentLessonId,
  level = 3,
}: {
  entries: readonly GlossaryEntry[]
  heading: string
  intro?: string
  currentLessonId?: string
  level?: 2 | 3
}) {
  if (!entries.length) return null
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <section className={styles.glossary} data-glossary aria-label={heading}>
      <Heading>{heading}</Heading>
      {intro && <p className={styles.muted}>{intro}</p>}
      <ul>
        {entries.map((entry) => {
          const lesson =
            entry.lessonId && entry.lessonId !== currentLessonId
              ? LESSONS.find((item) => item.id === entry.lessonId)
              : undefined
          return (
            <li key={entry.id}>
              <details data-glossary-term={entry.id}>
                <summary>{entry.term}</summary>
                <p>{entry.definition}</p>
                <p className={styles.muted}>From the course: {entry.sources.join('; ')}.</p>
                {lesson && (
                  <p>
                    <Link href={lessonHref(lesson.id)}>
                      Full teaching: Lesson {LESSONS.indexOf(lesson) + 1} · {lesson.title}
                    </Link>
                  </p>
                )}
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
