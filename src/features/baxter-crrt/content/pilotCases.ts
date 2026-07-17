import type { CrrtEngineFixture } from '../engine/types'
import { normalizeRuntimeCrrtCaseToEngineFixture } from './runtimeCaseNormalization'
import { baxterCrrtPilotSourceReferences } from './provenance'
import {
  CRRT_PILOT_CASE_IDS,
  runtimeCrrtCaseRegistrySchema,
  validatePilotCrrtCaseRegistry,
  type RuntimeCrrtCase,
  type SourceReference,
} from './schema'

export const BAXTER_CRRT_PILOT_CONTENT_VERSION = '0.5.0-pilot-draft.1' as const

export type BaxterCrrtPilotCaseId = (typeof CRRT_PILOT_CASE_IDS)[number]

const PENDING = 'pending' as const
const PRISMAX_DEVICE = 'prismax-aw8035-2xx' as const
const ALL_ROLE_LENSES = ['prescriber', 'operator', 'integrated'] as const

const sourceRecordById = new Map(
  baxterCrrtPilotSourceReferences.map((record) => [record.id, record] as const),
)

function sourceBasis(sourceIds: readonly string[]): SourceReference[] {
  return sourceIds.map((sourceId) => {
    const record = sourceRecordById.get(sourceId)
    if (!record) throw new Error(`Unknown CRRT pilot source ID: ${sourceId}`)
    return record
  })
}

function option(id: string, label: string, description: string, sourceIds: readonly string[]) {
  return { id, label, description, sourceIds: [...sourceIds], reviewStatus: PENDING }
}

function numberEffect(
  target: string,
  operation: 'set' | 'add' | 'multiply' | 'move-toward',
  value: number,
  unit: string,
  sourceId: string,
) {
  return { target, operation, valueType: 'number' as const, value, unit, sourceId }
}

function booleanEffect(target: string, value: boolean, sourceId: string) {
  return { target, operation: 'set' as const, valueType: 'boolean' as const, value, sourceId }
}

function enumEffect(target: string, value: string, sourceId: string) {
  return { target, operation: 'set' as const, valueType: 'enum' as const, value, sourceId }
}

function syntheticPatient(input: {
  sourceId: string
  bodyWeightKg: number
  hematocritFraction: number
  intravascularReserveMl: number
  totalFluidOverloadMl: number
  vascularRefillCapacityMlPerHour: number
  urineOutputMlPerHour: number
  residualRenalClearanceMlPerMin: number
  heartRatePerMin: number
  systolicPressureMmHg: number
  diastolicPressureMmHg: number
  meanArterialPressureMmHg: number
  vasopressorState: 'off' | 'stable' | 'increasing' | 'decreasing'
  temperatureCelsius: number
  sodiumMmolPerL: number
  potassiumMmolPerL: number
  bicarbonateMmolPerL: number
  pH: number
  smallSoluteMarkerMmolPerL: number
  creatinineMgPerDl: number
  phosphateMgPerDl: number
  magnesiumMgPerDl: number
  systemicIonizedCalciumMmolPerL: number
}) {
  return {
    simulatedBodyWeightKg: input.bodyWeightKg,
    hematocritFraction: input.hematocritFraction,
    intravascularReserveMl: input.intravascularReserveMl,
    totalFluidOverloadMl: input.totalFluidOverloadMl,
    vascularRefillCapacityMlPerHour: input.vascularRefillCapacityMlPerHour,
    urineOutputMlPerHour: input.urineOutputMlPerHour,
    residualRenalClearanceMlPerMin: input.residualRenalClearanceMlPerMin,
    hemodynamics: {
      heartRatePerMin: input.heartRatePerMin,
      systolicPressureMmHg: input.systolicPressureMmHg,
      diastolicPressureMmHg: input.diastolicPressureMmHg,
      meanArterialPressureMmHg: input.meanArterialPressureMmHg,
      vasopressorState: input.vasopressorState,
    },
    temperatureCelsius: input.temperatureCelsius,
    solutes: {
      sodiumMmolPerL: input.sodiumMmolPerL,
      potassiumMmolPerL: input.potassiumMmolPerL,
      bicarbonateMmolPerL: input.bicarbonateMmolPerL,
      pH: input.pH,
      smallSoluteMarkerMmolPerL: input.smallSoluteMarkerMmolPerL,
      creatinineMgPerDl: input.creatinineMgPerDl,
      phosphateMgPerDl: input.phosphateMgPerDl,
      magnesiumMgPerDl: input.magnesiumMgPerDl,
      systemicIonizedCalciumMmolPerL: input.systemicIonizedCalciumMmolPerL,
      totalCalciumMgPerDl: null,
      glucoseMgPerDl: null,
      advanced: [],
    },
    sourceIds: [input.sourceId],
  }
}

function syntheticAccess(input: {
  sourceId: string
  descriptor: string
  nominalFlowCapacityMlPerMin: number
  accessResistanceMmHgPerMlPerMin: number
  returnResistanceMmHgPerMlPerMin: number
  positionDependenceFraction: number
  partialThrombusFraction?: number
}) {
  return {
    catheter: {
      descriptor: input.descriptor,
      site: 'Synthetic central venous access site',
      type: 'Synthetic dual-lumen access',
      nominalFlowCapacityMlPerMin: input.nominalFlowCapacityMlPerMin,
    },
    accessResistanceMmHgPerMlPerMin: input.accessResistanceMmHgPerMlPerMin,
    returnResistanceMmHgPerMlPerMin: input.returnResistanceMmHgPerMlPerMin,
    positionDependenceFraction: input.positionDependenceFraction,
    recirculationFraction: 0,
    partialThrombusFraction: input.partialThrombusFraction ?? 0,
    accessLineState: 'open' as const,
    returnLineState: 'open' as const,
    connectionState: 'connected' as const,
    sourceIds: [input.sourceId],
  }
}

function cvvhdPrescription(input: {
  sourceIds: readonly string[]
  bloodFlowMlPerMin: number
  dialysateFlowMlPerHour: number
  patientFluidRemovalMlPerHour: number
}) {
  return {
    modality: 'CVVHD' as const,
    bloodFlowMlPerMin: input.bloodFlowMlPerMin,
    preBloodPumpFlowMlPerHour: 0,
    dialysateFlowMlPerHour: input.dialysateFlowMlPerHour,
    preReplacementFlowMlPerHour: 0,
    postReplacementFlowMlPerHour: 0,
    patientFluidRemovalMlPerHour: input.patientFluidRemovalMlPerHour,
    syringeFlowMlPerHour: 0,
    makeupFlowMlPerHour: 0,
    anticoagulation: { method: 'none' as const, protocolProfileId: null },
    solutionProfileIds: [],
    sourceIds: [...input.sourceIds],
  }
}

function soluteModel(sourceId: string, permeability = 1) {
  return {
    distributionVolumeLiters: 42,
    productionAmountPerHour: 0,
    inputAmountPerHour: 0,
    residualClearanceMlPerMin: 0,
    filterPermeabilityFraction: permeability,
    reviewStatus: PENDING,
    sourceIds: [sourceId],
  }
}

function cvvhdBags(sourceId: string) {
  return [
    {
      id: 'dialysate-bag',
      label: 'Synthetic dialysate supply',
      flowTerm: 'dialysate' as const,
      direction: 'source' as const,
      capacityMl: 20_000,
      calculatedVolumeMl: 20_000,
      measuredVolumeMl: 20_000,
      cumulativePumpVolumeMl: 0,
      connected: true,
      scaleOpen: false,
      externalInterferenceMl: 0,
      reviewStatus: PENDING,
      sourceIds: ['DEV-PM-013', sourceId],
    },
    {
      id: 'effluent-bag',
      label: 'Synthetic effluent collection',
      flowTerm: 'effluent' as const,
      direction: 'effluent' as const,
      capacityMl: 20_000,
      calculatedVolumeMl: 0,
      measuredVolumeMl: 0,
      cumulativePumpVolumeMl: 0,
      connected: true,
      scaleOpen: false,
      externalInterferenceMl: 0,
      reviewStatus: PENDING,
      sourceIds: ['DEV-PM-013', sourceId],
    },
  ]
}

function engineModelConfiguration(caseId: BaxterCrrtPilotCaseId, sourceId: string) {
  return {
    id: `${caseId.toLowerCase()}-synthetic-model`,
    version: BAXTER_CRRT_PILOT_CONTENT_VERSION,
    internalStepSeconds: 60 as const,
    internalStepRationale:
      'One-minute canonical integration is deterministic; exact coefficients are synthetic teaching calibration pending review.',
    maximumTrendSamples: 288 as const,
    enabledModelIds: [
      'source-mapped-device-math',
      'synthetic-pressure-directionality',
      'synthetic-fluid-ledger',
      'synthetic-solute-mass-balance',
      'synthetic-hemodynamic-tolerance',
    ],
    parameters: [
      {
        id: `${caseId.toLowerCase()}-access-reference`,
        domain: 'pressure' as const,
        value: 5,
        unit: 'mmHg',
        sourceId,
        reviewStatus: PENDING,
      },
      {
        id: `${caseId.toLowerCase()}-filter-resistance`,
        domain: 'pressure' as const,
        value: 0.3,
        unit: 'mmHg per mL/min',
        sourceId,
        reviewStatus: PENDING,
      },
      {
        id: `${caseId.toLowerCase()}-hemodynamic-stress-gain`,
        domain: 'patient' as const,
        value: 0.4,
        unit: 'model fraction per excess liter',
        sourceId,
        reviewStatus: PENDING,
      },
    ],
    sourceIds: [sourceId, 'DEV-PM-009'],
    reviewStatus: PENDING,
  }
}

function engineFixtureConfiguration(input: {
  sourceId: string
  positionResistanceMultiplier: number
  vasopressorSupportIndex: number
  hemodynamicStressIndex: number
  externalFluidRates: {
    maintenanceInputMlHour: number
    medicationCarrierInputMlHour: number
    nutritionInputMlHour: number
    bloodProductInputMlHour: number
    bolusInputMlHour: number
    otherInputMlHour: number
    urineOutputMlHour: number
    drainOutputMlHour: number
    otherOutputMlHour: number
  }
  timedEventMappings: readonly unknown[]
}) {
  const sourceId = input.sourceId
  return {
    patient: {
      vasopressorSupportIndex: input.vasopressorSupportIndex,
      hemodynamicStressIndex: input.hemodynamicStressIndex,
      totalCalciumMmolL: null,
      reviewStatus: PENDING,
      solutes: {
        sodium: soluteModel(sourceId, 0.95),
        potassium: soluteModel(sourceId),
        bicarbonate: soluteModel(sourceId),
        'urea-marker': soluteModel(sourceId),
        'creatinine-marker': soluteModel(sourceId, 0.9),
        phosphate: soluteModel(sourceId, 0.9),
        magnesium: soluteModel(sourceId, 0.85),
      },
    },
    access: {
      positionResistanceMultiplier: input.positionResistanceMultiplier,
      reviewStatus: PENDING,
    },
    prescription: { reviewStatus: PENDING },
    bags: cvvhdBags(sourceId),
    externalFluidRates: { ...input.externalFluidRates },
    unintendedDeviceNetGainRateMlHour: 0,
    modelConfiguration: {
      pressure: {
        accessReferencePressureMmHg: 5,
        disconnectedAccessPressureMmHg: 0,
        returnReferencePressureMmHg: 5,
        disconnectedReturnPressureMmHg: 0,
        observedEffluentPressureMmHg: -20,
        filterResistanceMmHgPerMlMin: 0.3,
        partialThrombusResistanceGainAtFullBurden: 1,
        foulingResistanceGainMmHgPerMlMinAtFullBurden: 0.2,
        clotResistanceGainMmHgPerMlMinAtFullBurden: 0.3,
        accessKinkResistanceMultiplier: 4,
        returnKinkResistanceMultiplier: 4,
        reviewStatus: PENDING,
        sourceIds: ['DEV-PM-009', sourceId],
      },
      filter: {
        foulingFractionPerHourAtRiskOne: 0.01,
        clotFractionPerHourAtRiskOne: 0.005,
        filtrationFractionWeight: 0.2,
        interruptionWeight: 0.2,
        lowFlowWeight: 0.2,
        accessDysfunctionWeight: 0.2,
        hematocritWeight: 0.2,
        procoagulantWeight: 0.2,
        anticoagulationProtectionFraction: { none: 0, 'systemic-concept': 0.25 },
        referenceHematocritFraction: 0.3,
        reviewStatus: PENDING,
        sourceIds: [sourceId],
      },
      hemodynamic: {
        stressGainPerExcessRemovalLiter: 0.4,
        stressRecoveryPerHour: 0.08,
        reviewStatus: PENDING,
        sourceIds: [sourceId],
      },
      filterInletConcentrationFraction: 1,
      filtrationFraction: 0.1,
      reviewStatus: PENDING,
      sourceIds: [sourceId, 'DEV-PM-009'],
    },
    timedEventMappings: [...input.timedEventMappings],
    sourceIds: [sourceId, 'DEV-PM-009', 'DEV-PM-013'],
  }
}

const crtt04SourceIds = [
  'DEV-PM-005',
  'MATH-PM-001',
  'DOSE-PM-001',
  'DEV-PM-009',
  'DEV-PM-013',
  'RENAL-2009',
  'SYNTH-CRRT-04',
] as const

const crrt04 = {
  id: 'CRRT-04',
  title: 'Build a CVVHD prescription and distinguish prescribed from delivered therapy',
  stationId: 'build-prescription',
  difficulty: 'introductory',
  roleLenses: [...ALL_ROLE_LENSES],
  compatibleDevices: [PRISMAX_DEVICE],
  patientDescription:
    'A synthetic adult ICU patient has a small-solute and acid-base teaching goal. Build a CVVHD prescription, complete the device workflow, and reassess delivery after a simulated interruption.',
  learningObjectives: [
    'Define the simulated small-solute and acid-base goal before selecting controls.',
    'Enter blood flow first, then dialysate and machine patient-fluid-removal flows.',
    'Predict the immediate prescribed-dose display and the delayed direction of laboratory response.',
    'Distinguish prescribed intensity from delivered intensity after downtime.',
  ],
  initialPatient: syntheticPatient({
    sourceId: 'SYNTH-CRRT-04',
    bodyWeightKg: 80,
    hematocritFraction: 0.3,
    intravascularReserveMl: 1_200,
    totalFluidOverloadMl: 4_000,
    vascularRefillCapacityMlPerHour: 180,
    urineOutputMlPerHour: 20,
    residualRenalClearanceMlPerMin: 0,
    heartRatePerMin: 102,
    systolicPressureMmHg: 104,
    diastolicPressureMmHg: 58,
    meanArterialPressureMmHg: 73,
    vasopressorState: 'stable',
    temperatureCelsius: 36.2,
    sodiumMmolPerL: 138,
    potassiumMmolPerL: 5.8,
    bicarbonateMmolPerL: 16,
    pH: 7.25,
    smallSoluteMarkerMmolPerL: 31,
    creatinineMgPerDl: 3.6,
    phosphateMgPerDl: 5.2,
    magnesiumMgPerDl: 2.2,
    systemicIonizedCalciumMmolPerL: 1.1,
  }),
  initialAccess: syntheticAccess({
    sourceId: 'SYNTH-CRRT-04',
    descriptor: 'Synthetic stable dual-lumen access',
    nominalFlowCapacityMlPerMin: 180,
    accessResistanceMmHgPerMlPerMin: 0.2,
    returnResistanceMmHgPerMlPerMin: 0.2,
    positionDependenceFraction: 0,
  }),
  initialPrescription: cvvhdPrescription({
    sourceIds: ['SYNTH-CRRT-04', 'MATH-PM-001', 'DOSE-PM-001'],
    bloodFlowMlPerMin: 0,
    dialysateFlowMlPerHour: 0,
    patientFluidRemovalMlPerHour: 0,
  }),
  initialDeviceOverrides: {
    workflowPhase: 'new-patient',
    treatmentState: 'not-started',
    connectedToPatient: false,
    pumpsPaused: true,
    activeAlarmIds: [],
  },
  hiddenMechanism: {
    id: 'crrt04-dose-and-downtime',
    summary:
      'CVVHD changes the device clearance signal immediately, while simulated solute response is delayed and actual delivery falls during interruption.',
    causalChain: [
      'The learner defines a small-solute and acid-base goal.',
      'A CVVHD prescription creates a weight-normalized prescribed effluent signal.',
      'Actual integrated effluent, not the prescription alone, drives the delivered-dose model.',
      'A bounded interruption accumulates downtime and separates prescribed from delivered intensity.',
      'The learner reassesses both machine delivery and delayed simulated laboratory direction.',
    ],
    correctGoalOptionId: 'crrt04-goal-solute-acid-base',
    correctMechanismOptionId: 'crrt04-mechanism-diffusion-delivery',
    correctControlOptionIds: ['crrt04-control-cvvhd-reviewed-workflow'],
    correctResponseOptionId: 'crrt04-response-immediate-dose-delayed-labs',
    correctReassessmentOptionIds: ['crrt04-reassess-delivered-dose-and-labs'],
    sourceIds: ['DOSE-PM-001', 'RENAL-2009', 'SYNTH-CRRT-04'],
    reviewStatus: PENDING,
  },
  visibleFindings: [
    'All patient values are labeled simulated and review-pending.',
    'The prescription controls begin blank even though a synthetic engine fixture is loaded.',
    'No clinical target, device range, or disposable-specific minimum is shown.',
  ],
  timedEvents: [
    {
      id: 'crrt04-therapy-interruption',
      atSimulationSeconds: 7_200,
      jitterSeconds: null,
      eventType: 'treatment-interruption',
      label: 'Synthetic bounded treatment interruption',
      effects: [enumEffect('device.deliveryState', 'paused', 'SYNTH-CRRT-04')],
      sourceIds: ['SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-therapy-resumption',
      atSimulationSeconds: 10_800,
      jitterSeconds: null,
      eventType: 'treatment-resumption',
      label: 'Synthetic treatment resumption after the interruption',
      effects: [enumEffect('device.deliveryState', 'running', 'SYNTH-CRRT-04')],
      sourceIds: ['SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
  ],
  goalOptions: [
    option(
      'crrt04-goal-solute-acid-base',
      'Improve the simulated small-solute and acid-base trajectory',
      'Frame the goal before choosing modality or flows; no numeric patient target is implied.',
      ['RENAL-2009', 'SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-goal-remove-fluid-only',
      'Treat machine fluid removal as the only goal',
      'This misses the case small-solute and acid-base objective.',
      ['SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-goal-maximize-intensity',
      'Maximize the displayed intensity regardless of reassessment',
      'The cited intensity trial does not support treating more intensity as universally better.',
      ['RENAL-2009'],
    ),
  ],
  mechanismOptions: [
    option(
      'crrt04-mechanism-diffusion-delivery',
      'Diffusive clearance with delivery reduced by downtime',
      'Dialysate flow changes the prescribed signal immediately; integrated actual effluent drives delivered therapy.',
      ['MATH-PM-001', 'DOSE-PM-001', 'SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-mechanism-pfr-equals-clearance',
      'Machine PFR alone determines small-solute clearance',
      'This incorrectly collapses patient removal and the full effluent prescription.',
      ['MATH-PM-001'],
    ),
    option(
      'crrt04-mechanism-prescription-guarantees-delivery',
      'The prescribed value is delivered despite interruption',
      'Downtime makes prescribed and delivered therapy diverge.',
      ['DOSE-PM-001', 'SYNTH-CRRT-04'],
    ),
  ],
  controlOptions: [
    option(
      'crrt04-control-cvvhd-reviewed-workflow',
      'Use CVVHD and complete BFR-first setup, prime, review, and start',
      'The pilot evaluates the source-mapped device sequence without asserting a real-device range.',
      ['DEV-PM-005', 'SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-control-skip-review',
      'Start before prime and prescription review',
      'This is retained only as a pending candidate critical-error choice.',
      ['DEV-PM-005', 'SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-control-use-pfr-only',
      'Change only PFR and leave dialysate blank',
      'This cannot satisfy the CVVHD prescription workflow.',
      ['MATH-PM-001', 'SYNTH-CRRT-04'],
    ),
  ],
  responseOptions: [
    option(
      'crrt04-response-immediate-dose-delayed-labs',
      'Immediate device-dose change, delayed laboratory direction',
      'The machine display reacts at prescription commit while the transparent solute model changes with elapsed delivered therapy.',
      ['DOSE-PM-001', 'SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-response-instant-normalization',
      'Immediate normalization of all simulated laboratories',
      'This ignores the model time course and is not an authorized teaching claim.',
      ['SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-response-no-downtime-effect',
      'No difference between prescribed and delivered dose',
      'A treatment interruption reduces actual integrated delivery.',
      ['DOSE-PM-001', 'SYNTH-CRRT-04'],
    ),
  ],
  reassessmentOptions: [
    option(
      'crrt04-reassess-delivered-dose-and-labs',
      'Review delivered dose, downtime, and delayed simulated laboratory direction',
      'Reassessment joins the device, delivered therapy, and patient model.',
      ['DOSE-PM-001', 'RENAL-2009', 'SYNTH-CRRT-04'],
    ),
    option(
      'crrt04-reassess-prescription-only',
      'Read only the prescribed setting',
      'This misses downtime and actual delivered therapy.',
      ['DOSE-PM-001'],
    ),
    option(
      'crrt04-reassess-no-delay',
      'End immediately without advancing time',
      'Delayed simulated response cannot be assessed without elapsed case time.',
      ['SYNTH-CRRT-04'],
    ),
  ],
  interventions: [
    {
      id: 'crrt04-assess-goal',
      label: 'Define the simulated clearance goal',
      category: 'assessment',
      description: 'Confirm the small-solute and acid-base teaching objective.',
      response: 'The goal is documented without creating a patient-specific target.',
      latencySeconds: 0,
      effects: [],
      prerequisites: [],
      repeatable: false,
      sourceIds: ['RENAL-2009', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-enter-blood-flow',
      label: 'Enter synthetic BFR first',
      category: 'prescription',
      description: 'Enter the synthetic case BFR before downstream flow controls.',
      response: 'Dialysate and PFR controls can now be completed in the educational workflow.',
      latencySeconds: 0,
      effects: [
        numberEffect('prescription.flows.bloodFlowMlMin', 'set', 120, 'mL/min', 'SYNTH-CRRT-04'),
      ],
      prerequisites: ['crrt04-assess-goal'],
      repeatable: false,
      sourceIds: ['DEV-PM-005', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-enter-dialysate-primary',
      label: 'Enter primary synthetic dialysate flow',
      category: 'prescription',
      description: 'Apply one accepted synthetic dialysate calibration.',
      response: 'The prescribed effluent signal updates through source-mapped device math.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'prescription.flows.dialysateFlowMlHour',
          'set',
          1_800,
          'mL/h',
          'SYNTH-CRRT-04',
        ),
      ],
      prerequisites: ['crrt04-enter-blood-flow'],
      repeatable: false,
      sourceIds: ['MATH-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-enter-dialysate-alternative',
      label: 'Enter alternative synthetic dialysate flow',
      category: 'prescription',
      description: 'Apply a second accepted teaching calibration rather than one exact answer.',
      response: 'The engine produces a different but explicitly accepted prescribed-dose signal.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'prescription.flows.dialysateFlowMlHour',
          'set',
          1_600,
          'mL/h',
          'SYNTH-CRRT-04',
        ),
      ],
      prerequisites: ['crrt04-enter-blood-flow'],
      repeatable: false,
      sourceIds: ['MATH-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-enter-machine-pfr',
      label: 'Enter synthetic machine PFR',
      category: 'prescription',
      description:
        'Apply the case machine-removal setting without treating it as whole-patient balance.',
      response: 'The PFR term contributes to the device effluent target.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'prescription.flows.patientFluidRemovalMlHour',
          'set',
          100,
          'mL/h',
          'SYNTH-CRRT-04',
        ),
      ],
      prerequisites: ['crrt04-enter-blood-flow'],
      repeatable: false,
      sourceIds: ['MATH-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-complete-prime-review',
      label: 'Complete prime and prescription review',
      category: 'device',
      description: 'Complete the source-mapped educational setup gates before starting.',
      response: 'The device workflow is ready for a reviewed educational start.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt04-enter-blood-flow', 'crrt04-enter-machine-pfr'],
      repeatable: false,
      sourceIds: ['DEV-PM-005', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-start-reviewed-treatment',
      label: 'Start after review',
      category: 'device',
      description: 'Start the synthetic treatment only after the interface gates are complete.',
      response: 'The engine begins integrating actual effluent and elapsed treatment time.',
      latencySeconds: 0,
      effects: [enumEffect('device.deliveryState', 'running', 'SYNTH-CRRT-04')],
      prerequisites: ['crrt04-complete-prime-review'],
      repeatable: false,
      sourceIds: ['DEV-PM-005', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-advance-six-hours',
      label: 'Advance six simulated hours',
      category: 'assessment',
      description: 'Observe the delayed model response across the bounded interruption.',
      response: 'Dose, downtime, trends, and simulated solutes advance deterministically.',
      latencySeconds: 21_600,
      effects: [
        numberEffect('simulation.advanceTimeSeconds', 'add', 21_600, 'seconds', 'SYNTH-CRRT-04'),
      ],
      prerequisites: ['crrt04-start-reviewed-treatment'],
      repeatable: false,
      sourceIds: ['DOSE-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-reassess-delivery',
      label: 'Reassess dose, downtime, and simulated laboratory direction',
      category: 'assessment',
      description: 'Compare the prescription with actual delivery and delayed response.',
      response: 'The debrief can explain why an interruption reduced delivered intensity.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt04-advance-six-hours'],
      repeatable: false,
      sourceIds: ['DOSE-PM-001', 'RENAL-2009', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-start-before-review',
      label: 'Attempt to start before prime and review',
      category: 'device',
      description:
        'Unsafe candidate retained for scoring validation; the interface should block it.',
      response: 'The start is rejected and recorded as a pending candidate critical-error choice.',
      latencySeconds: 0,
      effects: [],
      prerequisites: [],
      repeatable: false,
      sourceIds: ['DEV-PM-005', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-equate-prescribed-delivered',
      label: 'Declare prescribed and delivered dose equivalent after downtime',
      category: 'assessment',
      description: 'Ignore the interruption and skip actual-delivery review.',
      response: 'The case records a consequential reasoning error without altering engine truth.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt04-advance-six-hours'],
      repeatable: false,
      sourceIds: ['DOSE-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
  ],
  requiredActionIds: [
    'crrt04-assess-goal',
    'crrt04-enter-blood-flow',
    'crrt04-enter-machine-pfr',
    'crrt04-complete-prime-review',
    'crrt04-start-reviewed-treatment',
    'crrt04-advance-six-hours',
    'crrt04-reassess-delivery',
  ],
  acceptedAlternativePaths: [
    {
      id: 'crrt04-primary-path',
      label: 'Primary reviewed synthetic CVVHD path',
      actionIds: [
        'crrt04-assess-goal',
        'crrt04-enter-blood-flow',
        'crrt04-enter-dialysate-primary',
        'crrt04-enter-machine-pfr',
        'crrt04-complete-prime-review',
        'crrt04-start-reviewed-treatment',
        'crrt04-advance-six-hours',
        'crrt04-reassess-delivery',
      ],
      reassessmentIds: ['crrt04-reassess-delivered-dose-and-labs'],
      successConditionIds: [
        'crrt04-prescribed-dose-band',
        'crrt04-delivered-dose-positive',
        'crrt04-time-advanced',
      ],
      explanation:
        'One pending synthetic prescription reaches the authored endpoints and still requires delivered-dose reassessment.',
      sourceIds: ['DOSE-PM-001', 'RENAL-2009', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-alternative-path',
      label: 'Alternative reviewed synthetic CVVHD path',
      actionIds: [
        'crrt04-assess-goal',
        'crrt04-enter-blood-flow',
        'crrt04-enter-dialysate-alternative',
        'crrt04-enter-machine-pfr',
        'crrt04-complete-prime-review',
        'crrt04-start-reviewed-treatment',
        'crrt04-advance-six-hours',
        'crrt04-reassess-delivery',
      ],
      reassessmentIds: ['crrt04-reassess-delivered-dose-and-labs'],
      successConditionIds: [
        'crrt04-prescribed-dose-band',
        'crrt04-delivered-dose-positive',
        'crrt04-time-advanced',
      ],
      explanation:
        'A second pending synthetic prescription is explicitly accepted so scoring does not require one exact setting.',
      sourceIds: ['DOSE-PM-001', 'RENAL-2009', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
  ],
  requiredReassessmentIds: ['crrt04-reassess-delivered-dose-and-labs'],
  successConditions: [
    {
      id: 'crrt04-prescribed-dose-band',
      metric: 'deliveredTherapy.prescribedEffluentDoseMlKgHour',
      comparator: 'between',
      value: [15, 30],
      unit: 'synthetic mL/kg/h completion band',
      sourceId: 'SYNTH-CRRT-04',
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-delivered-dose-positive',
      metric: 'deliveredTherapy.deliveredDoseMlKgHour',
      comparator: 'gt',
      value: 0,
      unit: 'mL/kg/h',
      sourceId: 'SYNTH-CRRT-04',
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-time-advanced',
      metric: 'simulationTimeSeconds',
      comparator: 'gte',
      value: 21_600,
      unit: 'synthetic seconds',
      sourceId: 'SYNTH-CRRT-04',
      reviewStatus: PENDING,
    },
  ],
  unsafeActions: [
    {
      id: 'crrt04-unsafe-start-before-review',
      actionId: 'crrt04-start-before-review',
      explanation:
        'Attempting to bypass prime and prescription review is a pending candidate critical error; the device workflow blocks execution.',
      criticalErrorId: 'crrt04-critical-start-before-review',
      sourceIds: ['DEV-PM-005', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-unsafe-ignore-downtime',
      actionId: 'crrt04-equate-prescribed-delivered',
      explanation:
        'Equating prescribed with delivered therapy after known downtime omits a required delivery reassessment.',
      criticalErrorId: 'crrt04-critical-ignore-downtime',
      sourceIds: ['DOSE-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
  ],
  criticalErrors: [
    {
      id: 'crrt04-critical-start-before-review',
      label: 'Candidate: bypass prime and prescription review',
      explanation:
        'Pending clinical/device review; scoring records the unsafe choice even though the simulator blocks the device transition.',
      actionIds: ['crrt04-start-before-review'],
      conditionIds: [],
      sourceIds: ['DEV-PM-005', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-critical-ignore-downtime',
      label: 'Candidate: ignore known interruption when assessing delivery',
      explanation:
        'Pending clinical review; this case requires actual delivered-dose reassessment rather than reliance on the prescription alone.',
      actionIds: ['crrt04-equate-prescribed-delivered'],
      conditionIds: ['crrt04-time-advanced'],
      sourceIds: ['DOSE-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
  ],
  hintLadder: [
    {
      id: 'crrt04-hint-goal-before-control',
      sequence: 1,
      text: 'Name the simulated solute and acid-base goal before deciding which machine flow changes that goal.',
      sourceIds: ['RENAL-2009', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-hint-bfr-first',
      sequence: 2,
      text: 'The source-mapped setup sequence expects blood flow before the downstream pilot flow entries.',
      sourceIds: ['DEV-PM-005'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt04-hint-delivery',
      sequence: 3,
      text: 'Compare integrated actual effluent with elapsed charting time after the interruption.',
      sourceIds: ['DOSE-PM-001', 'SYNTH-CRRT-04'],
      reviewStatus: PENDING,
    },
  ],
  debrief: {
    summary:
      'A coherent CVVHD prescription links goal, modality, device sequence, prescribed intensity, actual delivery, and delayed reassessment.',
    statedGoalReview:
      'Review whether the learner defined the simulated small-solute and acid-base goal rather than chasing a machine number.',
    predictionReview:
      'Compare the committed prediction with the immediate dose display, delayed laboratory direction, and interruption effect.',
    actionTimelineReview:
      'Reconstruct BFR-first entry, dialysate/PFR selection, prime/review, start, interruption, resumption, and reassessment.',
    causalChain: [
      'CVVHD prescription sets the source-mapped effluent target.',
      'Body weight normalizes the prescribed device-dose display.',
      'Actual pump delivery accumulates only while therapy is delivered.',
      'Downtime separates prescribed from delivered intensity.',
      'Delivered clearance drives delayed simulated solute direction.',
    ],
    trendReview:
      'Review prescribed dose, delivered dose, downtime, actual effluent, and the accessible delayed simulated laboratory summary.',
    requiredActionsReview:
      'Identify completed and missed goal, setup, start, time-advance, and reassessment actions.',
    criticalErrorsReview:
      'Show pending candidate errors without implying validated competency or a patient-specific recommendation.',
    acceptedAlternativesReview:
      'Explain that both authored synthetic dialysate paths can satisfy the case; neither is a universal clinical prescription.',
    machineNavigationPoint:
      'The teaching point is BFR-first prescription entry followed by prime and review before start.',
    transferQuestion:
      'In supervised practice, which device delivery and patient data would you review after an interruption before deciding whether the prescription still meets the team goal?',
    sourceIds: ['DEV-PM-005', 'DOSE-PM-001', 'RENAL-2009', 'SYNTH-CRRT-04'],
    reviewStatus: PENDING,
  },
  sourceBasis: sourceBasis(crtt04SourceIds),
  reviewStatus: PENDING,
  sourceCaseId: 'CRRT-04',
  contentVersion: BAXTER_CRRT_PILOT_CONTENT_VERSION,
  engineModelConfiguration: engineModelConfiguration('CRRT-04', 'SYNTH-CRRT-04'),
  engineFixtureConfiguration: engineFixtureConfiguration({
    sourceId: 'SYNTH-CRRT-04',
    positionResistanceMultiplier: 1,
    vasopressorSupportIndex: 0.25,
    hemodynamicStressIndex: 0.15,
    externalFluidRates: {
      maintenanceInputMlHour: 80,
      medicationCarrierInputMlHour: 50,
      nutritionInputMlHour: 40,
      bloodProductInputMlHour: 0,
      bolusInputMlHour: 0,
      otherInputMlHour: 0,
      urineOutputMlHour: 20,
      drainOutputMlHour: 0,
      otherOutputMlHour: 0,
    },
    timedEventMappings: [
      {
        timedEventId: 'crrt04-therapy-interruption',
        action: { type: 'SET_DELIVERY_STATE', deliveryState: 'paused' },
      },
      {
        timedEventId: 'crrt04-therapy-resumption',
        action: { type: 'SET_DELIVERY_STATE', deliveryState: 'running' },
      },
    ],
  }),
}

const crtt10SourceIds = [
  'FLUID-PM-001',
  'DEV-PM-009',
  'DEV-PM-013',
  'WHITE-2024',
  'GONEUTRAL-2024',
  'SYNTH-CRRT-10',
] as const

const crrt10 = {
  id: 'CRRT-10',
  title: 'Reconcile machine PFR with whole-patient fluid balance',
  stationId: 'monitor-dose-fluid',
  difficulty: 'intermediate',
  roleLenses: [...ALL_ROLE_LENSES],
  compatibleDevices: [PRISMAX_DEVICE],
  patientDescription:
    'A synthetic adult ICU patient remains net positive while the PrisMax PFR display shows active removal. Reconcile all simulated inputs, outputs, downtime, and hemodynamic tolerance before changing the plan.',
  learningObjectives: [
    'Keep machine PFR and whole-patient cumulative balance as separate quantities.',
    'Reconcile maintenance fluid, medication carriers, nutrition, boluses, urine, drains, and machine removal.',
    'Choose among explicit accepted alternatives based on the simulated tolerance signal.',
    'Reassess both hemodynamic stress and the whole-patient ledger after time advances.',
  ],
  initialPatient: syntheticPatient({
    sourceId: 'SYNTH-CRRT-10',
    bodyWeightKg: 75,
    hematocritFraction: 0.29,
    intravascularReserveMl: 700,
    totalFluidOverloadMl: 6_000,
    vascularRefillCapacityMlPerHour: 180,
    urineOutputMlPerHour: 40,
    residualRenalClearanceMlPerMin: 2,
    heartRatePerMin: 108,
    systolicPressureMmHg: 96,
    diastolicPressureMmHg: 54,
    meanArterialPressureMmHg: 68,
    vasopressorState: 'stable',
    temperatureCelsius: 36.4,
    sodiumMmolPerL: 139,
    potassiumMmolPerL: 4.9,
    bicarbonateMmolPerL: 20,
    pH: 7.31,
    smallSoluteMarkerMmolPerL: 25,
    creatinineMgPerDl: 3.1,
    phosphateMgPerDl: 4.8,
    magnesiumMgPerDl: 2.1,
    systemicIonizedCalciumMmolPerL: 1.12,
  }),
  initialAccess: syntheticAccess({
    sourceId: 'SYNTH-CRRT-10',
    descriptor: 'Synthetic functioning dual-lumen access',
    nominalFlowCapacityMlPerMin: 180,
    accessResistanceMmHgPerMlPerMin: 0.2,
    returnResistanceMmHgPerMlPerMin: 0.2,
    positionDependenceFraction: 0,
  }),
  initialPrescription: cvvhdPrescription({
    sourceIds: ['FLUID-PM-001', 'SYNTH-CRRT-10'],
    bloodFlowMlPerMin: 120,
    dialysateFlowMlPerHour: 1_500,
    patientFluidRemovalMlPerHour: 250,
  }),
  initialDeviceOverrides: {
    workflowPhase: 'operations',
    treatmentState: 'running',
    connectedToPatient: true,
    pumpsPaused: false,
    activeAlarmIds: [],
  },
  hiddenMechanism: {
    id: 'crrt10-whole-patient-ledger',
    summary:
      'Whole-patient balance remains positive when external inputs exceed urine, drains, and actually delivered machine removal; tolerance constrains the response.',
    causalChain: [
      'The machine PFR setting removes fluid only while therapy is delivered.',
      'Maintenance fluids, medication carriers, nutrition, boluses, and other inputs continue independently.',
      'Urine, drains, and other outputs contribute separately.',
      'The net of every input and output determines the whole-patient balance.',
      'The simulated tolerance signal determines whether cautious removal adjustment or input coordination is the safer accepted path.',
    ],
    correctGoalOptionId: 'crrt10-goal-whole-patient-balance',
    correctMechanismOptionId: 'crrt10-mechanism-inputs-exceed-removal',
    correctControlOptionIds: ['crrt10-control-reconcile-and-titrate'],
    correctResponseOptionId: 'crrt10-response-balance-improves-with-tolerance',
    correctReassessmentOptionIds: ['crrt10-reassess-ledger-and-tolerance'],
    sourceIds: ['FLUID-PM-001', 'WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    reviewStatus: PENDING,
  },
  visibleFindings: [
    'The machine PFR display is active, but the cumulative whole-patient balance remains positive.',
    'Multiple synthetic external input categories remain active while therapy runs.',
    'The hemodynamic stress index is a bounded educational signal, not a blood-pressure prediction.',
  ],
  timedEvents: [
    {
      id: 'crrt10-bolus-complete',
      atSimulationSeconds: 3_600,
      jitterSeconds: null,
      eventType: 'state-change',
      label: 'Synthetic bolus input completes',
      effects: [
        numberEffect(
          'scenario.externalFluidRates.bolusInputMlHour',
          'set',
          0,
          'mL/h',
          'SYNTH-CRRT-10',
        ),
      ],
      sourceIds: ['WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
  ],
  goalOptions: [
    option(
      'crrt10-goal-whole-patient-balance',
      'Improve whole-patient balance while preserving simulated tolerance',
      'The goal includes all inputs and outputs rather than a machine number in isolation.',
      ['FLUID-PM-001', 'WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-goal-maximize-pfr',
      'Maximize PFR regardless of the tolerance signal',
      'This ignores hemodynamic reassessment and is not a patient-specific recommendation.',
      ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-goal-zero-machine-number',
      'Treat the machine PFR display as the whole-patient outcome',
      'The source-mapped device distinction makes this framing incorrect.',
      ['FLUID-PM-001'],
    ),
  ],
  mechanismOptions: [
    option(
      'crrt10-mechanism-inputs-exceed-removal',
      'External inputs exceed urine, drains, and actual machine removal',
      'The ledger remains positive even though machine PFR is nonzero.',
      ['FLUID-PM-001', 'WHITE-2024', 'SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-mechanism-pfr-not-running',
      'The machine is not removing any fluid',
      'The case explicitly shows active delivered machine removal.',
      ['SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-mechanism-scale-error',
      'A scale error must explain every positive balance',
      'No scale fault is authored in this case; the external ledger is sufficient.',
      ['DEV-PM-013', 'SYNTH-CRRT-10'],
    ),
  ],
  controlOptions: [
    option(
      'crrt10-control-reconcile-and-titrate',
      'Reconcile the ledger, assess tolerance, then titrate or coordinate inputs',
      'This permits more than one accepted response instead of requiring one exact PFR.',
      ['WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-control-increase-without-assessment',
      'Increase PFR without checking tolerance',
      'This is retained only as a pending candidate critical-error choice.',
      ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-control-ignore-inputs',
      'Ignore external inputs and chase one machine value',
      'This cannot reconcile the whole-patient result.',
      ['FLUID-PM-001', 'WHITE-2024'],
    ),
  ],
  responseOptions: [
    option(
      'crrt10-response-balance-improves-with-tolerance',
      'Whole-patient balance improves without excessive simulated stress',
      'The accepted endpoint joins the cumulative ledger and tolerance abstraction.',
      ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-response-pfr-equals-net',
      'Whole-patient balance becomes the negative of PFR',
      'External inputs and outputs prevent that identity.',
      ['FLUID-PM-001', 'WHITE-2024'],
    ),
    option(
      'crrt10-response-no-reassessment-needed',
      'No patient or ledger reassessment is needed',
      'The case explicitly requires both.',
      ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    ),
  ],
  reassessmentOptions: [
    option(
      'crrt10-reassess-ledger-and-tolerance',
      'Review cumulative balance, actual removal, inputs/outputs, and tolerance',
      'This reassessment keeps the machine and patient domains synchronized.',
      ['FLUID-PM-001', 'WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    ),
    option(
      'crrt10-reassess-pfr-only',
      'Read only the current PFR setting',
      'The setting cannot explain the whole-patient cumulative result.',
      ['FLUID-PM-001'],
    ),
    option(
      'crrt10-reassess-labs-only',
      'Review laboratory values without the fluid ledger',
      'The central case outcome is fluid balance and tolerance.',
      ['SYNTH-CRRT-10'],
    ),
  ],
  interventions: [
    {
      id: 'crrt10-assess-tolerance',
      label: 'Assess simulated hemodynamic tolerance',
      category: 'assessment',
      description: 'Review the bounded tolerance signal before changing removal.',
      response: 'The case records that tolerance was assessed before a plan change.',
      latencySeconds: 0,
      effects: [],
      prerequisites: [],
      repeatable: false,
      sourceIds: ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-review-fluid-ledger',
      label: 'Reconcile every fluid-ledger category',
      category: 'fluid',
      description: 'Compare machine removal with all synthetic inputs and outputs.',
      response: 'The net-positive mechanism becomes visible without changing engine truth.',
      latencySeconds: 0,
      effects: [],
      prerequisites: [],
      repeatable: false,
      sourceIds: ['FLUID-PM-001', 'WHITE-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-cautious-pfr-adjustment',
      label: 'Apply a cautious synthetic PFR adjustment after assessment',
      category: 'prescription',
      description: 'Use the case-only accepted removal calibration after reviewing tolerance.',
      response:
        'Machine removal increases while the bounded tolerance model remains available for reassessment.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'prescription.flows.patientFluidRemovalMlHour',
          'set',
          350,
          'mL/h',
          'SYNTH-CRRT-10',
        ),
      ],
      prerequisites: ['crrt10-assess-tolerance', 'crrt10-review-fluid-ledger'],
      repeatable: false,
      sourceIds: ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-coordinate-maintenance-input',
      label: 'Coordinate a synthetic maintenance-input reduction',
      category: 'communication',
      description:
        'Review the need for maintenance input with the simulated team before changing it.',
      response:
        'The external-input ledger updates without implying unilateral bedside discontinuation.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'scenario.externalFluidRates.maintenanceInputMlHour',
          'set',
          80,
          'mL/h',
          'SYNTH-CRRT-10',
        ),
      ],
      prerequisites: ['crrt10-assess-tolerance', 'crrt10-review-fluid-ledger'],
      repeatable: false,
      sourceIds: ['WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-coordinate-medication-carriers',
      label: 'Coordinate synthetic medication-carrier consolidation',
      category: 'communication',
      description: 'Review medication-carrier inputs with the simulated multidisciplinary team.',
      response:
        'A modifiable external input decreases while medication dosing remains outside scope.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'scenario.externalFluidRates.medicationCarrierInputMlHour',
          'set',
          80,
          'mL/h',
          'SYNTH-CRRT-10',
        ),
      ],
      prerequisites: ['crrt10-assess-tolerance', 'crrt10-review-fluid-ledger'],
      repeatable: false,
      sourceIds: ['WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-advance-two-hours',
      label: 'Advance two simulated hours',
      category: 'assessment',
      description: 'Integrate the adjusted plan and the authored bolus completion event.',
      response: 'The cumulative machine-removal, whole-balance, and tolerance signals update.',
      latencySeconds: 7_200,
      effects: [
        numberEffect('simulation.advanceTimeSeconds', 'add', 7_200, 'seconds', 'SYNTH-CRRT-10'),
      ],
      prerequisites: ['crrt10-assess-tolerance', 'crrt10-review-fluid-ledger'],
      repeatable: false,
      sourceIds: ['WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-reassess-balance-tolerance',
      label: 'Reassess whole-patient balance and tolerance',
      category: 'assessment',
      description:
        'Compare cumulative balance with actual machine removal and the tolerance signal.',
      response:
        'The debrief can identify which accepted path was used and whether its endpoints were met.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt10-advance-two-hours'],
      repeatable: false,
      sourceIds: ['FLUID-PM-001', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-increase-pfr-without-reassessment',
      label: 'Increase PFR aggressively without tolerance assessment',
      category: 'prescription',
      description: 'Apply an unsafe candidate change without the required assessment gate.',
      response: 'The action is recorded as a pending candidate critical error.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'prescription.flows.patientFluidRemovalMlHour',
          'set',
          700,
          'mL/h',
          'SYNTH-CRRT-10',
        ),
      ],
      prerequisites: [],
      repeatable: false,
      sourceIds: ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-ignore-external-balance',
      label: 'Declare machine PFR equal to whole-patient balance',
      category: 'assessment',
      description: 'Ignore the external input/output ledger despite visible discrepancy.',
      response: 'The case records a consequential whole-balance reasoning error.',
      latencySeconds: 0,
      effects: [],
      prerequisites: [],
      repeatable: false,
      sourceIds: ['FLUID-PM-001', 'WHITE-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
  ],
  requiredActionIds: [
    'crrt10-assess-tolerance',
    'crrt10-review-fluid-ledger',
    'crrt10-advance-two-hours',
    'crrt10-reassess-balance-tolerance',
  ],
  acceptedAlternativePaths: [
    {
      id: 'crrt10-tolerance-guided-removal-path',
      label: 'Tolerance-guided synthetic removal adjustment',
      actionIds: [
        'crrt10-assess-tolerance',
        'crrt10-review-fluid-ledger',
        'crrt10-cautious-pfr-adjustment',
        'crrt10-advance-two-hours',
        'crrt10-reassess-balance-tolerance',
      ],
      reassessmentIds: ['crrt10-reassess-ledger-and-tolerance'],
      successConditionIds: [
        'crrt10-balance-improved',
        'crrt10-stress-bounded',
        'crrt10-time-advanced',
      ],
      explanation:
        'After explicit tolerance review, one synthetic PFR adjustment improves the case ledger without requiring an exact universal setting.',
      sourceIds: ['FLUID-PM-001', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-input-coordination-alternative',
      label: 'Multidisciplinary external-input coordination',
      actionIds: [
        'crrt10-assess-tolerance',
        'crrt10-review-fluid-ledger',
        'crrt10-coordinate-maintenance-input',
        'crrt10-coordinate-medication-carriers',
        'crrt10-advance-two-hours',
        'crrt10-reassess-balance-tolerance',
      ],
      reassessmentIds: ['crrt10-reassess-ledger-and-tolerance'],
      successConditionIds: [
        'crrt10-balance-improved',
        'crrt10-stress-bounded',
        'crrt10-time-advanced',
      ],
      explanation:
        'Coordinating modifiable external inputs is an accepted alternative when the team does not simply chase a higher machine PFR.',
      sourceIds: ['WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
  ],
  requiredReassessmentIds: ['crrt10-reassess-ledger-and-tolerance'],
  successConditions: [
    {
      id: 'crrt10-balance-improved',
      metric: 'deliveredTherapy.cumulativeWholePatientBalanceMl',
      comparator: 'lte',
      value: 500,
      unit: 'synthetic mL completion boundary',
      sourceId: 'SYNTH-CRRT-10',
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-stress-bounded',
      metric: 'patient.hemodynamicStressIndex',
      comparator: 'lte',
      value: 0.6,
      unit: 'synthetic model fraction',
      sourceId: 'SYNTH-CRRT-10',
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-time-advanced',
      metric: 'simulationTimeSeconds',
      comparator: 'gte',
      value: 7_200,
      unit: 'synthetic seconds',
      sourceId: 'SYNTH-CRRT-10',
      reviewStatus: PENDING,
    },
  ],
  unsafeActions: [
    {
      id: 'crrt10-unsafe-increase-without-tolerance-check',
      actionId: 'crrt10-increase-pfr-without-reassessment',
      explanation:
        'Increasing removal without first assessing the authored tolerance signal is a pending candidate critical error.',
      criticalErrorId: 'crrt10-critical-unreassessed-pfr-increase',
      sourceIds: ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-unsafe-equate-pfr-with-balance',
      actionId: 'crrt10-ignore-external-balance',
      explanation:
        'Ignoring known external inputs and outputs misrepresents the simulated patient result.',
      criticalErrorId: 'crrt10-critical-ignore-whole-balance',
      sourceIds: ['FLUID-PM-001', 'WHITE-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
  ],
  criticalErrors: [
    {
      id: 'crrt10-critical-unreassessed-pfr-increase',
      label: 'Candidate: increase PFR without tolerance reassessment',
      explanation:
        'Pending clinical review; the simulator records this authored unsafe choice but does not generalize its case value to patient care.',
      actionIds: ['crrt10-increase-pfr-without-reassessment'],
      conditionIds: [],
      sourceIds: ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-critical-ignore-whole-balance',
      label: 'Candidate: ignore the whole-patient fluid ledger',
      explanation:
        'Pending clinical review; visible external inputs and outputs must not be collapsed into the machine PFR setting.',
      actionIds: ['crrt10-ignore-external-balance'],
      conditionIds: [],
      sourceIds: ['FLUID-PM-001', 'WHITE-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
  ],
  hintLadder: [
    {
      id: 'crrt10-hint-two-ledgers',
      sequence: 1,
      text: 'Place machine PFR beside the cumulative whole-patient balance; they answer different questions.',
      sourceIds: ['FLUID-PM-001'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-hint-list-inputs',
      sequence: 2,
      text: 'Account for maintenance fluid, medication carriers, nutrition, bolus input, urine, drains, and actual machine removal.',
      sourceIds: ['WHITE-2024', 'GONEUTRAL-2024'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt10-hint-tolerance',
      sequence: 3,
      text: 'Use the simulated tolerance signal before choosing either more removal or coordinated input reduction.',
      sourceIds: ['GONEUTRAL-2024', 'SYNTH-CRRT-10'],
      reviewStatus: PENDING,
    },
  ],
  debrief: {
    summary:
      'Machine PFR is one ledger term; whole-patient balance is the net of every patient input and output, constrained by simulated tolerance.',
    statedGoalReview:
      'Review whether the learner targeted whole-patient balance and tolerance rather than a single machine number.',
    predictionReview:
      'Compare the predicted balance direction with the integrated external inputs, outputs, machine removal, and bolus completion.',
    actionTimelineReview:
      'Reconstruct tolerance assessment, ledger review, the selected accepted alternative, time advancement, and reassessment.',
    causalChain: [
      'External patient inputs continue independently of machine PFR.',
      'Urine, drains, and actual machine removal contribute separate outputs.',
      'The net of all terms determines cumulative whole-patient balance.',
      'A PFR change affects the balance only while therapy is actually delivered.',
      'Hemodynamic tolerance must be reassessed rather than inferred from the machine setting.',
    ],
    trendReview:
      'Review cumulative whole-patient balance, cumulative machine removal, external rates, downtime, and the hemodynamic stress summary.',
    requiredActionsReview:
      'Identify completed and missed tolerance, ledger, plan, time-advance, and reassessment actions.',
    criticalErrorsReview:
      'Show pending candidate errors for unreassessed removal escalation and ignoring the visible whole-patient ledger.',
    acceptedAlternativesReview:
      'Compare the tolerance-guided removal path with the multidisciplinary input-coordination alternative; neither is a universal prescription.',
    machineNavigationPoint:
      'The machine PFR display must remain visibly distinct from the whole-patient balance ledger.',
    transferQuestion:
      'In supervised practice, which patient inputs, outputs, delivered-removal data, and tolerance findings would you reconcile before proposing the next plan?',
    sourceIds: ['FLUID-PM-001', 'WHITE-2024', 'GONEUTRAL-2024', 'SYNTH-CRRT-10'],
    reviewStatus: PENDING,
  },
  sourceBasis: sourceBasis(crtt10SourceIds),
  reviewStatus: PENDING,
  sourceCaseId: 'CRRT-10',
  contentVersion: BAXTER_CRRT_PILOT_CONTENT_VERSION,
  engineModelConfiguration: engineModelConfiguration('CRRT-10', 'SYNTH-CRRT-10'),
  engineFixtureConfiguration: engineFixtureConfiguration({
    sourceId: 'SYNTH-CRRT-10',
    positionResistanceMultiplier: 1,
    vasopressorSupportIndex: 0.4,
    hemodynamicStressIndex: 0.25,
    externalFluidRates: {
      maintenanceInputMlHour: 180,
      medicationCarrierInputMlHour: 160,
      nutritionInputMlHour: 120,
      bloodProductInputMlHour: 0,
      bolusInputMlHour: 100,
      otherInputMlHour: 40,
      urineOutputMlHour: 40,
      drainOutputMlHour: 10,
      otherOutputMlHour: 0,
    },
    timedEventMappings: [
      {
        timedEventId: 'crrt10-bolus-complete',
        action: {
          type: 'SET_EXTERNAL_FLUID_RATE',
          field: 'bolusInputMlHour',
          rateMlHour: 0,
        },
      },
    ],
  }),
}

const crtt13SourceIds = ['DOSE-PM-001', 'DEV-PM-009', 'DEV-PM-013', 'SYNTH-CRRT-13'] as const

const crrt13 = {
  id: 'CRRT-13',
  title: 'Localize and correct a worsening access-pressure pattern',
  stationId: 'pressures-troubleshooting',
  difficulty: 'intermediate',
  roleLenses: [...ALL_ROLE_LENSES],
  compatibleDevices: [PRISMAX_DEVICE],
  patientDescription:
    'During a synthetic CVVHD treatment, access resistance rises and produces an increasingly negative model-derived access pressure with a generic engine obstruction alert. Use a cause-first sequence and confirm restored delivery.',
  learningObjectives: [
    'Interpret access pressure as a trend created by flow and resistance rather than a universal threshold.',
    'Assess the simulated patient and inspect access/circuit mechanics before changing therapy.',
    'Correct the authored mechanical cause before acknowledging resolution or escalating anticoagulation.',
    'Confirm restored resistance, pressure direction, and delivered therapy.',
  ],
  initialPatient: syntheticPatient({
    sourceId: 'SYNTH-CRRT-13',
    bodyWeightKg: 70,
    hematocritFraction: 0.31,
    intravascularReserveMl: 1_000,
    totalFluidOverloadMl: 3_000,
    vascularRefillCapacityMlPerHour: 180,
    urineOutputMlPerHour: 15,
    residualRenalClearanceMlPerMin: 0,
    heartRatePerMin: 96,
    systolicPressureMmHg: 108,
    diastolicPressureMmHg: 62,
    meanArterialPressureMmHg: 77,
    vasopressorState: 'stable',
    temperatureCelsius: 36.5,
    sodiumMmolPerL: 137,
    potassiumMmolPerL: 4.7,
    bicarbonateMmolPerL: 21,
    pH: 7.33,
    smallSoluteMarkerMmolPerL: 24,
    creatinineMgPerDl: 2.9,
    phosphateMgPerDl: 4.5,
    magnesiumMgPerDl: 2,
    systemicIonizedCalciumMmolPerL: 1.14,
  }),
  initialAccess: syntheticAccess({
    sourceId: 'SYNTH-CRRT-13',
    descriptor: 'Synthetic position-sensitive dual-lumen access',
    nominalFlowCapacityMlPerMin: 180,
    accessResistanceMmHgPerMlPerMin: 0.2,
    returnResistanceMmHgPerMlPerMin: 0.2,
    positionDependenceFraction: 0.6,
  }),
  initialPrescription: cvvhdPrescription({
    sourceIds: ['SYNTH-CRRT-13'],
    bloodFlowMlPerMin: 120,
    dialysateFlowMlPerHour: 1_500,
    patientFluidRemovalMlPerHour: 50,
  }),
  initialDeviceOverrides: {
    workflowPhase: 'operations',
    treatmentState: 'running',
    connectedToPatient: true,
    pumpsPaused: false,
    activeAlarmIds: [],
  },
  hiddenMechanism: {
    id: 'crrt13-positional-access-resistance',
    summary:
      'An authored positional/mechanical resistance increase makes access pressure more negative at the same blood flow and activates a generic cause-derived obstruction alert.',
    causalChain: [
      'Blood flow begins at a stable synthetic operating point.',
      'The scheduled case event increases access resistance and activates the access-obstruction fault.',
      'The pressure model produces a more-negative access signal from flow times resistance.',
      'Cause-first inspection and repositioning restore the authored resistance term.',
      'The learner confirms the pressure trend and treatment delivery instead of treating acknowledgement as correction.',
    ],
    correctGoalOptionId: 'crrt13-goal-restore-safe-access-delivery',
    correctMechanismOptionId: 'crrt13-mechanism-positional-resistance',
    correctControlOptionIds: ['crrt13-control-assess-inspect-correct'],
    correctResponseOptionId: 'crrt13-response-pressure-recovers-after-correction',
    correctReassessmentOptionIds: ['crrt13-reassess-pressure-flow-delivery'],
    sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
    reviewStatus: PENDING,
  },
  visibleFindings: [
    'Access pressure becomes progressively more negative after a deterministic event.',
    'Filter and return pressure signals remain available for localization context.',
    'The alarm remains a generic engine alert with device priority and automatic reaction pending review.',
  ],
  timedEvents: [
    {
      id: 'crrt13-obstruction-flag',
      atSimulationSeconds: 1_800,
      jitterSeconds: null,
      eventType: 'state-change',
      label: 'Synthetic access-obstruction state becomes active',
      effects: [booleanEffect('scenario.activeFaults.access-obstruction', true, 'SYNTH-CRRT-13')],
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-resistance-rise',
      atSimulationSeconds: 1_800,
      jitterSeconds: null,
      eventType: 'state-change',
      label: 'Synthetic positional access resistance rises',
      effects: [
        numberEffect(
          'access.accessResistanceMmHgPerMlMin',
          'set',
          1.2,
          'synthetic mmHg per mL/min',
          'SYNTH-CRRT-13',
        ),
      ],
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
  ],
  goalOptions: [
    option(
      'crrt13-goal-restore-safe-access-delivery',
      'Identify and correct the access cause, then confirm delivery',
      'The goal joins patient assessment, circuit mechanics, pressure direction, and delivered therapy.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-goal-silence-alert',
      'Silence or acknowledge the alert as the endpoint',
      'Acknowledgement does not correct resistance or restore delivery.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-goal-normal-threshold',
      'Force access pressure above one universal normal threshold',
      'The manual supports operating-point context, not a universal clinical normal.',
      ['DEV-PM-009'],
    ),
  ],
  mechanismOptions: [
    option(
      'crrt13-mechanism-positional-resistance',
      'Position-dependent mechanical access resistance',
      'At constant blood flow, increased access resistance makes the modeled access pressure more negative.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-mechanism-return-obstruction',
      'Return-line obstruction',
      'A return problem would produce a different pressure localization pattern.',
      ['DEV-PM-009'],
    ),
    option(
      'crrt13-mechanism-filter-fouling',
      'Primary filter fouling',
      'The authored event changes access resistance rather than the filter burden.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-mechanism-anticoagulation-deficit',
      'Anticoagulation deficit as the first explanation',
      'The case authors a mechanical cause and keeps anticoagulation outside the active pilot.',
      ['SYNTH-CRRT-13'],
    ),
  ],
  controlOptions: [
    option(
      'crrt13-control-assess-inspect-correct',
      'Assess, inspect the access path, correct position, then reassess',
      'This follows the cause-first troubleshooting sequence.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-control-increase-bfr',
      'Increase blood flow through unresolved resistance',
      'This is retained only as a pending candidate critical-error choice.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-control-acknowledge-only',
      'Acknowledge the alert and declare the problem resolved',
      'The underlying access resistance remains unchanged.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
  ],
  responseOptions: [
    option(
      'crrt13-response-pressure-recovers-after-correction',
      'Access pressure becomes less negative after resistance correction',
      'The model responds immediately to the corrected mechanical term; delivered therapy then requires confirmation.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-response-acknowledgement-corrects-pressure',
      'Acknowledgement alone restores pressure',
      'Acknowledgement does not alter the cause-derived resistance state.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-response-more-bfr-improves-access',
      'More blood flow makes the obstructed access pressure less negative',
      'The directional model predicts the opposite when resistance is unresolved.',
      ['DEV-PM-009'],
    ),
  ],
  reassessmentOptions: [
    option(
      'crrt13-reassess-pressure-flow-delivery',
      'Confirm access resistance, pressure trend, blood flow, alert state, and delivery',
      'This verifies cause correction and treatment recovery.',
      ['DEV-PM-009', 'DOSE-PM-001', 'SYNTH-CRRT-13'],
    ),
    option(
      'crrt13-reassess-alert-hidden',
      'Confirm only that the alert window is closed',
      'A hidden or acknowledged alert does not prove cause correction.',
      ['DEV-PM-009'],
    ),
    option(
      'crrt13-reassess-single-number',
      'Read one pressure value without its trend or delivery context',
      'The case requires directional trend and delivery reassessment.',
      ['DEV-PM-009', 'SYNTH-CRRT-13'],
    ),
  ],
  interventions: [
    {
      id: 'crrt13-assess-patient-device',
      label: 'Assess the simulated patient and device state',
      category: 'assessment',
      description: 'Check immediate simulated safety before manipulating the access path.',
      response: 'The assessment step is recorded without inventing a device priority.',
      latencySeconds: 0,
      effects: [],
      prerequisites: [],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-advance-to-pattern',
      label: 'Advance to the worsening pattern',
      category: 'assessment',
      description: 'Advance thirty simulated minutes to the authored access event.',
      response:
        'Access resistance rises, pressure becomes more negative, and the generic obstruction alert derives from engine state.',
      latencySeconds: 1_800,
      effects: [
        numberEffect('simulation.advanceTimeSeconds', 'add', 1_800, 'seconds', 'SYNTH-CRRT-13'),
      ],
      prerequisites: ['crrt13-assess-patient-device'],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-inspect-access-path',
      label: 'Inspect the access catheter and line path',
      category: 'access-circuit',
      description: 'Inspect position, visible line mechanics, connection, and the pressure trend.',
      response:
        'The authored pattern localizes to the access side before the filter and return path.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt13-advance-to-pattern'],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-acknowledge-alert',
      label: 'Acknowledge the generic engine alert',
      category: 'device',
      description: 'Record awareness without changing the access cause.',
      response: 'The alert acknowledgement remains separate from resistance correction.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt13-advance-to-pattern'],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-pause-treatment',
      label: 'Pause the synthetic treatment while correcting the access path',
      category: 'device',
      description: 'Use the explicit accepted pause-correct-resume alternative.',
      response: 'The pumps pause while the learner corrects the authored mechanical cause.',
      latencySeconds: 0,
      effects: [enumEffect('device.deliveryState', 'paused', 'SYNTH-CRRT-13')],
      prerequisites: ['crrt13-inspect-access-path'],
      repeatable: false,
      sourceIds: ['SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-reposition-access',
      label: 'Reposition the synthetic access and relieve resistance',
      category: 'access-circuit',
      description: 'Correct the authored positional resistance after inspection.',
      response:
        'Access resistance returns toward its synthetic baseline and the obstruction fault resolves.',
      latencySeconds: 0,
      effects: [
        numberEffect(
          'access.accessResistanceMmHgPerMlMin',
          'set',
          0.25,
          'synthetic mmHg per mL/min',
          'SYNTH-CRRT-13',
        ),
        booleanEffect('scenario.activeFaults.access-obstruction', false, 'SYNTH-CRRT-13'),
      ],
      prerequisites: ['crrt13-inspect-access-path'],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-resume-treatment',
      label: 'Resume after correcting the cause',
      category: 'device',
      description: 'Resume only after the accepted paused path corrects the access cause.',
      response: 'The blood and fluid pumps resume in the synthetic model.',
      latencySeconds: 0,
      effects: [enumEffect('device.deliveryState', 'running', 'SYNTH-CRRT-13')],
      prerequisites: ['crrt13-pause-treatment', 'crrt13-reposition-access'],
      repeatable: false,
      sourceIds: ['SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-confirm-restored-delivery',
      label: 'Confirm restored pressure pattern and treatment delivery',
      category: 'assessment',
      description: 'Reassess access pressure, flow, alert state, and actual delivery.',
      response: 'The case can close only after cause correction is verified.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt13-reposition-access'],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'DOSE-PM-001', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-increase-bfr-through-obstruction',
      label: 'Increase BFR through unresolved access resistance',
      category: 'prescription',
      description:
        'Apply a pending candidate critical-error action while the access cause remains unresolved.',
      response: 'The directional pressure model makes access pressure more negative.',
      latencySeconds: 0,
      effects: [
        numberEffect('prescription.flows.bloodFlowMlMin', 'set', 180, 'mL/min', 'SYNTH-CRRT-13'),
      ],
      prerequisites: ['crrt13-advance-to-pattern'],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-declare-resolved-after-ack',
      label: 'Declare resolution after acknowledgement alone',
      category: 'device',
      description: 'Treat acknowledgement as correction without changing resistance.',
      response: 'The underlying fault and model-derived pressure pattern remain unresolved.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt13-acknowledge-alert'],
      repeatable: false,
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-escalate-anticoagulation-first',
      label: 'Escalate anticoagulation before correcting the mechanical cause',
      category: 'medication',
      description: 'Choose a disabled medication-first response to an authored mechanical problem.',
      response: 'No medication effect executes; the access resistance remains unchanged.',
      latencySeconds: 0,
      effects: [],
      prerequisites: ['crrt13-inspect-access-path'],
      repeatable: false,
      sourceIds: ['SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
  ],
  requiredActionIds: [
    'crrt13-assess-patient-device',
    'crrt13-advance-to-pattern',
    'crrt13-inspect-access-path',
    'crrt13-reposition-access',
    'crrt13-confirm-restored-delivery',
  ],
  acceptedAlternativePaths: [
    {
      id: 'crrt13-cause-first-path',
      label: 'Direct cause-first access correction',
      actionIds: [
        'crrt13-assess-patient-device',
        'crrt13-advance-to-pattern',
        'crrt13-inspect-access-path',
        'crrt13-reposition-access',
        'crrt13-confirm-restored-delivery',
      ],
      reassessmentIds: ['crrt13-reassess-pressure-flow-delivery'],
      successConditionIds: [
        'crrt13-access-resistance-restored',
        'crrt13-access-pressure-recovered',
        'crrt13-delivery-present',
      ],
      explanation:
        'After assessment and inspection, correcting the authored positional cause restores the directional pressure model.',
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-pause-correct-resume-alternative',
      label: 'Pause, correct, and resume alternative',
      actionIds: [
        'crrt13-assess-patient-device',
        'crrt13-advance-to-pattern',
        'crrt13-inspect-access-path',
        'crrt13-pause-treatment',
        'crrt13-reposition-access',
        'crrt13-resume-treatment',
        'crrt13-confirm-restored-delivery',
      ],
      reassessmentIds: ['crrt13-reassess-pressure-flow-delivery'],
      successConditionIds: [
        'crrt13-access-resistance-restored',
        'crrt13-access-pressure-recovered',
        'crrt13-delivery-present',
      ],
      explanation:
        'A deliberate pause while correcting the cause is an accepted alternative when followed by safe resume and reassessment.',
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
  ],
  requiredReassessmentIds: ['crrt13-reassess-pressure-flow-delivery'],
  successConditions: [
    {
      id: 'crrt13-access-resistance-restored',
      metric: 'access.accessResistanceMmHgPerMlMin',
      comparator: 'lte',
      value: 0.35,
      unit: 'synthetic mmHg per mL/min completion boundary',
      sourceId: 'SYNTH-CRRT-13',
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-access-pressure-recovered',
      metric: 'circuit.pressures.accessPressureMmHg',
      comparator: 'gt',
      value: -100,
      unit: 'synthetic mmHg completion boundary',
      sourceId: 'SYNTH-CRRT-13',
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-delivery-present',
      metric: 'deliveredTherapy.deliveredDoseMlKgHour',
      comparator: 'gt',
      value: 0,
      unit: 'mL/kg/h',
      sourceId: 'SYNTH-CRRT-13',
      reviewStatus: PENDING,
    },
  ],
  unsafeActions: [
    {
      id: 'crrt13-unsafe-increase-bfr',
      actionId: 'crrt13-increase-bfr-through-obstruction',
      explanation:
        'Increasing blood flow through the unresolved synthetic access limitation worsens the directional pressure pattern.',
      criticalErrorId: 'crrt13-critical-increase-bfr',
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-unsafe-acknowledgement-only',
      actionId: 'crrt13-declare-resolved-after-ack',
      explanation: 'Acknowledgement does not alter the underlying access resistance or fault.',
      criticalErrorId: 'crrt13-critical-acknowledgement-only',
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-unsafe-anticoagulation-first',
      actionId: 'crrt13-escalate-anticoagulation-first',
      explanation:
        'The case authors a mechanical cause; medication escalation is disabled and does not correct it.',
      criticalErrorId: 'crrt13-critical-anticoagulation-first',
      sourceIds: ['SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
  ],
  criticalErrors: [
    {
      id: 'crrt13-critical-increase-bfr',
      label: 'Candidate: increase BFR through unresolved access limitation',
      explanation:
        'Pending clinical/device review; the model demonstrates the directional consequence without creating a universal threshold.',
      actionIds: ['crrt13-increase-bfr-through-obstruction'],
      conditionIds: [],
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-critical-acknowledgement-only',
      label: 'Candidate: treat acknowledgement as cause correction',
      explanation:
        'Pending clinical/device review; acknowledgement alone leaves the authored resistance and fault active.',
      actionIds: ['crrt13-declare-resolved-after-ack'],
      conditionIds: [],
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-critical-anticoagulation-first',
      label: 'Candidate: escalate anticoagulation before correcting a mechanical cause',
      explanation:
        'Pending clinical review; the pilot has no active anticoagulation protocol and the authored mechanical cause remains correctable independently.',
      actionIds: ['crrt13-escalate-anticoagulation-first'],
      conditionIds: [],
      sourceIds: ['SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
  ],
  hintLadder: [
    {
      id: 'crrt13-hint-trend',
      sequence: 1,
      text: 'Compare the access-pressure trend with filter and return signals instead of using one isolated threshold.',
      sourceIds: ['DEV-PM-009'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-hint-flow-resistance',
      sequence: 2,
      text: 'At the same blood flow, the model makes access pressure more negative when access resistance rises.',
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
    {
      id: 'crrt13-hint-cause-first',
      sequence: 3,
      text: 'Inspect and correct the mechanical access cause before declaring the alert resolved.',
      sourceIds: ['DEV-PM-009', 'SYNTH-CRRT-13'],
      reviewStatus: PENDING,
    },
  ],
  debrief: {
    summary:
      'The worsening access-pressure pattern arose from an authored resistance change and resolved only after cause-first mechanical correction.',
    statedGoalReview:
      'Review whether the learner aimed to restore access function and delivery rather than simply hide the alert.',
    predictionReview:
      'Compare the committed mechanism and expected direction with the model-derived pressure response.',
    actionTimelineReview:
      'Reconstruct patient/device assessment, event onset, access inspection, acknowledgement if used, correction, resume, and reassessment.',
    causalChain: [
      'The scheduled event increases synthetic access resistance.',
      'At the same BFR, the flow-resistance model produces a more-negative access pressure.',
      'The active obstruction fault derives a generic engine alert.',
      'Acknowledgement alone leaves resistance and the fault unchanged.',
      'Repositioning restores the authored resistance term, resolves the fault, and permits delivery confirmation.',
    ],
    trendReview:
      'Review access pressure, access resistance, BFR, delivered dose, downtime, and the alert lifecycle with accessible text summaries.',
    requiredActionsReview:
      'Identify completed and missed assessment, inspection, correction, resume, and reassessment actions.',
    criticalErrorsReview:
      'Show pending candidate errors for increasing BFR, declaring resolution after acknowledgement alone, or choosing anticoagulation before mechanical correction.',
    acceptedAlternativesReview:
      'Compare direct cause correction with the pause-correct-resume path; both require the same verified endpoint.',
    machineNavigationPoint:
      'Pressure should be interpreted as an operating-point trend while acknowledgement remains separate from correction.',
    transferQuestion:
      'In supervised practice, which patient, line, access, pressure-trend, and delivered-therapy findings would you confirm before resuming after an access problem?',
    sourceIds: ['DEV-PM-009', 'DOSE-PM-001', 'SYNTH-CRRT-13'],
    reviewStatus: PENDING,
  },
  sourceBasis: sourceBasis(crtt13SourceIds),
  reviewStatus: PENDING,
  sourceCaseId: 'CRRT-13',
  contentVersion: BAXTER_CRRT_PILOT_CONTENT_VERSION,
  engineModelConfiguration: engineModelConfiguration('CRRT-13', 'SYNTH-CRRT-13'),
  engineFixtureConfiguration: engineFixtureConfiguration({
    sourceId: 'SYNTH-CRRT-13',
    positionResistanceMultiplier: 1,
    vasopressorSupportIndex: 0.2,
    hemodynamicStressIndex: 0.1,
    externalFluidRates: {
      maintenanceInputMlHour: 80,
      medicationCarrierInputMlHour: 60,
      nutritionInputMlHour: 50,
      bloodProductInputMlHour: 0,
      bolusInputMlHour: 0,
      otherInputMlHour: 0,
      urineOutputMlHour: 15,
      drainOutputMlHour: 0,
      otherOutputMlHour: 0,
    },
    timedEventMappings: [
      {
        timedEventId: 'crrt13-obstruction-flag',
        action: { type: 'SET_FAULT', fault: 'access-obstruction', active: true },
      },
      {
        timedEventId: 'crrt13-resistance-rise',
        action: { type: 'SET_ACCESS_RESISTANCE', resistanceMmHgPerMlMin: 1.2 },
      },
    ],
  }),
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return value
}

const parsedPilotCases = runtimeCrrtCaseRegistrySchema.parse([crrt04, crrt10, crrt13])
const registryIssues = validatePilotCrrtCaseRegistry(parsedPilotCases, {
  requireExactPilotCases: true,
})

for (const [index, expectedCaseId] of CRRT_PILOT_CASE_IDS.entries()) {
  if (parsedPilotCases[index]?.id !== expectedCaseId) {
    registryIssues.push(
      `Pilot registry order mismatch at index ${index}: expected ${expectedCaseId}, received ${parsedPilotCases[index]?.id ?? 'missing'}`,
    )
  }
}

if (registryIssues.length > 0) {
  throw new Error(`Invalid Baxter CRRT pilot registry: ${registryIssues.join('; ')}`)
}

export const baxterCrrtPilotCases: readonly RuntimeCrrtCase[] = deepFreeze(parsedPilotCases)

/** Ordered, immutable normalized fixtures matching `CRRT_PILOT_CASE_IDS`. */
export const baxterCrrtPilotFixtures: readonly CrrtEngineFixture[] = deepFreeze(
  baxterCrrtPilotCases.map(normalizeRuntimeCrrtCaseToEngineFixture),
)

const pilotCaseById = new Map(
  baxterCrrtPilotCases.map((definition) => [definition.id, definition] as const),
)

export function isBaxterCrrtPilotCaseId(value: string): value is BaxterCrrtPilotCaseId {
  return (CRRT_PILOT_CASE_IDS as readonly string[]).includes(value)
}

export function getBaxterCrrtPilotCase(caseId: BaxterCrrtPilotCaseId): RuntimeCrrtCase {
  const definition = pilotCaseById.get(caseId)
  if (!definition) throw new Error(`Unknown Baxter CRRT pilot case: ${caseId}`)
  return definition
}

/** Returns a fresh normalized fixture so attempts never share mutable runtime state. */
export function getBaxterCrrtPilotFixture(caseId: BaxterCrrtPilotCaseId): CrrtEngineFixture {
  return normalizeRuntimeCrrtCaseToEngineFixture(getBaxterCrrtPilotCase(caseId))
}
