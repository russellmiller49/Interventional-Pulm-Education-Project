import {
  bronchoscopeTubeOptions,
  type AssemblyPartDefinition,
  type AssemblyVector3,
} from '@/features/rigid-bronchoscopy/content/assemblyParts'
import {
  centralAirwayGeometry,
  getVentilationFenestrationLocalXs,
  getVentilationScopePose,
  transformVentilationScopePoint,
  type CanonicalVentilationScopePositionId,
  type VentilationScopePose,
  type VentilationScopePositionId,
} from '@/features/rigid-bronchoscopy/content/assemblyAirway'
import {
  respiratoryPhaseIds,
  type ProceduralPoseId,
  type RespiratoryPhaseDefinition,
  type RespiratoryPhaseId,
  type RigidPortId,
  type VentilationModeId,
  type VentilationObstructionState,
  type VentilationSetup,
} from '@/features/rigid-bronchoscopy/content/assemblyTopology'
import {
  getTubeDistalX,
  type AssemblyPathwaySegment,
} from '@/features/rigid-bronchoscopy/content/assemblyPathways'

export type { VentilationScopePositionId } from '@/features/rigid-bronchoscopy/content/assemblyAirway'
export type {
  RespiratoryPhaseId,
  VentilationModeId,
  VentilationObstructionState,
  VentilationSetup,
} from '@/features/rigid-bronchoscopy/content/assemblyTopology'

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

export interface RespiratoryCycleDefinition {
  mode: VentilationModeId
  obstructionState: VentilationObstructionState
  durationSeconds: number
  phases: readonly RespiratoryPhaseDefinition[]
}

export interface RespiratoryCycleState {
  cycle: RespiratoryCycleDefinition
  completedCycles: number
  cycleProgress: number
  phase: RespiratoryPhaseDefinition
  phaseIndex: number
  phaseProgress: number
  relativeDistalAccumulation: number
}

export interface VentilationComparison {
  expectedPrediction: VentilationPredictionId
  leakSeverity: VentilationLeakSeverity
  mode: VentilationModeId
  modeProfile: VentilationModeProfile
  obstructionPosition: AssemblyVector3
  obstructionState: VentilationObstructionState
  inspirationPermitted: boolean
  expirationRestricted: boolean
  relativeDistalAccumulationPerCycle: number
  instrumentedMainstemReceivesFlow: boolean
  oppositeMainstemReceivesFlow: boolean
  position: VentilationScopePositionId
  scopePose: VentilationScopePose
  segments: readonly AssemblyPathwaySegment[]
  segmentsByPhase: Readonly<Record<RespiratoryPhaseId, readonly AssemblyPathwaySegment[]>>
  setup: VentilationSetup
  respiratoryCycle: RespiratoryCycleDefinition
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

/** Complete set of authored depth choices shown by the v2 interface. */
export const ventilationScopePositionIds: readonly CanonicalVentilationScopePositionId[] = [
  'proximal-trachea',
  'mid-trachea',
  'at-carina',
  'past-carina',
  'right-mainstem',
  'left-mainstem',
]

/** @deprecated Use `ventilationScopePositionIds`; these are no longer hidden legacy states. */
export const legacyVentilationScopePositionIds = [
  'proximal-trachea',
  'past-carina',
] as const satisfies readonly VentilationScopePositionId[]

export const ventilationPredictionIds: readonly VentilationPredictionId[] = [
  'both-branches',
  'contralateral-fenestrations',
  'mainstem-only',
]

export const ventilationObstructionStates: readonly VentilationObstructionState[] = [
  'open',
  'fixed-complete',
  'ball-valve',
]

export const ventilationSourceIds = [
  'diaz-jimenez-interventions-2023',
  'pathak-ventilation-2014',
  'sarkiss-eapen-airway-management-2022',
  'chest-cao-guideline-2025',
  'putz-jet-ventilation-2016',
  'yang-jet-model-2025',
] as const

export const ventilationAirwayGeometry = centralAirwayGeometry

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

export const ventilationSetups = {
  conventional: {
    mode: 'conventional',
    inlet: 'anesthesiaCircuit',
    proximalPortStates: {
      mainAxial: 'sealed',
      accessory: 'gated',
      anesthesiaCircuit: 'connected',
      jet: 'unused',
    },
    expiratoryOutlet: 'anesthesiaCircuit',
    leakBehavior: 'circuit-limited',
    timingProfileId: 'conventional',
  },
  'spontaneous-assist': {
    mode: 'spontaneous-assist',
    inlet: 'anesthesiaCircuit',
    proximalPortStates: {
      mainAxial: 'sealed',
      accessory: 'gated',
      anesthesiaCircuit: 'connected',
      jet: 'unused',
    },
    expiratoryOutlet: 'anesthesiaCircuit',
    leakBehavior: 'circuit-limited',
    timingProfileId: 'spontaneous-assist',
  },
  'low-frequency-jet': {
    mode: 'low-frequency-jet',
    inlet: 'jet',
    proximalPortStates: {
      mainAxial: 'open',
      accessory: 'gated',
      anesthesiaCircuit: 'unused',
      jet: 'connected',
    },
    expiratoryOutlet: 'openSystem',
    leakBehavior: 'open-system-expected',
    timingProfileId: 'low-frequency-jet',
  },
  'high-frequency-jet': {
    mode: 'high-frequency-jet',
    inlet: 'jet',
    proximalPortStates: {
      mainAxial: 'open',
      accessory: 'gated',
      anesthesiaCircuit: 'unused',
      jet: 'connected',
    },
    expiratoryOutlet: 'openSystem',
    leakBehavior: 'open-system-expected',
    timingProfileId: 'high-frequency-jet',
  },
} as const satisfies Record<VentilationModeId, VentilationSetup>

const cycleDurationsSeconds: Record<VentilationModeId, number> = {
  conventional: 4.2,
  'spontaneous-assist': 4.8,
  'low-frequency-jet': 1.6,
  'high-frequency-jet': 0.28,
}

function baseRespiratoryPhases(mode: VentilationModeId): RespiratoryPhaseDefinition[] {
  if (mode === 'conventional') {
    return [
      {
        id: 'controlled-inspiration',
        durationFraction: 0.38,
        flowDirection: 'inward',
        activePort: 'anesthesiaCircuit',
        distalInspirationPermitted: true,
        distalExpirationPermitted: false,
        accumulationDelta: 0,
      },
      {
        id: 'pause',
        durationFraction: 0.12,
        flowDirection: 'none',
        activePort: null,
        distalInspirationPermitted: false,
        distalExpirationPermitted: false,
        accumulationDelta: 0,
      },
      {
        id: 'expiration',
        durationFraction: 0.5,
        flowDirection: 'outward',
        activePort: 'anesthesiaCircuit',
        distalInspirationPermitted: false,
        distalExpirationPermitted: true,
        accumulationDelta: 0,
      },
    ]
  }

  if (mode === 'spontaneous-assist') {
    return [
      {
        id: 'patient-inspiration',
        durationFraction: 0.25,
        flowDirection: 'inward',
        activePort: 'anesthesiaCircuit',
        distalInspirationPermitted: true,
        distalExpirationPermitted: false,
        accumulationDelta: 0,
      },
      {
        id: 'assisted-inspiration',
        durationFraction: 0.18,
        flowDirection: 'inward',
        activePort: 'anesthesiaCircuit',
        distalInspirationPermitted: true,
        distalExpirationPermitted: false,
        accumulationDelta: 0,
      },
      {
        id: 'pause',
        durationFraction: 0.07,
        flowDirection: 'none',
        activePort: null,
        distalInspirationPermitted: false,
        distalExpirationPermitted: false,
        accumulationDelta: 0,
      },
      {
        id: 'expiration',
        durationFraction: 0.5,
        flowDirection: 'outward',
        activePort: 'anesthesiaCircuit',
        distalInspirationPermitted: false,
        distalExpirationPermitted: true,
        accumulationDelta: 0,
      },
    ]
  }

  return [
    {
      id: 'jet-pulse',
      durationFraction: mode === 'low-frequency-jet' ? 0.2 : 0.3,
      flowDirection: 'inward',
      activePort: 'jet',
      distalInspirationPermitted: true,
      distalExpirationPermitted: false,
      accumulationDelta: 0,
    },
    {
      id: 'pause',
      durationFraction: mode === 'low-frequency-jet' ? 0.2 : 0.15,
      flowDirection: 'none',
      activePort: null,
      distalInspirationPermitted: false,
      distalExpirationPermitted: false,
      accumulationDelta: 0,
    },
    {
      id: 'expiration',
      durationFraction: mode === 'low-frequency-jet' ? 0.6 : 0.55,
      flowDirection: 'outward',
      activePort: 'mainAxial',
      distalInspirationPermitted: false,
      distalExpirationPermitted: true,
      accumulationDelta: 0,
    },
  ]
}

export function getVentilationSetup(mode: VentilationModeId): VentilationSetup {
  return ventilationSetups[mode]
}

export function getRespiratoryCycle(
  mode: VentilationModeId,
  obstructionState: VentilationObstructionState = 'open',
): RespiratoryCycleDefinition {
  const basePhases = baseRespiratoryPhases(mode)
  const inwardPhaseCount = Math.max(
    1,
    basePhases.filter((phase) => phase.flowDirection === 'inward').length,
  )
  const phases = basePhases.map((phase) => {
    if (obstructionState === 'open') return phase
    if (obstructionState === 'fixed-complete') {
      return {
        ...phase,
        distalInspirationPermitted: false,
        distalExpirationPermitted: false,
      }
    }
    if (phase.flowDirection === 'inward') {
      return {
        ...phase,
        distalInspirationPermitted: true,
        accumulationDelta: 1 / inwardPhaseCount,
      }
    }
    if (phase.flowDirection === 'outward') {
      return { ...phase, distalExpirationPermitted: false }
    }
    return phase
  })

  return {
    mode,
    obstructionState,
    durationSeconds: cycleDurationsSeconds[mode],
    phases,
  }
}

export function getRespiratoryCycleState(
  mode: VentilationModeId,
  elapsedSeconds: number,
  obstructionState: VentilationObstructionState = 'open',
): RespiratoryCycleState {
  const cycle = getRespiratoryCycle(mode, obstructionState)
  const safeElapsed = Math.max(0, elapsedSeconds)
  const completedCycles = Math.floor(safeElapsed / cycle.durationSeconds)
  const cycleProgress = (safeElapsed % cycle.durationSeconds) / cycle.durationSeconds
  let phaseStart = 0
  let phaseIndex = cycle.phases.length - 1

  for (let index = 0; index < cycle.phases.length; index += 1) {
    const phaseEnd = phaseStart + cycle.phases[index].durationFraction
    if (cycleProgress < phaseEnd || index === cycle.phases.length - 1) {
      phaseIndex = index
      break
    }
    phaseStart = phaseEnd
  }

  const phase = cycle.phases[phaseIndex]
  const phaseProgress = Math.min(
    1,
    Math.max(0, (cycleProgress - phaseStart) / Math.max(phase.durationFraction, 1e-9)),
  )
  const completedAccumulationPerCycle = cycle.phases.reduce(
    (total, candidate) => total + candidate.accumulationDelta,
    0,
  )
  const completedPhaseAccumulation = cycle.phases
    .slice(0, phaseIndex)
    .reduce((total, candidate) => total + candidate.accumulationDelta, 0)
  const relativeDistalAccumulation =
    completedCycles * completedAccumulationPerCycle +
    completedPhaseAccumulation +
    phase.accumulationDelta * phaseProgress

  return {
    cycle,
    completedCycles,
    cycleProgress,
    phase,
    phaseIndex,
    phaseProgress,
    relativeDistalAccumulation,
  }
}

export type VentilationScenarioPresetId =
  | 'safe-default-controlled-mid-trachea'
  | 'spontaneous-assisted-mid-trachea'
  | 'low-frequency-jet-carina'
  | 'high-frequency-jet-carina'
  | 'controlled-long-bronchial-shallow-fenestration-leak'
  | 'controlled-short-tracheoscope-shallow-control'
  | 'controlled-long-bronchial-past-carina'
  | 'controlled-short-tracheoscope-past-carina-counterfactual'
  | 'controlled-right-mainstem'
  | 'controlled-left-mainstem'
  | 'fixed-complete-obstruction'
  | 'ball-valve-obstruction'

export interface VentilationScenarioPreset {
  id: VentilationScenarioPresetId
  mode: VentilationModeId
  tubeId: string
  position: CanonicalVentilationScopePositionId
  obstructionState: VentilationObstructionState
  proceduralPoseId: ProceduralPoseId
}

export type VentilationScenarioComparisonGroup =
  | 'baseline'
  | 'mode'
  | 'tube-pattern-shallow'
  | 'tube-pattern-past-carina'
  | 'mainstem'
  | 'obstruction'

export interface VentilationScenarioMetadata {
  label: string
  explanation: string
  comparisonGroup: VentilationScenarioComparisonGroup
  intent: 'representative' | 'counterfactual'
  geometryCompatibility:
    | 'validated-procedural-pose'
    | 'authored-teaching-position'
    | 'matched-diameter-counterfactual'
  disclaimer?: string
  expected: {
    prediction: VentilationPredictionId
    leakSeverity: VentilationLeakSeverity
    sideFenestrationFinding: VentilationSideFenestrationFinding
  }
}

export const safeDefaultVentilationPreset = {
  id: 'safe-default-controlled-mid-trachea',
  mode: 'conventional',
  tubeId: 'tube-bt2203-3',
  position: 'mid-trachea',
  obstructionState: 'open',
  proceduralPoseId: 'midTrachea',
} as const satisfies VentilationScenarioPreset

export const ventilationScenarioPresets = [
  safeDefaultVentilationPreset,
  {
    id: 'spontaneous-assisted-mid-trachea',
    mode: 'spontaneous-assist',
    tubeId: 'tube-bt2203-3',
    position: 'mid-trachea',
    obstructionState: 'open',
    proceduralPoseId: 'midTrachea',
  },
  {
    id: 'low-frequency-jet-carina',
    mode: 'low-frequency-jet',
    tubeId: 'tube-bt2203-3',
    position: 'at-carina',
    obstructionState: 'open',
    proceduralPoseId: 'carina',
  },
  {
    id: 'high-frequency-jet-carina',
    mode: 'high-frequency-jet',
    tubeId: 'tube-bt2203-3',
    position: 'at-carina',
    obstructionState: 'open',
    proceduralPoseId: 'carina',
  },
  {
    id: 'controlled-long-bronchial-shallow-fenestration-leak',
    mode: 'conventional',
    tubeId: 'tube-bt2105-3',
    position: 'proximal-trachea',
    obstructionState: 'open',
    proceduralPoseId: 'midTrachea',
  },
  {
    id: 'controlled-short-tracheoscope-shallow-control',
    mode: 'conventional',
    tubeId: 'tube-bt2205-3',
    position: 'proximal-trachea',
    obstructionState: 'open',
    proceduralPoseId: 'midTrachea',
  },
  {
    id: 'controlled-long-bronchial-past-carina',
    mode: 'conventional',
    tubeId: 'tube-bt2105-3',
    position: 'past-carina',
    obstructionState: 'open',
    proceduralPoseId: 'rightMainstem',
  },
  {
    id: 'controlled-short-tracheoscope-past-carina-counterfactual',
    mode: 'conventional',
    tubeId: 'tube-bt2205-3',
    position: 'past-carina',
    obstructionState: 'open',
    proceduralPoseId: 'rightMainstem',
  },
  {
    id: 'controlled-right-mainstem',
    mode: 'conventional',
    tubeId: 'tube-bt2105-3',
    position: 'right-mainstem',
    obstructionState: 'open',
    proceduralPoseId: 'rightMainstem',
  },
  {
    id: 'controlled-left-mainstem',
    mode: 'conventional',
    tubeId: 'tube-bt2105-3',
    position: 'left-mainstem',
    obstructionState: 'open',
    proceduralPoseId: 'leftMainstem',
  },
  {
    id: 'fixed-complete-obstruction',
    mode: 'conventional',
    tubeId: 'tube-bt2203-3',
    position: 'at-carina',
    obstructionState: 'fixed-complete',
    proceduralPoseId: 'carina',
  },
  {
    id: 'ball-valve-obstruction',
    mode: 'conventional',
    tubeId: 'tube-bt2203-3',
    position: 'at-carina',
    obstructionState: 'ball-valve',
    proceduralPoseId: 'carina',
  },
] as const satisfies readonly VentilationScenarioPreset[]

export const SAFE_DEFAULT_VENTILATION_PRESET_ID = safeDefaultVentilationPreset.id

export const ventilationScenarioMetadata = {
  'safe-default-controlled-mid-trachea': {
    label: 'Safe default: controlled, mid-trachea',
    explanation: 'BT2203 remains centered in the trachea with open distal egress.',
    comparisonGroup: 'baseline',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'not-applicable',
    },
  },
  'spontaneous-assisted-mid-trachea': {
    label: 'Spontaneous-assisted, mid-trachea',
    explanation: 'Patient inspiration and separate assist events use the anesthesia circuit.',
    comparisonGroup: 'mode',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'not-applicable',
    },
  },
  'low-frequency-jet-carina': {
    label: 'Low-frequency jet, carina',
    explanation:
      'Discrete pulses enter through the fixed jet port with passive open-system egress.',
    comparisonGroup: 'mode',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'not-applicable',
    },
  },
  'high-frequency-jet-carina': {
    label: 'High-frequency jet, carina',
    explanation:
      'Rapid small pulses enter through the fixed jet port with passive open-system egress.',
    comparisonGroup: 'mode',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'not-applicable',
    },
  },
  'controlled-long-bronchial-shallow-fenestration-leak': {
    label: 'Long bronchial tube shallow: side holes above cords',
    explanation:
      'The long BT2105 side fenestrations lie proximal to the glottis and form a major leak route.',
    comparisonGroup: 'tube-pattern-shallow',
    intent: 'representative',
    geometryCompatibility: 'authored-teaching-position',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'fenestrations-above-cords',
      sideFenestrationFinding: 'not-applicable',
    },
  },
  'controlled-short-tracheoscope-shallow-control': {
    label: 'Short tracheoscope shallow: no side-hole leak',
    explanation: 'The diameter-matched BT2205 has no distal side fenestrations.',
    comparisonGroup: 'tube-pattern-shallow',
    intent: 'representative',
    geometryCompatibility: 'authored-teaching-position',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'not-applicable',
    },
  },
  'controlled-long-bronchial-past-carina': {
    label: 'Long bronchial tube beyond carina',
    explanation:
      'The entered mainstem receives direct flow while correctly aligned side fenestrations can reach the opposite mainstem.',
    comparisonGroup: 'tube-pattern-past-carina',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'contralateral-fenestrations',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'available',
    },
  },
  'controlled-short-tracheoscope-past-carina-counterfactual': {
    label: 'Short tracheoscope beyond carina: counterfactual',
    explanation:
      'Without side fenestrations, only the entered mainstem has a modeled direct distal route.',
    comparisonGroup: 'tube-pattern-past-carina',
    intent: 'counterfactual',
    geometryCompatibility: 'matched-diameter-counterfactual',
    disclaimer:
      'Geometry-compatible comparison only; advancing this short tracheal tube into a main bronchus is not its intended use or a validated clinical configuration.',
    expected: {
      prediction: 'mainstem-only',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'unavailable',
    },
  },
  'controlled-right-mainstem': {
    label: 'BT2105 right-mainstem pose',
    explanation: 'The bronchial tube occupies the validated discrete right-mainstem pose.',
    comparisonGroup: 'mainstem',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'contralateral-fenestrations',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'available',
    },
  },
  'controlled-left-mainstem': {
    label: 'BT2105 left-mainstem pose',
    explanation: 'The bronchial tube occupies the validated discrete left-mainstem pose.',
    comparisonGroup: 'mainstem',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'contralateral-fenestrations',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'available',
    },
  },
  'fixed-complete-obstruction': {
    label: 'Fixed complete obstruction',
    explanation: 'The fixed obstruction blocks distal inspiration and expiration.',
    comparisonGroup: 'obstruction',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'not-applicable',
    },
  },
  'ball-valve-obstruction': {
    label: 'Expiratory ball-valve obstruction',
    explanation:
      'Inspiration continues while restricted expiration produces breath-to-breath distal accumulation.',
    comparisonGroup: 'obstruction',
    intent: 'representative',
    geometryCompatibility: 'validated-procedural-pose',
    expected: {
      prediction: 'both-branches',
      leakSeverity: 'limited',
      sideFenestrationFinding: 'not-applicable',
    },
  },
} as const satisfies Readonly<Record<VentilationScenarioPresetId, VentilationScenarioMetadata>>

function styleSegment(
  id: string,
  legendId: AssemblyPathwaySegment['legendId'],
  color: string,
  particleColor: string,
  points: readonly AssemblyVector3[],
  profile: VentilationModeProfile,
  activePhaseIds: readonly RespiratoryPhaseId[],
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
    activePhaseIds,
  }
}

export function getVentilationModeProfile(mode: VentilationModeId) {
  return modeProfiles[mode]
}

function isMainstemPosition(position: VentilationScopePositionId) {
  return position === 'past-carina' || position === 'right-mainstem' || position === 'left-mainstem'
}

export function getExpectedVentilationPrediction(
  tubeType: 'bronchial' | 'tracheal',
  position: VentilationScopePositionId,
  hasDistalFenestrations = tubeType === 'bronchial',
): VentilationPredictionId {
  if (!isMainstemPosition(position)) return 'both-branches'
  return hasDistalFenestrations ? 'contralateral-fenestrations' : 'mainstem-only'
}

function inspirationPhaseIdsForMode(mode: VentilationModeId): readonly RespiratoryPhaseId[] {
  if (mode === 'conventional') return ['controlled-inspiration']
  if (mode === 'spontaneous-assist') return ['patient-inspiration', 'assisted-inspiration']
  return ['jet-pulse']
}

function buildSegmentsByPhase(
  segments: readonly AssemblyPathwaySegment[],
): Readonly<Record<RespiratoryPhaseId, readonly AssemblyPathwaySegment[]>> {
  return Object.fromEntries(
    respiratoryPhaseIds.map((phaseId) => [
      phaseId,
      segments.filter((segment) => segment.activePhaseIds?.includes(phaseId)),
    ]),
  ) as unknown as Readonly<Record<RespiratoryPhaseId, readonly AssemblyPathwaySegment[]>>
}

export function getVentilationSegmentsForPhase(
  comparison: VentilationComparison,
  phaseId: RespiratoryPhaseId,
): readonly AssemblyPathwaySegment[] {
  return comparison.segmentsByPhase[phaseId]
}

export function getVentilationComparison(
  mode: VentilationModeId,
  tube: AssemblyPartDefinition,
  options: {
    distalEgressOpen?: boolean
    obstructionState?: VentilationObstructionState
    position?: VentilationScopePositionId
  } = {},
): VentilationComparison {
  const position = options.position ?? 'mid-trachea'
  const obstructionState =
    options.obstructionState ?? (options.distalEgressOpen === false ? 'fixed-complete' : 'open')
  const tubeType =
    tube.tubeType ??
    (tube.workingLengthMm && tube.workingLengthMm >= 300 ? 'bronchial' : 'tracheal')
  const hasFenestrations = tube.hasDistalFenestrations ?? tubeType === 'bronchial'
  const profile = modeProfiles[mode]
  const setup = getVentilationSetup(mode)
  const tubeBevelX = getTubeDistalX(tube)
  const scopePose = getVentilationScopePose(tubeBevelX, position)
  const tipPosition = scopePose.worldBevel
  const isJet = setup.inlet === 'jet'
  const inspirationPhaseIds = inspirationPhaseIdsForMode(mode)
  const respiratoryCycle = getRespiratoryCycle(mode, obstructionState)
  const inspirationPermitted = obstructionState !== 'fixed-complete'
  const expirationRestricted = obstructionState !== 'open'
  const relativeDistalAccumulationPerCycle =
    obstructionState === 'ball-valve'
      ? respiratoryCycle.phases.reduce((sum, phase) => sum + phase.accumulationDelta, 0)
      : 0

  const localAnesthesiaInletPoints: readonly AssemblyVector3[] = [
    [-1.88, -0.72, 0],
    [-1.91, -0.52, 0],
    [-1.95, -0.34, 0],
    [-1.84, ventilationAirwayGeometry.airwayY, 0],
    [-1.2, ventilationAirwayGeometry.airwayY, 0],
    [tubeBevelX - 0.08, ventilationAirwayGeometry.airwayY, 0],
    scopePose.localBevel,
  ]
  const localJetInletPoints: readonly AssemblyVector3[] = [
    [-2.109, -0.53, 0],
    [-2.109, -0.41, 0],
    [-2.05, ventilationAirwayGeometry.airwayY, 0],
    [-1.2, ventilationAirwayGeometry.airwayY, 0],
    [tubeBevelX - 0.08, ventilationAirwayGeometry.airwayY, 0],
    scopePose.localBevel,
  ]
  const inletPoints = (isJet ? localJetInletPoints : localAnesthesiaInletPoints).map((point) =>
    transformVentilationScopePoint(point, scopePose),
  )

  const segments: AssemblyPathwaySegment[] = []
  if (inspirationPermitted) {
    if (mode === 'spontaneous-assist') {
      segments.push(
        styleSegment(
          'spontaneous-patient-inflow',
          'inspiratory-flow',
          '#67e8f9',
          '#cffafe',
          inletPoints,
          profile,
          ['patient-inspiration'],
          { countScale: 0.72, speedScale: 0.72 },
        ),
        styleSegment(
          'spontaneous-assist-inflow',
          'inspiratory-flow',
          '#22d3ee',
          '#a5f3fc',
          inletPoints,
          profile,
          ['assisted-inspiration'],
          { countScale: 1.12, speedScale: 1.15 },
        ),
      )
    } else {
      segments.push(
        styleSegment(
          `${mode}-inflow`,
          'inspiratory-flow',
          isJet ? '#38bdf8' : '#22d3ee',
          isJet ? '#e0f2fe' : '#a5f3fc',
          inletPoints,
          profile,
          inspirationPhaseIds,
        ),
      )
    }
  }

  if (isJet && inspirationPermitted) {
    const ambientLocalPoints: readonly AssemblyVector3[] = [
      [-2.78, ventilationAirwayGeometry.airwayY, 0.05],
      [-2.48, ventilationAirwayGeometry.airwayY, 0.03],
      [-2.1, ventilationAirwayGeometry.airwayY, 0.01],
      [-1.6, ventilationAirwayGeometry.airwayY, 0],
    ]
    const ambientPoints = ambientLocalPoints.map((point) =>
      transformVentilationScopePoint(point, scopePose),
    )
    segments.push(
      styleSegment(
        `${mode}-ambient-entrainment`,
        'ambient-entrainment',
        '#7dd3fc',
        '#e0f2fe',
        ambientPoints,
        profile,
        ['jet-pulse'],
        { countScale: 0.5, radiusScale: 0.72, speedScale: 0.78 },
      ),
    )
  }

  const enteredMainstem =
    position === 'left-mainstem'
      ? ventilationAirwayGeometry.leftMainstem
      : ventilationAirwayGeometry.rightMainstem
  const oppositeMainstem =
    position === 'left-mainstem'
      ? ventilationAirwayGeometry.rightMainstem
      : ventilationAirwayGeometry.leftMainstem
  const downstreamTrachea = ventilationAirwayGeometry.trachea.filter(
    (point) => point[0] > tipPosition[0] + 0.015,
  )
  const instrumentedPoints: readonly AssemblyVector3[] = isMainstemPosition(position)
    ? [tipPosition, ...enteredMainstem.slice(2)]
    : [tipPosition, ...downstreamTrachea, ...enteredMainstem.slice(1)]
  const instrumentedMainstemReceivesFlow = inspirationPermitted
  if (instrumentedMainstemReceivesFlow) {
    segments.push(
      styleSegment(
        'instrumented-mainstem-flow',
        'ventilation-flow',
        '#34d399',
        '#d1fae5',
        instrumentedPoints,
        profile,
        inspirationPhaseIds,
        { countScale: 0.72, radiusScale: 0.86, speedScale: 0.82 },
      ),
    )
  }

  const oppositeMainstemRouteAvailable = !isMainstemPosition(position) || hasFenestrations
  const oppositeMainstemReceivesFlow =
    oppositeMainstemRouteAvailable &&
    (inspirationPermitted ||
      (obstructionState === 'fixed-complete' && !isMainstemPosition(position)))
  const fenestrationLocalXs = getVentilationFenestrationLocalXs(tube)
  if (oppositeMainstemReceivesFlow) {
    const fenestrationWorldPoints = fenestrationLocalXs.map((x) =>
      transformVentilationScopePoint([x, ventilationAirwayGeometry.airwayY, 0.052], scopePose),
    )
    const carina = ventilationAirwayGeometry.carina
    const fenestrationNearestCarina =
      fenestrationWorldPoints.reduce<AssemblyVector3 | undefined>((nearest, candidate) => {
        if (!nearest) return candidate
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
      }, undefined) ?? tipPosition
    const oppositePoints: readonly AssemblyVector3[] = isMainstemPosition(position)
      ? [fenestrationNearestCarina, ventilationAirwayGeometry.carina, ...oppositeMainstem.slice(1)]
      : [tipPosition, ...downstreamTrachea, ...oppositeMainstem.slice(1)]
    segments.push(
      styleSegment(
        isMainstemPosition(position) ? 'contralateral-fenestration-flow' : 'opposite-mainstem-flow',
        isMainstemPosition(position) ? 'side-fenestration-flow' : 'ventilation-flow',
        isMainstemPosition(position) ? '#fbbf24' : '#34d399',
        isMainstemPosition(position) ? '#fef3c7' : '#d1fae5',
        oppositePoints,
        profile,
        inspirationPhaseIds,
        { countScale: 0.68, radiusScale: 0.82, speedScale: 0.78 },
      ),
    )
  }

  const leakSeverity: VentilationLeakSeverity =
    position === 'proximal-trachea' && hasFenestrations ? 'fenestrations-above-cords' : 'limited'
  const glottis = ventilationAirwayGeometry.glottis
  const fenestrationWorldPoints = fenestrationLocalXs.map((x) =>
    transformVentilationScopePoint([x, ventilationAirwayGeometry.airwayY, 0.052], scopePose),
  )
  const proximalFenestrations = fenestrationWorldPoints.filter(
    (point) => point[0] <= ventilationAirwayGeometry.glottisX + 0.02,
  )
  const leakOrigin =
    leakSeverity === 'fenestrations-above-cords' && proximalFenestrations.length > 0
      ? proximalFenestrations[proximalFenestrations.length - 1]
      : ([glottis[0] + 0.05, glottis[1] + 0.08, glottis[2] + 0.06] as const)
  const leakPoints: readonly AssemblyVector3[] = [
    leakOrigin,
    [glottis[0] - 0.04, glottis[1] + 0.11, glottis[2] + 0.1],
    [glottis[0] - 0.16, glottis[1] + 0.24, glottis[2] + 0.17],
    [glottis[0] - 0.3, glottis[1] + 0.4, glottis[2] + 0.27],
  ]
  if (inspirationPermitted) {
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
        inspirationPhaseIds,
        leakSeverity === 'fenestrations-above-cords'
          ? { countScale: 1.35, radiusScale: 1.12, speedScale: 1.15, span: 0.48 }
          : { countScale: 0.35, radiusScale: 0.62, speedScale: 0.68, span: 0.22 },
      ),
    )
  }

  const localProximalExpiratoryPoints: readonly AssemblyVector3[] =
    setup.expiratoryOutlet === 'anesthesiaCircuit'
      ? [
          [-1.88, -0.72, -0.08],
          [-1.95, -0.34, -0.08],
          [tubeBevelX - 0.12, -0.22, -0.1],
          scopePose.localBevel,
        ]
      : [
          [-2.78, -0.18, -0.11],
          [-2.42, -0.2, -0.11],
          [tubeBevelX - 0.12, -0.22, -0.1],
          scopePose.localBevel,
        ]
  const proximalExpiratoryPoints = localProximalExpiratoryPoints.map((point) =>
    transformVentilationScopePoint(point, scopePose),
  )
  const obstructionPosition = instrumentedPoints[1] ?? enteredMainstem[1]
  const expiratoryPoints: readonly AssemblyVector3[] =
    obstructionState === 'open'
      ? [...proximalExpiratoryPoints, ...instrumentedPoints.slice(1)]
      : [obstructionPosition, ...instrumentedPoints.slice(1, 4)]
  segments.push(
    styleSegment(
      obstructionState === 'open' ? 'passive-expiratory-egress' : 'restricted-expiratory-egress',
      'expiratory-egress',
      '#818cf8',
      '#c7d2fe',
      expiratoryPoints,
      profile,
      ['expiration'],
      {
        countScale: obstructionState === 'open' ? 0.58 : 0.32,
        radiusScale: 0.66,
        reverse: true,
        speedScale:
          obstructionState === 'open' ? 0.58 : obstructionState === 'ball-valve' ? 0.22 : 0,
      },
    ),
  )

  const sideFenestrationFinding: VentilationSideFenestrationFinding = !isMainstemPosition(position)
    ? 'not-applicable'
    : hasFenestrations
      ? 'available'
      : 'unavailable'

  return {
    expectedPrediction: getExpectedVentilationPrediction(tubeType, position, hasFenestrations),
    expirationRestricted,
    inspirationPermitted,
    instrumentedMainstemReceivesFlow,
    leakSeverity,
    mode,
    modeProfile: profile,
    obstructionPosition,
    obstructionState,
    oppositeMainstemReceivesFlow,
    position,
    relativeDistalAccumulationPerCycle,
    respiratoryCycle,
    scopePose,
    segments,
    segmentsByPhase: buildSegmentsByPhase(segments),
    setup,
    sideFenestrationFinding,
    tipPosition,
    tubeType,
  }
}

export function getVentilationActivePort(
  mode: VentilationModeId,
  phaseId?: RespiratoryPhaseId,
): RigidPortId | null {
  if (!phaseId) return getVentilationSetup(mode).inlet
  return getRespiratoryCycle(mode).phases.find((phase) => phase.id === phaseId)?.activePort ?? null
}

export interface VentilationScenarioValidationResult {
  valid: boolean
  errors: readonly string[]
}

/**
 * Checks preset claims against the live tube catalog and simulation result. This keeps the
 * matched long/short teaching pairs from silently drifting when dimensions or flow logic change.
 */
export function validateVentilationScenarioPresets(
  presets: readonly VentilationScenarioPreset[] = ventilationScenarioPresets,
  metadata: Readonly<
    Record<VentilationScenarioPresetId, VentilationScenarioMetadata>
  > = ventilationScenarioMetadata,
): VentilationScenarioValidationResult {
  const errors: string[] = []
  const seenIds = new Set<string>()

  for (const preset of presets) {
    if (seenIds.has(preset.id)) errors.push(`Duplicate ventilation preset id: ${preset.id}`)
    seenIds.add(preset.id)

    const scenarioMetadata = metadata[preset.id]
    if (!scenarioMetadata) {
      errors.push(`Missing ventilation metadata: ${preset.id}`)
      continue
    }

    const tube = bronchoscopeTubeOptions.find((candidate) => candidate.id === preset.tubeId)
    if (!tube) {
      errors.push(`Missing ventilation tube ${preset.tubeId} for ${preset.id}`)
      continue
    }

    const comparison = getVentilationComparison(preset.mode, tube, {
      obstructionState: preset.obstructionState,
      position: preset.position,
    })
    const expected = scenarioMetadata.expected
    if (comparison.expectedPrediction !== expected.prediction) {
      errors.push(
        `${preset.id}: expected prediction ${expected.prediction}, received ${comparison.expectedPrediction}`,
      )
    }
    if (comparison.leakSeverity !== expected.leakSeverity) {
      errors.push(
        `${preset.id}: expected leak ${expected.leakSeverity}, received ${comparison.leakSeverity}`,
      )
    }
    if (comparison.sideFenestrationFinding !== expected.sideFenestrationFinding) {
      errors.push(
        `${preset.id}: expected side-fenestration finding ${expected.sideFenestrationFinding}, received ${comparison.sideFenestrationFinding}`,
      )
    }

    if (tube.tubeType === 'tracheal' && isMainstemPosition(preset.position)) {
      if (
        scenarioMetadata.intent !== 'counterfactual' ||
        scenarioMetadata.geometryCompatibility !== 'matched-diameter-counterfactual' ||
        !scenarioMetadata.disclaimer
      ) {
        errors.push(
          `${preset.id}: tracheoscope mainstem comparisons require explicit counterfactual metadata and a disclaimer`,
        )
      }
    }
  }

  const pairedGroups: readonly VentilationScenarioComparisonGroup[] = [
    'tube-pattern-shallow',
    'tube-pattern-past-carina',
  ]
  for (const comparisonGroup of pairedGroups) {
    const pairedPresets = presets.filter(
      (preset) => metadata[preset.id]?.comparisonGroup === comparisonGroup,
    )
    if (pairedPresets.length !== 2) {
      errors.push(`${comparisonGroup}: expected exactly two matched comparison presets`)
      continue
    }

    const pairedTubes = pairedPresets.map((preset) =>
      bronchoscopeTubeOptions.find((candidate) => candidate.id === preset.tubeId),
    )
    const [firstPreset, secondPreset] = pairedPresets
    const [firstTube, secondTube] = pairedTubes
    if (!firstTube || !secondTube) continue

    if (
      firstTube.outerDiameterMm !== secondTube.outerDiameterMm ||
      firstTube.innerDiameterMm !== secondTube.innerDiameterMm
    ) {
      errors.push(`${comparisonGroup}: long and short tubes must have matching ID and OD`)
    }
    if (firstTube.tubeType === secondTube.tubeType) {
      errors.push(`${comparisonGroup}: pair must compare one bronchial and one tracheal tube`)
    }
    if (Boolean(firstTube.hasDistalFenestrations) === Boolean(secondTube.hasDistalFenestrations)) {
      errors.push(`${comparisonGroup}: pair must differ in distal side-fenestration pattern`)
    }
    if (
      firstPreset.mode !== secondPreset.mode ||
      firstPreset.position !== secondPreset.position ||
      firstPreset.obstructionState !== secondPreset.obstructionState ||
      firstPreset.proceduralPoseId !== secondPreset.proceduralPoseId
    ) {
      errors.push(`${comparisonGroup}: pair may differ only by tube pattern`)
    }
  }

  return { valid: errors.length === 0, errors }
}
