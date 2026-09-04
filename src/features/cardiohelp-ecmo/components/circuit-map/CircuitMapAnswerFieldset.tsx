'use client'

import { useId } from 'react'

import { isOffCircuitTarget, type EcmoMapAnswerTarget } from '../../content/mapAnswerTargets'
import styles from '../cardiohelp-ecmo.module.css'
import {
  circuitMapHotspot,
  circuitMapHotspotPercent,
  type CircuitMapRect,
} from './circuitMapGeometry'

/**
 * The prediction, answered on the circuit.
 *
 * A question about a place is answered by pointing at the place. Each candidate location gets a
 * numbered pin on the drawing, every option gets a row in the list beneath it, and picking either
 * one picks the answer.
 *
 * It is a real radio group, and that is the whole trick. Every option is a visually-hidden
 * `<input type="radio">` labelled twice — once by its row, once by its pin — so the browser supplies
 * everything an answer control has to have and none of it is reimplemented: one tab stop for the
 * group, arrow keys between the options, "radio group, 2 of 4" from a screen reader, the label
 * click that selects, and the disabled fieldset that locks the answer once it is committed. The pin
 * carries the numeral and the row carries the words, so the accessible name reads "2. Between the
 * pump outlet and the membrane lung" and each visible label is part of it.
 *
 * Some questions have an answer that is not a place. "There is not enough information to localise
 * it" is a real response to "where does this localise", and an item that offers it is still
 * answerable here: that option takes a row like every other and simply has no pin. Deciding whether
 * the answer is a place at all is then part of answering, which is what those items are for — and
 * it keeps the rows uniform, so the shape of an option is not a hint about whether it is the
 * keyed one.
 */

export interface CircuitMapAnswerProps {
  readonly item: {
    readonly id: string
    readonly stem: string
    readonly choices: readonly { readonly id: string; readonly label: string }[]
  }
  readonly targets: readonly EcmoMapAnswerTarget[]
  readonly selectedChoiceId: string | null
  /** The committed answer, once there is one. Locks the group and marks what was right. */
  readonly committedChoiceId: string | null
  readonly correctChoiceIds: readonly string[]
  readonly name: string
  readonly onSelect: (choiceId: string) => void
}

interface Option {
  readonly choiceId: string
  readonly label: string
  /** The pin's number, or null for an option that is not a place on the circuit. */
  readonly ordinal: number | null
  readonly rect: CircuitMapRect | undefined
}

/**
 * Options keep the registry's order, and pins are numbered along the blood path.
 *
 * The per-item rotation in `content/choiceOrder` exists so a keyed answer is not always in the same
 * list position. On a drawing that device is pointless — an answer's position is the circuit's, not
 * the list's — and numbering by place means 1, 2, 3 reads along the circuit instead of jumping
 * about it. Options that are not places sort last, after the pins they are an alternative to.
 */
function optionsFor(props: CircuitMapAnswerProps): readonly Option[] {
  const labelFor = (choiceId: string) =>
    props.item.choices.find((choice) => choice.id === choiceId)?.label ?? ''
  const placed = props.targets.flatMap((target) => (isOffCircuitTarget(target) ? [] : [target]))
  const offCircuit = props.targets.filter(isOffCircuitTarget)
  return [
    ...placed.map((target, index) => ({
      choiceId: target.choiceId,
      label: labelFor(target.choiceId),
      ordinal: index + 1,
      rect: circuitMapHotspot(target.segmentId),
    })),
    ...offCircuit.map((target) => ({
      choiceId: target.choiceId,
      label: labelFor(target.choiceId),
      ordinal: null,
      rect: undefined,
    })),
  ]
}

export function CircuitMapAnswerFieldset(props: CircuitMapAnswerProps) {
  const { item, selectedChoiceId, committedChoiceId, correctChoiceIds, name, onSelect } = props
  const baseId = useId()
  const options = optionsFor(props)
  if (options.filter((option) => option.rect).length === 0) return null
  const committed = committedChoiceId !== null
  const legendId = `${baseId}-legend`
  const inputId = (choiceId: string) => `${baseId}-${choiceId}`

  const stateOf = (choiceId: string) => {
    if (!committed) return undefined
    const chosen = choiceId === committedChoiceId
    const correct = correctChoiceIds.includes(choiceId)
    if (chosen && correct) return 'chosen-correct'
    if (chosen) return 'chosen'
    if (correct) return 'correct'
    return undefined
  }

  const flagFor = (state: string | undefined) =>
    state === 'chosen-correct'
      ? 'Your answer · correct'
      : state === 'chosen'
        ? 'Your answer'
        : state === 'correct'
          ? 'Correct'
          : null

  return (
    <fieldset
      className={styles.mapAnswer}
      disabled={committed}
      aria-labelledby={legendId}
      data-prediction-choices
      data-map-answer
    >
      <legend id={legendId} className="sr-only">
        {item.stem}
      </legend>

      {/* The pins: a second label each, over the place they stand on. */}
      <div className={styles.mapAnswerPins}>
        {options.map((option) =>
          option.rect ? (
            <label
              key={option.choiceId}
              className={styles.mapAnswerPin}
              htmlFor={inputId(option.choiceId)}
              style={circuitMapHotspotPercent(option.rect)}
              data-map-answer-choice={option.choiceId}
              data-map-answer-state={stateOf(option.choiceId)}
              data-selected={selectedChoiceId === option.choiceId}
            >
              <span className={styles.mapAnswerPinBody}>{option.ordinal}</span>
              {flagFor(stateOf(option.choiceId)) ? (
                <span
                  className={styles.mapAnswerFlag}
                  data-map-answer-flag={stateOf(option.choiceId)}
                >
                  {flagFor(stateOf(option.choiceId))}
                </span>
              ) : null}
            </label>
          ) : null,
        )}
      </div>

      {/* The options: one row each, whether or not it has a pin. */}
      <ol className={styles.mapAnswerLegend} data-map-answer-legend>
        {options.map((option) => {
          const state = stateOf(option.choiceId)
          return (
            <li key={option.choiceId} data-map-answer-legend-item={option.choiceId}>
              <input
                type="radio"
                id={inputId(option.choiceId)}
                className="sr-only"
                name={name}
                value={option.choiceId}
                checked={selectedChoiceId === option.choiceId}
                onChange={() => onSelect(option.choiceId)}
              />
              <label
                className={styles.mapAnswerRow}
                htmlFor={inputId(option.choiceId)}
                data-map-answer-row={option.choiceId}
                data-map-answer-state={state}
                data-selected={selectedChoiceId === option.choiceId}
              >
                {/*
                  The pin already announces the number; here it is a visual tie between the row and
                  the drawing, so it stays out of the accessible name and the name reads
                  "2. Between the pump outlet and the membrane lung" rather than "22Between…".
                */}
                <span
                  className={styles.mapAnswerLegendOrdinal}
                  data-map-answer-ordinal
                  aria-hidden="true"
                >
                  {option.ordinal ?? '—'}
                </span>
                <span>
                  {option.label}
                  {flagFor(state) ? (
                    <span className={styles.mapAnswerRowFlag} data-map-answer-row-flag={state}>
                      {flagFor(state)}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}
      </ol>
    </fieldset>
  )
}
