'use client'

import type { ReactNode } from 'react'

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
  /** Local foundation opt-in: visible question and submit/feedback beside the map. */
  readonly inlineActions?: ReactNode
  /** The question is printed in large type above the task; the legend stays for assistive tech. */
  readonly stemShownElsewhere?: boolean
  /**
   * The numbered options and their radio group live in the host's question card, and the map
   * carries only its numbered pins. The pins stay labels for the same radios (`htmlFor` reaches
   * across the document), so pointing at a place still answers the question.
   */
  readonly choicesOutsideMap?: boolean
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

/**
 * Stable ids shared by the pins and the rows. Derived from the group's name rather than `useId`,
 * so the pins on the map and the rows in a question card can be rendered by different components
 * and still label the same radio.
 */
function answerInputId(name: string, choiceId: string): string {
  return `${name}-${choiceId}`
}

function answerStateOf(props: CircuitMapAnswerProps, choiceId: string) {
  if (props.committedChoiceId === null) return undefined
  const chosen = choiceId === props.committedChoiceId
  const correct = props.correctChoiceIds.includes(choiceId)
  if (chosen && correct) return 'chosen-correct'
  if (chosen) return 'chosen'
  if (correct) return 'correct'
  return undefined
}

function answerFlagFor(state: string | undefined) {
  return state === 'chosen-correct'
    ? 'Your answer · correct'
    : state === 'chosen'
      ? 'Your answer'
      : state === 'correct'
        ? 'Correct'
        : null
}

function hasPins(props: CircuitMapAnswerProps): boolean {
  return optionsFor(props).some((option) => option.rect)
}

/** The pins: a second label each, over the place they stand on. */
export function CircuitMapAnswerPins(props: CircuitMapAnswerProps) {
  if (!hasPins(props)) return null
  return (
    <div className={styles.mapAnswerPins} data-map-answer-pins>
      {optionsFor(props).map((option) => {
        if (!option.rect) return null
        const state = answerStateOf(props, option.choiceId)
        const flag = answerFlagFor(state)
        return (
          <label
            key={option.choiceId}
            className={styles.mapAnswerPin}
            htmlFor={answerInputId(props.name, option.choiceId)}
            style={circuitMapHotspotPercent(option.rect)}
            data-map-answer-choice={option.choiceId}
            data-map-answer-state={state}
            data-selected={props.selectedChoiceId === option.choiceId}
          >
            <span className={styles.mapAnswerPinBody}>{option.ordinal}</span>
            {flag ? (
              <span className={styles.mapAnswerFlag} data-map-answer-flag={state}>
                {flag}
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}

/**
 * The options: one row each, whether or not it has a pin, inside the radio group's fieldset.
 *
 * With `legendClassName` the legend is the visible question stem (a host's question card); without
 * it the legend is for assistive technology only, as it always was under the map.
 */
export function CircuitMapAnswerChoices({
  legendClassName,
  hint,
  ...props
}: CircuitMapAnswerProps & {
  readonly legendClassName?: string
  /** A line under the stem saying how to answer, inside the group. */
  readonly hint?: ReactNode
}) {
  if (!hasPins(props)) return null
  const committed = props.committedChoiceId !== null
  const legendId = `${props.name}-legend`
  return (
    <>
      <fieldset
        className={styles.mapAnswer}
        disabled={committed}
        aria-labelledby={legendId}
        data-prediction-choices
        data-map-answer
      >
        <legend
          id={legendId}
          className={
            legendClassName ??
            (props.inlineActions && !props.stemShownElsewhere ? styles.mapAnswerStem : 'sr-only')
          }
          data-map-question={props.inlineActions ? true : undefined}
        >
          {props.item.stem}
        </legend>
        {hint}
        {props.choicesOutsideMap ? null : <CircuitMapAnswerPins {...props} />}
        <ol className={styles.mapAnswerLegend} data-map-answer-legend>
          {optionsFor(props).map((option) => {
            const state = answerStateOf(props, option.choiceId)
            const flag = answerFlagFor(state)
            const inputId = answerInputId(props.name, option.choiceId)
            return (
              <li key={option.choiceId} data-map-answer-legend-item={option.choiceId}>
                <input
                  type="radio"
                  id={inputId}
                  className="sr-only"
                  name={props.name}
                  value={option.choiceId}
                  checked={props.selectedChoiceId === option.choiceId}
                  onChange={() => props.onSelect(option.choiceId)}
                />
                <label
                  className={styles.mapAnswerRow}
                  htmlFor={inputId}
                  data-map-answer-row={option.choiceId}
                  data-map-answer-state={state}
                  data-selected={props.selectedChoiceId === option.choiceId}
                >
                  {/*
                    The pin already announces the number; here it is a visual tie between the row
                    and the drawing, so it stays out of the accessible name and the name reads
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
                    {flag ? (
                      <span className={styles.mapAnswerRowFlag} data-map-answer-row-flag={state}>
                        {flag}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ol>
      </fieldset>
      {props.inlineActions}
    </>
  )
}

/**
 * The whole answer under the map: pins over the drawing, rows beneath it, one fieldset. With
 * `choicesOutsideMap` the map keeps only its pins and the host renders `CircuitMapAnswerChoices`.
 */
export function CircuitMapAnswerFieldset(props: CircuitMapAnswerProps) {
  if (props.choicesOutsideMap) return <CircuitMapAnswerPins {...props} />
  return <CircuitMapAnswerChoices {...props} />
}
