'use client'

import { ArrowRight, GitBranch } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { PRIMER, PRIMER_TITLE, TEACHING_SIMULATOR_STATEMENT } from '../content/bench-copy'
import { NAMING_KEY, NAMING_USE, patternFor } from '../content/course-guide'
import { BASE_PATH, SOURCE, lessonHref } from '../content/module'
import { LESSON_GROUPS, NAV_LESSONS, lessonNumber, totalMinutes } from '../content/nav-lessons'
import { ASSESS_TARGET_IDS, TARGET_IDS } from '../content/targets'
import { recommendedLesson } from '../engine/selfPacedProgress'
import { useSelfPacedProgress } from './useSelfPacedProgress'
import { ModuleFrame } from './ModuleFrame'
import { TargetCtPreview } from './TargetCtPreview'
import styles from './branch-tracing.module.css'

const HERO_TRACE = 'middle-lobe-caudal'

export function BranchTracingOverview() {
  const { ready, status, record } = useSelfPacedProgress()
  const recommendation = recommendedLesson(record)
  const reviewed = NAV_LESSONS.filter((l) => record.reviewedLessonIds.includes(l.id))
  const door = recommendation?.lesson ?? NAV_LESSONS[0]
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
              Read the route off the CT, then drive it with the scope.
            </p>
            <p>
              Branch tracing is how you plan a bronchoscopic route to a peripheral lesion before you
              scope. This course puts a virtual bronchoscope beside the axial CT. At every fork you
              turn the CT so it faces the way the scope does, find each opening on the CT, choose
              the one that leads toward the lesion, and drive on to the next fork, until the airway
              ends beside the lesion.
            </p>
            <Link className={styles.primary} href={lessonHref(door.id)} aria-disabled={!ready}>
              {!ready
                ? 'Loading your place'
                : !recommendation
                  ? 'Review the course'
                  : recommendation.kind === 'start'
                    ? 'Start lesson 1'
                    : `${recommendation.kind === 'resume' ? 'Resume' : 'Continue'}: ${door.title}`}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className={styles.small}>
              {NAV_LESSONS.length} lessons, about {totalMinutes()} minutes, then Practice on{' '}
              {TARGET_IDS.length} lesions. Every lesson is open. {reviewed.length} of{' '}
              {NAV_LESSONS.length} reached on this device.
            </p>
            <p className={styles.namingKey} data-naming-key>
              <strong>Names:</strong> {NAMING_KEY} {NAMING_USE}
            </p>
          </div>
          <TargetCtPreview traceId={HERO_TRACE} />
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
        <section>
          <div className={styles.sectionTitle}>
            <h2>Lessons</h2>
            <span>
              {reviewed.length}/{NAV_LESSONS.length} reached on this device
            </span>
          </div>
          {LESSON_GROUPS.map((group) => (
            <div key={group.label} data-lesson-group>
              <h3 className={styles.small}>{group.label}</h3>
              <ol className={styles.lessonList}>
                {group.ids.map((id) => {
                  const lesson = NAV_LESSONS.find((entry) => entry.id === id)!
                  const pattern = patternFor(id)
                  return (
                    <li key={id}>
                      <span className={styles.lessonNumber}>
                        {String(lessonNumber(id)).padStart(2, '0')}
                      </span>
                      <div>
                        <Link href={lessonHref(id)}>{lesson.title}</Link>
                        {pattern && (
                          <span className={styles.patternTag}>Pattern: {pattern.name}</span>
                        )}
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
        </section>
        <div className={styles.introGrid}>
          <section>
            <h2>
              <Link href={`${BASE_PATH}/practice`}>Practice: pick a lesion</Link>
            </h2>
            <p>
              {TARGET_IDS.length} simulated lesions across five lobes. Each route runs from the
              trachea to the lesion with the same four moves at every fork, and help on request.
            </p>
          </section>
          <section>
            <h2>
              <Link href={`${BASE_PATH}/assess`}>
                Closing set: {ASSESS_TARGET_IDS.length} lesions, no hints
              </Link>
            </h2>
            <p>
              Three routes in three lobes. Openings are numbered but not named until you have
              chosen, and a missed mark is told what it landed in, not which way to move.
            </p>
          </section>
        </div>
        <section className={styles.source}>
          <h2>What this is built on</h2>
          <p data-teaching-simulator-statement>{TEACHING_SIMULATOR_STATEMENT}</p>
          <p>
            The method and the four fork patterns follow{' '}
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
