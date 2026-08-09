/**
 * The static hardware illustration.
 *
 * This is no longer the module's device representation. Pressure teaching lives
 * on the live profile, which reads the running model; this drawing is kept only
 * for the one thing a functional schematic cannot give — where things physically
 * sit on a machine. It is frozen artwork: nothing on it moves, and none of its
 * regions carries a value.
 *
 * Hardware names stay at the broad orientation level DEV-PM-014 supports. They
 * do not encode operating instructions, and no region here explains what a
 * pressure means; that belongs to the live profile and the universal circuit,
 * where it is said once.
 */
export type PrismaxSimulatorHotspotId =
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
 * The sentence that has to survive every later edit: this picture is not wired
 * to anything.
 */
export const prismaxStaticReferenceNotice = Object.freeze({
  title: 'Static device reference',
  summary: 'Where things sit on the machine — a fixed drawing, not a live display.',
  unsynchronisedNotice:
    'This drawing is not connected to the simulation. Nothing on it updates, no region shows a value, and its appearance does not change when the model does. For current pressures, read the live pressure profile above.',
  fidelityBoundary:
    'It shows roughly where hardware sits, nothing more. Screen layout, menus, button behaviour, alarm appearance, and every operating sequence belong to the manufacturer’s instructions and your local training.',
  sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
})

/**
 * Coordinates target the original simulator artwork rather than a copied
 * product photograph.
 */
export const prismaxSimulatorHotspots: readonly PrismaxSimulatorHotspot[] = Object.freeze([
  Object.freeze({
    id: 'solution-pumps',
    ordinal: 1,
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
    ordinal: 2,
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
    ordinal: 3,
    label: 'Pressure and safety-monitoring area',
    shortLabel: 'Sensors and clamp',
    description:
      'Where the pressure connections, air monitoring, and return-line clamp physically sit. What each pressure means, and which are measured at a site rather than calculated from other sites, is on the live pressure profile — it is not repeated here. No device threshold or troubleshooting instruction is reproduced.',
    xPercent: 69,
    yPercent: 43,
    sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  }),
  Object.freeze({
    id: 'fluid-management',
    ordinal: 4,
    label: 'Fluid scales and bag positions',
    shortLabel: 'Scales and bags',
    description:
      'Four separated scale positions support visual tracing of fluid management. Bag identity, capacity, solution, and installed configuration are not inferred.',
    xPercent: 50,
    yPercent: 72,
    sourceRecordIds: Object.freeze(['DEV-PM-014'] as const),
  }),
])
