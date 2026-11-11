'use client'

import { ArrowRight, GitBranch, Play } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { PRIMER, PRIMER_TITLE, TEACHING_SIMULATOR_STATEMENT } from '../content/bench-copy'
import { METHOD_STEPS, NAMING_KEY, NAMING_USE } from '../content/course-guide'
import { BASE_PATH, METHOD_SOURCE, SOURCE, lessonHref } from '../content/module'
import {
  ALL_LESSONS,
  LESSON_GROUPS,
  NAV_LESSONS,
  ORIENTATION_CHECK,
  lessonNumber,
  totalMinutes,
} from '../content/nav-lessons'
import { ASSESS_TARGET_IDS, TARGET_IDS } from '../content/targets'
import { ROLL_MINUTES, ROLL_OBJECTIVE, ROLL_TITLE } from '../content/roll-copy'
import { DEMO_LESSON_ID } from '../engine/demo-script'
import { ROLL_DRILL_ID } from '../engine/roll-drill'
import { recommendedLesson } from '../engine/selfPacedProgress'
import { CruiseChoice } from './CruiseChoice'
import { useSelfPacedProgress } from './useSelfPacedProgress'
import { ModuleFrame } from './ModuleFrame'
import { TargetCtPreview } from './TargetCtPreview'
import styles from './branch-tracing.module.css'
// Kept last: the poster draws with the bench's map, and the bench's stylesheet has to load
// after the frame's.
import { MethodPoster } from './MethodPoster'

const HERO_TRACE = 'middle-lobe-caudal'

export function BranchTracingOverview() {
  const { ready, status, record } = useSelfPacedProgress()
  const recommendation = recommendedLesson(record)
  const reviewed = NAV_LESSONS.filter((l) => record.reviewedLessonIds.includes(l.id))
  // A first visit opens on the optional orientation check, with planning one link away.
  const firstVisit = recommendation?.kind === 'start'
  const door = firstVisit ? ORIENTATION_CHECK : (recommendation?.lesson ?? NAV_LESSONS[0])
  return (
    <ModuleFrame section="overview">
      <main className={styles.overview} data-course-overview>
        <div className={styles.eyebrow}>
          <GitBranch size={18} aria-hidden /> BRONCHOSCOPY / SPATIAL ANATOMY
        </div>
        <header className={styles.hero}>
          <div>
            <h1>Bronchial branch tracing</h1>
            <p className={styles.subtitle}>
              Plan from the lesion back, draw the map, then drive it with the scope.
            </p>
            <p>
              Branch tracing is how you plan a bronchoscopic route to a peripheral lesion before you
              scope. This course teaches the simplified method: find the airway that runs into the
              lesion, follow it back to its segmental bronchus, draw that segment’s ostium as a
              circle with four directions, and draw each division to the lesion as arcs nested in
              the one before. Then a virtual bronchoscope flies through the central airways, and
              past the segment your map chooses each opening.
            </p>
            <Link className={styles.primary} href={lessonHref(door.id)} aria-disabled={!ready}>
              {!ready
                ? 'Loading your place'
                : !recommendation
                  ? 'Review the course'
                  : firstVisit
                    ? 'Start with the orientation check'
                    : `${recommendation.kind === 'resume' ? 'Resume' : 'Continue'}: ${door.title}`}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              className={`${styles.posterLink} ${styles.watchFirst}`}
              href={lessonHref(DEMO_LESSON_ID)}
              data-watch-method
            >
              <Play size={15} aria-hidden /> Watch the method first, about 2 minutes
            </Link>
            {ready && firstVisit && (
              <p className={styles.small} data-skip-check>
                Three forks, about {ORIENTATION_CHECK.minutes} minutes: turn the CT to face the way
                the scope does. It is optional.{' '}
                <Link href={lessonHref(NAV_LESSONS[0].id)}>Skip to planning: lesson 1</Link>
              </p>
            )}
            <p className={styles.small}>
              {NAV_LESSONS.length} lessons, about {totalMinutes()} minutes, then Practice on{' '}
              {TARGET_IDS.length} lesions. Every lesson is open. {reviewed.length} of{' '}
              {NAV_LESSONS.length} reached on this device.
            </p>
            <p className={styles.namingKey} data-naming-key>
              <strong>Names:</strong> {NAMING_KEY} {NAMING_USE}
            </p>
          </div>
          <div className={styles.heroSide}>
            <TargetCtPreview traceId={HERO_TRACE} />
            <MethodPoster />
          </div>
        </header>
        {status === 'unavailable' && (
          <p className={styles.notice} role="status">
            This browser is not saving your place. Every lesson and route stays open.
          </p>
        )}
        {status === 'unreadable' && (
          <p className={styles.notice} role="status">
            Your saved place on this device could not be read, so it has been left untouched and
            nothing new is saved over it. Every lesson and route stays open.
          </p>
        )}
        <section className={styles.courseMap} aria-labelledby="bbt-why" data-course-primer>
          <h2 id="bbt-why">{PRIMER_TITLE}</h2>
          {PRIMER.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
        <section className={styles.courseMap} aria-labelledby="bbt-method" data-method-steps>
          <h2 id="bbt-method">The method in five steps</h2>
          <ol>
            {METHOD_STEPS.map((step) => (
              <li key={step.name}>
                <strong>{step.name}.</strong> {step.what}
              </li>
            ))}
          </ol>
        </section>
        <section>
          <div className={styles.sectionTitle}>
            <h2>Lessons</h2>
            <span>
              {reviewed.length}/{NAV_LESSONS.length} reached on this device
            </span>
          </div>
          <CruiseChoice />
          {LESSON_GROUPS.map((group) => (
            <div key={group.label} data-lesson-group>
              <h3 className={styles.small}>{group.label}</h3>
              <ol className={styles.lessonList}>
                {group.ids.map((id) => {
                  const lesson = ALL_LESSONS.find((entry) => entry.id === id)!
                  return (
                    <li key={id}>
                      <span className={styles.lessonNumber}>
                        {/* The check and the refreshers are off the numbered course. */}
                        {lessonNumber(id) ? String(lessonNumber(id)).padStart(2, '0') : '·'}
                      </span>
                      <div>
                        <Link href={lessonHref(id)}>{lesson.title}</Link>
                        <p>{lesson.objective}</p>
                      </div>
                      <span>
                        {record.reviewedLessonIds.includes(id) ? (
                          <>
                            <strong>Reached the end</strong> · about {lesson.minutes} min
                          </>
                        ) : record.visitedLessonIds.includes(id) ? (
                          `Opened · about ${lesson.minutes} min`
                        ) : (
                          `about ${lesson.minutes} min`
                        )}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
          {/* Not a lesson group: the drill is beside the course, not one of its lessons. */}
          <div data-drill>
            <h3 className={styles.small}>Drill, after the lessons</h3>
            <ol className={styles.lessonList}>
              <li>
                <span className={styles.lessonNumber}>·</span>
                <div>
                  <Link href={lessonHref(ROLL_DRILL_ID)}>{ROLL_TITLE}</Link>
                  <p>{ROLL_OBJECTIVE}</p>
                </div>
                <span>
                  {record.reviewedLessonIds.includes(ROLL_DRILL_ID) ? (
                    <>
                      <strong>Reached the end</strong> · about {ROLL_MINUTES} min
                    </>
                  ) : record.visitedLessonIds.includes(ROLL_DRILL_ID) ? (
                    `Opened · about ${ROLL_MINUTES} min`
                  ) : (
                    `about ${ROLL_MINUTES} min`
                  )}
                </span>
              </li>
            </ol>
          </div>
        </section>
        <div className={styles.introGrid}>
          <section>
            <h2>
              <Link href={`${BASE_PATH}/practice`}>Practice: pick a lesion</Link>
            </h2>
            <p>
              {TARGET_IDS.length} simulated lesions across five lobes. Plan each from the lesion
              back, draw its map, then drive it, with help on request.
            </p>
          </section>
          <section>
            <h2>
              <Link href={`${BASE_PATH}/assess`}>
                Closing set: {ASSESS_TARGET_IDS.length} lesions, no hints
              </Link>
            </h2>
            <p>
              Three lesions in three lobes, planned, mapped and driven on your own. Openings are
              numbered but not named until you have chosen, and a check says only whether it fits.
            </p>
          </section>
        </div>
        <section className={styles.source}>
          <h2>What this is built on</h2>
          <p data-teaching-simulator-statement>{TEACHING_SIMULATOR_STATEMENT}</p>
          <p>
            The method follows{' '}
            <a href={METHOD_SOURCE.url} target="_blank" rel="noreferrer">
              {METHOD_SOURCE.title}
            </a>
            . The scope’s roll at each division and the airway names follow{' '}
            <a href={SOURCE.url} target="_blank" rel="noreferrer">
              {SOURCE.title}
            </a>
            . The CT is one real scan at 0.5 mm slices; the scope view is the airway surface
            segmented from that same scan, and the lesions are simulated on it. For PCCM and IP
            fellows and practicing bronchoscopists; a laptop screen shows the scope and CT side by
            side.
          </p>
        </section>
      </main>
    </ModuleFrame>
  )
}
