import type { VentilationCaseDefinition } from '../engine/types'
import { mechanicalVentilationCaseById, mechanicalVentilationCases } from './runtimeCases'

/** Authored passive teaching fixture, September 2026. Values are model inputs, not bedside targets. */
const base = mechanicalVentilationCases[0]
export const ventilationLearningPatient: VentilationCaseDefinition = {
  ...base,
  id: 'MV-LAB',
  sourceCaseId: 'authored-passive-learning-patient',
  title: 'A passive supported breath',
  phenotype: 'normal-supported-breath',
  category: 'Learning experiment',
  difficulty: 'Foundation',
  predictedBodyWeightKg: 70,
  patientDescription:
    'An authored adult with quiet respiratory muscles and uncomplicated passive mechanics.',
  initialSettings: {
    ...base.initialSettings,
    mode: 'volume-ac',
    deviceMode: 'volume-ac',
    vtMl: 420,
    ratePerMin: 16,
    peakFlowLMin: 40,
    flowPattern: 'square',
    pausePercent: 0,
    oxygenPercent: 40,
    peepCmH2O: 5,
    highPressureLimitCmH2O: 40,
  },
  initialPatient: {
    ...base.initialPatient,
    mechanics: {
      complianceLPerCmH2O: 0.05,
      resistanceCmH2OPerLps: 8,
      intrinsicPeepCmH2O: 0,
      endExpiratoryVolumeL: 0,
      airwayLeakFraction: 0,
      tubeResistanceCmH2OPerLps: 2,
    },
    drive: {
      neuralRatePerMin: 0,
      neuralInspiratoryTimeSeconds: 0.85,
      effortAmplitudeCmH2O: 0,
      variability: 0,
      reverseTriggerDelaySeconds: null,
    },
    gasExchange: {
      ...base.initialPatient.gasExchange,
      shuntFraction: 0.02,
      deadSpaceFraction: 0.3,
      // Matches this engine's resting oxygenation target at the authored FiO₂ and PEEP.
      paO2MmHg: 83.2,
      paCO2MmHg: 40,
      pH: 7.4,
      spo2Percent: 95.5,
    },
    hemodynamics: {
      heartRatePerMin: 80,
      systolicMmHg: 120,
      diastolicMmHg: 70,
      mapMmHg: 87,
      obstructiveShock: false,
    },
    human: {
      painScore: 0,
      anxietyScore: 0,
      deliriumScore: 0,
      sedationScore: 0,
      dyspneaScore: 0,
      canCommunicate: false,
    },
  },
  visibleFindings: [
    'Respiratory muscles are quiet in this authored example.',
    'Gas enters during inspiration and leaves passively during expiration.',
  ],
  branchOptions: ['passive'],
  learningObjectives: ['Connect ventilator controls, passive mechanics, and the live breath.'],
  mechanismOptions: [],
  priorityOptions: [],
  responseOptions: [],
  correctMechanismId: '',
  correctPriorityId: '',
  correctResponseId: '',
  requiredInterventionIds: [],
  requiredReassessmentIds: [],
  successConditions: [],
  hintLadder: [],
  expectedActions: [],
  acceptedAlternatives: [],
  unsafeActions: [],
  successCriteria: [],
  debrief: 'An exploratory physiology patient; completion is recorded by the learning experiment.',
}

/** Keep the teaching fixture out of the clinical case library and its existing case counts. */
export function resolveVentilationSimulationCase(id: string): VentilationCaseDefinition {
  return id === ventilationLearningPatient.id
    ? ventilationLearningPatient
    : (mechanicalVentilationCaseById.get(id) ?? mechanicalVentilationCases[0])
}
