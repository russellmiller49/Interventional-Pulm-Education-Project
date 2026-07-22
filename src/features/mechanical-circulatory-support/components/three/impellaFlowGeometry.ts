import * as THREE from 'three'

import type { CardiacPoint3 } from '@/features/cardiac-anatomy/content/paths'

export interface ImpellaBloodFlowPaths {
  core: readonly CardiacPoint3[]
  inlet: readonly (readonly CardiacPoint3[])[]
  outlet: readonly (readonly CardiacPoint3[])[]
}

const REFERENCE_UP = new THREE.Vector3(0, 1, 0)
const REFERENCE_SIDE = new THREE.Vector3(1, 0, 0)

function toPoint(vector: THREE.Vector3): CardiacPoint3 {
  return [vector.x, vector.y, vector.z]
}

function normalBasis(tangent: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const reference = Math.abs(tangent.dot(REFERENCE_UP)) < 0.86 ? REFERENCE_UP : REFERENCE_SIDE
  const normal = new THREE.Vector3().crossVectors(tangent, reference).normalize()
  const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize()
  return [normal, binormal]
}

function radialVector(
  normal: THREE.Vector3,
  binormal: THREE.Vector3,
  angle: number,
): THREE.Vector3 {
  return normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle))
}

/**
 * Creates visible blood paths around the actual device openings. Inlet paths converge into the
 * first point; outlet paths leave the final point with a wider, longer jet.
 */
export function createImpellaBloodFlowPaths(
  points: readonly CardiacPoint3[],
): ImpellaBloodFlowPaths {
  if (points.length < 2) {
    return { core: points, inlet: [], outlet: [] }
  }

  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
  )
  const inlet = curve.getPointAt(0)
  const outlet = curve.getPointAt(1)
  const inletTangent = curve.getTangentAt(0).normalize()
  const outletTangent = curve.getTangentAt(1).normalize()
  const [inletNormal, inletBinormal] = normalBasis(inletTangent)
  const [outletNormal, outletBinormal] = normalBasis(outletTangent)

  const inletPaths = Array.from({ length: 4 }, (_, index) => {
    const angle = (index / 4) * Math.PI * 2 + Math.PI / 4
    const radial = radialVector(inletNormal, inletBinormal, angle)
    return [
      toPoint(inlet.clone().addScaledVector(inletTangent, -0.44).addScaledVector(radial, 0.2)),
      toPoint(inlet.clone().addScaledVector(inletTangent, -0.16).addScaledVector(radial, 0.075)),
      toPoint(inlet.clone().addScaledVector(inletTangent, 0.035)),
    ] as const
  })

  const outletPaths = Array.from({ length: 5 }, (_, index) => {
    const angle = (index / 5) * Math.PI * 2
    const radial = radialVector(outletNormal, outletBinormal, angle)
    return [
      toPoint(outlet.clone().addScaledVector(outletTangent, -0.035)),
      toPoint(outlet.clone().addScaledVector(outletTangent, 0.2).addScaledVector(radial, 0.025)),
      toPoint(outlet.clone().addScaledVector(outletTangent, 0.62).addScaledVector(radial, 0.12)),
    ] as const
  })

  return { core: points, inlet: inletPaths, outlet: outletPaths }
}

/**
 * Low-pass smoothing for the flexible RP cannula. Endpoints remain registered to the IVC inlet
 * and PA outlet while small source-centerline reversals are removed from the rendered tube.
 */
export function smoothImpellaCannulaRoute(
  points: readonly CardiacPoint3[],
): readonly CardiacPoint3[] {
  if (points.length < 3) return points.map((point) => [...point] as CardiacPoint3)

  const sourceCurve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
  )
  const targetLength = sourceCurve.getLength()
  // Seven broad anatomical samples retain the IVC/RA, tricuspid, RV, pulmonic, and PA sweep while
  // filtering the short reversals present in the densely extracted source centerlines.
  const anchorProgresses = [0, 0.14, 0.325, 0.5, 0.595, 0.76, 1]
  const envelopeCurve = new THREE.CatmullRomCurve3(
    anchorProgresses.map((progress) => sourceCurve.getPointAt(progress)),
    false,
    'centripetal',
  )
  const current = Array.from({ length: points.length }, (_, index) =>
    envelopeCurve.getPointAt(index / (points.length - 1)),
  )

  // Smoothing removes small reversals and would otherwise make the fixed-length RP cannula look
  // artificially short. Scale only the broad deviation from the inlet-to-outlet chord until the
  // original centerline length is recovered; the registered endpoints remain unchanged.
  const inlet = current[0]
  const outlet = current.at(-1)!
  const scaledRoute = (deviationScale: number) =>
    current.map((point, index) => {
      if (index === 0) return new THREE.Vector3(...points[0])
      if (index === current.length - 1) return new THREE.Vector3(...points.at(-1)!)
      const chordPoint = inlet.clone().lerp(outlet, index / (current.length - 1))
      return chordPoint.add(point.clone().sub(chordPoint).multiplyScalar(deviationScale))
    })
  const routeLength = (deviationScale: number) =>
    new THREE.CatmullRomCurve3(scaledRoute(deviationScale), false, 'centripetal').getLength()

  let lowerScale = 1
  let upperScale = 1
  while (routeLength(upperScale) < targetLength && upperScale < 8) upperScale *= 1.25
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const middleScale = (lowerScale + upperScale) / 2
    if (routeLength(middleScale) < targetLength) lowerScale = middleScale
    else upperScale = middleScale
  }
  return scaledRoute((lowerScale + upperScale) / 2).map(toPoint)
}

/** Builds a continuous reinforcement helix around a curved cannula using parallel transport. */
export function createCannulaHelixPoints(
  points: readonly CardiacPoint3[],
  bodyRadius: number,
  turns: number,
): readonly CardiacPoint3[] {
  if (points.length < 2) return points
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
  )
  const samples = Math.max(120, Math.ceil(points.length * 1.5))
  const tangent = curve.getTangentAt(0).normalize()
  const [initialNormal] = normalBasis(tangent)
  const transportedNormal = initialNormal.clone()
  const previousTangent = tangent.clone()
  const rotation = new THREE.Quaternion()
  const currentTangent = new THREE.Vector3()
  const binormal = new THREE.Vector3()

  return Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples
    curve.getTangentAt(progress, currentTangent).normalize()
    if (index > 0) {
      rotation.setFromUnitVectors(previousTangent, currentTangent)
      transportedNormal.applyQuaternion(rotation)
      transportedNormal.addScaledVector(currentTangent, -transportedNormal.dot(currentTangent))
      transportedNormal.normalize()
    }
    binormal.crossVectors(currentTangent, transportedNormal).normalize()
    previousTangent.copy(currentTangent)
    const angle = progress * turns * Math.PI * 2
    const center = curve.getPointAt(progress)
    center
      .addScaledVector(transportedNormal, Math.cos(angle) * bodyRadius)
      .addScaledVector(binormal, Math.sin(angle) * bodyRadius)
    return toPoint(center)
  })
}
