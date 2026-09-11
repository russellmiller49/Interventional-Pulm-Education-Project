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
            <p className={styles.subtitle}>Follow the real airway, one CT slice at a time.</p>
            <p>
              Orient the CT using the book’s tracing conventions. Follow the air column, mark your
              route, then compare it on the same images.
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
          <figure className={styles.ctHero}>
            <svg
              viewBox="0 0 100 100"
              role="img"
              aria-label="Actual right-upper-lobe CT rotated 90 degrees counterclockwise"
            >
              <g transform="translate(50 50) rotate(-90) scale(.52) translate(-184 -305)">
                <image href="/branch-tracing/native-v1/axial/390.png" width="512" height="512" />
              </g>
              <text x="50" y="6" textAnchor="middle">
                L
              </text>
              <text x="50" y="97" textAnchor="middle">
                R
              </text>
              <text x="3" y="51">
                A
              </text>
              <text x="96" y="51">
                P
              </text>
            </svg>
            <figcaption>
              <strong>Right upper lobe · 90° counterclockwise</strong>
              <span>Real CT · native 0.5 mm slices</span>
            </figcaption>
          </figure>
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
              <li>Record a continuous trace and the limits of visible airway evidence.</li>
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
            Learn, Practice and Assess use actual CT slices from one teaching scan, with the
            appropriate reflection or rotation for each region. You mark the lumen yourself before
            seeing the source-derived comparison. Clinical grading awaits reviewed case checkpoints.
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
            Progress stays in this browser’s existing education progress store. Completed lessons
            and first-attempt participation are saved. Reloading restarts an incomplete lesson;
            image coordinates and camera state are not saved. CT interpretation is ungraded.
          </p>
        </section>
      </main>
    </ModuleFrame>
  )
}
