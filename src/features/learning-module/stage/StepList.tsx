'use client'

import { Check } from 'lucide-react'

import {
  STAGE_PHASE_LABELS,
  stepRowState,
  type StageLessonBase,
  type StageStepBase,
} from './stageModel'
import styles from './lesson-stage.module.css'

/**
 * The single progression.
 *
 * One ordered list, one `aria-current="step"`. A performed row collapses to its ordinal, phase and
 * title with a recap of what it changed; the current row is marked; the next row is reachable once
 * the current one is performed; everything further shows its ordinal and phase only — never its
 * title, because several titles name the fitting action and the list sits beside the prediction.
 * Selecting a performed row reviews it in place; nothing here re-runs an action.
 */
export function StepList<TStep extends StageStepBase<unknown>>({
  lesson,
  currentIndex,
  furthestPerformedIndex,
  performedStepIds,
  predictionCommitted,
  reviewIndex,
  recapFor,
  onSelect,
}: {
  readonly lesson: StageLessonBase<TStep>
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
        const rowState = stepRowState(
          step,
          index,
          currentIndex,
          furthestPerformedIndex,
          performedStepIds,
          predictionCommitted,
        )
        const performed = rowState === 'done'
        const current = index === currentIndex
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
              disabled={rowState === 'locked' || rowState === 'next'}
              onClick={() => onSelect(index)}
            >
              <span className={styles.stepOrdinal} aria-hidden="true">
                {performed ? <Check aria-hidden="true" /> : step.ordinal}
              </span>
              <span className={styles.stepText}>
                <span className={styles.stepPhase}>{STAGE_PHASE_LABELS[step.phase]}</span>
                {rowState === 'locked' ? (
                  <span className={styles.stepTitle}>Step {step.ordinal}</span>
                ) : (
                  <span className={styles.stepTitle}>{step.title}</span>
                )}
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
