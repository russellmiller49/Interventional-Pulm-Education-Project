import type { SuiteViewSpec } from '../../src/features/peripheral-imaging/components/suite/types'

/** Render/contract fixture only. The hub's eventual view spec belongs to its owner. */
export const ROOM_FIXTURE: SuiteViewSpec = {
  sectionId: 'room-preview',
  mode: 'room',
  camera: 'room',
  litStop: null,
  stopSentence: '',
  layers: [
    'Thoracic envelope',
    'Airways',
    'Lungs',
    'Ribs and spine',
    'table',
    'gantry',
    'monitor',
    'cone',
  ],
  variant: 'fixed',
  monitor: 'hidden',
  defaults: { orbit: 20, tilt: 0 },
  bindings: [],
  controls: [],
  readouts: [],
  boundary:
    'CT-derived teaching context and authored geometry. No clinical performance, exposure, reconstruction or clearance validation.',
}

export const ROOM_HERO = {
  width: 2400,
  height: 1000,
  background: '#061519',
  // Renamed with the 2026-11-10 re-render so no cache serves the earlier picture under new labels.
  output: 'public/peripheral-imaging/room-suite.png',
  maximumBytes: 400_000,
} as const
