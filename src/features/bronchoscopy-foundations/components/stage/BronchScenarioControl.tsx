'use client'

import { useState } from 'react'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { BronchScenario, Plausibility } from '../../content/types'
import type { ScenarioCommitment } from '../../engine/stageSession'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'
import { MonitorPanel } from './MonitorPanel'

/**
 * A scenario in frames: the situation and the monitor's readings, one decision per frame. The
 * keyed decision moves the case to its next observation, because the next frame is what follows
 * that decision; an unsafe one is refused with its reasoning and the frame stays (A13, A32); any
 * other decision shows its reasoning and the frame can be decided again. The learner may open the
 * reasoning for the current frame without deciding (`revealed`), which records nothing and does not
 * move the case, and may leave the scenario at any time from the Now card.
 */
export function BronchScenarioControl({
  scenario,
  commitment,
  onChoice,
  integrated = false,
  baseline,
  revealed = false,
}: {
  readonly scenario: BronchScenario
  readonly commitment: ScenarioCommitment
  readonly onChoice: (frameId: string, choiceId: string, plausibility: Plausibility) => void
  readonly integrated?: boolean
  readonly baseline?: string
  readonly revealed?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [feedbackFrameId, setFeedbackFrameId] = useState<string | null>(null)
  const frame = scenario.frames[commitment.frameIndex]
  const previous =
    commitment.frameIndex > 0 ? scenario.frames[commitment.frameIndex - 1] : undefined
  const previousChoice = previous
    ? previous.choices.find((choice) => choice.id === commitment.lastChoices[previous.id])
    : undefined
  const lastId = frame ? commitment.lastChoices[frame.id] : undefined
  const last = frame && lastId ? frame.choices.find((choice) => choice.id === lastId) : undefined
  const lastOutcome = !last ? undefined : last.plausibility === 'unsafe' ? 'refused' : 'other'

  const feedbackFrame =
    integrated && feedbackFrameId
      ? scenario.frames.find((entry) => entry.id === feedbackFrameId)
      : null
  const feedbackChoice = feedbackFrame?.choices.find(
    (choice) => choice.id === commitment.lastChoices[feedbackFrame.id],
  )
  if (feedbackFrame && feedbackChoice && !commitment.done)
    return (
      <div className={styles.act} data-bronch-scenario={scenario.id}>
        <p>{feedbackFrame.situation}</p>
        <MonitorPanel readings={feedbackFrame.readings} caption={scenario.boundary} />
        <p role="status" data-scenario-feedback>
          <strong>Your action: {feedbackChoice.label}.</strong> {feedbackChoice.rationale}
        </p>
        <button
          type="button"
          data-scenario-continue
          className={styles.orderActions}
          onClick={() => setFeedbackFrameId(null)}
        >
          Continue to the next observation
        </button>
      </div>
    )

  if (!frame || commitment.done) {
    return (
      <div className={styles.act} data-bronch-scenario={scenario.id} data-scenario-done>
        <p className={styles.verdict}>
          <strong>{scenario.title}.</strong> You worked the case to its end.
        </p>
        <ol className={styles.frameSummary} data-scenario-summary>
          {scenario.frames.map((entry) => {
            const decision = entry.choices.find((choice) => choice.plausibility === 'best')
            return (
              <li key={entry.id} data-scenario-frame={entry.id}>
                <strong>{decision?.label}.</strong>
                <p>{decision?.rationale}</p>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div className={styles.act} data-bronch-scenario={scenario.id}>
      {!integrated && previous && previousChoice ? (
        <p className={styles.verdict} data-scenario-previous>
          <strong>Held.</strong> {previousChoice.rationale}
        </p>
      ) : null}
      <div
        className={styles.frame}
        data-scenario-frame={frame.id}
        data-scenario-position={commitment.frameIndex + 1}
        data-integrated-case={integrated || undefined}
      >
        <div data-case-observations>
          <p className={styles.kicker}>{scenario.title}</p>
          <p className={styles.verdict}>{frame.situation}</p>
          {integrated ? (
            <>
              {baseline ? (
                <p className={styles.boundaryLine} data-case-baseline>
                  <strong>Baseline.</strong> {baseline}
                </p>
              ) : null}
              <MonitorPanel readings={frame.readings} caption={scenario.boundary} />
            </>
          ) : null}
          {frame.media ? <MediaFigure media={frame.media} compact /> : null}
        </div>
        <div data-case-response>
          <fieldset className={styles.choices}>
            <legend>{frame.prompt}</legend>
            {orderChoices(frame.id, frame.choices).map((choice) => (
              <label
                key={choice.id}
                className={styles.choice}
                data-selected={selected === choice.id}
              >
                <input
                  type="radio"
                  name={`bronch-scenario-${scenario.id}-${frame.id}`}
                  value={choice.id}
                  checked={selected === choice.id}
                  onChange={() => setSelected(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className={styles.orderActions}
            data-scenario-decide
            disabled={!selected}
            onClick={() => {
              const choice = frame.choices.find((candidate) => candidate.id === selected)
              if (!choice) return
              setSelected(null)
              onChoice(frame.id, choice.id, choice.plausibility)
              if (integrated && choice.plausibility === 'best') setFeedbackFrameId(frame.id)
            }}
          >
            Decide
          </button>
          {!selected ? (
            <p className={styles.boundaryLine}>
              Choose an action to enable Decide, or open the reasoning for this observation.
            </p>
          ) : null}
          {last && lastOutcome ? (
            <p
              className={styles.verdict}
              data-scenario-outcome={lastOutcome}
              data-tone={lastOutcome}
            >
              <strong>
                {lastOutcome === 'refused'
                  ? 'Refused: that move is unsafe here, and the case does not move on with it.'
                  : 'Not the move to make first.'}
              </strong>{' '}
              {last.rationale} Decide again if you like.
            </p>
          ) : null}
          {revealed ? (
            <section
              className={styles.row}
              data-scenario-explanation={frame.id}
              aria-label="The reasoning for this observation"
            >
              <p className={styles.kicker}>The reasoning for this observation</p>
              <ul>
                {frame.choices.map((choice) => (
                  <li
                    key={choice.id}
                    data-best={choice.plausibility === 'best' ? 'true' : undefined}
                    data-unsafe={choice.plausibility === 'unsafe' ? 'true' : undefined}
                  >
                    <strong>{choice.label}</strong>
                    {choice.plausibility === 'best'
                      ? ' The move to make first.'
                      : choice.plausibility === 'unsafe'
                        ? ' Unsafe.'
                        : ''}{' '}
                    {choice.rationale}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      <p className={styles.boundaryLine} data-model-boundary>
        {scenario.boundary}
      </p>
    </div>
  )
}
