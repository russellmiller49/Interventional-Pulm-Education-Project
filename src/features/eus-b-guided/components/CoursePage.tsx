'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import {
  BASE,
  CHAPTERS,
  COURSE_OBJECTIVES,
  GUIDED_MINUTES,
  LESSONS,
  lessonHref,
  lessonNumber,
} from '../content/curriculum'
import { clearProgress, recommendedLesson } from '../engine/progress'
import { EusbModuleFrame } from './ModuleFrame'
import { StationTable, stationsTaught } from './StationLandmarks'
import { SurveyRoute } from './SurveyRoute'
import { useCourseProgress } from './useCourseProgress'
import styles from './eus-b-guided.module.css'

/**
 * Overview and Learn landing. One recommended door (the lesson the learner was in, or the first
 * they have not reached the end of) and the full map, always open. The marks say where the learner
 * has been, never how they answered.
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
  const [everyStation, setEveryStation] = useState(false)
  const next = recommendedLesson(progress)
  const reviewed = progress.reviewedLessonIds.length
  const opened = progress.visitedLessonIds.length
  const mark = (id: string) =>
    progress.reviewedLessonIds.includes(id)
      ? 'Reviewed'
      : progress.visitedLessonIds.includes(id)
        ? 'Opened'
        : ''
  const door = next ? (
    <Link data-course-door className={styles.button} href={lessonHref(next.id)}>
      {(opened ? 'Continue with ' : 'Start with ') + next.title}
    </Link>
  ) : (
    <Link data-course-door className={styles.button} href={lessonHref(LESSONS[0].id)}>
      Open the first lesson again
    </Link>
  )
  return (
    <EusbModuleFrame locale={locale} active={mode}>
      <div className={styles.page}>
        {unknownSection && (
          <p className={styles.notice} role="status">
            That lesson link is no longer available. Choose a lesson below.
          </p>
        )}
        {mode === 'Overview' ? (
          <div className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>EUS-B · A self-paced guided course</p>
              <h1>
                The scope you know,
                <br />
                in the esophagus.
              </h1>
              <p>
                For pulmonologists who already perform linear EBUS. Learn one systematic survey with
                the EBUS scope in the esophagus and stomach: six landmarks, found on ultrasound and
                confirmed by their neighbors.
              </p>
              <p className={styles.muted}>
                About {GUIDED_MINUTES} minutes in {LESSONS.length} lessons, in any order. The scope
                tasks need a desktop or tablet.
              </p>
              <div className={styles.actions}>{door}</div>
              <p className={styles.muted} data-course-marks>
                {reviewed} of {LESSONS.length} lessons reviewed · {opened} opened
              </p>
            </div>
            <SurveyRoute current={next?.stop} />
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>Learn · Your course map</p>
            <h1 className={styles.learnTitle}>One survey, six landmarks.</h1>
            <p className={styles.muted}>
              The order below is the recommended route; open any lesson in any order. Reaching the
              end of a lesson marks it reviewed in this browser, whether or not you completed its
              tasks.
            </p>
            <p>{door}</p>
          </>
        )}
        {status === 'unavailable' && (
          <p role="status" className={styles.notice}>
            This browser is not saving your place in the course. Everything stays open; your place
            and reviewed marks will not survive a reload.
          </p>
        )}
        {status === 'unreadable' && (
          <p role="status" className={styles.notice}>
            A saved course record in this browser could not be read. It has been left unchanged and
            nothing new is being saved. Everything stays open.
          </p>
        )}
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
        <div className={styles.map}>
          {CHAPTERS.map((chapter, chapterIndex) => (
            <section className={styles.card} key={chapter.id} id={'chapter-' + chapter.id}>
              <h2>
                {chapterIndex + 1}. {chapter.title}
              </h2>
              <ol start={lessonNumber(chapter.lessons[0].id)}>
                {chapter.lessons.map((lesson) => (
                  <li key={lesson.id} data-up-next={next?.id === lesson.id || undefined}>
                    <Link href={lessonHref(lesson.id)}>{lesson.title}</Link>{' '}
                    <span className={styles.muted}>
                      · about {lesson.minutes} min {mark(lesson.id) ? '· ' + mark(lesson.id) : ''}
                    </span>
                    {next?.id === lesson.id && <span className={styles.upNext}>Up next</span>}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <section className={styles.card} id="station-landmarks" data-course-stations>
          <h2>Station landmarks</h2>
          <p className={styles.muted}>
            Each nodal station seen from the esophagus, with the landmarks that identify it. A
            station is filled in when you reach the end of the lesson that teaches it, so the table
            does not answer a question before you have met it.
          </p>
          <StationTable open={everyStation ? 'all' : stationsTaught(progress.reviewedLessonIds)} />
          <p>
            <button
              type="button"
              className={styles.secondary}
              aria-pressed={everyStation}
              data-show-every-station
              onClick={() => setEveryStation((value) => !value)}
            >
              Show every station now
            </button>
          </p>
        </section>
        <p className={styles.muted} data-course-marks-legend>
          <strong>What the marks mean.</strong> Opened: you have started the lesson. Reviewed: you
          reached its end; it does not record which tasks you completed or how you answered. Both
          are kept in this browser only.{' '}
          {opened > 0 && (
            <Link
              href={BASE}
              className={styles.inlineLink}
              data-restart-course
              onClick={() => clearProgress()}
            >
              Restart course
            </Link>
          )}
        </p>
        <p className={styles.muted} data-course-boundary>
          The ultrasound images in this course are simulated from one patient’s CT. They show where
          each landmark lies and what surrounds it; they are not clinical recordings.
        </p>
      </div>
    </EusbModuleFrame>
  )
}
