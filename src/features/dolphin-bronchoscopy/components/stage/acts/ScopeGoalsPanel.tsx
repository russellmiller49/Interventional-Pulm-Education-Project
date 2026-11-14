'use client'

import { Check, Circle } from 'lucide-react'

import {
  scopeGoalHint,
  scopeGoalMet,
  scopeGoalsMet,
  visitedAbbrs,
  type ScopeGoal,
  type ScopeHistory,
} from '../../../engine/scopeGoals'
import styles from '../dolphin-stage.module.css'

/**
 * What the scope lab asks for, each goal ticked as the drive meets it, and the one hint that
 * applies now. A `hold-at` or `avoid` hint names the earliest sign and the first move.
 */
export function ScopeGoalsPanel({
  prompt,
  goals,
  history,
  showPlaces = true,
  onRestart,
}: {
  readonly prompt: string
  readonly goals: readonly ScopeGoal[]
  readonly history: ScopeHistory
  /** False in an identification drill: the place names would answer it. */
  readonly showPlaces?: boolean
  readonly onRestart: () => void
}) {
  const hint = scopeGoalHint(goals, history)
  const done = scopeGoalsMet(goals, history)
  return (
    <section className={styles.question} aria-label="Goals" data-landmark="Goals" data-scope-goals>
      <p className={styles.stem}>{prompt}</p>
      <ul className={styles.goals}>
        {goals.map((goal, index) => {
          const met = scopeGoalMet(goal, history)
          return (
            <li key={`${goal.kind}-${index}`} data-met={met} data-goal-kind={goal.kind}>
              {met ? (
                <Check aria-hidden="true" size={16} />
              ) : (
                <Circle aria-hidden="true" size={16} />
              )}
              <span>{goal.label}</span>
              <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
            </li>
          )
        })}
      </ul>
      {hint ? (
        <p className={styles.note} data-tone="hint" role="status" data-scope-hint>
          {hint}
        </p>
      ) : null}
      {done ? (
        <p className={styles.note} data-tone="done" role="status" data-scope-done>
          Goal reached. Continue when you are ready, or keep driving.
        </p>
      ) : null}
      {showPlaces && history.entries.length > 0 ? (
        <p className={styles.rowFeedback} data-scope-visited>
          Places so far: {visitedAbbrs(history).join(' · ')}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onRestart}>
          Back to the start
        </button>
      </div>
    </section>
  )
}
