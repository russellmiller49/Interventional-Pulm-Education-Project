'use client'
import { Link } from '@/i18n/navigation'
import {
  BASE,
  LESSONS,
  CHAPTERS,
  COURSE_OBJECTIVES,
  GUIDED_MINUTES,
  lessonHref,
  nextLesson,
} from '../content/curriculum'
import { EbusModuleFrame } from './ModuleFrame'
import { useCourseRecord } from './useCourseRecord'
import { TeachingDiagram } from './Diagram'
import styles from './course.module.css'
export function CoursePage({
  locale = 'en',
  mode = 'Overview',
  unknownSection,
}: {
  locale?: string
  mode?: string
  unknownSection?: string
}) {
  const record = useCourseRecord(),
    next = nextLesson(record.completed)
  return (
    <EbusModuleFrame locale={locale} active={mode}>
      <div className={styles.page}>
        {unknownSection && (
          <p className={styles.notice} role="status">
            That lesson link is no longer available. Choose a lesson below.
          </p>
        )}
        {mode === 'Overview' ? (
          <div className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>Linear EBUS · A guided clinical course</p>
              <h1>
                From the airway view
                <br />
                to the tissue diagnosis.
              </h1>
              <p>
                Build a systematic approach to endobronchial ultrasound-guided transbronchial needle
                aspiration (EBUS-TBNA): establish the image, locate the station, plan the sample,
                and interpret what the result can tell you.
              </p>
              <p className={styles.muted}>
                For early pulmonary fellows with basic flexible bronchoscopy and chest CT knowledge.{' '}
                {GUIDED_MINUTES} minutes of guided lessons plus about 25 minutes of case review,
                over several sittings. Selected labs require a desktop or tablet with WebGL 2.
              </p>
              <div className={styles.actions}>
                <Link
                  className={styles.button}
                  href={next ? lessonHref(next.id) : BASE + '/assess'}
                >
                  {next
                    ? record.completed.length
                      ? 'Continue learning'
                      : 'Start course'
                    : 'Open final assessment'}
                </Link>
              </div>
              <p className={styles.muted}>
                {record.completed.length} of {LESSONS.length} lessons completed ·{' '}
                {LESSONS.filter((l) => !record.completed.includes(l.id)).reduce(
                  (n, l) => n + l.minutes,
                  0,
                )}{' '}
                guided minutes remaining
              </p>
            </div>
            <TeachingDiagram kind="workflow" />
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>Learn · Your course map</p>
            <h1 className="text-3xl font-bold">
              From the clinical question to a defensible report.
            </h1>
            <p className={styles.muted}>
              Follow the suggested order. An unfinished lesson restarts at its first step; completed
              lessons and first responses are retained in this browser.
            </p>
          </>
        )}
        {mode === 'Overview' && (
          <section className={styles.card}>
            <h2>What you will practice</h2>
            <ul>
              {COURSE_OBJECTIVES.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
            <p className={styles.muted}>
              These objectives assess knowledge and clinical reasoning (“knows how”). Supervised
              procedural performance requires separate assessment.
            </p>
          </section>
        )}
        {record.completed.length > 0 && (
          <p className={styles.muted}>
            Earlier lesson completion remains part of your history. Newly introduced image
            interpretations and examination-record tasks have separate records; earlier completion
            does not establish those added skills.
          </p>
        )}
        <div className={styles.map}>
          {CHAPTERS.map((chapter, chapterIndex) => {
            const lessons = chapter.lessons
            if (!lessons.length) return null
            return (
              <section className={styles.card} key={chapter.id}>
                <h2>
                  {chapterIndex + 1}. {chapter.title}
                </h2>
                <ol start={LESSONS.indexOf(lessons[0]) + 1}>
                  {lessons.map((l) => (
                    <li key={l.id}>
                      <Link href={lessonHref(l.id)}>{l.title}</Link>{' '}
                      <span className={styles.muted}>
                        · {l.minutes} min {record.completed.includes(l.id) ? '· Completed' : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
        </div>
        <p className={styles.notice}>
          Completion records learning activities, not independent procedural competence. Continue
          with supervised simulation and workplace assessment. This development course remains
          separate from the existing EBUS tools.
        </p>
      </div>
    </EbusModuleFrame>
  )
}
