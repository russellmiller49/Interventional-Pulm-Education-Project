import * as THREE from 'three'

import type { StentGeometryBuilderId } from './learningLabTypes'

export const STENT_LENGTH = 4.8
export const STENT_RADIUS = 1.08
export const WIRE_RADIUS = 0.037
export const SINGLE_WIRE_COURSE_COUNT = 9
export const PARTIAL_COVER_LENGTH_FRACTION = 0.6
const TAU = Math.PI * 2

export type ScaffoldPathRole =
  | 'wire-a'
  | 'wire-b'
  | 'capture'
  | 'connector'
  | 'silicone-ridge'
  | 'single-wire'

export interface ScaffoldPath {
  closed: boolean
  id: string
  points: THREE.Vector3[]
  radius: number
  role: ScaffoldPathRole
}

export interface StentLimbDescriptor {
  end: THREE.Vector3
  id: 'tracheal' | 'left' | 'right'
  radius: number
  start: THREE.Vector3
}

function cylindricalPoint(theta: number, y: number, radius = STENT_RADIUS) {
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius)
}

export function createRingPath({
  axis = new THREE.Vector3(0, 1, 0),
  center,
  id,
  radius,
  role,
  sampleCount = 64,
}: {
  axis?: THREE.Vector3
  center: THREE.Vector3
  id: string
  radius: number
  role: ScaffoldPathRole
  sampleCount?: number
}): ScaffoldPath {
  const normalizedAxis = axis.clone().normalize()
  const reference =
    Math.abs(normalizedAxis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const first = new THREE.Vector3().crossVectors(normalizedAxis, reference).normalize()
  const second = new THREE.Vector3().crossVectors(normalizedAxis, first).normalize()
  const points = Array.from({ length: sampleCount }, (_, index) => {
    const angle = (index / sampleCount) * TAU
    return center
      .clone()
      .addScaledVector(first, Math.cos(angle) * radius)
      .addScaledVector(second, Math.sin(angle) * radius)
  })
  return { closed: true, id, points, radius: WIRE_RADIUS, role }
}

function buildStuddedPaths(): ScaffoldPath[] {
  return Array.from({ length: 7 }, (_, index) =>
    createRingPath({
      center: new THREE.Vector3(0, -STENT_LENGTH * 0.42 + index * (STENT_LENGTH * 0.14), 0),
      id: `studded-ring-${index}`,
      radius: STENT_RADIUS * 1.018,
      role: 'silicone-ridge',
    }),
  )
}

export function dynamicDPoint(theta: number, y: number, radius: number) {
  return new THREE.Vector3(
    Math.max(-radius * 0.55, Math.cos(theta) * radius),
    y,
    Math.sin(theta) * radius,
  )
}

function buildDynamicDPaths(): ScaffoldPath[] {
  return Array.from({ length: 7 }, (_, row) => {
    const y = -STENT_LENGTH * 0.42 + row * (STENT_LENGTH * 0.14)
    return {
      closed: true,
      id: `dynamic-d-ring-${row}`,
      points: Array.from({ length: 80 }, (_, index) =>
        dynamicDPoint((index / 80) * TAU, y, STENT_RADIUS),
      ),
      radius: WIRE_RADIUS * 1.08,
      role: 'silicone-ridge' as const,
    }
  })
}

function buildFreeBraidPaths(): ScaffoldPath[] {
  const paths: ScaffoldPath[] = []
  const wiresPerFamily = 8
  const turns = 3.35
  const samples = 160

  for (const direction of [-1, 1] as const) {
    for (let wire = 0; wire < wiresPerFamily; wire += 1) {
      const phase = (wire / wiresPerFamily) * TAU
      const points = Array.from({ length: samples + 1 }, (_, index) => {
        const t = index / samples
        const theta = phase + direction * turns * TAU * t
        const crossingWave = Math.sin(wiresPerFamily * turns * TAU * t + direction * Math.PI * 0.5)
        const radius = STENT_RADIUS + direction * WIRE_RADIUS * 0.62 * crossingWave
        return cylindricalPoint(theta, -STENT_LENGTH * 0.5 + t * STENT_LENGTH, radius)
      })
      paths.push({
        closed: false,
        id: `free-braid-${direction}-${wire}`,
        points,
        radius: WIRE_RADIUS,
        role: direction > 0 ? 'wire-a' : 'wire-b',
      })
    }
  }
  return paths
}

function buildHookCapturePath(theta: number, y: number, index: number): ScaffoldPath {
  const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta))
  const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta))
  const axial = new THREE.Vector3(0, 1, 0)
  const center = radial.clone().multiplyScalar(STENT_RADIUS + WIRE_RADIUS * 1.05)
  center.y = y
  const loopHalfHeight = 0.095
  const loopHalfWidth = 0.145
  const stemHalfHeight = 0.2
  const points: THREE.Vector3[] = []

  for (let step = 0; step <= 5; step += 1) {
    const progress = step / 5
    points.push(
      center
        .clone()
        .addScaledVector(axial, -stemHalfHeight + (stemHalfHeight - loopHalfHeight) * progress),
    )
  }
  for (let step = 0; step <= 30; step += 1) {
    const angle = -Math.PI * 0.5 + (step / 30) * TAU
    points.push(
      center
        .clone()
        .addScaledVector(tangent, Math.cos(angle) * loopHalfWidth)
        .addScaledVector(axial, Math.sin(angle) * loopHalfHeight)
        .addScaledVector(radial, Math.sin(angle * 0.5) ** 2 * WIRE_RADIUS * 1.4),
    )
  }
  for (let step = 1; step <= 7; step += 1) {
    const progress = step / 7
    points.push(
      center
        .clone()
        .addScaledVector(axial, -loopHalfHeight + (stemHalfHeight + loopHalfHeight) * progress),
    )
  }

  return {
    closed: false,
    id: `hook-capture-${index}`,
    points,
    radius: WIRE_RADIUS * 1.16,
    role: 'capture',
  }
}

function buildCapturedBraidPaths(): ScaffoldPath[] {
  const paths: ScaffoldPath[] = []
  const columnCount = 8
  const waveCycles = 4
  const samples = 256
  const cellAngle = TAU / columnCount
  const angularAmplitude = cellAngle * 0.56

  for (let column = 0; column < columnCount; column += 1) {
    const parity = column % 2 === 0 ? 1 : -1
    const baseTheta = column * cellAngle
    const points = Array.from({ length: samples + 1 }, (_, index) => {
      const progress = index / samples
      const phase = waveCycles * TAU * progress
      const theta = baseTheta + parity * angularAmplitude * Math.sin(phase)
      const radius = STENT_RADIUS + parity * WIRE_RADIUS * 0.62 * Math.cos(phase)
      return cylindricalPoint(theta, -STENT_LENGTH * 0.5 + progress * STENT_LENGTH, radius)
    })
    paths.push({
      closed: false,
      id: `hook-cross-wire-${column}`,
      points,
      radius: WIRE_RADIUS * 1.2,
      role: column % 2 === 0 ? 'wire-a' : 'wire-b',
    })
  }

  const crossingRatio = Math.min(0.98, cellAngle / (2 * angularAmplitude))
  const baseAngle = Math.asin(crossingRatio)
  let hookIndex = 0
  let crossingOrdinal = 0
  for (let boundary = 0; boundary < columnCount - 1; boundary += 1) {
    const parity = boundary % 2 === 0 ? 1 : -1
    for (let cycle = 0; cycle < waveCycles; cycle += 1) {
      const signedBase = parity > 0 ? baseAngle : TAU - baseAngle
      const signedMirror = parity > 0 ? Math.PI - baseAngle : Math.PI + baseAngle
      for (const localPhase of [signedBase, signedMirror]) {
        const phase = cycle * TAU + localPhase
        const progress = phase / (waveCycles * TAU)
        if (progress <= 0 || progress >= 1) continue

        if ((boundary + crossingOrdinal) % 2 === 0) {
          const theta = (boundary + 0.5) * cellAngle
          const y = -STENT_LENGTH * 0.5 + progress * STENT_LENGTH
          paths.push(buildHookCapturePath(theta, y, hookIndex))
          hookIndex += 1
        }
        crossingOrdinal += 1
      }
    }
  }

  return paths
}

function buildLaserCutPaths(): ScaffoldPath[] {
  const paths: ScaffoldPath[] = []
  const rowCount = 8
  const crownCount = 10
  const crownHeight = 0.19
  const firstCenter = -STENT_LENGTH * 0.5 + 0.38
  const lastCenter = STENT_LENGTH * 0.5 - 0.38
  const rowSpacing = (lastCenter - firstCenter) / (rowCount - 1)

  for (let row = 0; row < rowCount; row += 1) {
    const centerY = firstCenter + row * rowSpacing
    const endFlare = Math.pow(Math.abs(centerY) / (STENT_LENGTH * 0.5), 6) * 0.035
    const rowRadius = STENT_RADIUS * (1 + endFlare)
    const points = Array.from({ length: crownCount * 2 }, (_, index) =>
      cylindricalPoint(
        (index / (crownCount * 2)) * TAU,
        centerY + (index % 2 === 0 ? -crownHeight : crownHeight),
        rowRadius,
      ),
    )
    paths.push({
      closed: true,
      id: `laser-ring-${row}`,
      points,
      radius: WIRE_RADIUS * 1.35,
      role: 'wire-a',
    })
  }

  for (let row = 0; row < rowCount - 1; row += 1) {
    const lower = firstCenter + row * rowSpacing + crownHeight
    const upper = firstCenter + (row + 1) * rowSpacing - crownHeight
    for (let connector = 0; connector < 5; connector += 1) {
      const theta = (connector / 5) * TAU + (row % 2 === 0 ? 0.12 : 0)
      paths.push({
        closed: false,
        id: `laser-connector-${row}-${connector}`,
        points: [
          cylindricalPoint(theta, lower),
          cylindricalPoint(theta + 0.035, (lower + upper) * 0.5, STENT_RADIUS * 1.025),
          cylindricalPoint(theta, upper),
        ],
        radius: WIRE_RADIUS * 1.2,
        role: 'connector',
      })
    }
  }

  return paths
}

function buildSingleWireKnitPath(): ScaffoldPath[] {
  const points: THREE.Vector3[] = []
  const stitchesPerCourse = 8
  const samplesPerStitch = 16
  const samplesPerCourse = stitchesPerCourse * samplesPerStitch
  const innerLength = STENT_LENGTH - 0.45
  const courseSpacing = innerLength / (SINGLE_WIRE_COURSE_COUNT - 1)
  const loopHalfHeight = courseSpacing * 0.58

  for (let course = 0; course < SINGLE_WIRE_COURSE_COUNT; course += 1) {
    const direction = course % 2 === 0 ? 1 : -1
    const courseCenterY = -innerLength * 0.5 + course * courseSpacing
    const phaseOffset = course % 2 === 0 ? 0 : Math.PI

    for (let sample = 0; sample <= samplesPerCourse; sample += 1) {
      const progress = sample / samplesPerCourse
      const theta = direction > 0 ? TAU * progress : TAU * (1 - progress)
      const loopPhase = stitchesPerCourse * TAU * progress + phaseOffset
      const y = courseCenterY + loopHalfHeight * Math.sin(loopPhase)
      const radius = STENT_RADIUS + WIRE_RADIUS * 0.82 * Math.cos(loopPhase)
      points.push(cylindricalPoint(theta, y, radius))
    }

    if (course < SINGLE_WIRE_COURSE_COUNT - 1) {
      const nextCenterY = courseCenterY + courseSpacing
      const startRadius = STENT_RADIUS + WIRE_RADIUS * 0.82 * Math.cos(phaseOffset)
      const nextPhaseOffset = course % 2 === 0 ? Math.PI : 0
      const endRadius = STENT_RADIUS + WIRE_RADIUS * 0.82 * Math.cos(nextPhaseOffset)
      for (let step = 1; step <= 14; step += 1) {
        const progress = step / 14
        const theta = (direction > 0 ? TAU : 0) + direction * 0.11 * Math.sin(Math.PI * progress)
        const y =
          courseCenterY +
          (nextCenterY - courseCenterY) * progress +
          0.055 * Math.sin(TAU * progress)
        const radius = startRadius + (endRadius - startRadius) * progress
        points.push(cylindricalPoint(theta, y, radius))
      }
    }
  }

  return [
    {
      closed: false,
      id: 'single-continuous-knitted-wire',
      points,
      radius: WIRE_RADIUS * 1.32,
      role: 'single-wire',
    },
  ]
}

export function buildScaffoldPaths(builder: StentGeometryBuilderId): ScaffoldPath[] {
  switch (builder) {
    case 'studded-cylinder':
      return buildStuddedPaths()
    case 'dynamic-d-cylinder':
      return buildDynamicDPaths()
    case 'silicone-y':
      return []
    case 'free-crossing-helices':
      return buildFreeBraidPaths()
    case 'hook-cross-captured-helices':
      return buildCapturedBraidPaths()
    case 'laser-cut-rings':
      return buildLaserCutPaths()
    case 'single-wire-knitted-loops':
      return buildSingleWireKnitPath()
  }
}

export function getSiliconeYStentTopology(): {
  junction: THREE.Vector3
  limbs: StentLimbDescriptor[]
} {
  const junction = new THREE.Vector3(0, -0.18, 0)
  return {
    junction,
    limbs: [
      {
        id: 'tracheal',
        start: junction.clone(),
        end: new THREE.Vector3(0, STENT_LENGTH * 0.5, 0),
        radius: 0.69,
      },
      {
        id: 'left',
        start: junction.clone(),
        end: new THREE.Vector3(-1.38, -2.02, 0),
        radius: 0.53,
      },
      {
        id: 'right',
        start: junction.clone(),
        end: new THREE.Vector3(1.38, -2.02, 0),
        radius: 0.53,
      },
    ],
  }
}
