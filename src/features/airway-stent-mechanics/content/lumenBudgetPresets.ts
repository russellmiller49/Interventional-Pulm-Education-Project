export type LumenBudgetArchitectureId = 'generic-silicone-tube' | 'generic-thin-wall-scaffold'

export interface LumenBudgetArchitecturePreset {
  id: LumenBudgetArchitectureId
  label: string
  shortLabel: string
  wallThicknessMm: number
  description: string
}

export const lumenBudgetArchitecturePresets: readonly LumenBudgetArchitecturePreset[] = [
  {
    id: 'generic-silicone-tube',
    label: 'Generic thicker-wall silicone tube',
    shortLabel: 'Silicone tube',
    wallThicknessMm: 1.5,
    description:
      'A schematic solid-wall tube. At a fixed outer diameter, its thicker wall leaves a smaller calculated inner diameter.',
  },
  {
    id: 'generic-thin-wall-scaffold',
    label: 'Generic thin-wall scaffold',
    shortLabel: 'Thin-wall scaffold',
    wallThicknessMm: 0.5,
    description:
      'A schematic thin structural envelope. At the same outer diameter, its smaller radial thickness leaves a larger calculated inner diameter.',
  },
] as const

export const lumenBudgetOuterDiameterControl = {
  defaultMm: 14,
  minMm: 8,
  maxMm: 20,
  stepMm: 0.5,
} as const

export const lumenBudgetTeachingCopy = {
  evidenceBoundary:
    'This is a two-dimensional geometry comparison using illustrative wall thicknesses, not product specifications or manufacturer instructions for use. It does not model cover folds, studs, deformation, mucus, radial force, tissue pressure, pressure drop, airflow, ventilation, complications, or clinical outcomes.',
  educationalDisclaimer:
    'For professional education and device-size comparison only. Actual usable lumen and device selection depend on patient anatomy, airway caliber, device construction and instructions for use, deployment conditions, secretion burden, procedural goals, and operator judgment.',
  displayRangeBoundary:
    'The adjustable range supports visual comparison only and is not a sizing recommendation.',
} as const
