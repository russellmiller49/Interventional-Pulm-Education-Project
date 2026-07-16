/**
 * Module-local type surface for the Rigid Bronchoscopy module.
 *
 * The interactive Practice drills are built on the shared skill-lab primitives,
 * so we re-export those shapes here. Pages and content import from this module
 * path, which keeps the dependency on `@/features/skill-lab` in one place.
 */

export type {
  DecisionScenario,
  EquipmentHotspot,
  EquipmentMap,
  ScenarioChoice,
  ScenarioNode,
  ScenarioState,
  SequenceScore,
  SequenceStep,
  StepSequence,
  Vitals,
} from '@/features/skill-lab/engine/types'

export type {
  InstrumentEntryPortId,
  InstrumentRoute,
  InstrumentRouteId,
  LumenClearanceResult,
  ProceduralPose,
  ProceduralPoseId,
  RespiratoryPhaseDefinition,
  RespiratoryPhaseId,
  RigidAssetManifest,
  RigidPortDefinition,
  RigidPortId,
  VentilationModeId,
  VentilationObstructionState,
  VentilationSetup,
} from '../content/assemblyTopology'
