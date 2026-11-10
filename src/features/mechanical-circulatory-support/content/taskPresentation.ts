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

/**
 * The picture a task opens on.
 *
 * Every task has one, so the simulator pane is never a column of folded disclosures beside a text
 * that talks about a device. The timing lab leads with its timing figure and the tasks read on
 * the loop lead with the circulation map, as before. The rest (a task about a patient on a
 * device, the controller's readings, the three pathways) used to open on numbers alone or on
 * nothing; they lead with the heart and the device in three dimensions. The unloading comparison
 * is its own full-width figure and has no simulator pane.
 *
 * It mirrors the pane's own rule for where the map leads, so the two cannot disagree.
 */
export type McsLeadVisual = 'comparison' | 'timing' | 'map' | 'anatomy'

export function mcsLeadVisual(
  presentation: McsPresentationKind,
  interaction: McsStageInteraction,
): McsLeadVisual {
  if (presentation === 'unloading-comparison') return 'comparison'
  if (presentation === 'timing-lab') return 'timing'
  const teaching = interaction.kind === 'teaching' || interaction.kind === 'walk'
  if (
    presentation === 'circulation-reader' ||
    presentation === 'pump-loading-lab' ||
    (presentation === 'mechanism-comparison' && !teaching) ||
    (interaction.kind === 'identify' && interaction.onMap)
  )
    return 'map'
  return 'anatomy'
}
