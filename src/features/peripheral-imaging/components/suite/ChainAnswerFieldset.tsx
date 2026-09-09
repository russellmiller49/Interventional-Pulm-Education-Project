'use client'

import { chainStop } from '../../content/imagingChain'
import styles from './suite-fallback.module.css'
import { chainChoiceInputId, SUITE_DOM, type ChainAnswer } from './types'

/**
 * The answer control for a prediction answered on the chain: one native radio group.
 *
 * The inputs live here, in the DOM, whatever draws the chain. A pin in the 3D scene is a
 * `<label htmlFor={chainChoiceInputId(name, choiceId)}>` and nothing more, which is why a pin
 * click checks a radio, arrow keys move between stops, and a committed answer locks with
 * `disabled` on the fieldset. Silent until commit: no outcome attribute, no colour, no text
 * says which stop is keyed while the learner is deciding.
 */
export function ChainAnswerFieldset({ answer }: { readonly answer: ChainAnswer }) {
  const committed = answer.committedChoiceId != null
  return (
    <fieldset
      className={styles.answer}
      disabled={answer.disabled}
      {...{ [SUITE_DOM.chainAnswer]: answer.name }}
      {...(committed && answer.correctChoiceIds
        ? {
            [SUITE_DOM.chainOutcome]: answer.correctChoiceIds.includes(
              answer.committedChoiceId ?? '',
            )
              ? 'best'
              : 'other',
          }
        : {})}
    >
      <legend>{answer.legend}</legend>
      {answer.hint ? <p className={styles.hint}>{answer.hint}</p> : null}
      {answer.choices.map((choice) => {
        const id = chainChoiceInputId(answer.name, choice.id)
        const stop = choice.stop ? chainStop(choice.stop) : null
        const outcome = committed
          ? answer.correctChoiceIds?.includes(choice.id)
            ? 'best'
            : choice.id === answer.committedChoiceId
              ? 'chosen'
              : undefined
          : undefined
        return (
          <label
            key={choice.id}
            htmlFor={id}
            data-selected={answer.selectedChoiceId === choice.id ? 'true' : undefined}
            data-outcome={outcome}
            {...(choice.stop === null ? { [SUITE_DOM.offChain]: '' } : {})}
          >
            <input
              id={id}
              type="radio"
              name={answer.name}
              value={choice.id}
              checked={answer.selectedChoiceId === choice.id}
              onChange={() => answer.onSelect(choice.id)}
              disabled={answer.disabled}
            />
            <span>
              {stop ? `${stop.number} · ` : ''}
              {choice.label}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
