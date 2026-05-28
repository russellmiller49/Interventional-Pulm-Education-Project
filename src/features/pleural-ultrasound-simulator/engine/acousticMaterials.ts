import type { PleuralTissueLabel } from '../types'

export interface AcousticMaterial {
  scatter: number
  attenuation: number
  reflectivity: number
  castsShadow?: boolean
  posteriorEnhancement?: number
  airInterface?: boolean
}

export const acousticMaterials: Record<PleuralTissueLabel, AcousticMaterial> = {
  background: {
    scatter: 0.04,
    attenuation: 0.05,
    reflectivity: 0.02,
  },
  skin: {
    scatter: 0.34,
    attenuation: 0.45,
    reflectivity: 0.25,
  },
  subcutaneousTissue: {
    scatter: 0.45,
    attenuation: 0.5,
    reflectivity: 0.15,
  },
  intercostalMuscle: {
    scatter: 0.4,
    attenuation: 0.55,
    reflectivity: 0.2,
  },
  rib: {
    scatter: 0.9,
    attenuation: 2.5,
    reflectivity: 1,
    castsShadow: true,
  },
  lung: {
    scatter: 0.5,
    attenuation: 1.5,
    reflectivity: 0.85,
    airInterface: true,
  },
  atelectaticLung: {
    scatter: 0.6,
    attenuation: 0.6,
    reflectivity: 0.45,
  },
  pleuralFluid: {
    scatter: 0.02,
    attenuation: 0.05,
    reflectivity: 0.03,
    posteriorEnhancement: 1.25,
  },
  septation: {
    scatter: 0.75,
    attenuation: 0.25,
    reflectivity: 0.8,
  },
  debris: {
    scatter: 0.8,
    attenuation: 0.3,
    reflectivity: 0.55,
  },
  diaphragm: {
    scatter: 0.55,
    attenuation: 0.45,
    reflectivity: 0.9,
  },
  liver: {
    scatter: 0.55,
    attenuation: 0.7,
    reflectivity: 0.35,
  },
  spleen: {
    scatter: 0.55,
    attenuation: 0.7,
    reflectivity: 0.35,
  },
}

export function estimateBoundaryReflection(
  previousLabel: PleuralTissueLabel,
  nextLabel: PleuralTissueLabel,
) {
  if (previousLabel === nextLabel) {
    return 0
  }

  const previous = acousticMaterials[previousLabel] ?? acousticMaterials.background
  const next = acousticMaterials[nextLabel] ?? acousticMaterials.background
  return Math.min(1, Math.abs(next.reflectivity - previous.reflectivity) + 0.18)
}
