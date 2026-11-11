'use client'

import { requireCardiacOutputMethod } from '../../content/cardiacOutputMethods'
import type { DerivedMetricId } from '../../content/derivedMetrics'
import type { HemodynamicsSectionFigure } from '../../content/taskPresentation'
import type { HemodynamicSimulationState } from '../../engine/types'
import { DerivedValueFigure } from '../DerivedValueFigure'
import { PacComponentSchematic } from '../NormalWaveformAnatomyFigure'
import { NormalWaveformReference } from '../NormalWaveformReference'
import { ThermodilutionCurveFigure } from '../ThermodilutionTrialReview'
import styles from '../icu-hemodynamics.module.css'

/** Whether the step's named figure has something to draw in this state. */
export function sectionFigureShows(
  figure: HemodynamicsSectionFigure,
  state: HemodynamicSimulationState,
): boolean {
  if (figure === 'pac-parts' || figure === 'derived-value' || figure === 'normal-reference')
    return true
  if (figure === 'td-curve') return state.thermodilutionTrials.length > 0
  return false
}

/**
 * A section's drawing in the visual column (`presentation.figure`). The stage wraps it.
 *
 * This file must not import the stage's own stylesheets. It is imported ahead of them, and a
 * stylesheet's first import fixes where its rules fall in the cascade: importing the flow
 * stylesheet here moved it ahead of the stage's, which changed the flush comparison's alignment
 * and a card's contrast two sections away (caught by the browser specs, November 2026).
 *
 * `answered` is for a drawing whose legend could answer the question beside it: the catheter's
 * parts keep their names and places and hold back what each measures until the question is
 * answered. The thermodilution curve names the parts of a curve, which no question in its section
 * asks for, so it is the same on every task.
 */
export function HemodynamicsSectionFigureView({
  figure,
  state,
  answered,
  derived,
}: {
  readonly figure: HemodynamicsSectionFigure
  readonly state: HemodynamicSimulationState
  readonly answered: boolean
  /** For `derived-value`: the value to draw, and the worked episode whose numbers fill it, if any. */
  readonly derived?: { readonly metricId: DerivedMetricId; readonly episodeId?: string }
}) {
  if (!sectionFigureShows(figure, state)) return null
  if (figure === 'pac-parts') return <PacComponentSchematic functions={answered} />
  if (figure === 'derived-value')
    return derived ? (
      <DerivedValueFigure metricId={derived.metricId} episodeId={derived.episodeId} />
    ) : null
  if (figure === 'normal-reference') {
    // The chamber the walk is standing in; before the first chamber, the first one.
    const position = state.catheter.position === 'introducer' ? 'ra' : state.catheter.position
    return (
      <section className={styles.walkReference} data-walk-reference={position}>
        <h3>Normal waveform reference · current walk stop</h3>
        <p>
          The reference follows the chamber selected by the walk. Its fixed scale, anatomy and ECG
          describe that chamber; the live monitor uses the separate teaching-patient values.
        </p>
        <NormalWaveformReference fixedPosition={position} concise figuresFirst />
      </section>
    )
  }
  const method = requireCardiacOutputMethod('thermodilution')
  return (
    <figure className={styles.thermoReferenceFigure} data-reference-curve>
      {/* The first curve on this lesson's record: standard technique, the section's reference. */}
      <ThermodilutionCurveFigure trial={state.thermodilutionTrials[0]} named />
      <figcaption>
        <strong>The raw record: temperature change against time</strong>
        <span data-curve-record>{method.rawDataRepresentation}</span>
        <span>
          Time runs left to right from the injection; the trace falls as cooler blood passes the
          thermistor. This is the reference curve of this lesson&apos;s model. Viewing it does not
          review or accept a trial in your ledger.
        </span>
      </figcaption>
    </figure>
  )
}
