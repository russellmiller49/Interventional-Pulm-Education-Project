'use client'

import { useId, useState } from 'react'
import {
  RENUMBERED_MEAN_SHIFT_MMHG,
  componentExample,
  componentNames,
  componentOrder,
  componentRegions,
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
        with rhythm, conduction and signal transmission. This is a labeled reference, not a
        selection of yours.
      </p>
    </section>
  )
}

const NUMBERINGS: readonly { readonly mode: ComponentMode; readonly label: string }[] = [
  { mode: 'guided', label: 'Numbered in order' },
  { mode: 'independent', label: 'Renumbered repeat · model variant' },
]

/**
 * Optional practice: find each atrial component on a numbered, frozen tracing.
 *
 * HD-01 (self-paced): any component can be checked, shown without an answer, retried or skipped, in
 * any order. Nothing tallies answers or retries, and nothing here decides whether the learner may
 * move on.
 *
 * HD-02 folded the separate renumbered activity into this one as an optional repeat: the same normal
 * model tracing, moved up and renumbered, and labelled a model variant rather than a new example. The
 * labelled reference is one disclosure away at any time. Checked regions are kept per numbering for
 * this visit only, so a look-back or a change of numbering shows them again; showing a component or
 * opening the reference records no selection.
 */
export function AtrialComponentActivity({
  selections,
  onChange,
  enabled,
}: {
  readonly selections: Readonly<Partial<Record<ComponentMode, readonly ComponentSelection[]>>>
  readonly onChange: (mode: ComponentMode, selections: readonly ComponentSelection[]) => void
  readonly enabled: boolean
}) {
  const group = useId()
  const [mode, setMode] = useState<ComponentMode>('guided')
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState<number | null>(null)
  const [revealed, setRevealed] = useState<'checked' | 'shown' | null>(null)
  const component = componentOrder[index]
  const regions = componentRegions(mode)
  const expected = regions.find((region) => region.component === component)!
  const modeSelections = selections[mode] ?? []
  const checked = modeSelections.find((selection) => selection.component === component)
  const correct = checked ? componentSelectionCorrect(checked, mode) : false

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(next, componentOrder.length - 1)))
    setPending(null)
    setRevealed(null)
  }

  function changeNumbering(next: ComponentMode) {
    if (!enabled || next === mode) return
    setMode(next)
    goTo(0)
  }

  function check() {
    if (!enabled || pending === null) return
    onChange(mode, [
      ...modeSelections.filter((selection) => selection.component !== component),
      { component, selectedRegion: pending },
    ])
    setRevealed('checked')
  }

  return (
    <section
      className={styles.surfaceCard}
      aria-label="Identify the atrial component"
      data-component-activity={mode}
    >
      <p className={styles.kicker}>
        {NUMBERINGS.find((numbering) => numbering.mode === mode)!.label} · frozen right atrium ·
        sinus rhythm
      </p>
      <h3>Identify the atrial component</h3>
      <p>
        The numbered regions use the trace’s existing landmarks. Select a region and check it, or
        show where the component is. Work through the components in any order.
      </p>
      <div className={styles.componentTabs} role="group" aria-label="Numbering">
        {NUMBERINGS.map((numbering) => (
          <button
            key={numbering.mode}
            type="button"
            className={styles.dockButton}
            aria-pressed={mode === numbering.mode}
            disabled={!enabled}
            onClick={() => changeNumbering(numbering.mode)}
          >
            {numbering.label}
          </button>
        ))}
      </div>
      {mode === 'independent' ? (
        <p className={styles.dockNote} data-component-variant-note>
          Model variant: the same normal right-atrial model tracing moved up{' '}
          {RENUMBERED_MEAN_SHIFT_MMHG} mmHg, with its regions numbered in a different order. It is
          another try on one morphology, not a new patient recording.
        </p>
      ) : null}
      <WaveformAtlasFigure
        key={mode}
        entry={componentExample(mode)}
        beats={2}
        ecgLandmarks
        readable
        showLegend={false}
        figureDescription={`Frozen right-atrial pressure in mmHg and synchronized ECG. ${regions.map((region) => `Region ${region.number}: ${region.description}.`).join(' ')}`}
      />
      <fieldset
        className={styles.choiceGroup}
        disabled={!enabled || revealed !== null}
        data-component-position={index + 1}
      >
        <legend>
          Find the {componentNames[component]} · component {index + 1} of {componentOrder.length}
        </legend>
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
      {revealed === null ? (
        <div className={styles.componentTabs}>
          <button
            type="button"
            className={styles.dockButton}
            disabled={!enabled || pending === null}
            onClick={check}
          >
            Check component
          </button>
          <button
            type="button"
            className={styles.dockButton}
            disabled={!enabled}
            onClick={() => setRevealed('shown')}
          >
            Show this component
          </button>
        </div>
      ) : null}
      {revealed ? (
        <div className={styles.dockVerdict} role="status" data-component-reveal={revealed}>
          <strong>
            {revealed === 'shown'
              ? 'Shown without an answer.'
              : correct
                ? 'Component identified.'
                : 'Compare the timing.'}
          </strong>
          <p>
            Region {expected.number} marks the {componentNames[component]}.{' '}
            {expected.annotation.description}
          </p>
          <div className={styles.componentTabs}>
            <button
              className={styles.dockButton}
              type="button"
              disabled={!enabled}
              onClick={() => {
                setPending(null)
                setRevealed(null)
              }}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}
      <div className={styles.componentTabs} aria-label="Move between components">
        <button
          type="button"
          className={styles.dockButton}
          disabled={!enabled || index === 0}
          onClick={() => goTo(index - 1)}
        >
          Previous component
        </button>
        <button
          type="button"
          className={styles.dockButton}
          disabled={!enabled || index === componentOrder.length - 1}
          onClick={() => goTo(index + 1)}
        >
          Next component
        </button>
        <button
          type="button"
          className={styles.dockButton}
          disabled={!enabled}
          onClick={() => {
            onChange(mode, [])
            goTo(0)
          }}
        >
          Clear this exercise
        </button>
      </div>
      <details data-component-compare>
        <summary>Compare with the labelled reference</summary>
        <WaveformAtlasFigure
          entry={waveformAtlasById.get('ra-normal')!}
          beats={2}
          ecgLandmarks
          readable
          showLegend={false}
        />
        <p className={styles.dockNote}>
          The reference right atrium with its a, c, x, v and y labels, on the same axis.
          {mode === 'independent'
            ? ` The practice tracing sits ${RENUMBERED_MEAN_SHIFT_MMHG} mmHg higher; every landmark keeps the same timing.`
            : null}
        </p>
      </details>
      <p className={styles.dockNote}>
        Optional practice. Checked regions stay for this visit only; nothing about them is saved,
        and you can continue in Steps at any point.
      </p>
    </section>
  )
}
