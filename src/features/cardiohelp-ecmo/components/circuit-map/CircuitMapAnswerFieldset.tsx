'use client'

import type { EcmoMapAnswerTarget } from '../../content/mapAnswerTargets'
import styles from '../cardiohelp-ecmo.module.css'
import { circuitMapHotspot, circuitMapHotspotPercent } from './circuitMapGeometry'

/**
 * The prediction, answered on the circuit.
 *
 * A question about a place is answered by pointing at the place. The four candidate locations get a
 * numbered pin on the drawing and a legend under it; picking a pin is picking an answer.
 *
 * It is a real radio group, and that is the whole trick. Each pin is a `<label>` for a
 * visually-hidden `<input type="radio">`, so the browser supplies everything an answer control has
 * to have and none of it is reimplemented: one tab stop for the group, arrow keys between the
 * options, "radio group, 2 of 4" from a screen reader, the label click that selects, and the
 * disabled fieldset that locks the answer once it is committed. The pin shows its number and the
 * accessible name carries the number and the place, so what is seen is part of what is announced.
 *
 * The legend under the drawing is plain text, not a second control. It is there because a pin has
 * room for a numeral and not for "between the pump outlet and the membrane lung", and because a
 * learner reading the words should not have to hover four pins to find them.
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

interface Pin extends EcmoMapAnswerTarget {
  readonly ordinal: number
  readonly label: string
}

/**
 * Pins are numbered along the blood path, not in the order the choices are authored.
 *
 * The choice order is rotated per item so the keyed answer is not always in the same place
 * (`content/choiceOrder`). On a drawing that device is pointless — the answer's position is the
 * drawing's, not the list's — and numbering the pins by where they sit means 1, 2, 3, 4 reads
 * along the circuit instead of jumping about it.
 */
function pinsFor(props: CircuitMapAnswerProps): readonly Pin[] {
  const labelFor = (choiceId: string) =>
    props.item.choices.find((choice) => choice.id === choiceId)?.label ?? ''
  return props.targets
    .filter((target) => circuitMapHotspot(target.segmentId))
    .map((target, index) => ({ ...target, ordinal: index + 1, label: labelFor(target.choiceId) }))
}

export function CircuitMapAnswerFieldset(props: CircuitMapAnswerProps) {
  const { item, selectedChoiceId, committedChoiceId, correctChoiceIds, name, onSelect } = props
  const pins = pinsFor(props)
  if (pins.length === 0) return null
  const committed = committedChoiceId !== null
  const legendId = `${item.id}-map-legend`

  const stateOf = (choiceId: string) => {
    if (!committed) return undefined
    const chosen = choiceId === committedChoiceId
    const correct = correctChoiceIds.includes(choiceId)
    if (chosen && correct) return 'chosen-correct'
    if (chosen) return 'chosen'
    if (correct) return 'correct'
    return undefined
  }

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
      <div className={styles.mapAnswerPins}>
        {pins.map((pin) => {
          const rect = circuitMapHotspot(pin.segmentId)
          if (!rect) return null
          const state = stateOf(pin.choiceId)
          return (
            <label
              key={pin.choiceId}
              className={styles.mapAnswerPin}
              style={circuitMapHotspotPercent(rect)}
              data-map-answer-choice={pin.choiceId}
              data-map-answer-segment={pin.segmentId}
              data-map-answer-state={state}
              data-selected={selectedChoiceId === pin.choiceId}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={pin.choiceId}
                checked={selectedChoiceId === pin.choiceId}
                onChange={() => onSelect(pin.choiceId)}
              />
              <span className={styles.mapAnswerPinBody} aria-hidden="true">
                {pin.ordinal}
              </span>
              {/* The number is visible and the place is not, so the name carries both. */}
              <span className="sr-only">
                {pin.ordinal}. {pin.label}
              </span>
              {state ? (
                <span className={styles.mapAnswerFlag} data-map-answer-flag={state}>
                  {state === 'chosen-correct'
                    ? 'Your answer · correct'
                    : state === 'chosen'
                      ? 'Your answer'
                      : 'Correct'}
                </span>
              ) : null}
            </label>
          )
        })}
      </div>
      <ol className={styles.mapAnswerLegend} data-map-answer-legend>
        {pins.map((pin) => (
          <li key={pin.choiceId} data-map-answer-legend-item={pin.choiceId}>
            <span className={styles.mapAnswerLegendOrdinal} aria-hidden="true">
              {pin.ordinal}
            </span>
            {pin.label}
          </li>
        ))}
      </ol>
    </fieldset>
  )
}
