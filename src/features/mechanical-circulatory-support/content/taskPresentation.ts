import type { McsStageInteraction } from './stageLessons'

export type McsPresentationKind =
  | 'circulation-reader'
  | 'mechanism-comparison'
  | 'timing-lab'
  | 'pump-loading-lab'
  | 'unloading-comparison'
  | 'parameter-reader'
  | 'patient-case'

/** Renderer metadata only. No patient, scoring, clock, or progress state lives here. */
const sections: Readonly<Record<string, McsPresentationKind>> = {
  'mcs-foundations-signals': 'circulation-reader',
  'mcs-foundations-mechanisms': 'mechanism-comparison',
  'iabp-timing-triggering': 'timing-lab',
  'iabp-efficacy-limits': 'patient-case',
  'impella-unloading-placement': 'pump-loading-lab',
  'impella-suction-purge-rv': 'pump-loading-lab',
  'lvad-parameters-assessment': 'parameter-reader',
  'lvad-alarms-emergencies': 'patient-case',
  'mcs-device-selection-integration': 'patient-case',
}

export function mcsTaskPresentation(
  sectionId: string,
  interaction: McsStageInteraction,
): McsPresentationKind {
  if (interaction.kind === 'teaching' && interaction.introduction.id === 'unloading-example')
    return 'unloading-comparison'
  const kind = sections[sectionId]
  if (!kind) throw new Error(`Missing MCS presentation: ${sectionId}`)
  if (interaction.kind === 'transfer') return 'patient-case'
  if (interaction.kind === 'walk') return 'circulation-reader'
  if (sectionId === 'iabp-efficacy-limits' && interaction.kind === 'identify') return 'timing-lab'
  if (sectionId === 'lvad-parameters-assessment' && interaction.kind === 'action')
    return 'pump-loading-lab'
  return kind
}

/** Deployment rollback changes the host presentation only; the same reducer and content remain. */
export const MCS_TASK_PRESENTATIONS_ENABLED = true
