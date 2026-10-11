'use client'

import type { ReactNode } from 'react'
import { Check, Circle } from 'lucide-react'

import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import { CHAIN_STOPS } from '../../content/imagingChain'
import styles from './imaging-stage.module.css'

export interface ImagingTaskGoal {
  readonly label: string
  readonly met: boolean
}

/**
 * The text column of a hands-on step: what to do, what to watch, and the step's checklist, ticked as
 * each item is done on the image beside it.
 *
 * Owner feedback, 2026-10-11 (slide 5): on these steps the text column was an empty box and the
 * checklist was folded into the control dock, so the screen read as if an instruction had gone
 * missing. The checklist now has one home, here, where the reading starts.
 */
export function ImagingTaskCard({
  lead,
  goals,
  children,
}: {
  /** What to move and what to watch change. */
  readonly lead: string | null
  readonly goals: readonly ImagingTaskGoal[]
  /** Shown under the task, for a step that closes with a recap. */
  readonly children?: ReactNode
}) {
  const remaining = goals.filter((goal) => !goal.met).length
  return (
    <section className={styles.taskCard} data-task-card aria-label="What to do in this step">
      <p className={styles.kicker}>What to do</p>
      {lead ? <p data-task-lead>{lead}</p> : null}
      {goals.length > 0 ? (
        <ul className={stageStyles.taskList} data-step-goals aria-label="Checklist for this step">
          {goals.map((goal) => (
            <li key={goal.label} data-met={goal.met}>
              {goal.met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
              <span>{goal.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {/* Always present, so the completion is announced when it arrives. */}
      <p className={styles.taskHint} data-task-hint role="status">
        {goals.length > 0 && remaining === 0 ? 'Done. Continue when you are ready.' : ''}
      </p>
      {children}
    </section>
  )
}

/** The six components in order, for the end of the walk: one line each, nothing new. */
export function ImagingWalkRecap() {
  return (
    <div data-walk-recap>
      <p className={styles.kicker}>The six components, in order</p>
      <ol className={styles.walkRecap}>
        {CHAIN_STOPS.map((stop) => (
          <li key={stop.id}>
            <strong>{stop.title}</strong> <span>{stop.summary}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
