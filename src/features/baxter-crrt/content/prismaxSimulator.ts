export type PrismaxSimulatorHotspotId =
  | 'touchscreen'
  | 'solution-pumps'
  | 'syringe-pump'
  | 'safety-monitoring'
  | 'fluid-management'

export interface PrismaxSimulatorHotspot {
  readonly id: PrismaxSimulatorHotspotId
  readonly ordinal: number
  readonly label: string
  readonly shortLabel: string
  readonly description: string
  readonly xPercent: number
  readonly yPercent: number
  readonly sourceRecordIds: readonly ['DEV-PM-014']
}

export const prismaxSimulatorArtwork = Object.freeze({
  src: '/images/baxter-crrt/prismax-educational-machine.webp',
  alt: 'Original front-facing educational illustration of a CRRT machine with a touchscreen, pump deck, safety sensors, four fluid scales, and a wheeled base.',
  width: 1024,
  height: 1536,
  sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  generationMethod: 'Original AI-assisted educational rendering from supplied reference views.',
})

/**
 * Coordinates target the original simulator artwork rather than a copied
 * product photograph. Hardware names stay at the broad orientation level
 * supported by DEV-PM-014; they do not encode operating instructions.
 */
export const prismaxSimulatorHotspots: readonly PrismaxSimulatorHotspot[] = Object.freeze([
  Object.freeze({
    id: 'touchscreen',
    ordinal: 1,
    label: 'Touchscreen and workflow display',
    shortLabel: 'Touchscreen',
    description:
      'The interactive screen below carries the manual-reference setup sequence and the synthetic Operations projection.',
    xPercent: 50,
    yPercent: 14,
    sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  }),
  Object.freeze({
    id: 'solution-pumps',
    ordinal: 2,
    label: 'Solution pump deck',
    shortLabel: 'Fluid pumps',
    description:
      'Four pump positions provide spatial orientation to the circuit. This artwork does not claim a therapy-specific disposable or local pump assignment.',
    xPercent: 50,
    yPercent: 40,
    sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  }),
  Object.freeze({
    id: 'syringe-pump',
    ordinal: 3,
    label: 'Syringe-pump position',
    shortLabel: 'Syringe position',
    description:
      'The left-side position is shown for equipment orientation only. Medication and anticoagulation workflows remain outside this simulator.',
    xPercent: 31,
    yPercent: 47,
    sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  }),
  Object.freeze({
    id: 'safety-monitoring',
    ordinal: 4,
    label: 'Pressure and safety-monitoring area',
    shortLabel: 'Sensors and clamp',
    description:
      'This area represents pressure connections, air monitoring, and the return-line clamp without reproducing device thresholds or troubleshooting instructions.',
    xPercent: 69,
    yPercent: 43,
    sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  }),
  Object.freeze({
    id: 'fluid-management',
    ordinal: 5,
    label: 'Fluid scales and bag positions',
    shortLabel: 'Scales and bags',
    description:
      'Four separated scale positions support visual tracing of fluid management. Bag identity, capacity, solution, and installed configuration are not inferred.',
    xPercent: 50,
    yPercent: 72,
    sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  }),
])
