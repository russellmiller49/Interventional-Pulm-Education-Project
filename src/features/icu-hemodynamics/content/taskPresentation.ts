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

export interface HemodynamicsTaskPresentation {
  readonly kind: HemodynamicsPresentationKind
  readonly monitor: 'none' | 'pac' | 'arterial' | 'all'
  readonly anatomy: 'none' | 'map' | 'paired' | 'optional'
  readonly controls: boolean
}

/** Presentation only: no title matching, state construction, dispatch, or progression. */
export function hemodynamicsTaskPresentation(
  section: HemodynamicsSectionId,
  step: Pick<HemodynamicsStageStep, 'surface' | 'interaction' | 'teaching' | 'anatomy'>,
): HemodynamicsTaskPresentation {
  const task = step.interaction.kind
  const reading = task === 'read' || task === 'explain'
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
