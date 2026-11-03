'use client'

import { useState } from 'react'

import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'

import {
  MCS_ECHO_DEPTH_NUMBER_IDS,
  MCS_ECHO_POSITION,
  MCS_ECHO_REPOSITION_NUMBER_ID,
  MCS_ECHO_WORKED_EXAMPLE,
} from '../../content/impellaEchoPosition'
import { ReferenceValues } from '../teaching/shared'
import { mcsVerdictFrames } from './McsStageHost'
import styles from './mcs-stage.module.css'

/**
 * Section 5's guided introduction, carried from the cutaway to the echo image: where the two ends
 * sit on a long-axis view, the depth each pump is read against, and one malposition worked from
 * the picture to the first move.
 *
 * Built from the module's existing pieces: the depths print through `ReferenceValues`, so each
 * carries its register row and source, and the worked example uses the story problems' choice list
 * and verdict card. Choosing a move is view-state for the mount only; nothing is recorded.
 */
export function McsImpellaEchoPosition() {
  const { item } = MCS_ECHO_WORKED_EXAMPLE
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [committedId, setCommittedId] = useState<string | null>(null)
  const committedChoice = item.choices.find((choice) => choice.id === committedId)
  const legendId = `${item.id}-stem`

  return (
    <section aria-labelledby="mcs-echo-position-heading" data-echo-position>
      <h4 id="mcs-echo-position-heading" className="font-semibold">
        {MCS_ECHO_POSITION.title}
      </h4>
      <p data-echo-views>{MCS_ECHO_POSITION.views}</p>
      <ul data-echo-aligned>
        {MCS_ECHO_POSITION.aligned.map((finding) => (
          <li key={finding}>{finding}</li>
        ))}
      </ul>
      <ReferenceValues title={MCS_ECHO_POSITION.depthTitle} ids={MCS_ECHO_DEPTH_NUMBER_IDS}>
        <p className="mt-1 text-xs leading-5" data-echo-devices>
          {MCS_ECHO_POSITION.devices}
        </p>
      </ReferenceValues>
      <dl className={styles.definitionList} data-echo-malpositions>
        {MCS_ECHO_POSITION.malpositions.map((malposition) => (
          <div key={malposition.id} data-echo-malposition={malposition.id}>
            <dt>{malposition.term}</dt>
            <dd>{malposition.finding}</dd>
          </div>
        ))}
      </dl>

      <article className={styles.story} data-echo-worked-example>
        <h5 className="font-semibold">{MCS_ECHO_WORKED_EXAMPLE.title}</h5>
        <fieldset
          className={stageStyles.choiceList}
          disabled={Boolean(committedId)}
          aria-labelledby={legendId}
          data-echo-choices
        >
          <legend id={legendId}>{item.stem}</legend>
          {orderChoices(item.id, item.choices).map((choice) => (
            <label
              key={choice.id}
              className={stageStyles.choice}
              data-selected={selectedId === choice.id}
            >
              <input
                type="radio"
                name={item.id}
                value={choice.id}
                checked={selectedId === choice.id}
                onChange={() => setSelectedId(choice.id)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
        {committedChoice ? (
          <div className="grid gap-3" data-echo-verdict>
            <ChoiceReasoningFeedback
              choice={committedChoice}
              outcome="stated"
              frames={mcsVerdictFrames(item)}
              alternatives={item.choices}
              explanation={item.explanation}
              evidenceIds={item.evidenceIds}
            />
            <ReferenceValues
              title="The level while the position is corrected"
              ids={[MCS_ECHO_REPOSITION_NUMBER_ID]}
            />
            <div className={styles.optionalActions}>
              <button
                type="button"
                data-echo-try-again
                onClick={() => {
                  setSelectedId(null)
                  setCommittedId(null)
                }}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={shellStyles.nowPrimary}
            disabled={!selectedId}
            onClick={() => setCommittedId(selectedId)}
            data-echo-commit
          >
            Compare your move
          </button>
        )}
      </article>
    </section>
  )
}
