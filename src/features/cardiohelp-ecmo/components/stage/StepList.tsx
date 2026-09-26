'use client'

import { Check } from 'lucide-react'

import { STAGE_PHASE_LABELS, type StageLesson } from './stageModel'
import styles from './EcmoLessonStage.module.css'

export type StepRowState = 'done' | 'current' | 'next' | 'locked'

/** Open task outline. A done marker reflects an actual performed interaction, never a skip. */
export function StepList({
  lesson,
  currentIndex,
  performedStepIds,
  reviewIndex,
  recapFor,
  onSelect,
}: {
  readonly lesson: StageLesson
  readonly currentIndex: number
  readonly furthestPerformedIndex: number
  readonly performedStepIds: ReadonlySet<string>
  readonly predictionCommitted: boolean
  readonly reviewIndex: number | null
  readonly recapFor: (stepIndex: number) => readonly string[]
  readonly onSelect: (stepIndex: number) => void
}) {
  return (
    <ol className={styles.stepList} aria-label="Lesson steps" data-step-list>
      {lesson.steps.map((step, index) => {
        const performed = performedStepIds.has(step.id)
        const current = index === currentIndex
        const rowState: StepRowState = performed ? 'done' : current ? 'current' : 'next'
        const reviewing = reviewIndex === index && performed
        const recap = reviewing ? recapFor(index) : []
        return (
          <li
            key={step.id}
            className={styles.stepRow}
            data-step-state={rowState}
            data-step-id={step.id}
          >
            <button
              type="button"
              className={styles.stepButton}
              aria-current={current ? 'step' : undefined}
              aria-expanded={performed ? reviewing : undefined}
              onClick={() => onSelect(index)}
            >
              <span className={styles.stepOrdinal} aria-hidden="true">
                {performed ? <Check aria-hidden="true" /> : step.ordinal}
              </span>
              <span className={styles.stepText}>
                <span className={styles.stepPhase}>
                  {step.foundationTask ? `Task ${step.ordinal}` : STAGE_PHASE_LABELS[step.phase]}
                </span>
                {/*
                  A step the learner has not reached shows its phase and ordinal only. Reached
                  steps show their title; unreached ones would otherwise paint the fitting action
                  beside the question that asks for it.
                */}
                <span className={styles.stepTitle}>{step.title}</span>
              </span>
            </button>
            {reviewing ? (
              <div className={styles.stepRecap} data-step-recap>
                {recap.length > 0 ? (
                  <ul>
                    {recap.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Done. Nothing on the simulator changed for this step.</p>
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
