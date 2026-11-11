import type { HemodynamicsSectionId } from './sectionSpecs'
import type { HemodynamicsStageStep } from './stageLessons'

export type HemodynamicsPresentationKind =
  | 'concept'
  | 'signal-lab'
  | 'waveform-reader'
  | 'catheter-procedure'
  | 'acquisition-lab'
  | 'calculation-lab'
  | 'case'

/**
 * A drawing the section keeps beside its text, where the step has no simulator of its own.
 *
 * `pac-parts` is the catheter with its four parts marked (`PacComponentSchematic`). Walked on
 * screen in November 2026, the opening section was a single centred text column on all six tasks,
 * with this drawing below the fold of the first one and nowhere on the other five.
 *
 * `td-curve` is the flow section's reference thermodilution curve with its parts named. That
 * section's reading, its two questions and its two Explain cards described a temperature curve in
 * words (baseline, onset, peak, decay) with no curve beside them; the one drawing sat inside the
 * second page of the first task, its marks unnamed.
 *
 * `derived-value` is one calculated value drawn as what goes into it, its formula and what comes
 * out (`DerivedValueFigure`). The derived-values section had no drawing at all: its reading, its
 * two questions and its two Explain cards were text about equations.
 */
export type HemodynamicsSectionFigure = 'none' | 'pac-parts' | 'td-curve' | 'derived-value'

export interface HemodynamicsTaskPresentation {
  readonly kind: HemodynamicsPresentationKind
  readonly monitor: 'none' | 'pac' | 'arterial' | 'all'
  readonly anatomy: 'none' | 'map' | 'paired' | 'optional'
  readonly controls: boolean
  readonly figure: HemodynamicsSectionFigure
}

/** Presentation only: no title matching, state construction, dispatch, or progression. */
export function hemodynamicsTaskPresentation(
  section: HemodynamicsSectionId,
  step: Pick<HemodynamicsStageStep, 'surface' | 'interaction' | 'teaching' | 'anatomy'>,
): HemodynamicsTaskPresentation {
  return { ...simulatorPresentation(section, step), figure: sectionFigure(section, step) }
}

function sectionFigure(
  section: HemodynamicsSectionId,
  step: Pick<HemodynamicsStageStep, 'interaction'>,
): HemodynamicsSectionFigure {
  const task = step.interaction.kind
  if (section === 'why-measure' && task !== 'case') return 'pac-parts'
  // Not the tasks that draw their own curves (the series, the disagreement) or the Fick reading.
  if (
    section === 'thermodilution-series' &&
    (task === 'read' || task === 'prediction' || task === 'explain')
  )
    return 'td-curve'
  // Not the workbenches, which lay out their own inputs and results.
  if (
    section === 'derived-hemodynamics' &&
    (task === 'provenance-drill' || task === 'prediction' || task === 'explain')
  )
    return 'derived-value'
  return 'none'
}

function simulatorPresentation(
  section: HemodynamicsSectionId,
  step: Pick<HemodynamicsStageStep, 'surface' | 'interaction' | 'teaching' | 'anatomy'>,
): Omit<HemodynamicsTaskPresentation, 'figure'> {
  const task = step.interaction.kind
  const reading = task === 'read' || task === 'explain'
  // A section's last task is its case, which brings its own monitor and workspace.
  if (task === 'case') return { kind: 'case', monitor: 'none', anatomy: 'none', controls: false }
  switch (section) {
    case 'why-measure':
      return { kind: 'concept', monitor: 'none', anatomy: 'none', controls: false }
    case 'pressure-system':
      return {
        kind: 'signal-lab',
        monitor:
          step.surface === 'response-demo'
            ? 'none'
            : step.surface === 'scale-demo'
              ? 'arterial'
              : 'pac',
        anatomy: task === 'walk' ? 'map' : 'none',
        controls: task !== 'walk' && task !== 'explain' && task !== 'prediction',
      }
    case 'waveform-interpretation':
      return {
        kind: 'waveform-reader',
        monitor: task === 'prediction' ? 'pac' : 'none',
        anatomy: task === 'walk' || task === 'prediction' ? 'map' : 'none',
        controls: true,
      }
    case 'waveform-components':
      return { kind: 'waveform-reader', monitor: 'none', anatomy: 'none', controls: true }
    case 'catheter-advancement':
      return {
        kind: 'catheter-procedure',
        monitor: 'pac',
        anatomy: 'paired',
        controls: !reading && task !== 'prediction',
      }
    case 'pawp-capture':
      return {
        kind: 'acquisition-lab',
        monitor: 'pac',
        anatomy: 'optional',
        controls: !reading && task !== 'prediction',
      }
    case 'thermodilution-series':
      return {
        kind: task === 'observe' || task === 'disagreement' ? 'calculation-lab' : 'acquisition-lab',
        monitor: 'none',
        anatomy: 'none',
        controls: task === 'simulator-task',
      }
    case 'derived-hemodynamics':
      return { kind: 'calculation-lab', monitor: 'none', anatomy: 'none', controls: true }
    case 'pac-signal-validation':
      return {
        kind: 'case',
        monitor: 'all',
        anatomy: 'none',
        controls: !reading && task !== 'prediction',
      }
  }
}
