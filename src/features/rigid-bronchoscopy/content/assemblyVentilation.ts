import type {
  AssemblyPartDefinition,
  AssemblyVector3,
} from '@/features/rigid-bronchoscopy/content/assemblyParts'
import {
  getVentilationScopePose,
  realisticAirwayGeometry,
  transformVentilationScopePoint,
  VENTILATION_FENESTRATION_LOCAL_XS,
  type VentilationScopePose,
  type VentilationScopePositionId,
} from '@/features/rigid-bronchoscopy/content/assemblyAirway'
import {
  getTubeDistalX,
  type AssemblyPathwaySegment,
} from '@/features/rigid-bronchoscopy/content/assemblyPathways'

export type { VentilationScopePositionId } from '@/features/rigid-bronchoscopy/content/assemblyAirway'

export type VentilationModeId =
  | 'conventional'
  | 'spontaneous-assist'
  | 'low-frequency-jet'
  | 'high-frequency-jet'

export type VentilationPredictionId =
  | 'both-branches'
  | 'contralateral-fenestrations'
  | 'mainstem-only'

export type VentilationLeakSeverity = 'limited' | 'fenestrations-above-cords'
export type VentilationSideFenestrationFinding = 'available' | 'unavailable' | 'not-applicable'

export interface VentilationModeProfile {
  particleCount: number
  particleRadius: number
  particleSpan: number
  speed: number
  burstFrequencyHz?: number
  burstDutyCycle?: number
}

export interface VentilationComparison {
  expectedPrediction: VentilationPredictionId
  leakSeverity: VentilationLeakSeverity
  mode: VentilationModeId
  modeProfile: VentilationModeProfile
  obstructionPosition: AssemblyVector3
  instrumentedMainstemReceivesFlow: boolean
  oppositeMainstemReceivesFlow: boolean
  position: VentilationScopePositionId
  scopePose: VentilationScopePose
  segments: readonly AssemblyPathwaySegment[]
  sideFenestrationFinding: VentilationSideFenestrationFinding
  tipPosition: AssemblyVector3
  tubeType: 'bronchial' | 'tracheal'
}

export const ventilationModeIds: readonly VentilationModeId[] = [
  'conventional',
  'spontaneous-assist',
  'low-frequency-jet',
  'high-frequency-jet',
]

export const ventilationScopePositionIds: readonly VentilationScopePositionId[] = [
  'proximal-trachea',
  'at-carina',
  'past-carina',
]

export const ventilationPredictionIds: readonly VentilationPredictionId[] = [
  'both-branches',
  'contralateral-fenestrations',
  'mainstem-only',
]

export const ventilationSourceIds = [
  'diaz-jimenez-interventions-2023',
  'pathak-ventilation-2014',
  'yang-jet-model-2025',
] as const

export const ventilationAirwayGeometry = realisticAirwayGeometry

const modeProfiles: Record<VentilationModeId, VentilationModeProfile> = {
  conventional: {
    particleCount: 9,
    particleRadius: 0.038,
    particleSpan: 0.82,
    speed: 0.16,
    burstFrequencyHz: 0.24,
    burstDutyCycle: 0.65,
  },
  'spontaneous-assist': {
    particleCount: 7,
    particleRadius: 0.033,
    particleSpan: 0.68,
    speed: 0.12,
    burstFrequencyHz: 0.2,
    burstDutyCycle: 0.8,
  },
  'low-frequency-jet': {
    particleCount: 4,
    particleRadius: 0.058,
    particleSpan: 0.12,
    speed: 0.32,
    burstFrequencyHz: 0.28,
    burstDutyCycle: 0.65,
  },
  'high-frequency-jet': {
    particleCount: 15,
    particleRadius: 0.024,
    particleSpan: 0.34,
    speed: 0.58,
    burstFrequencyHz: 2.2,
    burstDutyCycle: 0.82,
  },
}

function styleSegment(
  id: string,
  legendId: AssemblyPathwaySegment['legendId'],
  color: string,
  particleColor: string,
  points: readonly AssemblyVector3[],
  profile: VentilationModeProfile,
  options: {
    countScale?: number
    radiusScale?: number
    reverse?: boolean
    speedScale?: number
    span?: number
  } = {},
): AssemblyPathwaySegment {
  return {
    id,
    color,
    legendId,
    particleColor,
    particleCount: Math.max(2, Math.round(profile.particleCount * (options.countScale ?? 1))),
    particleRadius: profile.particleRadius * (options.radiusScale ?? 1),
    particleSpan: options.span ?? profile.particleSpan,
    burstFrequencyHz: profile.burstFrequencyHz,
    burstDutyCycle: profile.burstDutyCycle,
    points,
    radius: 0.012,
    reverse: options.reverse,
    speed: profile.speed * (options.speedScale ?? 1),
  }
}

export function getVentilationModeProfile(mode: VentilationModeId) {
  return modeProfiles[mode]
}

export function getExpectedVentilationPrediction(
  tubeType: 'bronchial' | 'tracheal',
  position: VentilationScopePositionId,
  hasDistalFenestrations = tubeType === 'bronchial',
): VentilationPredictionId {
  if (position !== 'past-carina') return 'both-branches'
  return hasDistalFenestrations ? 'contralateral-fenestrations' : 'mainstem-only'
}

export function getVentilationComparison(
  mode: VentilationModeId,
  tube: AssemblyPartDefinition,
  options: {
    distalEgressOpen?: boolean
    position?: VentilationScopePositionId
  } = {},
): VentilationComparison {
  const position = options.position ?? 'at-carina'
  const distalEgressOpen = options.distalEgressOpen ?? true
  const tubeType =
    tube.tubeType ??
    (tube.workingLengthMm && tube.workingLengthMm >= 300 ? 'bronchial' : 'tracheal')
  const hasFenestrations = tube.hasDistalFenestrations ?? tubeType === 'bronchial'
  const profile = modeProfiles[mode]
  const tubeDistalX = getTubeDistalX(tube)
  const scopePose = getVentilationScopePose(tubeDistalX, position)
  const tipPosition = scopePose.worldTip
  const isJet = mode === 'low-frequency-jet' || mode === 'high-frequency-jet'
  const axialEndX = tubeDistalX - 0.08
  const axialControlPoints = (startX: number): readonly AssemblyVector3[] => [
    [startX + (axialEndX - startX) * 0.12, ventilationAirwayGeometry.airwayY, 0],
    [startX + (axialEndX - startX) * 0.42, ventilationAirwayGeometry.airwayY, 0],
    [startX + (axialEndX - startX) * 0.74, ventilationAirwayGeometry.airwayY, 0],
    [axialEndX, ventilationAirwayGeometry.airwayY, 0],
  ]
  const localInletPoints: readonly AssemblyVector3[] = isJet
    ? [
        [-2.109, -0.53, 0],
        [-2.109, -0.41, 0],
        [-2.05, ventilationAirwayGeometry.airwayY, 0],
        ...axialControlPoints(-2.05),
        scopePose.localTip,
      ]
    : mode === 'spontaneous-assist'
      ? [
          [-2.77, ventilationAirwayGeometry.airwayY, 0],
          [-2.48, ventilationAirwayGeometry.airwayY, 0],
          [-1.84, ventilationAirwayGeometry.airwayY, 0],
          ...axialControlPoints(-1.84),
          scopePose.localTip,
        ]
      : [
          [-1.88, -0.72, 0],
          [-1.91, -0.52, 0],
          [-1.95, -0.34, 0],
          [-1.84, ventilationAirwayGeometry.airwayY, 0],
          ...axialControlPoints(-1.84),
          scopePose.localTip,
        ]
  const inletPoints = localInletPoints.map((point) =>
    transformVentilationScopePoint(point, scopePose),
  )

  const segments: AssemblyPathwaySegment[] = [
    styleSegment(
      `${mode}-inflow`,
      'inspiratory-flow',
      isJet ? '#38bdf8' : '#22d3ee',
      isJet ? '#e0f2fe' : '#a5f3fc',
      inletPoints,
      profile,
    ),
  ]

  const downstreamTrachea = ventilationAirwayGeometry.trachea.filter(
    (point) => point[0] > tipPosition[0] + 0.015,
  )
  const instrumentedPoints: readonly AssemblyVector3[] =
    position === 'past-carina'
      ? [tipPosition, ...ventilationAirwayGeometry.instrumentedMainstem.slice(2)]
      : [
          tipPosition,
          ...downstreamTrachea,
          ...ventilationAirwayGeometry.instrumentedMainstem.slice(1),
        ]
  const instrumentedMainstemReceivesFlow = distalEgressOpen
  if (instrumentedMainstemReceivesFlow) {
    segments.push(
      styleSegment(
        'instrumented-mainstem-flow',
        'ventilation-flow',
        '#34d399',
        '#d1fae5',
        instrumentedPoints,
        profile,
        { countScale: 0.72, radiusScale: 0.86, speedScale: 0.82 },
      ),
    )
  }

  const oppositeMainstemRouteAvailable = position !== 'past-carina' || hasFenestrations
  const oppositeMainstemReceivesFlow =
    oppositeMainstemRouteAvailable &&
    (distalEgressOpen ||
      position === 'at-carina' ||
      (position === 'past-carina' && hasFenestrations))
  if (oppositeMainstemReceivesFlow) {
    const fenestrationWorldPoints = VENTILATION_FENESTRATION_LOCAL_XS.map((x) =>
      transformVentilationScopePoint([x, ventilationAirwayGeometry.airwayY, 0.052], scopePose),
    )
    const carina = ventilationAirwayGeometry.carina
    const fenestrationNearestCarina = fenestrationWorldPoints.reduce((nearest, candidate) => {
      const nearestDistance = Math.hypot(
        nearest[0] - carina[0],
        nearest[1] - carina[1],
        nearest[2] - carina[2],
      )
      const candidateDistance = Math.hypot(
        candidate[0] - carina[0],
        candidate[1] - carina[1],
        candidate[2] - carina[2],
      )
      return candidateDistance < nearestDistance ? candidate : nearest
    })
    const oppositePoints: readonly AssemblyVector3[] =
      position === 'past-carina'
        ? [
            fenestrationNearestCarina,
            ventilationAirwayGeometry.carina,
            ...ventilationAirwayGeometry.oppositeMainstem.slice(1),
          ]
        : [
            tipPosition,
            ...downstreamTrachea,
            ...ventilationAirwayGeometry.oppositeMainstem.slice(1),
          ]
    segments.push(
      styleSegment(
        position === 'past-carina' ? 'contralateral-fenestration-flow' : 'opposite-mainstem-flow',
        position === 'past-carina' ? 'side-fenestration-flow' : 'ventilation-flow',
        position === 'past-carina' ? '#fbbf24' : '#34d399',
        position === 'past-carina' ? '#fef3c7' : '#d1fae5',
        oppositePoints,
        profile,
        { countScale: 0.68, radiusScale: 0.82, speedScale: 0.78 },
      ),
    )
  }

  const leakSeverity: VentilationLeakSeverity =
    position === 'proximal-trachea' && hasFenestrations ? 'fenestrations-above-cords' : 'limited'
  const glottis = ventilationAirwayGeometry.glottis
  const fenestrationWorldPoints = VENTILATION_FENESTRATION_LOCAL_XS.map((x) =>
    transformVentilationScopePoint([x, ventilationAirwayGeometry.airwayY, 0.052], scopePose),
  )
  const proximalFenestrations = fenestrationWorldPoints.filter(
    (point) => point[0] <= ventilationAirwayGeometry.glottisX + 0.02,
  )
  const leakOrigin =
    leakSeverity === 'fenestrations-above-cords' && proximalFenestrations.length > 0
      ? proximalFenestrations[proximalFenestrations.length - 1]
      : ([glottis[0] + 0.05, glottis[1] + 0.08, glottis[2] + 0.06] as const)
  const leakPoints: readonly AssemblyVector3[] =
    leakSeverity === 'fenestrations-above-cords'
      ? [
          leakOrigin,
          [glottis[0] - 0.08, glottis[1] + 0.16, glottis[2] + 0.14],
          [glottis[0] - 0.24, glottis[1] + 0.34, glottis[2] + 0.24],
          [glottis[0] - 0.46, glottis[1] + 0.54, glottis[2] + 0.36],
        ]
      : [
          leakOrigin,
          [glottis[0] - 0.04, glottis[1] + 0.11, glottis[2] + 0.1],
          [glottis[0] - 0.16, glottis[1] + 0.24, glottis[2] + 0.17],
          [glottis[0] - 0.3, glottis[1] + 0.4, glottis[2] + 0.27],
        ]
  segments.push(
    styleSegment(
      leakSeverity === 'fenestrations-above-cords'
        ? 'fenestration-related-proximal-leak'
        : 'limited-proximal-leak',
      'proximal-leak',
      '#fb923c',
      '#fed7aa',
      leakPoints,
      profile,
      leakSeverity === 'fenestrations-above-cords'
        ? { countScale: 1.35, radiusScale: 1.12, speedScale: 1.15, span: 0.48 }
        : { countScale: 0.35, radiusScale: 0.62, speedScale: 0.68, span: 0.22 },
    ),
  )

  const localProximalExpiratoryPoints: readonly AssemblyVector3[] =
    mode === 'conventional'
      ? [
          [-1.88, -0.72, -0.08],
          [-1.95, -0.34, -0.08],
          [tubeDistalX - 0.12, -0.22, -0.1],
          scopePose.localTip,
        ]
      : [
          [-2.77, -0.18, -0.11],
          [-2.42, -0.2, -0.11],
          [tubeDistalX - 0.12, -0.22, -0.1],
          scopePose.localTip,
        ]
  const proximalExpiratoryPoints = localProximalExpiratoryPoints.map((point) =>
    transformVentilationScopePoint(point, scopePose),
  )
  const obstructionPosition =
    instrumentedPoints[1] ?? ventilationAirwayGeometry.instrumentedMainstem[1]
  const expiratoryPoints: readonly AssemblyVector3[] = distalEgressOpen
    ? [...proximalExpiratoryPoints, ...instrumentedPoints.slice(1)]
    : [obstructionPosition, ...instrumentedPoints.slice(2, 5)]
  segments.push(
    styleSegment(
      distalEgressOpen ? 'passive-expiratory-egress' : 'restricted-expiratory-egress',
      'expiratory-egress',
      '#818cf8',
      '#c7d2fe',
      expiratoryPoints,
      profile,
      { countScale: 0.58, radiusScale: 0.66, reverse: true, speedScale: 0.58 },
    ),
  )

  const sideFenestrationFinding: VentilationSideFenestrationFinding =
    position !== 'past-carina' ? 'not-applicable' : hasFenestrations ? 'available' : 'unavailable'

  return {
    expectedPrediction: getExpectedVentilationPrediction(tubeType, position, hasFenestrations),
    instrumentedMainstemReceivesFlow,
    leakSeverity,
    mode,
    modeProfile: profile,
    obstructionPosition,
    oppositeMainstemReceivesFlow,
    position,
    scopePose,
    segments,
    sideFenestrationFinding,
    tipPosition,
    tubeType,
  }
}
