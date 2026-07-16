import type { StentExampleSceneKind } from '@/features/airway-stent-mechanics/content/stentExamples'

export interface StentExamplePose {
  radialCompression: number
  ovalization: number
  bend: number
  stenosisRelief: number
  airwayCoughOvalization: number
  stentOffsetY: number
  stentRotationZ: number
  uncoveredOpacity: number
  coveredOpacity: number
  annotationIntensity: number
}

export function clampProgress(progress: number) {
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clampProgress((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function getStentExamplePose(
  sceneKind: StentExampleSceneKind,
  rawProgress: number,
): StentExamplePose {
  const progress = clampProgress(rawProgress)
  const eased = smoothstep(0, 1, progress)
  const base: StentExamplePose = {
    radialCompression: 0,
    ovalization: 0,
    bend: 0,
    stenosisRelief: 0,
    airwayCoughOvalization: 0,
    stentOffsetY: 0,
    stentRotationZ: 0,
    uncoveredOpacity: 1,
    coveredOpacity: 0,
    annotationIntensity: smoothstep(0.76, 1, progress),
  }

  if (sceneKind === 'deployment') {
    const insertion = smoothstep(0, 0.34, progress)
    const expansion = smoothstep(0.28, 0.9, progress)
    return {
      ...base,
      radialCompression: 1 - expansion,
      ovalization: 0.32 * expansion,
      stenosisRelief: 0.52 * expansion,
      airwayCoughOvalization: 0.18 * smoothstep(0.68, 0.9, progress),
      stentOffsetY: 0.84 * (1 - insertion),
    }
  }

  if (sceneKind === 'architecture') {
    return {
      ...base,
      radialCompression: 0.58 * eased,
      ovalization: 0.18 * eased,
      bend: 0.22 * eased,
      stentOffsetY: -0.08 * eased,
    }
  }

  if (sceneKind === 'cover') {
    return {
      ...base,
      radialCompression: 0.12 * Math.sin(Math.PI * eased) ** 2,
      uncoveredOpacity: 1 - eased,
      coveredOpacity: eased,
    }
  }

  if (sceneKind === 'bend') {
    return {
      ...base,
      bend: eased,
      ovalization: 0.62 * eased,
      radialCompression: 0.18 * eased,
    }
  }

  if (sceneKind === 'fatigue') {
    const cyclicPhase = smoothstep(0, 0.82, progress)
    const cycle = (1 - Math.cos(cyclicPhase * Math.PI * 8)) * 0.5
    const finalPose = smoothstep(0.82, 1, progress)
    return {
      ...base,
      radialCompression: Math.max(0.42 * cycle, 0.36 * finalPose),
      ovalization: Math.max(0.34 * cycle, 0.28 * finalPose),
      bend: Math.max(0.46 * cycle, 0.5 * finalPose),
      stentOffsetY: 0.05 * Math.sin(cyclicPhase * Math.PI * 8) * (1 - finalPose),
      stentRotationZ: 0.045 * Math.sin(cyclicPhase * Math.PI * 4) * (1 - finalPose),
    }
  }

  if (sceneKind === 'y-anchoring') {
    return {
      ...base,
      radialCompression: 0.32 * (1 - eased),
      stentOffsetY: 0.72 * (1 - eased),
      stentRotationZ: 0.16 * (1 - eased),
    }
  }

  return base
}
