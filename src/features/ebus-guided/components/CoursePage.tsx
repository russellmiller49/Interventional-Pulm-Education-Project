'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import {
  BASE,
  LESSONS,
  CHAPTERS,
  COURSE_OBJECTIVES,
  GUIDED_MINUTES,
  lessonHref,
} from '../content/curriculum'
import { legacyRecordPresent, recommendedLesson } from '../engine/selfPacedProgress'
import { EbusModuleFrame } from './ModuleFrame'
import { useCourseProgress } from './useCourseProgress'
import { StorageNotice } from './StorageNotice'
import { GlossaryTerms } from './Glossary'
import { GLOSSARY } from '../content/glossary'
import styles from './course.module.css'

/**
 * Overview and Learn landing (EBUS-01). One recommended door — the lesson the learner was in, or
 * the first not yet marked reviewed — and the full map, always open. The marks on the map say
 * where the learner has been (opened, reviewed, saved for later), never how they answered.
 */
export function CoursePage({
  locale = 'en',
  mode = 'Overview',
  unknownSection,
}: {
  locale?: string
  mode?: 'Overview' | 'Learn'
  unknownSection?: string
}) {
  const { progress, status } = useCourseProgress()
  const [legacy, setLegacy] = useState(false)
  useEffect(() => {
    // The old record is browser state; its presence is read after mounting and its bytes untouched.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLegacy(legacyRecordPresent())
  }, [])
  const next = recommendedLesson(progress)
  const reviewed = progress.reviewedLessonIds.length
  const opened = progress.visitedLessonIds.length
  const remainingMinutes = LESSONS.filter((l) => !progress.reviewedLessonIds.includes(l.id)).reduce(
    (n, l) => n + l.minutes,
    0,
  )
  const mark = (id: string) =>
    [
      progress.reviewedLessonIds.includes(id)
        ? 'Reviewed'
        : progress.visitedLessonIds.includes(id)
          ? 'Opened'
          : '',
      progress.reviewLaterLessonIds.includes(id) ? 'Saved for later' : '',
    ]
      .filter(Boolean)
      .join(' · ')
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
              <p className={styles.eyebrow}>Linear EBUS · A self-paced guided course</p>
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
                For early pulmonary fellows with basic flexible bronchoscopy and chest CT knowledge.
                About {GUIDED_MINUTES} minutes of guided lessons plus about 25 minutes of integrated
                cases, in any order and over several sittings; the times are estimates, not measured
                study times. Selected labs require a desktop or tablet with WebGL 2.
              </p>
              <div className={styles.actions}>
                <Link
                  data-course-door
                  className={styles.button}
                  href={next ? lessonHref(next.id) : BASE + '/assess'}
                >
                  {next
                    ? opened
                      ? 'Continue with ' + next.title
                      : 'Start with ' + next.title
                    : 'Open the integrated cases'}
                </Link>
                <Link className={styles.secondary} href={BASE + '/assess'}>
                  Integrated cases
                </Link>
              </div>
              <p className={styles.muted} data-course-marks>
                {reviewed} of {LESSONS.length} lessons reviewed · {opened} opened · about{' '}
                {remainingMinutes} estimated minutes in lessons not yet reviewed
              </p>
            </div>
            {/*
             * The course map, once (EBUS-PRE-REVIEW-04, OV-1 / OV-2). A five-box "clinical
             * question → result" schematic stood here beside the seven chapter cards below: two
             * organizing schemes on one page, and selecting one of its labels lit a number and
             * located nothing. This is the same chapter registry as the cards, summarized, each
             * chapter linking to its card. No second registry, no phase-to-lesson mapping.
             */}
            <nav className={styles.mapSummary} aria-labelledby="ebus-map-summary">
              <h2 id="ebus-map-summary">The course in {CHAPTERS.length} chapters</h2>
              <p className={styles.muted}>
                {LESSONS.length} lessons. Open any chapter; the order is a recommendation, not a
                requirement.
              </p>
              <ol>
                {CHAPTERS.map((chapter) => (
                  <li key={chapter.id}>
                    <a href={'#chapter-' + chapter.id}>{chapter.title}</a>{' '}
                    <span className={styles.muted}>
                      · {chapter.lessons.length} lessons ·{' '}
                      {
                        chapter.lessons.filter((lesson) =>
                          progress.reviewedLessonIds.includes(lesson.id),
                        ).length
                      }{' '}
                      reviewed
                    </span>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>Learn · Your course map</p>
            <h1 className="text-3xl font-bold">
              From the clinical question to a defensible report.
            </h1>
            <p className={styles.muted}>
              The order below is the recommended route; open any lesson in any order. Reaching the
              end of a lesson marks it reviewed in this browser, whether or not you completed its
              tasks. Reopening an unfinished lesson starts it at its first task.
            </p>
            {next && (
              <p>
                <Link data-course-door className={styles.button} href={lessonHref(next.id)}>
                  {opened ? 'Continue with ' + next.title : 'Start with ' + next.title}
                </Link>
              </p>
            )}
          </>
        )}
        <StorageNotice status={status} />
        {mode === 'Overview' && (
          <section className={styles.card}>
            <h2>What you will practice</h2>
            <ul>
              {COURSE_OBJECTIVES.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
            <p className={styles.muted}>
              These objectives describe the knowledge and clinical reasoning taught here (“knows
              how”). Supervised procedural performance is taught and judged separately.
            </p>
          </section>
        )}
        {legacy && (
          <p className={styles.muted} data-legacy-record-note>
            A course record from before the self-paced conversion exists in this browser. It is kept
            unchanged and is not used: this course now keeps only your place, the lessons you have
            opened, finished or saved for later, and the cases you have opened.
          </p>
        )}
        {/*
         * What the marks mean (EBUS-PRE-REVIEW-04, NAV-1). "Reviewed" was read as evidence of work
         * done; it is a navigation mark. The record and its undo are unchanged.
         */}
        <p className={styles.muted} data-course-marks-legend>
          <strong>What the marks mean.</strong> Opened: you have started the lesson. Reviewed: you
          reached its end, or marked it yourself; it does not record which tasks you completed,
          skipped or answered, and you can unmark it at the end of the lesson. Saved for later: your
          own reminder. Lesson times are estimates. None of these marks grades your answers.
        </p>
        <div className={styles.map}>
          {CHAPTERS.map((chapter, chapterIndex) => {
            const lessons = chapter.lessons
            if (!lessons.length) return null
            return (
              <section className={styles.card} key={chapter.id} id={'chapter-' + chapter.id}>
                <h2>
                  {chapterIndex + 1}. {chapter.title}
                </h2>
                <ol start={LESSONS.indexOf(lessons[0]) + 1}>
                  {lessons.map((l) => (
                    <li key={l.id}>
                      <Link href={lessonHref(l.id)}>{l.title}</Link>{' '}
                      <span className={styles.muted}>
                        · about {l.minutes} min {mark(l.id) ? '· ' + mark(l.id) : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
        </div>
        {mode === 'Overview' && (
          <section className={styles.card}>
            <GlossaryTerms
              entries={GLOSSARY}
              heading="Course glossary"
              intro="Definitions taken from the course’s own teaching, with the lesson each comes from. Terms the course uses without defining are not listed. The same glossary is under Help in every lesson."
              level={2}
            />
          </section>
        )}
        <p className={styles.notice}>
          Reviewed and opened marks record where you have been in the course, not procedural
          competence. Continue with supervised simulation and workplace teaching. This development
          course remains separate from the existing EBUS tools.
        </p>
      </div>
    </EbusModuleFrame>
  )
}
