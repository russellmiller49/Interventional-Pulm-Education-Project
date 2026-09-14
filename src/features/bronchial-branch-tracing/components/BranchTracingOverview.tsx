'use client'

import { ArrowRight, GitBranch } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { BASE_PATH, LESSONS, nextLesson, SOURCE, lessonById, VERSION } from '../content/lessons'
import {
  completedLessons,
  progressVersionChanged,
  hasHistoricalOrientation,
} from '../engine/progress'
import { useDeviceProgress } from './useDeviceProgress'
import { ModuleFrame } from './ModuleFrame'
import { TargetCtPreview } from './TargetCtPreview'
import styles from './branch-tracing.module.css'

export function BranchTracingOverview() {
  const { ready, progress } = useDeviceProgress()
  const completed = completedLessons(progress)
  const changed = progressVersionChanged(progress)
  const resume =
    progress.resume?.payloadVersion === VERSION && progress.resume.pathname === `${BASE_PATH}/learn`
      ? lessonById(progress.resume.query?.lesson)
      : undefined
  const next = resume && !completed.includes(resume.id) ? resume : nextLesson(completed)
  return (
    <ModuleFrame section="overview">
      <main className={styles.overview}>
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
              your own marks, retry the same task, then relate the daughter branches to the view
              from their parent.
            </p>
            <Link
              className={styles.primary}
              href={
                next
                  ? `${BASE_PATH}/learn?lesson=${next.id}`
                  : `${BASE_PATH}/learn?lesson=${LESSONS[0].id}`
              }
              aria-disabled={!ready}
            >
              {!ready
                ? 'Loading progress'
                : !next
                  ? 'Review the course'
                  : completed.length || resume
                    ? `Continue: ${next.title}`
                    : 'Start learning'}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className={styles.small}>
              {LESSONS.length} lessons · about {LESSONS.reduce((n, l) => n + l.minutes, 0)} minutes
              · {completed.length} completed on this device
            </p>
          </div>
          <TargetCtPreview />
        </header>
        {hasHistoricalOrientation(progress) && !completed.includes('orientation') && (
          <p className={styles.notice}>
            Your earlier orientation participation is retained. The new observer comparison and
            same-airway application remain available to complete.
          </p>
        )}
        {changed && (
          <p className={styles.notice}>
            An earlier version’s history is retained. This version starts a new course record
            because its content, assets, or rubric changed.
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
            a three-division route and complete nodule approaches. Learn and Practice reveal
            comparisons after each recorded attempt; Assess keeps comparisons hidden until the set
            is submitted. All exercises use one teaching scan. Different targets in that scan do not
            demonstrate transfer to an unfamiliar patient CT.
          </p>
          <p>
            Educational spatial reasoning only. This module does not establish device reach,
            patient-specific routes, or independent procedural competence.
          </p>
        </section>
        <section>
          <div className={styles.sectionTitle}>
            <h2>Your lesson pathway</h2>
            <span>
              {completed.length}/{LESSONS.length} complete
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
                <span>{completed.includes(lesson.id) ? 'Completed' : `${lesson.minutes} min`}</span>
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
            Versioned drafts save your current exercise, answers, CT slice, orientation and viewing
            state on this device. Save & exit restores that draft when you reopen the lesson or the
            same Practice/Assess selection. First-attempt participation remains separate. A changed
            lesson or annotation version explains why an older draft cannot be resumed. Saving
            failures are disclosed before you leave. CT interpretation is ungraded.
          </p>
        </section>
      </main>
    </ModuleFrame>
  )
}
