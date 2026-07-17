import type { DeviceArchitectureId } from '../content/deviceArchitectureProfiles'

export const DEVICE_LENGTH = 4.8
export const DEVICE_RADIUS = 1.12
export const WIRE_RADIUS = 0.035

const TAU = Math.PI * 2

export type PointTuple = readonly [x: number, y: number, z: number]

export interface DevicePath {
  id: string
  family: 'crown' | 'bridge' | 'anchor' | 'clockwise' | 'counterclockwise' | 'single-wire'
  closed: boolean
  radiusScale: number
  points: PointTuple[]
}

function cylindricalPoint(theta: number, y: number, radius: number): PointTuple {
  return [Math.cos(theta) * radius, y, Math.sin(theta) * radius]
}

export function buildAeroPaths(): DevicePath[] {
  const paths: DevicePath[] = []
  const rowCount = 8
  const crownCount = 10
  const crownHeight = 0.2
  const firstCenter = -DEVICE_LENGTH * 0.5 + 0.42
  const lastCenter = DEVICE_LENGTH * 0.5 - 0.42
  const rowSpacing = (lastCenter - firstCenter) / (rowCount - 1)

  for (let row = 0; row < rowCount; row += 1) {
    const centerY = firstCenter + row * rowSpacing
    const endWeight = Math.pow(Math.abs(centerY) / (DEVICE_LENGTH * 0.5), 5)
    const rowRadius = DEVICE_RADIUS * (1 + endWeight * 0.045)
    const points = Array.from({ length: crownCount * 2 }, (_, pointIndex) => {
      const theta = (pointIndex / (crownCount * 2)) * TAU
      const alternatingY = pointIndex % 2 === 0 ? -crownHeight : crownHeight
      return cylindricalPoint(theta, centerY + alternatingY, rowRadius)
    })

    paths.push({
      id: `aero-crown-${row}`,
      family: 'crown',
      closed: true,
      radiusScale: 1,
      points,
    })
  }

  for (let row = 0; row < rowCount - 1; row += 1) {
    const lowerCenter = firstCenter + row * rowSpacing
    const upperCenter = lowerCenter + rowSpacing
    for (let connector = 0; connector < 5; connector += 1) {
      const theta = (connector / 5) * TAU + (row % 2 === 0 ? TAU / (crownCount * 2) : 0)
      const lowerRadius =
        DEVICE_RADIUS * (1 + Math.pow(Math.abs(lowerCenter) / (DEVICE_LENGTH * 0.5), 5) * 0.045)
      const upperRadius =
        DEVICE_RADIUS * (1 + Math.pow(Math.abs(upperCenter) / (DEVICE_LENGTH * 0.5), 5) * 0.045)
      const middleY = (lowerCenter + upperCenter) * 0.5

      paths.push({
        id: `aero-bridge-${row}-${connector}`,
        family: 'bridge',
        closed: false,
        radiusScale: 1,
        points: [
          cylindricalPoint(theta, lowerCenter + crownHeight, lowerRadius),
          cylindricalPoint(theta + 0.035, middleY, DEVICE_RADIUS * 1.015),
          cylindricalPoint(theta, upperCenter - crownHeight, upperRadius),
        ],
      })
    }
  }

  for (const endDirection of [-1, 1] as const) {
    const baseY = endDirection * (DEVICE_LENGTH * 0.5 - 0.2)
    for (let anchor = 0; anchor < 6; anchor += 1) {
      const theta = (anchor / 6) * TAU + (endDirection > 0 ? 0.08 : 0)
      paths.push({
        id: `aero-anchor-${endDirection}-${anchor}`,
        family: 'anchor',
        closed: false,
        radiusScale: 0.92,
        points: [
          cylindricalPoint(theta, baseY - endDirection * 0.18, DEVICE_RADIUS * 1.025),
          cylindricalPoint(theta, baseY, DEVICE_RADIUS * 1.14),
          cylindricalPoint(
            theta + endDirection * 0.045,
            baseY + endDirection * 0.2,
            DEVICE_RADIUS * 1.07,
          ),
        ],
      })
    }
  }

  return paths
}

export function buildBonastentPaths(): DevicePath[] {
  const paths: DevicePath[] = []
  const wireCountPerDirection = 8
  const turns = 4.15
  const sampleCount = 180

  for (const direction of [-1, 1] as const) {
    for (let wireIndex = 0; wireIndex < wireCountPerDirection; wireIndex += 1) {
      const phase = (wireIndex / wireCountPerDirection) * TAU
      const points = Array.from({ length: sampleCount + 1 }, (_, sampleIndex) => {
        const t = sampleIndex / sampleCount
        const y = -DEVICE_LENGTH * 0.5 + t * DEVICE_LENGTH
        const theta = phase + direction * turns * TAU * t
        const endFlare = 0.045 * Math.pow(Math.abs(2 * t - 1), 7)

        // The two families receive opposite radial offsets. The wave changes sign at
        // successive crossing levels, making an explicit over-under visual order.
        const crossingWave = Math.cos(wireCountPerDirection * turns * TAU * t)
        const hookWave = Math.sin(wireCountPerDirection * turns * TAU * t)
        const radius =
          DEVICE_RADIUS * (1 + endFlare) + direction * WIRE_RADIUS * 0.72 * crossingWave

        return cylindricalPoint(theta, y + hookWave * 0.012, radius)
      })

      paths.push({
        id: `bonastent-${direction > 0 ? 'clockwise' : 'counterclockwise'}-${wireIndex}`,
        family: direction > 0 ? 'clockwise' : 'counterclockwise',
        closed: false,
        radiusScale: 0.96,
        points,
      })
    }
  }

  return paths
}

export function buildUltraflexPaths(): DevicePath[] {
  const columnCount = 10
  const rowCount = 8
  const samplesPerRow = 14
  const innerLength = DEVICE_LENGTH - 0.32
  const rowHeight = innerLength / rowCount
  const loopWidth = (TAU / columnCount) * 0.48
  const points: PointTuple[] = []

  for (let column = 0; column < columnCount; column += 1) {
    const upward = column % 2 === 0
    const baseTheta = (column / columnCount) * TAU
    const sampleCount = rowCount * samplesPerRow

    for (let sample = 0; sample <= sampleCount; sample += 1) {
      const traversal = sample / sampleCount
      const axialProgress = upward ? traversal : 1 - traversal
      const rowCoordinate = Math.min(rowCount - 0.0001, axialProgress * rowCount)
      const rowIndex = Math.floor(rowCoordinate)
      const localProgress = rowCoordinate - rowIndex
      const loopPhase = localProgress * TAU
      const baseY = -innerLength * 0.5 + (rowIndex + localProgress) * rowHeight
      const loopDirection = upward ? 1 : -1
      const y = baseY + loopDirection * rowHeight * 0.22 * Math.sin(loopPhase)
      const theta = baseTheta + loopWidth * Math.sin(loopPhase)
      const radius = DEVICE_RADIUS + WIRE_RADIUS * 0.75 * Math.cos(loopPhase)
      points.push(cylindricalPoint(theta, y, radius))
    }

    if (column < columnCount - 1) {
      const connectorSteps = 10
      const nextTheta = ((column + 1) / columnCount) * TAU
      const connectorY = upward ? innerLength * 0.5 : -innerLength * 0.5
      for (let step = 1; step <= connectorSteps; step += 1) {
        const t = step / connectorSteps
        const theta = baseTheta + (nextTheta - baseTheta) * t
        const radius = DEVICE_RADIUS + Math.sin(t * Math.PI) * WIRE_RADIUS * 1.6
        points.push(cylindricalPoint(theta, connectorY, radius))
      }
    }
  }

  return [
    {
      id: 'ultraflex-single-wire',
      family: 'single-wire',
      closed: false,
      radiusScale: 1.04,
      points,
    },
  ]
}

export function buildDevicePaths(id: DeviceArchitectureId) {
  if (id === 'aero') return buildAeroPaths()
  if (id === 'bonastent') return buildBonastentPaths()
  return buildUltraflexPaths()
}
