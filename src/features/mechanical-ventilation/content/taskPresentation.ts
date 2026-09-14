import type { VentilationStageInteraction } from './stageLessons'

/** Presentation metadata only. These values never select a patient or change a learning gate. */
export type VentilationPresentationKind =
  | 'breath-reader'
  | 'concept-control'
  | 'experiment-lab'
  | 'timing-reader'
  | 'response-lab'
  | 'patient-case'

export interface VentilationTaskPresentation {
  readonly kind: VentilationPresentationKind
  readonly surface: 'reference' | 'question' | 'working' | 'comparison'
  readonly landmark: string
  readonly effort: boolean
  readonly patient: 'none' | 'protection' | 'bedside'
}

interface UnitPresentation {
  readonly reference: VentilationPresentationKind
  readonly application: VentilationPresentationKind
  readonly effort?: boolean
  readonly patient?: VentilationTaskPresentation['patient']
}

/** All 14 stable IDs are explicit; neither titles nor question wording route the renderer. */
export const ventilationUnitPresentation = {
  'breathing-with-support': { reference: 'breath-reader', application: 'breath-reader' },
  'waveform-anatomy': { reference: 'breath-reader', application: 'experiment-lab' },
  'controls-and-goals': { reference: 'concept-control', application: 'experiment-lab' },
  'mechanics-load-and-pressure': { reference: 'experiment-lab', application: 'experiment-lab' },
  'modes-and-breath-delivery': { reference: 'concept-control', application: 'experiment-lab' },
  'lung-protection': {
    reference: 'concept-control',
    application: 'experiment-lab',
    patient: 'protection',
    effort: true,
  },
  'expiration-and-air-trapping': { reference: 'breath-reader', application: 'experiment-lab' },
  'triggering-and-cycling': {
    reference: 'timing-reader',
    application: 'timing-reader',
    effort: true,
  },
  'oxygenation-response': { reference: 'concept-control', application: 'response-lab' },
  'ventilation-and-co2': { reference: 'concept-control', application: 'response-lab' },
  'waveform-reading-sequence': {
    reference: 'breath-reader',
    application: 'breath-reader',
    effort: true,
    patient: 'bedside',
  },
  'dyssynchrony-mechanisms': {
    reference: 'timing-reader',
    application: 'timing-reader',
    effort: true,
  },
  'safety-reassessment-and-human-factors': {
    reference: 'patient-case',
    application: 'patient-case',
    patient: 'bedside',
  },
  'high-peak-pressure-integration': {
    reference: 'patient-case',
    application: 'patient-case',
    patient: 'bedside',
  },
} as const satisfies Record<string, UnitPresentation>

const surfaceByInteraction = {
  read: 'reference',
  walk: 'reference',
  locate: 'question',
  prediction: 'question',
  sort: 'question',
  'simulator-task': 'working',
  observe: 'working',
  interpret: 'comparison',
  explain: 'comparison',
} as const satisfies Record<
  VentilationStageInteraction['kind'],
  VentilationTaskPresentation['surface']
>

const landmarks: Record<VentilationPresentationKind, string> = {
  'breath-reader': 'the captured breath and linked time cursor',
  'concept-control': 'the concept and selected-setting comparison',
  'experiment-lab': 'the experimental control, aligned traces, and recorded readings',
  'timing-reader': 'patient effort and machine events on the same time axis',
  'response-lab': 'breath delivery and the modeled response timeline',
  'patient-case': 'the patient findings, working simulation, and reassessment',
}

export function ventilationTaskPresentation(
  unitId: string,
  interaction: VentilationStageInteraction,
): VentilationTaskPresentation {
  const unit: UnitPresentation | undefined =
    ventilationUnitPresentation[unitId as keyof typeof ventilationUnitPresentation]
  if (!unit) throw new Error(`Missing task presentation for ${unitId}`)
  const surface = surfaceByInteraction[interaction.kind]
  const kind =
    surface === 'reference' ||
    interaction.kind === 'sort' ||
    (unitId === 'controls-and-goals' && interaction.kind === 'prediction')
      ? unit.reference
      : unit.application
  return {
    kind,
    surface,
    landmark: landmarks[kind],
    effort: unit.effort ?? false,
    patient: unit.patient ?? 'none',
  }
}
