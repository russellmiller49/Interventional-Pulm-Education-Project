'use client'

import { useId, useState } from 'react'
import {
  componentExample,
  componentNames,
  componentOrder,
  componentRegions,
  componentIdentificationComplete,
  componentSelectionCorrect,
  type ComponentMode,
  type ComponentSelection,
} from '../../content/introductoryTeaching'
import { waveformAtlasById } from '../../content/waveformAtlas'
import { WaveformAtlasFigure } from '../WaveformAtlasFigure'
import styles from './hemodynamics-stage.module.css'

export function AtrialComponentDemonstration() {
  const [active, setActive] = useState(0)
  const entry = waveformAtlasById.get('ra-normal')!
  const component = componentOrder[active]
  const annotation = entry.annotations.find((candidate) => candidate.id === component)!
  return (
    <section className={styles.surfaceCard} aria-label="Normal atrial components">
      <p className={styles.kicker}>Reference example · frozen right atrium · sinus rhythm</p>
      <h3>Normal atrial components</h3>
      <WaveformAtlasFigure entry={entry} beats={2} ecgLandmarks readable showLegend={false} />
      <div className={styles.componentTabs} aria-label="Read about a component">
        {componentOrder.map((id, index) => (
          <button
            key={id}
            type="button"
            className={styles.dockButton}
            aria-pressed={active === index}
            onClick={() => setActive(index)}
          >
            {componentNames[id]}
          </button>
        ))}
      </div>
      <p role="status">
        <strong>{componentNames[component]}:</strong> {annotation.description}
      </p>
      <p className={styles.dockNote}>
        Idealized landmarks from the existing morphology model. Exact timing and visibility vary
        with rhythm, conduction and signal transmission. Viewing this reference earns no
        identification credit.
      </p>
    </section>
  )
}

export function AtrialComponentActivity({
  mode,
  selections,
  onChange,
  enabled,
}: {
  readonly mode: ComponentMode
  readonly selections: readonly ComponentSelection[]
  readonly onChange: (selections: readonly ComponentSelection[]) => void
  readonly enabled: boolean
}) {
  const group = useId()
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const component = componentOrder[index]
  const regions = componentRegions(mode)
  const expected = regions.find((region) => region.component === component)!
  const previous = selections.find((selection) => selection.component === component)
  const complete = componentIdentificationComplete(selections, mode)
  const correct = previous ? componentSelectionCorrect(previous, mode) : false
  const independentCorrect = selections.filter(
    (selection) =>
      !selection.assisted && selection.attempts === 1 && componentSelectionCorrect(selection, mode),
  ).length

  function submit() {
    if (!enabled || pending === null || revealed) return
    onChange([
      ...selections.filter((selection) => selection.component !== component),
      {
        component,
        firstRegion: previous?.firstRegion ?? pending,
        selectedRegion: pending,
        attempts: (previous?.attempts ?? 0) + 1,
        assisted: Boolean(previous),
      },
    ])
    setRevealed(true)
  }

  return (
    <section
      className={styles.surfaceCard}
      aria-label="Identify the atrial component"
      data-component-activity={mode}
    >
      <p className={styles.kicker}>
        {mode === 'guided' ? 'Guided attempt' : 'New application example'} · frozen right atrium ·
        sinus rhythm
      </p>
      <h3>Identify the atrial component</h3>
      <p>
        The numbered regions use the trace’s existing landmarks. Select a region below; no
        pixel-precision grading is used.
      </p>
      <WaveformAtlasFigure
        entry={componentExample(mode)}
        beats={2}
        ecgLandmarks
        readable
        showLegend={false}
        figureDescription={`Frozen right-atrial pressure in mmHg and synchronized ECG. ${regions.map((region) => `Region ${region.number}: ${region.description}.`).join(' ')}`}
      />
      <fieldset className={styles.choiceGroup} disabled={!enabled || revealed || complete}>
        <legend>Find the {componentNames[component]}</legend>
        {regions.map((region) => (
          <label key={region.number}>
            <input
              type="radio"
              name={group}
              checked={pending === region.number}
              onChange={() => setPending(region.number)}
            />
            <span>
              Region {region.number} · {region.description}
            </span>
          </label>
        ))}
      </fieldset>
      {!revealed && !complete ? (
        <button
          type="button"
          className={styles.dockButton}
          disabled={!enabled || pending === null}
          onClick={submit}
        >
          Check component
        </button>
      ) : null}
      {revealed && previous ? (
        <div className={styles.dockVerdict} role="status">
          <strong>{correct ? 'Component identified.' : 'Compare the timing.'}</strong>
          <p>
            Region {expected.number} marks the {componentNames[component]}.{' '}
            {expected.annotation.description}
          </p>
          <p>
            {previous.assisted
              ? 'Assisted retry recorded; the first selection is retained.'
              : mode === 'guided'
                ? 'Guided response recorded.'
                : 'First response recorded.'}
          </p>
          {!complete ? (
            <button
              className={styles.dockButton}
              type="button"
              disabled={!enabled}
              onClick={() => {
                if (correct) setIndex((current) => Math.min(current + 1, componentOrder.length - 1))
                setPending(null)
                setRevealed(false)
              }}
            >
              {correct ? 'Next component' : 'Retry with feedback'}
            </button>
          ) : null}
        </div>
      ) : null}
      <p role="status" data-component-progress>
        {selections.filter((selection) => componentSelectionCorrect(selection, mode)).length} of 5
        components identified.{' '}
        {mode === 'independent'
          ? `${independentCorrect} correct on first response without feedback; ${selections.filter((selection) => selection.selectedRegion !== null && selection.assisted).length} assisted.`
          : 'Guided work is separate from independent responses.'}
      </p>
      {complete ? (
        <p>
          Identification exercise worked through. This records selections in this session, not
          clinical competence. Continue in Steps.
        </p>
      ) : null}
      <button
        type="button"
        className={styles.dockButton}
        disabled={!enabled}
        onClick={() => {
          // Restart current selections while retaining first-response evidence across resets.
          onChange(
            selections.map((selection) => ({ ...selection, selectedRegion: null, assisted: true })),
          )
          setIndex(0)
          setPending(null)
          setRevealed(false)
        }}
      >
        Reset this exercise
      </button>
      <p className={styles.dockNote}>
        Reset clears current selections. Earlier first responses are retained; answering those
        components again counts as assisted practice.
      </p>
    </section>
  )
}
