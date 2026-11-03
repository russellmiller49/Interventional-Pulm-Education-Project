import type {
  ScopeComparisonRow,
  ScopeFeature,
} from '@/components/bronchoscopy-instruments/ScopeComparison'

import type { DolphinSourceId } from '../data/sources'
import type { DolphinNumberRowId } from './teachingNumbers'

/**
 * The two scopes side by side for "Choosing the instrument". It shows before the prediction, so it
 * describes each scope and leaves what to do with it to the section's teaching.
 *
 * Features follow the NMMP annual-training slide comparing the two scopes (slide 12) and the 2024
 * Module 1 slide; sizes follow slide 11 and the 2024 slide, given side by side where they differ.
 */
export const DOLPHIN_SCOPE_FEATURES: readonly ScopeFeature[] = [
  {
    id: 'steering',
    label: 'Steering',
    bronchoscope:
      'One thumb lever bends the tip up or down. To aim sideways, turn the whole scope.',
    gastroscope: 'Two knobs steer the tip in four directions: up and down, left and right.',
  },
  {
    id: 'lock',
    label: 'Locking the bend',
    bronchoscope: 'No fixation lever.',
    gastroscope: 'Fixation levers hold the tip’s bend in place.',
  },
  {
    id: 'air',
    label: 'Air and water',
    bronchoscope: 'No air or water button, and no insufflation.',
    gastroscope: 'An air and water button: air to open the gut, water to wash the lens.',
  },
  {
    id: 'suction',
    label: 'Suction',
    bronchoscope: 'A suction button; suction runs through the working channel.',
    gastroscope: 'A suction button; suction runs through the working channel.',
  },
  {
    id: 'channel',
    label: 'Working channel',
    bronchoscope:
      'One port takes the instruments and the wash: saline, lidocaine and lavage fluid all go down the channel.',
    gastroscope:
      'The biopsy port takes the instruments; the lens is washed through its own nozzle.',
  },
]

export const DOLPHIN_SCOPE_ROWS: readonly ScopeComparisonRow[] = [
  {
    id: 'working-length',
    label: 'Working length',
    bronchoscope: '60 cm on the annual-training slide; 600 mm on the 2024 slide',
    gastroscope: '110 cm on the annual-training slide; 1030 mm on the 2024 slide',
  },
  {
    id: 'outer-diameter',
    label: 'Outer diameter',
    bronchoscope: '5.8 mm',
    gastroscope: '9.9 mm',
  },
  {
    id: 'channel',
    label: 'Working channel',
    bronchoscope: '2.8 mm',
    gastroscope: '2.8 mm',
  },
  {
    id: 'insufflation',
    label: 'Insufflation',
    bronchoscope: 'None',
    gastroscope: 'Air, through the air and water button',
  },
  {
    id: 'wash',
    label: 'Wash',
    bronchoscope: 'Through the working channel',
    gastroscope: 'Water through the lens nozzle',
  },
]

export const DOLPHIN_SCOPE_COMPARISON_NUMBERS: readonly DolphinNumberRowId[] = [
  'scope-sizes-annual',
  'scope-working-length',
]

export const DOLPHIN_SCOPE_COMPARISON_SOURCES: readonly DolphinSourceId[] = [
  'nmmp-annual-training',
  'nmmp-workshop-2024',
]

export const DOLPHIN_SCOPE_SOURCE_NOTE =
  'Sizes from the NMMP annual-training slide and the 2024 NMMP workshop slide; neither names a model. Check the working length of the scope you have.'
