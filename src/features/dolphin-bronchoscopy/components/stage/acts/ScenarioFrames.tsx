'use client'

import { useState } from 'react'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import { troubleRowById } from '../../../content/troubleGrammar'
import type { DolphinScenario } from '../../../content/types'
import { DolphinFrameImage } from '../DolphinFrameImage'
import styles from '../dolphin-stage.module.css'

/**
 * A case, frame by frame. The best choice advances; an unsafe choice is refused with its rationale
 * and the frame stays; any other shows its rationale and the learner chooses again. The first
 * choice of each frame is reported to the caller for the section's session only.
 */
export function ScenarioFrames({
  scenario,
  done,
  onFirstChoice,
  onDone,
}: {
  readonly scenario: DolphinScenario
  readonly done: boolean
  readonly onFirstChoice: (frameId: string, choiceId: string) => void
  readonly onDone: () => void
}) {
  const [index, setIndex] = useState(done ? scenario.frames.length - 1 : 0)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const frame = scenario.frames[index]
  const tried = picked[frame.id] ?? []
  const last = tried.at(-1)
  const lastChoice = frame.choices.find((choice) => choice.id === last)
  const resolved = lastChoice?.plausibility === 'best'
  const row = frame.troubleRowId ? troubleRowById.get(frame.troubleRowId) : undefined
  return (
    <section
      className={styles.question}
      aria-label="The case, frame by frame"
      data-scenario={scenario.id}
      data-frame-index={index}
    >
      <p className={styles.kicker}>
        {scenario.title} · Frame {index + 1} of {scenario.frames.length}
        {frame.time ? ` · ${frame.time}` : ''}
      </p>
      <p className={styles.situation}>{frame.situation}</p>
      {frame.media ? <DolphinFrameImage frameId={frame.media.frameId} revealed={resolved} /> : null}
      <p className={styles.stem}>{frame.prompt}</p>
      <div className={styles.rows}>
        {orderChoices(frame.id, frame.choices).map((choice) => {
          const chosen = tried.includes(choice.id)
          return (
            <button
              key={choice.id}
              type="button"
              className={styles.choice}
              disabled={resolved || chosen}
              aria-pressed={chosen}
              data-plausibility={chosen ? choice.plausibility : undefined}
              onClick={() => {
                if (tried.length === 0) onFirstChoice(frame.id, choice.id)
                setPicked((current) => ({
                  ...current,
                  [frame.id]: [...(current[frame.id] ?? []), choice.id],
                }))
              }}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
      {lastChoice ? (
        <p
          className={styles.note}
          data-tone={resolved ? 'done' : 'hint'}
          role={lastChoice.plausibility === 'unsafe' ? 'alert' : 'status'}
        >
          {resolved
            ? 'That move holds. '
            : lastChoice.plausibility === 'unsafe'
              ? 'Stop: that move could harm the animal. '
              : 'Not the first move here. '}
          {lastChoice.rationale}
          {!resolved ? ' Choose again.' : ''}
        </p>
      ) : null}
      {resolved && row ? (
        <p className={styles.rowFeedback} data-trouble-row={row.id}>
          <strong>{row.change}.</strong> Earliest sign: {row.earliestSign.toLowerCase()}. First
          moves: {row.firstMoves.join('; ').toLowerCase()}.
        </p>
      ) : null}
      {resolved ? (
        <div className={styles.actions}>
          {index < scenario.frames.length - 1 ? (
            <button
              type="button"
              className={styles.button}
              data-primary="true"
              onClick={() => setIndex(index + 1)}
            >
              Next frame
            </button>
          ) : done ? null : (
            <button
              type="button"
              className={styles.button}
              data-primary="true"
              onClick={onDone}
              data-scenario-done
            >
              Finish the case
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}
