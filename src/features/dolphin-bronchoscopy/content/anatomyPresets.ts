import type { DolphinViewName } from '@/features/dolphin-anatomy/components/DolphinScene'

import type { AnatomyPresetId } from './types'

/**
 * Which structures of the 3D dolphin a section shows, from which side, and how see-through the
 * body is. Structure ids are those of `dolphin-anatomy/content/dolphin-001-manifest.json`.
 */
export interface AnatomyPreset {
  readonly id: AnatomyPresetId
  readonly structures: readonly string[]
  readonly view: DolphinViewName
  /** Body-surface opacity; zero hides it. */
  readonly surfaceOpacity: number
}

export const DOLPHIN_ANATOMY_PRESETS: Readonly<Record<AnatomyPresetId, AnatomyPreset>> = {
  'airway-in-body': {
    id: 'airway-in-body',
    structures: [
      'body-surface',
      'nasal-passages',
      'airway',
      'lung-left',
      'lung-right',
      'esophagus',
      'skull',
      'vertebral-column',
      'ribs',
      'sternum',
    ],
    view: 'right',
    surfaceOpacity: 0.14,
  },
  'lungs-and-ribs': {
    id: 'lungs-and-ribs',
    structures: [
      'airway',
      'lung-left',
      'lung-right',
      'ribs',
      'sternum',
      'vertebral-column',
      'heart',
    ],
    view: 'right',
    surfaceOpacity: 0,
  },
  'spout-in-skull': {
    id: 'spout-in-skull',
    structures: ['skull', 'nasal-passages', 'airway', 'esophagus', 'hyoid'],
    view: 'rostral',
    surfaceOpacity: 0,
  },
}
