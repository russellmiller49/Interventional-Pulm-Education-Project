import { getStentArchitecturePreset } from '../content/stentProfiles'
import type {
  ForceCurvePoint,
  MechanicsInputs,
  MechanicsProfile,
  QualitativeBand,
  StentArchitecturePreset,
} from './types'

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function calculateOversizingPercent(freeStentDiameterMm: number, airwayDiameterMm: number) {
  if (!Number.isFinite(freeStentDiameterMm) || !Number.isFinite(airwayDiameterMm)) {
    throw new Error('Diameter inputs must be finite numbers.')
  }
  if (airwayDiameterMm <= 0 || freeStentDiameterMm <= 0) {
    throw new Error('Diameter inputs must be greater than zero.')
  }

  return ((freeStentDiameterMm - airwayDiameterMm) / airwayDiameterMm) * 100
}

export function classifyRelativeIndex(value: number): QualitativeBand {
  if (value < 34) return 'low'
  if (value < 67) return 'moderate'
  return 'high'
}

export function wireBendingScale(relativeDiameter: number) {
  if (!Number.isFinite(relativeDiameter) || relativeDiameter <= 0) {
    throw new Error('Relative wire diameter must be greater than zero.')
  }
  return relativeDiameter ** 4
}

export function createRelativeForceCurve(
  preset: StentArchitecturePreset,
  structureScale = 1,
): ForceCurvePoint[] {
  const architecturePower = preset.isWireBased ? 4 : 3
  const sectionFactor = clamp(structureScale ** architecturePower, 0.3, 2.3)
  const base = preset.radialSupport * sectionFactor
  const hysteresisRatio = preset.isWireBased ? 0.68 : 0.76

  return Array.from({ length: 11 }, (_, index) => {
    const compressionPercent = index * 5
    const normalizedCompression = compressionPercent / 50
    const nonlinearLoad = normalizedCompression * 0.42 + normalizedCompression ** 2 * 0.58
    const compressionResistance = base * nonlinearLoad
    const chronicOutwardForce =
      base * (normalizedCompression * 0.28 + normalizedCompression ** 2 * 0.72) * hysteresisRatio

    return {
      diameterPercent: 100 - compressionPercent,
      compressionPercent,
      compressionResistance: round(compressionResistance),
      chronicOutwardForce: round(chronicOutwardForce),
    }
  })
}

function geometryModifiers(inputs: MechanicsInputs) {
  switch (inputs.airwayGeometry) {
    case 'curved':
      return { contact: 1.08, migration: 1.02, fatigue: 1.16, lumen: 0.94 }
    case 'tapered':
      return { contact: 1.12, migration: 0.86, fatigue: 1.06, lumen: 0.96 }
    case 'asymmetric':
      return { contact: 1.24, migration: 0.92, fatigue: 1.18, lumen: 0.9 }
    default:
      return { contact: 1, migration: 1, fatigue: 1, lumen: 1 }
  }
}

export function calculateMechanicsProfile(inputs: MechanicsInputs): MechanicsProfile {
  const preset = getStentArchitecturePreset(inputs.architectureId)
  const oversizingPercent = calculateOversizingPercent(
    inputs.freeStentDiameterMm,
    inputs.airwayDiameterMm,
  )
  const oversizeFactor = clamp(oversizingPercent / 18, -0.45, 1.8)
  const structurePower = preset.isWireBased ? 4 : 3
  const structureFactor = clamp(inputs.structureScale ** structurePower, 0.35, 2.25)
  const braidAngleFactor = preset.isWireBased
    ? clamp(Math.sin((inputs.braidAngleDeg * Math.PI) / 180) ** 2 / 0.67, 0.55, 1.35)
    : 1
  const geometry = geometryModifiers(inputs)
  const curvature = clamp(inputs.curvaturePercent / 100, 0, 1)
  const asymmetry = clamp(inputs.asymmetryPercent / 100, 0, 1)
  const lengthFactor = clamp(inputs.stentLengthMm / 60, 0.65, 1.65)
  const wetFrictionFactor = inputs.wetInterface ? 0.72 : 1

  const radialSupportIndex = clamp(
    preset.radialSupport * structureFactor * braidAngleFactor * (0.5 + 0.5 * (1 + oversizeFactor)),
    0,
    100,
  )
  const chronicContactIndex = clamp(
    radialSupportIndex *
      (preset.contactConcentration / 68) *
      geometry.contact *
      (1 + asymmetry * 0.42 + curvature * 0.16),
    0,
    100,
  )
  const migrationResistanceIndex = clamp(
    ((preset.interfaceFriction *
      wetFrictionFactor *
      (0.55 + Math.max(oversizeFactor, -0.3) * 0.42) +
      preset.anchoringGeometry * 0.7) *
      geometry.migration) /
      1.25,
    0,
    100,
  )
  const straighteningIndex = clamp(
    preset.axialStiffness *
      Math.max(curvature, 0.12) *
      lengthFactor *
      clamp(structureFactor ** 0.55, 0.65, 1.45),
    0,
    100,
  )
  const areaRetentionPercent = clamp(
    preset.lumenRetention * geometry.lumen -
      curvature * (100 - preset.lumenRetention) * 0.48 -
      asymmetry * 10 +
      radialSupportIndex * 0.13,
    18,
    100,
  )
  const fatigueDemandIndex = clamp(
    preset.fatigueConcentration *
      geometry.fatigue *
      (0.34 + curvature * 0.45 + asymmetry * 0.22 + Math.max(oversizeFactor, 0) * 0.12) *
      clamp(structureFactor ** 0.3, 0.8, 1.24),
    0,
    100,
  )
  const secretionBurdenIndex = clamp(
    preset.mucusBurden +
      (100 - areaRetentionPercent) * 0.34 +
      (inputs.airwayGeometry === 'tapered' ? 8 : 0) +
      (preset.isCovered ? 6 : 0),
    0,
    100,
  )
  const foreshorteningPercent = preset.isWireBased
    ? clamp((62 - inputs.braidAngleDeg) * 0.5 + Math.max(oversizingPercent, 0) * 0.18, 0, 24)
    : 0

  const interpretation: string[] = []
  if (oversizingPercent < 0) {
    interpretation.push(
      'The free stent diameter is smaller than the modeled airway, so incomplete apposition and migration dominate the educational model.',
    )
  } else if (oversizingPercent > 20) {
    interpretation.push(
      'High modeled oversizing increases support and friction, but it also raises chronic contact and tissue-loading concern.',
    )
  } else {
    interpretation.push(
      'Modeled oversizing is in the middle of the sandbox range; architecture and geometry now drive most of the visible tradeoff.',
    )
  }

  if (straighteningIndex >= 67) {
    interpretation.push(
      'High straightening tendency shifts load toward the ends and outer curvature; inspect inner-curve gapping before judging nominal diameter.',
    )
  } else if (curvature > 0.45 && areaRetentionPercent < 65) {
    interpretation.push(
      'The device follows the bend but loses modeled lumen area, illustrating that easy bending is not the same as kink resistance.',
    )
  } else {
    interpretation.push(
      'The modeled bend response preserves a useful balance between centerline conformity and lumen retention.',
    )
  }

  if (migrationResistanceIndex < 34) {
    interpretation.push(
      'Low modeled anchoring means cyclic micromotion may matter even before gross migration is visible.',
    )
  } else if (chronicContactIndex >= 67) {
    interpretation.push(
      'Anchoring is strong, but the model achieves it with substantial chronic contact loading rather than geometry alone.',
    )
  } else {
    interpretation.push(
      'Anchoring is supplied by a mix of contact, friction, and architecture rather than radial force alone.',
    )
  }

  return {
    oversizingPercent: round(oversizingPercent),
    radialSupportIndex: round(radialSupportIndex),
    chronicContactIndex: round(chronicContactIndex),
    migrationResistanceIndex: round(migrationResistanceIndex),
    straighteningIndex: round(straighteningIndex),
    areaRetentionPercent: round(areaRetentionPercent),
    fatigueDemandIndex: round(fatigueDemandIndex),
    secretionBurdenIndex: round(secretionBurdenIndex),
    foreshorteningPercent: round(foreshorteningPercent),
    radialSupportBand: classifyRelativeIndex(radialSupportIndex),
    contactBand: classifyRelativeIndex(chronicContactIndex),
    migrationBand: classifyRelativeIndex(migrationResistanceIndex),
    straighteningBand: classifyRelativeIndex(straighteningIndex),
    fatigueBand: classifyRelativeIndex(fatigueDemandIndex),
    interpretation,
  }
}

export const defaultMechanicsInputs: MechanicsInputs = {
  architectureId: 'studded-silicone',
  airwayGeometry: 'curved',
  airwayDiameterMm: 12,
  freeStentDiameterMm: 14,
  stentLengthMm: 50,
  curvaturePercent: 45,
  asymmetryPercent: 20,
  structureScale: 1,
  braidAngleDeg: 55,
  wetInterface: true,
}
