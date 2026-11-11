'use client'

import { requireCardiacOutputMethod } from '../../content/cardiacOutputMethods'
import type { HemodynamicsSectionFigure } from '../../content/taskPresentation'
import type { HemodynamicSimulationState } from '../../engine/types'
import { PacComponentSchematic } from '../NormalWaveformAnatomyFigure'
import { ThermodilutionCurveFigure } from '../ThermodilutionTrialReview'
import flowStyles from './hemodynamics-flow.module.css'

/** Whether the step's named figure has something to draw in this state. */
export function sectionFigureShows(
  figure: HemodynamicsSectionFigure,
  state: HemodynamicSimulationState,
): boolean {
  if (figure === 'pac-parts') return true
  if (figure === 'td-curve') return state.thermodilutionTrials.length > 0
  return false
}

/**
 * A section's drawing in the visual column (`presentation.figure`).
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
}: {
  readonly figure: HemodynamicsSectionFigure
  readonly state: HemodynamicSimulationState
  readonly answered: boolean
}) {
  if (!sectionFigureShows(figure, state)) return null
  if (figure === 'pac-parts')
    return (
      <div className={flowStyles.sectionFigure} data-section-figure={figure}>
        <PacComponentSchematic functions={answered} />
      </div>
    )
  const method = requireCardiacOutputMethod('thermodilution')
  return (
    <figure
      className={`${flowStyles.sectionFigure} ${flowStyles.curveFigure}`}
      data-section-figure={figure}
    >
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
