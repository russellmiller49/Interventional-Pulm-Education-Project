import type { DisplayGrayContext, ThoracicStructureLabel, TissueModel, Vec3 } from '../types'

import { acousticMaterials, estimateBoundaryReflection } from './acousticMaterials'

export function fract(value: number) {
  return value - Math.floor(value)
}

/**
 * Deterministic per-point speckle so a static probe pose renders a stable image
 * (no frame-to-frame shimmer). Mixed low/high frequency hash of the world point.
 */
export function stableSpeckle(worldPoint: Vec3, label: ThoracicStructureLabel) {
  const labelSeed = label.length * 19.19
  const coarse =
    Math.sin(worldPoint[0] * 0.19 + worldPoint[1] * 0.31 + worldPoint[2] * 0.27 + labelSeed) *
    43758.5453
  const fine =
    Math.sin(worldPoint[0] * 1.47 + worldPoint[1] * 1.91 + worldPoint[2] * 1.33 + labelSeed) *
    12414.19

  const mixed = 0.62 * fract(coarse) + 0.38 * fract(fine)
  return Math.pow(0.18 + 0.82 * mixed, 1.35)
}

function defaultBackscatter(label: ThoracicStructureLabel) {
  switch (label) {
    case 'background':
      return 0
    // Anechoic blood/fluid pools: essentially no internal scatter.
    case 'pleuralFluid':
    case 'greatVessel':
    case 'aorta':
    case 'venaCava':
    case 'pulmonaryVessel':
      return 0.0012
    case 'portalVein':
      // Anechoic lumen with a touch more internal echo than a clean vessel.
      return 0.0016
    case 'gallbladder':
      // Anechoic bile pool (thin echogenic wall + distal enhancement come from
      // the fluid-boundary display path and the material's posteriorEnhancement).
      return 0.0014
    case 'cardiacBlood':
      // Anechoic chamber blood with only a faint electronic/suspended-cell echo.
      return 0.001
    case 'septation':
      return 0.22
    case 'debris':
      return 0.16
    case 'pleuralThickening':
      return 0.14
    case 'pleuralNodule':
      return 0.18
    case 'diaphragm':
    case 'pericardium':
      return 0.036
    case 'rib':
    case 'spine':
      return 0.006
    case 'lung':
    case 'airway':
      return 0.032
    case 'atelectaticLung':
    case 'consolidation':
      return 0.064
    // Solid organs, distinguished so parenchyma reads differently on screen.
    case 'liver':
      return 0.04
    case 'spleen':
      // Slightly finer / marginally less echogenic than liver.
      return 0.037
    case 'kidney':
      // Cortex is hypoechoic relative to adjacent liver/spleen.
      return 0.03
    case 'pancreas':
      // Adult pancreas: homogeneous, mildly hyperechoic vs liver.
      return 0.05
    case 'thyroid':
      // Fine, homogeneous, mildly hyperechoic parenchyma.
      return 0.05
    case 'heart':
      return 0.042
    case 'myocardium':
      return 0.06
    case 'cardiacValve':
      return 0.16
    case 'stomach':
      return 0.046
    case 'esophagus':
      return 0.044
    case 'thoracicCavity':
      // Mediastinal fat / connective tissue: soft mid-gray filler.
      return 0.03
    case 'lymphNode':
      return 0.03
    case 'skin':
      return 0.048
    case 'intercostalMuscle':
    case 'muscle':
      return 0.055
    case 'subcutaneousTissue':
      return 0.042
    default:
      return 0.038
  }
}

const fluidLikeLabels = new Set<ThoracicStructureLabel>([
  'pleuralFluid',
  'greatVessel',
  'aorta',
  'venaCava',
  'pulmonaryVessel',
  'portalVein',
  'gallbladder',
  'cardiacBlood',
])

/** Solid organs / soft-tissue parenchyma that share the gentle highlight knee. */
const softTissueOrganLabels = new Set<ThoracicStructureLabel>([
  'liver',
  'spleen',
  'kidney',
  'heart',
  'myocardium',
  'pancreas',
  'thyroid',
  'stomach',
  'esophagus',
  'thoracicCavity',
  'lymphNode',
])

function isFluidLike(label: ThoracicStructureLabel) {
  return fluidLikeLabels.has(label)
}

function isFluidInterface(
  previousLabel: ThoracicStructureLabel,
  nextLabel: ThoracicStructureLabel,
) {
  return isFluidLike(previousLabel) || isFluidLike(nextLabel)
}

function defaultInterfaceEcho(
  previousLabel: ThoracicStructureLabel,
  nextLabel: ThoracicStructureLabel,
) {
  if (previousLabel === nextLabel) {
    return 0
  }

  if (
    nextLabel === 'rib' ||
    previousLabel === 'rib' ||
    nextLabel === 'spine' ||
    previousLabel === 'spine'
  ) {
    return 1.5
  }

  if (nextLabel === 'cardiacValve' || previousLabel === 'cardiacValve') {
    return 1.35
  }

  if (
    (nextLabel === 'cardiacBlood' && previousLabel === 'myocardium') ||
    (previousLabel === 'cardiacBlood' && nextLabel === 'myocardium')
  ) {
    return 1.05
  }

  if (
    (nextLabel === 'myocardium' && previousLabel !== 'myocardium') ||
    (previousLabel === 'myocardium' && nextLabel !== 'myocardium')
  ) {
    return 0.72
  }

  if (nextLabel === 'diaphragm' || previousLabel === 'diaphragm') {
    return 1.1
  }

  if (
    isFluidInterface(previousLabel, nextLabel) &&
    (previousLabel === 'liver' ||
      nextLabel === 'liver' ||
      previousLabel === 'spleen' ||
      nextLabel === 'spleen' ||
      previousLabel === 'lung' ||
      nextLabel === 'lung' ||
      previousLabel === 'atelectaticLung' ||
      nextLabel === 'atelectaticLung')
  ) {
    return 0.86
  }

  if (nextLabel === 'lung' || previousLabel === 'lung') {
    return 0.58
  }

  if (isFluidInterface(previousLabel, nextLabel)) {
    return 0.5
  }

  return estimateBoundaryReflection(previousLabel, nextLabel) * 0.36
}

function defaultTexture(worldPoint: Vec3, label: ThoracicStructureLabel, depthMm: number) {
  const speckle = stableSpeckle(worldPoint, label)
  const fascialBand =
    label === 'skin' ||
    label === 'intercostalMuscle' ||
    label === 'muscle' ||
    label === 'subcutaneousTissue'
      ? 0.028 * Math.max(0, Math.sin(worldPoint[0] * 0.08 + worldPoint[2] * 0.06))
      : 0
  // Homogeneous parenchymal grain; the per-label phase shift keeps liver,
  // spleen, kidney, pancreas, thyroid, and heart from sharing an identical
  // speckle pattern where they abut.
  const organGrain = softTissueOrganLabels.has(label)
    ? 0.026 *
      fract(Math.sin(worldPoint[0] * 0.55 + worldPoint[2] * 0.47 + label.length * 2.3) * 9142.17)
    : 0
  const myocardialFibers =
    label === 'myocardium'
      ? 0.034 *
        Math.pow(
          0.5 + 0.5 * Math.sin(worldPoint[0] * 0.34 + worldPoint[1] * 0.18 - worldPoint[2] * 0.27),
          2,
        )
      : 0
  const nearFieldNoise =
    depthMm < 16 && !isFluidLike(label) ? 0.014 * stableSpeckle(worldPoint, 'skin') : 0

  // High multiplicative variance is what gives ultrasound its granular look;
  // the render pipeline's point-spread blur correlates it into speckle blobs.
  return (
    defaultBackscatter(label) * (0.22 + 1.45 * Math.pow(speckle, 1.7)) +
    fascialBand +
    organGrain +
    myocardialFibers +
    nearFieldNoise
  )
}

/** Soft highlight compression: keeps texture above the knee instead of clipping. */
function softKnee(gray: number, knee: number) {
  return gray <= knee ? gray : knee + (gray - knee) * 0.35
}

function defaultDisplayGray(fillLabel: ThoracicStructureLabel) {
  return ({
    label,
    renderLabel,
    gray,
    boundaryEcho,
    fluidBoundary,
    ribCortex,
  }: DisplayGrayContext) => {
    // Anechoic lumen (pleural fluid, aorta, cavae, pulmonary/portal vessels):
    // near-black inside, a specular wall where the boundary is crossed.
    if (isFluidLike(renderLabel)) {
      const wallCeiling = renderLabel === 'portalVein' ? 176 : 168
      return fluidBoundary ? Math.min(Math.max(gray, 72), wallCeiling) : Math.min(gray, 13)
    }
    if (renderLabel === 'rib' || renderLabel === 'spine') {
      return ribCortex ? Math.max(gray, 212) : Math.min(gray, 10)
    }
    if (renderLabel === 'cardiacValve') {
      return Math.min(Math.max(gray, 188), 244)
    }
    if (renderLabel === 'diaphragm' || renderLabel === 'pericardium') {
      return Math.min(Math.max(gray, 158), 238)
    }
    if (softTissueOrganLabels.has(renderLabel) && boundaryEcho < 0.16) {
      return softKnee(gray, 118)
    }
    if (label === 'background' && renderLabel === fillLabel) {
      return softKnee(gray, 112)
    }
    return gray
  }
}

/**
 * The generic thoracic tissue model: physically-generic ultrasound behaviour
 * shared by every case unless a case supplies overrides.
 */
export const defaultThoracicTissueModel: TissueModel = {
  fluidLabel: 'pleuralFluid',
  fillLabel: 'subcutaneousTissue',
  materials: acousticMaterials,
  isSolidOrgan: (label) =>
    label === 'liver' ||
    label === 'spleen' ||
    label === 'kidney' ||
    label === 'pancreas' ||
    label === 'heart',
  isFluidLike,
  backscatter: defaultBackscatter,
  interfaceEcho: defaultInterfaceEcho,
  texture: defaultTexture,
  displayGray: defaultDisplayGray('subcutaneousTissue'),
}

export function createTissueModel(overrides: Partial<TissueModel> = {}): TissueModel {
  return { ...defaultThoracicTissueModel, ...overrides }
}
