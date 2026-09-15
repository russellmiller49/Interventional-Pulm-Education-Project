'use client'

import { ArrowRight, GitBranch } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { BASE_PATH, LESSONS, SOURCE } from '../content/lessons'
import { recommendedLesson } from '../engine/selfPacedProgress'
import { useSelfPacedProgress } from './useSelfPacedProgress'
import { ModuleFrame } from './ModuleFrame'
import { TargetCtPreview } from './TargetCtPreview'
import styles from './branch-tracing.module.css'

export function BranchTracingOverview() {
  const { ready, status, record } = useSelfPacedProgress()
  const recommendation = recommendedLesson(record)
  const opened = LESSONS.filter((l) => record.visitedLessonIds.includes(l.id))
  const reviewed = LESSONS.filter((l) => record.reviewedLessonIds.includes(l.id))
  const savedForReview = LESSONS.filter((l) => record.reviewLaterLessonIds.includes(l.id))
  const door = recommendation?.lesson ?? LESSONS[0]
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
              {LESSONS.length} lessons · about {LESSONS.reduce((n, l) => n + l.minutes, 0)} minutes
              · every lesson open · {opened.length} opened and {reviewed.length} reviewed on this
              device
            </p>
          </div>
          <TargetCtPreview />
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
            <h2>What you will learn to do</h2>
            <ul>
              <li>Rotate or reflect standard axial CT while comparing the virtual airway view.</li>
              <li>Choose the continuing daughter at every fork and verify its lumen on CT.</li>
              <li>Relate the four tracing patterns to the parent-airway viewpoint.</li>
              <li>Separate patient direction, camera roll, and screen position.</li>
              <li>
                Plan a segmental airway approach to a nodule and record uncertain distal continuity.
              </li>
            </ul>
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
        <section className={styles.notice}>
          <h2>What this preview contains</h2>
          <p>
            Foundations isolate a single lumen or bifurcation. Local pattern exercises follow, then
            a three-division route and complete nodule approaches. In Learn, Practice and More
            routes you can show the reference before you mark, compare after you check, or continue
            without marking. Nothing is scored, and no lesson waits on a correct branch. All
            exercises use one teaching scan. Different targets in that scan do not demonstrate
            transfer to an unfamiliar patient CT.
          </p>
          <p>
            Educational spatial reasoning only. This module does not establish device reach,
            patient-specific routes, or independent procedural competence.
          </p>
        </section>
        {savedForReview.length > 0 && (
          <section>
            <h2>Saved for review</h2>
            <ul>
              {savedForReview.map((lesson) => (
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
              {reviewed.length}/{LESSONS.length} reviewed on this device
            </span>
          </div>
          <ol className={styles.lessonList}>
            {LESSONS.map((lesson, i) => (
              <li key={lesson.id}>
                <span className={styles.lessonNumber}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <Link href={`${BASE_PATH}/learn?lesson=${lesson.id}`}>{lesson.title}</Link>
                  <p>{lesson.objective}</p>
                </div>
                <span>
                  {record.reviewedLessonIds.includes(lesson.id)
                    ? 'Reviewed'
                    : record.visitedLessonIds.includes(lesson.id)
                      ? `Opened · ${lesson.minutes} min`
                      : `${lesson.minutes} min`}
                  {record.reviewLaterLessonIds.includes(lesson.id) ? ' · Saved for review' : ''}
                </span>
              </li>
            ))}
          </ol>
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
            for review, and a draft of your current marks, CT slice, orientation and viewing state
            so you can resume. Nothing is scored and hint use is not counted. Participation records
            from earlier versions stay on this device untouched and are not shown as progress. A
            changed lesson or annotation version explains why an older draft cannot be resumed.
            Saving failures are disclosed before you leave.
          </p>
        </section>
      </main>
    </ModuleFrame>
  )
}
