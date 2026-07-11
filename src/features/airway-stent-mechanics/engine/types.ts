export type StentArchitectureId =
  | 'studded-silicone'
  | 'dynamic-silicone'
  | 'single-wire-knit'
  | 'multiwire-braid'
  | 'covered-hybrid'
  | 'laser-cut-sems'
  | 'silicone-y'
  | 'patient-specific-silicone'

export type StentRenderKind = 'silicone' | 'braid' | 'laser-cut' | 'y'

export type AirwayGeometryId = 'straight' | 'curved' | 'tapered' | 'asymmetric'

export type LoadMode = 'rest' | 'breathing' | 'cough' | 'migration'

export type QualitativeBand = 'low' | 'moderate' | 'high'

export interface StentArchitecturePreset {
  id: StentArchitectureId
  label: string
  shortLabel: string
  family: string
  material: string
  renderKind: StentRenderKind
  description: string
  radialSupport: number
  axialStiffness: number
  contactConcentration: number
  interfaceFriction: number
  anchoringGeometry: number
  lumenRetention: number
  mucusBurden: number
  fatigueConcentration: number
  isCovered: boolean
  isWireBased: boolean
  sourceRefs: number[]
  strengths: string[]
  tradeoffs: string[]
}

export interface MechanicsInputs {
  architectureId: StentArchitectureId
  airwayGeometry: AirwayGeometryId
  airwayDiameterMm: number
  freeStentDiameterMm: number
  stentLengthMm: number
  curvaturePercent: number
  asymmetryPercent: number
  structureScale: number
  braidAngleDeg: number
  wetInterface: boolean
}

export interface ForceCurvePoint {
  diameterPercent: number
  compressionPercent: number
  compressionResistance: number
  chronicOutwardForce: number
}

export interface MechanicsProfile {
  oversizingPercent: number
  radialSupportIndex: number
  chronicContactIndex: number
  migrationResistanceIndex: number
  straighteningIndex: number
  areaRetentionPercent: number
  fatigueDemandIndex: number
  secretionBurdenIndex: number
  foreshorteningPercent: number
  radialSupportBand: QualitativeBand
  contactBand: QualitativeBand
  migrationBand: QualitativeBand
  straighteningBand: QualitativeBand
  fatigueBand: QualitativeBand
  interpretation: string[]
}

export interface MechanicsScenarioChoice {
  id: string
  label: string
  rationale: string
}

export interface MechanicsScenario {
  id: string
  title: string
  stem: string
  prompt: string
  choices: MechanicsScenarioChoice[]
  bestChoiceId: string
  explanation: string
  sourceRefs: number[]
}
