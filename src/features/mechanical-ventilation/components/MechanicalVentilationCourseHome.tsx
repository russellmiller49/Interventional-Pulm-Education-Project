'use client'

import type { Route } from 'next'
import { ArrowRight, CheckCircle2, Clock3, RotateCcw } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  ventilationCourseMinutes,
  ventilationLearningUnits,
  ventilationObjectives,
  ventilationStages,
  ventilationUnitHref,
} from '../content/learningCurriculum'
import { mechanicalVentilationCases } from '../content/runtimeCases'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import { nextVentilationUnit, ventilationReviewQueue } from '../engine/learningProgress'
import { VentilationBreathExplorer } from './VentilationLearningVisuals'
import { useVentilationLearningProgress } from './useVentilationLearningProgress'
import styles from './ventilation-course.module.css'

export function MechanicalVentilationCourseHome() {
  const { progress, ready, storageAvailable } = useVentilationLearningProgress()
  const next = nextVentilationUnit(progress)
  const complete = ventilationLearningUnits.filter(
    (unit) => progress.units[unit.id]?.completedAt,
  ).length
  const remaining = ventilationLearningUnits
    .filter((unit) => !progress.units[unit.id]?.completedAt)
    .reduce((total, unit) => total + unit.minutes, 0)
  const review = ventilationReviewQueue(progress)
  const started = next && !!progress.units[next.id]
  return (
    <div className={styles.course}>
      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="ventilation-course-title">
          <div>
            <p className={styles.eyebrow}>A bedside reasoning course</p>
            <h1 id="ventilation-course-title">
              Every setting.
              <br />
              One patient.
              <br />A reason why.
            </h1>
            <p className={styles.lead}>
              Learn to read a breath, explain what changed, and choose what to check next. Build the
              reasoning before taking the controls.
            </p>
            <p className={styles.muted}>
              For residents, fellows, and ICU clinicians. Assumes basic respiratory anatomy, oxygen
              saturation, and blood gases. New to ventilation? Start with the first breath.
            </p>
            <div className={styles.meta}>
              <span>
                <Clock3 size={15} aria-hidden="true" />
                About {ventilationCourseMinutes} min · short units
              </span>
              <span>
                {ventilationLearningUnits.length} units · {mechanicalVentilationCases.length}{' '}
                practice cases
              </span>
              {complete > 0 && <span>About {remaining} min remaining</span>}
            </div>
            <div className={styles.actions} aria-busy={!ready}>
              {ready ? (
                <Link
                  className={styles.primary}
                  href={
                    (next
                      ? ventilationUnitHref(next.id)
                      : '/mechanical-ventilation/assess') as Route
                  }
                >
                  {next
                    ? `${started ? 'Resume' : complete ? 'Continue' : 'Start'} — ${next.shortTitle}`
                    : 'Continue — Final check'}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <span className={styles.muted} role="status">
                  Finding your next step…
                </span>
              )}
            </div>
            <div className={styles.actions}>
              <Link
                href={'/mechanical-ventilation/learn?entry=placement' as Route}
                className={styles.textLink}
              >
                Have experience? Find your starting level
              </Link>
              <a href="#learning-path" className={styles.textLink}>
                Browse all {ventilationLearningUnits.length} units
              </a>
            </div>
          </div>
          <VentilationBreathExplorer compact />
        </section>
        <section className={styles.outcomes} aria-label="What you will be able to decide">
          {ventilationObjectives.map((objective, index) => (
            <div key={objective.id}>
              <span className={styles.index}>0{index + 1}</span>
              <h2>{objective.title}</h2>
              <p>{objective.description}</p>
            </div>
          ))}
        </section>
        {!storageAvailable && (
          <p className={`${styles.notice} ${styles.warning}`} role="status">
            Saved progress is unavailable in this browser. You can keep learning in this session.
          </p>
        )}
        {ready && review.length > 0 && (
          <div className={styles.notice}>
            <RotateCcw size={16} aria-hidden="true" style={{ display: 'inline', marginRight: 8 }} />
            <strong>{review.length} concepts ready to revisit.</strong> Your missed, uncertain, and
            spaced questions are waiting.{' '}
            <Link
              className={styles.textLink}
              href={'/mechanical-ventilation/learn?entry=review' as Route}
            >
              Open your review
            </Link>
          </div>
        )}
        <section id="learning-path" aria-labelledby="learning-path-title">
          <div className={styles.pathHeader}>
            <div>
              <p className={styles.eyebrow}>Your learning path</p>
              <h2 id="learning-path-title">From a breath to a bedside decision.</h2>
              <p className={styles.muted}>
                Each unit: recall → learn → worked example → decide → transfer.
              </p>
            </div>
            <div>
              <p className={styles.muted}>
                {complete} of {ventilationLearningUnits.length} units completed
              </p>
              <progress
                className={styles.progress}
                value={complete}
                max={ventilationLearningUnits.length}
                aria-label="Learning path completion"
              />
            </div>
          </div>
          {ventilationStages.map((stage, stageIndex) => {
            const units = ventilationLearningUnits.filter((unit) => unit.stage === stage.id)
            return (
              <section
                className={styles.stage}
                key={stage.id}
                aria-labelledby={`stage-${stage.id}`}
              >
                <div>
                  <p className={styles.eyebrow}>
                    Stage {stageIndex + 1} · {units.reduce((sum, unit) => sum + unit.minutes, 0)}{' '}
                    min
                  </p>
                  <h3 id={`stage-${stage.id}`}>{stage.title}</h3>
                  <p className={styles.muted}>{stage.description}</p>
                </div>
                <ol>
                  {units.map((unit) => {
                    const record = progress.units[unit.id]
                    const done = !!record?.completedAt
                    return (
                      <li key={unit.id}>
                        <Link
                          className={styles.unitLink}
                          data-next={next?.id === unit.id}
                          href={ventilationUnitHref(unit.id) as Route}
                        >
                          <span className={styles.index}>
                            {done ? (
                              <CheckCircle2 size={18} aria-label="Completed" />
                            ) : (
                              String(ventilationLearningUnits.indexOf(unit) + 1).padStart(2, '0')
                            )}
                          </span>
                          <span>
                            <strong>{unit.title}</strong>
                            <small>
                              {unit.minutes} min ·{' '}
                              {unit.stage === 'application' || unit.stage === 'integration'
                                ? 'Apply and check'
                                : 'Learn and try'}
                            </small>
                          </span>
                          <span className={styles.unitStatus}>
                            {done
                              ? 'Completed'
                              : record
                                ? 'In progress'
                                : next?.id === unit.id
                                  ? 'Your next step →'
                                  : 'Not started'}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </section>
        <div className={styles.bottomGrid}>
          <section className={styles.card}>
            <p className={styles.eyebrow}>Practice and transfer</p>
            <h2>Take the reasoning to a full case.</h2>
            <p className={styles.muted}>
              {mechanicalVentilationCases.length} clinical teaching cases and{' '}
              {ventilatorDeviceProfiles.length} training consoles. Practice combines the mechanisms
              you have learned, with guidance you can adjust.
            </p>
            <div className={styles.actions}>
              <Link className={styles.secondary} href={'/mechanical-ventilation/practice' as Route}>
                Explore case practice <ArrowRight size={16} />
              </Link>
            </div>
          </section>
          <section className={styles.card}>
            <p className={styles.eyebrow}>After the learning path</p>
            <h2>Check your reasoning independently.</h2>
            <p className={styles.muted}>
              A mixed set with feedback at the end. It becomes available when every unit’s decisions
              and feedback have been reviewed.
            </p>
            <div className={styles.actions}>
              <Link className={styles.textLink} href={'/mechanical-ventilation/assess' as Route}>
                View the final check and prerequisites
              </Link>
            </div>
          </section>
        </div>
        <p className={styles.notice}>
          This course develops clinical reasoning at the “knows how” level. It does not establish
          competence to manage ventilation independently. Device operation, emergency procedures,
          and bedside adjustment require supervised practice. Neonatal ventilation and ventilator
          liberation are outside this course.
        </p>
      </div>
    </div>
  )
}
