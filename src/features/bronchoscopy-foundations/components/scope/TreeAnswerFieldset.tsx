'use client'

import { airwayDisplayName } from '../../content/airwayTree'
import styles from './scope-fallback.module.css'
import { SCOPE_DOM, treeChoiceInputId, type TreeAnswer } from './types'

/**
 * The answer control for a prediction answered on the airway tree: one native radio group.
 *
 * The inputs live here, in the DOM, whatever draws the tree. A pin on the map or in the optical
 * view is a `<label htmlFor={treeChoiceInputId(name, choiceId)}>` and nothing more, which is why
 * a pin click checks a radio, arrow keys move between airways, and a committed answer locks with
 * `disabled` on the fieldset. Silent until commit: no outcome attribute, no colour, no text says
 * which airway is keyed while the learner is deciding.
 */
export function TreeAnswerFieldset({ answer }: { readonly answer: TreeAnswer }) {
  const committed = answer.committedChoiceId != null
  return (
    <fieldset
      className={styles.answer}
      disabled={answer.disabled}
      {...{ [SCOPE_DOM.treeAnswer]: answer.name }}
      {...(committed && answer.correctChoiceIds
        ? {
            [SCOPE_DOM.treeOutcome]: answer.correctChoiceIds.includes(
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
        const id = treeChoiceInputId(answer.name, choice.id)
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
            {...(choice.airway === null ? { [SCOPE_DOM.offTree]: '' } : {})}
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
              {choice.airway ? `${airwayDisplayName(choice.airway)} · ` : ''}
              {choice.label}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
