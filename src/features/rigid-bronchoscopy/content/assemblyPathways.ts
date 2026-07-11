import type {
  AssemblyPartDefinition,
  AssemblyVector3,
} from '@/features/rigid-bronchoscopy/content/assemblyParts'

export type AssemblyPathwayId = 'ventilation' | 'instrument' | 'optics-light'

export type AssemblyPathwayLegendId =
  | 'ventilation-flow'
  | 'inspiratory-flow'
  | 'expiratory-egress'
  | 'side-fenestration-flow'
  | 'proximal-leak'
  | 'instrument-tip'
  | 'illumination-outward'
  | 'image-return'

export interface AssemblyPathwaySegment {
  id: string
  color: string
  legendId: AssemblyPathwayLegendId
  particleColor: string
  particleCount: number
  particleRadius: number
  particleSpan?: number
  burstFrequencyHz?: number
  burstDutyCycle?: number
  points: readonly AssemblyVector3[]
  radius: number
  reverse?: boolean
  speed: number
}

export interface AssemblyPathwayDefinition {
  id: AssemblyPathwayId
  segments: readonly AssemblyPathwaySegment[]
}

export const assemblyPathwayIds: readonly AssemblyPathwayId[] = [
  'ventilation',
  'instrument',
  'optics-light',
]

const DEFAULT_TUBE_WORKING_LENGTH_MM = 360
const DISTAL_SAFETY_STOP_OFFSET = 0.09

export function getTubeDistalX(tube: AssemblyPartDefinition) {
  const numericScale = typeof tube.target.scale === 'number' ? tube.target.scale : 1
  const workingLengthMm = tube.workingLengthMm ?? DEFAULT_TUBE_WORKING_LENGTH_MM
  return (
    tube.target.position[0] + (workingLengthMm / 1000) * numericScale - DISTAL_SAFETY_STOP_OFFSET
  )
}

export function getAssemblyPathway(
  id: AssemblyPathwayId,
  tube: AssemblyPartDefinition,
  options: { distalEgressOpen?: boolean } = {},
): AssemblyPathwayDefinition {
  const tubeDistalX = getTubeDistalX(tube)

  if (id === 'ventilation') {
    const distalEgressOpen = options.distalEgressOpen ?? true
    const flowEndX = distalEgressOpen ? tubeDistalX : tubeDistalX - 0.28
    return {
      id,
      segments: [
        {
          id: 'assisted-ventilation-flow',
          color: '#22d3ee',
          legendId: 'ventilation-flow',
          particleColor: '#a5f3fc',
          particleCount: distalEgressOpen ? 9 : 13,
          particleRadius: 0.034,
          points: [
            [-1.88, -0.72, 0],
            [-1.91, -0.52, 0],
            [-1.95, -0.34, 0],
            [-1.84, -0.3, 0],
            [-0.2, -0.3, 0],
            [flowEndX, -0.3, 0],
          ],
          radius: 0.014,
          speed: distalEgressOpen ? 0.2 : 0.08,
        },
      ],
    }
  }

  if (id === 'instrument') {
    return {
      id,
      segments: [
        {
          id: 'lateral-instrument-route',
          color: '#f472b6',
          legendId: 'instrument-tip',
          particleColor: '#fbcfe8',
          particleCount: 3,
          particleRadius: 0.052,
          points: [
            [-2.512, 0.45, -0.009],
            [-2.473, 0.32, -0.009],
            [-2.414, 0.18, -0.009],
            [-2.291, -0.121, -0.009],
            [-2.12, -0.3, 0],
            [tubeDistalX, -0.3, 0],
          ],
          radius: 0.012,
          speed: 0.11,
        },
      ],
    }
  }

  return {
    id,
    segments: [
      {
        id: 'illumination-path',
        color: '#fbbf24',
        legendId: 'illumination-outward',
        particleColor: '#fef3c7',
        particleCount: 8,
        particleRadius: 0.03,
        points: [
          [-2.794, -0.84, -0.025],
          [-2.794, -0.72, -0.025],
          [-2.794, -0.65, -0.025],
          [-2.794, -0.56, -0.025],
          [-2.75, -0.44, -0.025],
          [-2.6, -0.32, -0.025],
          [-0.45, -0.3, -0.025],
          [1.765, -0.3, -0.025],
        ],
        radius: 0.01,
        speed: 0.19,
      },
      {
        id: 'image-return-path',
        color: '#a78bfa',
        legendId: 'image-return',
        particleColor: '#ddd6fe',
        particleCount: 8,
        particleRadius: 0.03,
        points: [
          [1.765, -0.3, 0.035],
          [0.4, -0.3, 0.035],
          [-1, -0.3, 0.035],
          [-2.65, -0.3, 0.035],
          [-2.869, -0.3, 0.035],
        ],
        radius: 0.01,
        speed: 0.17,
      },
    ],
  }
}
