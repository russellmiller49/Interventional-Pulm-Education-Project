'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, GitBranch } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { BASE_PATH, LESSONS, SOURCE } from '../content/lessons'
import {
  LESSON_GROUPS,
  NAMING_KEY,
  courseMap,
  lessonNumber,
  moreRoutesSet,
  patternFor,
  targetNaming,
} from '../content/course-guide'
import { targetForTrace, traceById } from '../geometry/native-ct'
import { browserStorage, recommendedLesson } from '../engine/selfPacedProgress'
import { savedRouteDrafts } from '../engine/route-drafts'
import { useSelfPacedProgress } from './useSelfPacedProgress'
import { CourseReference } from './CourseReference'
import { ModuleFrame } from './ModuleFrame'
import { TargetCtPreview } from './TargetCtPreview'
import styles from './branch-tracing.module.css'

const HERO_TRACE = 'middle-lobe-caudal'

export function BranchTracingOverview() {
  const { ready, status, record } = useSelfPacedProgress()
  const recommendation = recommendedLesson(record)
  const opened = LESSONS.filter((l) => record.visitedLessonIds.includes(l.id))
  const reviewed = LESSONS.filter((l) => record.reviewedLessonIds.includes(l.id))
  const savedForLater = LESSONS.filter((l) => record.reviewLaterLessonIds.includes(l.id))
  const door = recommendation?.lesson ?? LESSONS[0]
  const map = courseMap()
  const heroTarget = targetForTrace(traceById(HERO_TRACE))
  // Which route drafts this device already keeps. Read after hydration; a draft is a saved place,
  // never a result, and nothing here is written.
  const [routeDrafts, setRouteDrafts] = useState({ practice: false, assess: false })
  useEffect(() => {
    // Read the saved drafts from browser storage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRouteDrafts(savedRouteDrafts(browserStorage()))
  }, [])
  const minutesEstimate = (minutes: number) => `about ${minutes} min`
  return (
    <ModuleFrame section="overview">
      <main className={styles.overview} data-course-overview>
        <div className={styles.eyebrow}>
          <GitBranch size={18} aria-hidden /> BRONCHOSCOPY / SPATIAL ANATOMY{' '}
          <span>Unpublished preview</span>
        </div>
        <header className={styles.hero}>
          <div>
            <h1>Bronchial branch tracing</h1>
            <p className={styles.subtitle}>
              Follow one lumen, establish the viewpoint, then build a route.
            </p>
            <p>
              Start with a short CT interval and one visible airway. Compare a demonstration with
              your own marks, show the reference whenever you want it, then relate the daughter
              branches to the view from their parent.
            </p>
            <Link
              className={styles.primary}
              href={`${BASE_PATH}/learn?lesson=${door.id}`}
              aria-disabled={!ready}
            >
              {!ready
                ? 'Loading your place'
                : !recommendation
                  ? 'Review the course'
                  : recommendation.kind === 'start'
                    ? 'Start learning'
                    : recommendation.kind === 'resume'
                      ? `Resume: ${door.title}`
                      : `Continue: ${door.title}`}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className={styles.small}>
              {map.lessons} lessons · about {map.estimatedMinutes} minutes by the authors’ estimate
              · every lesson open · {opened.length} opened and {reviewed.length} marked reviewed on
              this device
            </p>
            {ready && !recommendation && (
              <p className={styles.small} data-after-learn>
                Every lesson is marked reviewed on this device.{' '}
                <Link href={`${BASE_PATH}/practice`}>Practice</Link> is the suggested next step;
                every lesson stays open.
              </p>
            )}
            <p className={styles.namingKey} data-naming-key>
              <strong>Naming:</strong> {NAMING_KEY} {targetNaming(heroTarget).sentence}
            </p>
          </div>
          <TargetCtPreview traceId={HERO_TRACE} />
        </header>
        {status === 'unavailable' && (
          <p className={styles.notice} role="status">
            This browser is not saving your place. Every lesson and route set stays open.
          </p>
        )}
        {status === 'unreadable' && (
          <p className={styles.notice} role="status">
            Your saved place on this device could not be read, so it has been left untouched and
            nothing new is saved over it. Every lesson and route set stays open.
          </p>
        )}
        <div className={styles.introGrid}>
          <section>
            <h2>What you will practise</h2>
            <ul>
              <li>
                Keep the same air-filled lumen across adjacent 0.5 mm CT slices instead of switching
                to a nearby airway.
              </li>
              <li>
                Turn or reflect the CT display while keeping patient directions straight, and
                compare it with the parent airway view: the model camera looking down the parent
                airway.
              </li>
              <li>
                At each fork, choose the daughter that continues toward a named target and mark its
                lumen on CT.
              </li>
              <li>
                Recognise the four tracing patterns this course uses and relate each to the view
                from the parent airway.
              </li>
              <li>
                Plan a segmental airway approach to a simulated nodule and record where distal
                continuity stays uncertain.
              </li>
            </ul>
            <p className={styles.small}>
              New terms such as parent viewpoint and camera roll are defined in the course reference
              below and again where each is first used.
            </p>
          </section>
          <section>
            <h2>Before you begin</h2>
            <p>
              For PCCM and IP fellows and practicing bronchoscopists. Familiarity with lobar anatomy
              is helpful. Start with patient orientation if CT-to-scope correlation is new to you.
            </p>
            <p>
              Use a laptop for detailed CT and parent-view comparison. On narrow screens the task
              stays above the workspace; scrolling and touch controls remain available.
            </p>
          </section>
        </div>
        <section className={styles.courseMap} aria-labelledby="bbt-course-map" data-course-map>
          <h2 id="bbt-course-map">How the course is organised</h2>
          <ol>
            <li>
              <h3>
                <Link href={`${BASE_PATH}/learn?lesson=${LESSONS[0].id}`}>Learn</Link>
              </h3>
              <p>
                {map.lessons} lessons, about {map.estimatedMinutes} minutes in total by the authors’
                estimate: a planning aid, not a measured learner time. The suggested order is 1 to{' '}
                {map.lessons}, and every lesson is open.
              </p>
              <ul>
                {LESSON_GROUPS.map((group) => (
                  <li key={group.label}>
                    {group.ids.length > 1
                      ? `Lessons ${lessonNumber(group.ids[0])}–${lessonNumber(group.ids.at(-1)!)}`
                      : `Lesson ${lessonNumber(group.ids[0])}`}
                    : {group.label}
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <h3>
                <Link href={`${BASE_PATH}/practice`}>Practice</Link>
              </h3>
              <p>
                Full routes from the trachea to a simulated nodule in one of {map.practiceTargets}{' '}
                segments, or a mixed set of {map.mixedSet}. Suggested after Learn and open now. The
                reference is available at every junction.
                {routeDrafts.practice ? ' A Practice draft is saved on this device.' : ''}
              </p>
            </li>
            <li>
              <h3>
                <Link href={`${BASE_PATH}/assess`}>More routes</Link> (optional)
              </h3>
              <p>
                A mixed set of {map.moreRoutes} further routes in the same teaching CT:{' '}
                {moreRoutesSet()
                  .map((e) => e.target.segment.code)
                  .join(', ')}
                . {map.moreRoutesAlsoInLearn} of them also appear in{' '}
                {map.moreRoutesLearnLessons.map((n) => `Lesson ${n}`).join(' and ')} and{' '}
                {map.moreRoutesAlsoInPractice === map.moreRoutes
                  ? 'all'
                  : map.moreRoutesAlsoInPractice}{' '}
                can be chosen in Practice, so treat the set as a revisit, not a new patient or a
                test. The reference stays available.
                {routeDrafts.assess ? ' A More routes draft is saved on this device.' : ''}
              </p>
            </li>
          </ol>
          <p>
            In Learn, Practice and More routes you can show the reference before you mark, compare
            after you check, or continue without marking. Nothing is scored, and no lesson waits on
            a correct branch. All exercises use one teaching scan. Different targets in that scan do
            not demonstrate transfer to an unfamiliar patient CT.
          </p>
          <p>
            Educational spatial reasoning only. This module does not establish device reach,
            patient-specific routes, or independent procedural competence.
          </p>
        </section>
        <section className={styles.notice} aria-labelledby="bbt-course-reference">
          <h2 id="bbt-course-reference">Course reference</h2>
          <CourseReference disclosure={false} target={heroTarget} />
        </section>
        {savedForLater.length > 0 && (
          <section>
            <h2>Saved for later</h2>
            <ul>
              {savedForLater.map((lesson) => (
                <li key={lesson.id}>
                  <Link href={`${BASE_PATH}/learn?lesson=${lesson.id}`}>{lesson.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <div className={styles.sectionTitle}>
            <h2>Your lesson pathway</h2>
            <span>
              {reviewed.length}/{LESSONS.length} marked reviewed on this device
            </span>
          </div>
          <ol className={styles.lessonList}>
            {LESSONS.map((lesson, i) => {
              const pattern = patternFor(lesson.id)
              return (
                <li key={lesson.id}>
                  <span className={styles.lessonNumber}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <Link href={`${BASE_PATH}/learn?lesson=${lesson.id}`}>{lesson.title}</Link>
                    {pattern && <span className={styles.patternTag}>Pattern: {pattern.name}</span>}
                    <p>{lesson.objective}</p>
                  </div>
                  <span>
                    {record.reviewedLessonIds.includes(lesson.id) ? (
                      <>
                        <strong>Reviewed</strong> · {minutesEstimate(lesson.minutes)}
                      </>
                    ) : record.visitedLessonIds.includes(lesson.id) ? (
                      `Opened · ${minutesEstimate(lesson.minutes)}`
                    ) : (
                      minutesEstimate(lesson.minutes)
                    )}
                    {record.reviewLaterLessonIds.includes(lesson.id) ? ' · Saved for later' : ''}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className={styles.small}>
            Times are the authors’ estimates. Reviewed is your own note that you reached the end of
            a lesson; Saved for later is a bookmark. Neither is a result.
          </p>
        </section>
        <section className={styles.source}>
          <h2>Source and model limits</h2>
          <p>
            The four-pattern framework follows{' '}
            <a href={SOURCE.url} target="_blank" rel="noreferrer">
              {SOURCE.title}
            </a>
            , Chapter 1. The native CT was exported with 3D Slicer from the same source volume as
            the existing airway model. The textbook guides the method; its figures are not copied.
          </p>
          <p>
            Target nodules use the navigation trainer’s CT intensity compositor. They are authored
            teaching targets, not findings in the original scan. CT route planning does not confirm
            instrument reach or tool-in-lesion.
          </p>
          <p>
            This device keeps your place: the last lesson, lessons opened or finished, lessons saved
            for later, and a draft of your current marks, CT slice, orientation and viewing state so
            you can resume. Nothing is scored and hint use is not counted. Participation records
            from earlier versions stay on this device untouched and are not shown as progress. A
            changed lesson or annotation version explains why an older draft cannot be resumed.
            Saving failures are disclosed before you leave.
          </p>
        </section>
      </main>
    </ModuleFrame>
  )
}
