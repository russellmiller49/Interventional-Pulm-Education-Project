'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'

import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'

import { orderChoices } from '../../content/choiceOrder'
import type { EcmoStoryProblem } from '../../content/storyProblems'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import shellStyles from '../shell/EcmoActivityShell.module.css'
import styles from './EcmoLessonStage.module.css'

/**
 * The story problems of a foundation section, on its Observe step.
 *
 * Each story is predict → commit → reveal → run: the learner commits which axis the colleague's
 * change moves, reads the rationale, then runs the same change on the circuit from the clean
 * reference and reads the four values. Commitment is view state for this mount only; nothing is
 * scored or stored. The choice order is rotated per item like every other choice list.
 */
const READING_LABELS: Readonly<Record<EcmoStoryProblem['triad'][number], string>> = {
  paCO2: 'PaCO₂',
  pH: 'pH',
  spo2: 'SpO₂',
  bloodFlow: 'Circuit flow',
}

function reading(state: EcmoSimulationState, key: EcmoStoryProblem['triad'][number]): string {
  switch (key) {
    case 'paCO2':
      return `${state.patient.paCO2.toFixed(1)} mm Hg`
    case 'pH':
      return state.patient.pH.toFixed(2)
    case 'spo2':
      return state.patient.spo2.toFixed(1)
    case 'bloodFlow':
      return `${state.circuit.bloodFlow.toFixed(2)} L/min`
    default:
      return ''
  }
}

export function FoundationStoryProblems({
  stories,
  state,
  ranActionIds,
  onRun,
}: {
  readonly stories: readonly EcmoStoryProblem[]
  readonly state: EcmoSimulationState
  /** Guided actions run since the last restore, so "run it" can show the reading it produced. */
  readonly ranActionIds: readonly string[]
  readonly onRun: (guidedActionId: string) => void
}) {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [committed, setCommitted] = useState<Record<string, string>>({})
  if (stories.length === 0) return null

  return (
    <section
      className={styles.storyProblems}
      aria-labelledby="story-problems-heading"
      data-story-problems
    >
      <h3 id="story-problems-heading">Two story problems</h3>
      <p className={styles.storyIntro}>
        A colleague has just moved one of the two controls for a reason that sounds sensible. Commit
        which values move before the circuit responds, then run the same change and read it.
      </p>
      {stories.map((story) => {
        const committedId = committed[story.id]
        const committedChoice = story.item.choices.find((choice) => choice.id === committedId)
        const ran = ranActionIds.includes(story.runGuidedActionId)
        return (
          <article key={story.id} className={styles.storyCard} data-story={story.id}>
            <h4>{story.title}</h4>
            <fieldset
              className={styles.choiceList}
              disabled={Boolean(committedChoice)}
              aria-labelledby={`${story.id}-stem`}
              data-story-choices
            >
              <legend id={`${story.id}-stem`}>{story.item.stem}</legend>
              {orderChoices(story.item.id, story.item.choices).map((choice) => (
                <label
                  key={choice.id}
                  className={styles.choice}
                  data-selected={selected[story.id] === choice.id}
                >
                  <input
                    type="radio"
                    name={`story-${story.id}`}
                    value={choice.id}
                    checked={selected[story.id] === choice.id}
                    onChange={() =>
                      setSelected((current) => ({ ...current, [story.id]: choice.id }))
                    }
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
            {!committedChoice ? (
              <button
                type="button"
                className={shellStyles.nowPrimary}
                disabled={!selected[story.id]}
                onClick={() =>
                  setCommitted((current) => ({ ...current, [story.id]: selected[story.id] ?? '' }))
                }
              >
                Commit this prediction
              </button>
            ) : (
              <div className="grid gap-3" data-story-verdict>
                <ChoiceReasoningFeedback
                  choice={committedChoice}
                  explanation={story.item.explanation}
                  evidenceIds={story.item.evidenceIds}
                />
                <button
                  type="button"
                  className={shellStyles.nowSecondary}
                  onClick={() => onRun(story.runGuidedActionId)}
                  data-story-run
                >
                  <Play aria-hidden="true" /> {ran ? 'Run it again' : 'Run it on the circuit'}
                </button>
                {ran ? (
                  <dl className={styles.storyTriad} aria-label="What the circuit shows now">
                    {story.triad.map((key) => (
                      <div key={key}>
                        <dt>{READING_LABELS[key]}</dt>
                        <dd>{reading(state, key)}</dd>
                      </div>
                    ))}
                    <p className={styles.storyVerdict} data-story-axis-verdict>
                      {story.axisVerdict}
                    </p>
                  </dl>
                ) : null}
                <EcmoSourceList
                  compact
                  evidenceIds={story.item.evidenceIds}
                  title="Sources"
                  headingLevel={5}
                />
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
