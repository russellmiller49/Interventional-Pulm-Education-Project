import type { AcousticMaterial, ThoracicStructureLabel } from '../types'

/**
 * Generic acoustic lookup for the thoracic structure vocabulary. Values are
 * physically-generic (anechoic fluid, bright shadowing bone, air-interface
 * lung) and were tuned against the pleural reference case; new structures reuse
 * the closest physiological analogue.
 */
export const acousticMaterials: Record<ThoracicStructureLabel, AcousticMaterial> = {
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
  muscle: {
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
  spine: {
    // Vertebral bone behaves like rib cortex: bright specular surface with a
    // clean acoustic shadow beneath.
    scatter: 0.9,
    attenuation: 2.6,
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
  consolidation: {
    scatter: 0.58,
    attenuation: 0.62,
    reflectivity: 0.4,
  },
  pleuralFluid: {
    scatter: 0.02,
    attenuation: 0.05,
    reflectivity: 0.03,
    posteriorEnhancement: 1.25,
  },
  pleuralThickening: {
    scatter: 0.6,
    attenuation: 0.4,
    reflectivity: 0.5,
  },
  pleuralNodule: {
    scatter: 0.68,
    attenuation: 0.42,
    reflectivity: 0.55,
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
  kidney: {
    scatter: 0.52,
    attenuation: 0.68,
    reflectivity: 0.38,
  },
  pancreas: {
    // Homogeneous; in adults slightly more echogenic than liver.
    scatter: 0.58,
    attenuation: 0.66,
    reflectivity: 0.36,
  },
  gallbladder: {
    // Anechoic bile with a thin echogenic wall and distal enhancement.
    scatter: 0.03,
    attenuation: 0.06,
    reflectivity: 0.06,
    posteriorEnhancement: 1.22,
  },
  stomach: {
    // Gut wall + variable luminal content; treat as a mid-gray soft-tissue wall.
    scatter: 0.44,
    attenuation: 0.58,
    reflectivity: 0.32,
  },
  thyroid: {
    // Fine, homogeneous, mildly hyperechoic parenchyma.
    scatter: 0.52,
    attenuation: 0.56,
    reflectivity: 0.33,
  },
  heart: {
    scatter: 0.5,
    attenuation: 0.6,
    reflectivity: 0.4,
  },
  pericardium: {
    scatter: 0.6,
    attenuation: 0.5,
    reflectivity: 0.85,
  },
  greatVessel: {
    scatter: 0.06,
    attenuation: 0.08,
    reflectivity: 0.05,
    posteriorEnhancement: 1.2,
  },
  aorta: {
    // Anechoic blood pool; thick, muscular, mildly echogenic wall.
    scatter: 0.05,
    attenuation: 0.08,
    reflectivity: 0.32,
    posteriorEnhancement: 1.22,
  },
  venaCava: {
    // Anechoic, thin-walled, compressible; subtle wall reflection.
    scatter: 0.05,
    attenuation: 0.07,
    reflectivity: 0.22,
    posteriorEnhancement: 1.22,
  },
  pulmonaryVessel: {
    scatter: 0.055,
    attenuation: 0.08,
    reflectivity: 0.24,
    posteriorEnhancement: 1.18,
  },
  portalVein: {
    // Classic brightly echogenic ("portal triad") walls around anechoic lumen.
    scatter: 0.06,
    attenuation: 0.09,
    reflectivity: 0.55,
    posteriorEnhancement: 1.15,
  },
  esophagus: {
    scatter: 0.45,
    attenuation: 0.5,
    reflectivity: 0.3,
  },
  airway: {
    scatter: 0.5,
    attenuation: 1.4,
    reflectivity: 0.8,
    airInterface: true,
  },
  thoracicCavity: {
    scatter: 0.1,
    attenuation: 0.1,
    reflectivity: 0.05,
  },
  lymphNode: {
    scatter: 0.62,
    attenuation: 0.5,
    reflectivity: 0.35,
  },
}

export function estimateBoundaryReflection(
  previousLabel: ThoracicStructureLabel,
  nextLabel: ThoracicStructureLabel,
) {
  if (previousLabel === nextLabel) {
    return 0
  }

  const previous = acousticMaterials[previousLabel] ?? acousticMaterials.background
  const next = acousticMaterials[nextLabel] ?? acousticMaterials.background
  return Math.min(1, Math.abs(next.reflectivity - previous.reflectivity) + 0.18)
}
