import type {
  AssemblyPartDefinition,
  AssemblyVector3,
} from '@/features/rigid-bronchoscopy/content/assemblyParts'
import {
  getInstrumentRoute,
  getInstrumentRouteForTool,
  type InstrumentRoute,
  type InstrumentRouteId,
  type LumenClearanceResult,
  type RespiratoryPhaseId,
  type RigidPortId,
  type RigidSemanticAnchorId,
} from '@/features/rigid-bronchoscopy/content/assemblyTopology'
import {
  getInstrumentRouteClearance,
  getTubeAxialLandmarks,
  millimetersToWorldUnits,
} from '@/features/rigid-bronchoscopy/engine/dimensions'

export type AssemblyPathwayId = 'ventilation' | 'instrument' | 'optics-light'

export type AssemblyPathwayLegendId =
  | 'ventilation-flow'
  | 'inspiratory-flow'
  | 'expiratory-egress'
  | 'side-fenestration-flow'
  | 'proximal-leak'
  | 'ambient-entrainment'
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
  activePhaseIds?: readonly RespiratoryPhaseId[]
}

export interface AssemblyPathwayDefinition {
  id: AssemblyPathwayId
  segments: readonly AssemblyPathwaySegment[]
  activePortId?: RigidPortId
  instrumentRoute?: InstrumentRoute
  compatibility?: LumenClearanceResult
}

export const assemblyPathwayIds: readonly AssemblyPathwayId[] = [
  'ventilation',
  'instrument',
  'optics-light',
]

const STATIC_ANCHOR_POINTS = {
  mainAxialEntrance: [-2.73, -0.3, 0],
  mainAxialLumen: [-2.48, -0.3, 0],
  accessoryGateEntrance: [-2.512, 0.45, -0.009],
  accessoryGateJunction: [-2.12, -0.3, 0],
  anesthesiaCircuitConnector: [-1.88, -0.72, 0],
  anesthesiaCircuitJunction: [-1.84, -0.3, 0],
  jetConnector: [-2.109, -0.53, 0],
  jetJunction: [-2.05, -0.3, 0],
  tubeLumen: [-1.72, -0.3, 0],
} as const satisfies Partial<Record<RigidSemanticAnchorId, AssemblyVector3>>

export function getTubeDistalX(tube: AssemblyPartDefinition) {
  return getTubeAxialLandmarks(tube).bevel[0]
}

export function getTubeSafetyStopX(tube: AssemblyPartDefinition) {
  return getTubeAxialLandmarks(tube).safetyStop[0]
}

function resolveInstrumentAnchor(
  anchorId: RigidSemanticAnchorId,
  tube: AssemblyPartDefinition,
): AssemblyVector3 {
  const staticPoint = STATIC_ANCHOR_POINTS[anchorId as keyof typeof STATIC_ANCHOR_POINTS]
  if (staticPoint) return staticPoint

  const landmarks = getTubeAxialLandmarks(tube)
  if (anchorId === 'tubeBevel') return landmarks.bevel
  if (anchorId === 'tubeSafetyStop') return landmarks.safetyStop
  if (anchorId === 'telescopeObjective') return landmarks.telescopeObjective
  if (anchorId === 'toolEndpoint') {
    return [
      landmarks.bevel[0] + millimetersToWorldUnits(35),
      landmarks.bevel[1],
      landmarks.bevel[2],
    ]
  }

  throw new Error(`No pathway coordinate for semantic anchor ${anchorId}`)
}

export function getInstrumentPathway(
  routeId: InstrumentRouteId,
  tube: AssemblyPartDefinition,
): AssemblyPathwayDefinition {
  const route = getInstrumentRoute(routeId)
  const compatibility = getInstrumentRouteClearance(route, tube)

  if (!compatibility.allowed) {
    return {
      id: 'instrument',
      activePortId: route.entryPort,
      compatibility,
      instrumentRoute: route,
      segments: [],
    }
  }

  return {
    id: 'instrument',
    activePortId: route.entryPort,
    compatibility,
    instrumentRoute: route,
    segments: [
      {
        id: route.id,
        color: route.entryPort === 'mainAxial' ? '#fb7185' : '#f472b6',
        legendId: 'instrument-tip',
        particleColor: route.entryPort === 'mainAxial' ? '#ffe4e6' : '#fbcfe8',
        particleCount: 3,
        particleRadius: 0.052,
        points: route.anchorSequence.map((anchorId) => resolveInstrumentAnchor(anchorId, tube)),
        radius: 0.012,
        speed: 0.11,
      },
    ],
  }
}

export function getAssemblyPathway(
  id: AssemblyPathwayId,
  tube: AssemblyPartDefinition,
  options: {
    distalEgressOpen?: boolean
    instrumentRouteId?: InstrumentRouteId
    selectedToolId?: string
  } = {},
): AssemblyPathwayDefinition {
  const landmarks = getTubeAxialLandmarks(tube)

  if (id === 'ventilation') {
    const distalEgressOpen = options.distalEgressOpen ?? true
    const flowEnd = distalEgressOpen ? landmarks.bevel : landmarks.safetyStop
    return {
      id,
      activePortId: 'anesthesiaCircuit',
      segments: [
        {
          id: 'assisted-ventilation-flow',
          color: '#22d3ee',
          legendId: 'ventilation-flow',
          particleColor: '#a5f3fc',
          particleCount: distalEgressOpen ? 9 : 13,
          particleRadius: 0.034,
          points: [
            STATIC_ANCHOR_POINTS.anesthesiaCircuitConnector,
            [-1.91, -0.52, 0],
            [-1.95, -0.34, 0],
            STATIC_ANCHOR_POINTS.anesthesiaCircuitJunction,
            STATIC_ANCHOR_POINTS.tubeLumen,
            flowEnd,
          ],
          radius: 0.014,
          speed: distalEgressOpen ? 0.2 : 0.08,
          activePhaseIds: ['controlled-inspiration', 'assisted-inspiration'],
        },
      ],
    }
  }

  if (id === 'instrument') {
    const selectedRoute = options.instrumentRouteId
      ? getInstrumentRoute(options.instrumentRouteId)
      : options.selectedToolId
        ? getInstrumentRouteForTool(options.selectedToolId)
        : undefined
    return getInstrumentPathway(selectedRoute?.id ?? 'optical-forceps-main-axial', tube)
  }

  return {
    id,
    activePortId: 'mainAxial',
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
          landmarks.telescopeObjective,
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
          landmarks.telescopeObjective,
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
