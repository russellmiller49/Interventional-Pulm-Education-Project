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
                For early pulmonary fellows. About {GUIDED_MINUTES} minutes of lessons and 25
                minutes of cases, in any order. The labs need a desktop or tablet.
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
             * A picture of what the course is (visual review of 2026-10-07, item 8). A second
             * list of the chapters stood here, above the chapter cards that list them again.
             */}
            <figure className={styles.heroFigure}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ebus-guided/lab-console.jpg"
                width={1342}
                height={334}
                alt="The lab console: the bronchoscopy view, the ultrasound image with a lymph node in the plane, and the 3D airway with the scan plane drawn on it."
              />
              <figcaption>
                In the labs you steer the scope and read three views together: where the scope is,
                what the plane shows, and where that plane lies in the chest.
              </figcaption>
            </figure>
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
          </section>
        )}
        {legacy && (
          <p className={styles.muted} data-legacy-record-note>
            A course record from before the self-paced conversion exists in this browser. It is kept
            unchanged and is not used: this course now keeps only your place, the lessons you have
            opened, finished or saved for later, and the cases you have opened.
          </p>
        )}
        <p className={styles.muted} data-course-marks-legend>
          <strong>What the marks mean.</strong> Opened: you have started the lesson. Reviewed: you
          reached its end, or marked it yourself; it does not record which tasks you completed,
          skipped or answered. Saved for later: your own reminder.
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
                <p className={styles.muted} data-chapter-progress>
                  {lessons.filter((l) => progress.reviewedLessonIds.includes(l.id)).length} of{' '}
                  {lessons.length} reviewed
                </p>
                <ol start={LESSONS.indexOf(lessons[0]) + 1}>
                  {lessons.map((l) => (
                    <li key={l.id} data-up-next={next?.id === l.id || undefined}>
                      <Link href={lessonHref(l.id)}>{l.title}</Link>{' '}
                      <span className={styles.muted}>
                        · about {l.minutes} min {mark(l.id) ? '· ' + mark(l.id) : ''}
                      </span>
                      {next?.id === l.id && <span className={styles.upNext}>Up next</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
        </div>
        {mode === 'Overview' && (
          <p className={styles.muted} data-glossary-pointer>
            The course glossary is under Help in every lesson.
          </p>
        )}
      </div>
    </EbusModuleFrame>
  )
}
