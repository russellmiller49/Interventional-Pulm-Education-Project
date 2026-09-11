'use client'

import { useState } from 'react'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import type { BronchScenario, Plausibility } from '../../content/types'
import type { ScenarioCommitment } from '../../engine/stageSession'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'

/**
 * A scenario in frames: the situation and the monitor's readings, one decision per frame. The
 * keyed decision advances the scenario; an unsafe one is refused with its reasoning and the frame
 * stays — it can never complete the step (A13, A32); any other decision shows its reasoning and
 * the frame is decided again. The first decision on each frame is the one kept.
 */
export function BronchScenarioControl({
  scenario,
  commitment,
  onChoice,
}: {
  readonly scenario: BronchScenario
  readonly commitment: ScenarioCommitment
  readonly onChoice: (frameId: string, choiceId: string, plausibility: Plausibility) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const frame = scenario.frames[commitment.frameIndex]
  const previous =
    commitment.frameIndex > 0 ? scenario.frames[commitment.frameIndex - 1] : undefined
  const previousChoice = previous
    ? previous.choices.find((choice) => choice.id === commitment.lastChoices[previous.id])
    : undefined
  const lastId = frame ? commitment.lastChoices[frame.id] : undefined
  const last = frame && lastId ? frame.choices.find((choice) => choice.id === lastId) : undefined
  const lastOutcome = !last ? undefined : last.plausibility === 'unsafe' ? 'refused' : 'other'

  if (!frame || commitment.done) {
    return (
      <div className={styles.act} data-bronch-scenario={scenario.id} data-scenario-done>
        <p className={styles.verdict}>
          <strong>{scenario.title}.</strong> Every frame decided.
        </p>
        <ol className={styles.frameSummary} data-scenario-summary>
          {scenario.frames.map((entry) => {
            const first = entry.choices.find(
              (choice) => choice.id === commitment.firstChoices[entry.id],
            )
            const held = first?.plausibility === 'best'
            return (
              <li
                key={entry.id}
                data-scenario-frame={entry.id}
                data-outcome={held ? 'held' : 'other'}
              >
                {first?.label ?? 'No decision kept'} — {held ? 'held.' : 'did not hold at first.'}
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div className={styles.act} data-bronch-scenario={scenario.id}>
      {previous && previousChoice ? (
        <p className={styles.verdict} data-scenario-previous>
          <strong>Held.</strong> {previousChoice.rationale}
        </p>
      ) : null}
      <div
        className={styles.frame}
        data-scenario-frame={frame.id}
        data-scenario-position={commitment.frameIndex + 1}
      >
        <p className={styles.kicker}>{scenario.title}</p>
        <p className={styles.verdict}>{frame.situation}</p>
        {frame.media ? <MediaFigure media={frame.media} compact /> : null}
        <fieldset className={styles.choices}>
          <legend>{frame.prompt}</legend>
          {orderChoices(frame.id, frame.choices).map((choice) => (
            <label key={choice.id} className={styles.choice} data-selected={selected === choice.id}>
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
          }}
        >
          Decide
        </button>
        {last && lastOutcome ? (
          <p className={styles.verdict} data-scenario-outcome={lastOutcome} data-tone={lastOutcome}>
            <strong>
              {lastOutcome === 'refused'
                ? 'Refused: that move is unsafe here, and cannot complete this step.'
                : 'Not the move to make first.'}
            </strong>{' '}
            {last.rationale} Decide again.
          </p>
        ) : null}
      </div>
      <p className={styles.boundaryLine} data-model-boundary>
        {scenario.boundary}
      </p>
    </div>
  )
}
