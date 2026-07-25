import { criticalCareActivityPhases, type CriticalCareActivityPhase } from '../activity'
import styles from './learning-module-v2.module.css'

const phaseLabels: Readonly<Record<CriticalCareActivityPhase, string>> = {
  recognize: 'Recognize',
  predict: 'Predict',
  act: 'Act',
  observe: 'Observe',
  explain: 'Explain',
  transfer: 'Transfer',
}

export interface ActivityStepperProps {
  readonly currentPhase: CriticalCareActivityPhase
  readonly completedPhases?: readonly CriticalCareActivityPhase[]
  readonly ariaLabel?: string
  readonly onPhaseSelect?: (phase: CriticalCareActivityPhase) => void
}

export function ActivityStepper({
  currentPhase,
  completedPhases,
  ariaLabel = 'Activity phases',
  onPhaseSelect,
}: ActivityStepperProps) {
  const currentIndex = criticalCareActivityPhases.indexOf(currentPhase)
  const completed = new Set(
    completedPhases ?? criticalCareActivityPhases.slice(0, Math.max(0, currentIndex)),
  )

  return (
    <div className={styles.stepper} role="group" aria-label={ariaLabel}>
      <ol className={styles.stepperList}>
        {criticalCareActivityPhases.map((phase, index) => {
          const isComplete = completed.has(phase)
          return (
            <li
              key={phase}
              className={styles.step}
              data-step={index + 1}
              data-complete={isComplete || undefined}
              aria-current={phase === currentPhase ? 'step' : undefined}
            >
              <span className={styles.stepLabel}>{phaseLabels[phase]}</span>
              {isComplete ? <span className="sr-only">, completed</span> : null}
              {onPhaseSelect && phase !== currentPhase ? (
                <button
                  type="button"
                  className={styles.stepJumpButton}
                  aria-label={`Open ${phaseLabels[phase]} phase`}
                  onClick={() => onPhaseSelect(phase)}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
