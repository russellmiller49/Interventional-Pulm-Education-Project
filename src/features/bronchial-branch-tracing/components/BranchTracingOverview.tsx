'use client'

import { ArrowRight, GitBranch } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { BASE_PATH, LESSONS, nextLesson, SOURCE } from '../content/lessons'
import { completedLessons, progressVersionChanged } from '../engine/progress'
import { useDeviceProgress } from './useDeviceProgress'
import { ModuleFrame } from './ModuleFrame'
import styles from './branch-tracing.module.css'

export function BranchTracingOverview() {
  const { ready, progress } = useDeviceProgress()
  const completed = completedLessons(progress)
  const changed = progressVersionChanged(progress)
  const next = nextLesson(completed)
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
            <p className={styles.subtitle}>From CT to the bronchoscopic view</p>
            <p>
              Follow a lumen through neighboring slices. Build its branch map. Predict the next
              opening before looking from inside the parent airway.
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
                  : completed.length
                    ? `Continue: ${next.title}`
                    : 'Start learning'}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className={styles.small}>
              {LESSONS.length} lessons · about {LESSONS.reduce((n, l) => n + l.minutes, 0)} minutes
              · {completed.length} completed on this device
            </p>
          </div>
          <div className={styles.heroDiagram} aria-label="Learning sequence">
            <div>
              01 <strong>Follow the CT</strong>
              <span>Patient axes · lumen continuity</span>
            </div>
            <div>
              02 <strong>Build a branch map</strong>
              <span>Parent · siblings · destination</span>
            </div>
            <div>
              03 <strong>Predict the opening</strong>
              <span>View along the parent · account for roll</span>
            </div>
          </div>
        </header>
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
              <li>Maintain continuity of one airway across axial planes.</li>
              <li>Relate the four tracing patterns to the parent-airway viewpoint.</li>
              <li>Separate patient direction, camera roll, and screen position.</li>
              <li>Recognize variants and the limits of visible airway evidence.</li>
            </ul>
          </section>
          <section>
            <h2>Before you begin</h2>
            <p>
              For PCCM and IP fellows and practicing bronchoscopists. Familiarity with lobar anatomy
              is helpful. Start with patient orientation if CT-to-scope correlation is new to you.
            </p>
            <p>
              Lessons work on a phone. A larger screen helps with side-by-side comparison and real
              anatomy exploration.
            </p>
          </section>
        </div>
        <section className={styles.notice}>
          <h2>What this preview contains</h2>
          <p>
            The lessons use original synthetic airway geometry. The real CT explorer uses one
            existing teaching CT preview. Clinical subsegmental checkpoints and held-out clinical
            cases are awaiting review; synthetic exercise results do not establish skill on a new
            patient CT.
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
            , chapters 1–2, as mapped in the supplied planning documents. Lesson diagrams, geometry,
            exercises and scoring are original teaching constructs. No textbook plates are
            reproduced.
          </p>
          <p>
            Progress stays in this browser’s existing education progress store. Completed lessons
            and first-attempt outcomes are saved. Reloading restarts an incomplete lesson; image,
            camera and sketch state are not saved. English preview.
          </p>
        </section>
      </main>
    </ModuleFrame>
  )
}
