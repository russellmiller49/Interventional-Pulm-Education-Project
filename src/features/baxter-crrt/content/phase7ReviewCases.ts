import { baxterCrrtSupplementalSourceReferences } from './phase7ReviewSources'
import { baxterCrrtPilotSourceReferences } from './provenance'
import { runtimeCrrtCaseRegistrySchema, type RuntimeCrrtCase, type SourceReference } from './schema'
import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

const PENDING = 'pending' as const
const PRISMAX_DEVICE = 'prismax-aw8035-2xx' as const
const ALL_ROLE_LENSES = ['prescriber', 'operator', 'integrated'] as const

type ReviewCaseId =
  | 'CRRT-01'
  | 'CRRT-02'
  | 'CRRT-05'
  | 'CRRT-06'
  | 'CRRT-07'
  | 'CRRT-11'
  | 'CRRT-15'
type ReviewCaseStation = RuntimeCrrtCase['stationId']
type ReviewCaseDifficulty = RuntimeCrrtCase['difficulty']
type ReviewCaseModality = RuntimeCrrtCase['initialPrescription']['modality']
type InterventionCategory = RuntimeCrrtCase['interventions'][number]['category']

interface FlowConfiguration {
  readonly bloodFlowMlPerMin: number
  readonly preBloodPumpFlowMlPerHour: number
  readonly dialysateFlowMlPerHour: number
  readonly preReplacementFlowMlPerHour: number
  readonly postReplacementFlowMlPerHour: number
  readonly patientFluidRemovalMlPerHour: number
  readonly syringeFlowMlPerHour: number
  readonly makeupFlowMlPerHour: number
}

interface PatientConfiguration {
  readonly bodyWeightKg: number
  readonly hematocritFraction: number
  readonly intravascularReserveMl: number
  readonly totalFluidOverloadMl: number
  readonly vascularRefillCapacityMlPerHour: number
  readonly urineOutputMlPerHour: number
  readonly residualRenalClearanceMlPerMin: number
  readonly heartRatePerMin: number
  readonly systolicPressureMmHg: number
  readonly diastolicPressureMmHg: number
  readonly meanArterialPressureMmHg: number
  readonly vasopressorState: 'off' | 'stable' | 'increasing' | 'decreasing'
  readonly vasopressorSupportIndex: number
  readonly temperatureCelsius: number
  readonly sodiumMmolPerL: number
  readonly potassiumMmolPerL: number
  readonly bicarbonateMmolPerL: number
  readonly pH: number
  readonly smallSoluteMarkerMmolPerL: number
  readonly creatinineMgPerDl: number
  readonly phosphateMgPerDl: number
  readonly magnesiumMgPerDl: number
  readonly systemicIonizedCalciumMmolPerL: number
  readonly hemodynamicStressIndex: number
}

interface NumericEffectTemplate {
  readonly target: string
  readonly operation: 'set' | 'add' | 'multiply'
  readonly valueType: 'number'
  readonly value: number
  readonly unit: string
}

interface ActionTemplate {
  readonly label: string
  readonly category: InterventionCategory
  readonly description: string
  readonly response: string
  readonly latencySeconds: number
  readonly effects: readonly NumericEffectTemplate[]
}

interface ConditionTemplate {
  readonly suffix: string
  readonly metric: string
  readonly comparator: 'lt' | 'lte' | 'eq' | 'gte' | 'gt' | 'between'
  readonly value: number | [number, number]
  readonly unit: string
}

interface DeliveryEventTemplate {
  readonly suffix: string
  readonly atSimulationSeconds: number
  readonly eventType: 'treatment-interruption' | 'treatment-resumption'
  readonly label: string
  readonly deliveryState: 'paused' | 'running'
}

interface ReviewCaseSpec {
  readonly id: ReviewCaseId
  readonly title: string
  readonly stationId: ReviewCaseStation
  readonly difficulty: ReviewCaseDifficulty
  readonly patientDescription: string
  readonly learningObjectives: readonly string[]
  readonly focus: string
  readonly mechanism: string
  readonly expectedResponse: string
  readonly reassessmentFocus: string
  readonly patient: PatientConfiguration
  readonly modality: ReviewCaseModality
  readonly flows: FlowConfiguration
  readonly positionResistanceMultiplier: number
  readonly accessResistanceMmHgPerMlPerMin: number
  readonly returnResistanceMmHgPerMlPerMin: number
  readonly nominalFlowCapacityMlPerMin: number
  readonly externalFluidRates: Readonly<{
    maintenanceInputMlHour: number
    medicationCarrierInputMlHour: number
    nutritionInputMlHour: number
    bloodProductInputMlHour: number
    bolusInputMlHour: number
    otherInputMlHour: number
    urineOutputMlHour: number
    drainOutputMlHour: number
    otherOutputMlHour: number
  }>
  readonly safeAction: ActionTemplate
  readonly alternativeAction: ActionTemplate
  readonly unsafeAction: ActionTemplate
  readonly successConditions: readonly ConditionTemplate[]
  readonly alternativeConditionSuffixes: readonly string[]
  readonly deliveryEvents?: readonly DeliveryEventTemplate[]
  readonly clinicalSourceIds: readonly string[]
  readonly transferQuestion: string
}

const sourceRecordById = new Map<string, SourceReference>(
  [...baxterCrrtSupplementalSourceReferences, ...baxterCrrtPilotSourceReferences].map((record) => [
    record.id,
    record,
  ]),
)

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function sourceBasis(sourceIds: readonly string[]): SourceReference[] {
  return unique(sourceIds).map((sourceId) => {
    const source = sourceRecordById.get(sourceId)
    if (!source) throw new Error(`Unknown Phase 7 review-case source ID: ${sourceId}`)
    return source
  })
}

function casePrefix(caseId: ReviewCaseId): string {
  return caseId.toLowerCase().replace('-', '')
}

function syntheticSourceId(caseId: ReviewCaseId): string {
  return `SYNTH-${caseId}`
}

function option(id: string, label: string, description: string, sourceIds: readonly string[]) {
  return {
    id,
    label,
    description,
    sourceIds: [...sourceIds],
    reviewStatus: PENDING,
  }
}

function numericEffect(effect: NumericEffectTemplate, sourceId: string) {
  return { ...effect, sourceId }
}

function sourceBags(flows: FlowConfiguration, syntheticId: string) {
  const activeSources = [
    ['dialysate', 'Synthetic dialysate source', flows.dialysateFlowMlPerHour],
    ['pbp', 'Synthetic pre-blood-pump source', flows.preBloodPumpFlowMlPerHour],
    ['pre-replacement', 'Synthetic pre-replacement source', flows.preReplacementFlowMlPerHour],
    ['post-replacement', 'Synthetic post-replacement source', flows.postReplacementFlowMlPerHour],
    ['syringe', 'Synthetic syringe source', flows.syringeFlowMlPerHour],
    ['makeup', 'Synthetic makeup source', flows.makeupFlowMlPerHour],
  ] as const

  const sources = activeSources
    .filter(([, , rate]) => rate > 0)
    .map(([flowTerm, label]) => ({
      id: `${flowTerm}-bag`,
      label,
      flowTerm,
      direction: 'source' as const,
      capacityMl: 20_000,
      calculatedVolumeMl: 20_000,
      measuredVolumeMl: 20_000,
      cumulativePumpVolumeMl: 0,
      connected: true,
      scaleOpen: false,
      externalInterferenceMl: 0,
      reviewStatus: PENDING,
      sourceIds: ['DEV-PM-013', syntheticId],
    }))

  return [
    ...sources,
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
      sourceIds: ['DEV-PM-013', syntheticId],
    },
  ]
}

function soluteModel(syntheticId: string, permeabilityFraction: number) {
  return {
    distributionVolumeLiters: 40,
    productionAmountPerHour: 0,
    inputAmountPerHour: 0,
    residualClearanceMlPerMin: 0,
    filterPermeabilityFraction: permeabilityFraction,
    reviewStatus: PENDING,
    sourceIds: [syntheticId],
  }
}

function buildReviewCase(spec: ReviewCaseSpec) {
  const prefix = casePrefix(spec.id)
  const syntheticId = syntheticSourceId(spec.id)
  const deviceSourceIds = [
    'MATH-PM-001',
    'DOSE-PM-001',
    'FLUID-PM-001',
    'DEV-PM-009',
    'DEV-PM-013',
  ] as const
  const caseSourceIds = unique([...spec.clinicalSourceIds, ...deviceSourceIds, syntheticId])
  const contextualSourceIds = unique([...spec.clinicalSourceIds, syntheticId])
  const assessId = `${prefix}-action-assess`
  const safeId = `${prefix}-action-safe-candidate`
  const alternativeId = `${prefix}-action-alternative-candidate`
  const communicateId = `${prefix}-action-communicate`
  const unsafeId = `${prefix}-action-unsafe-candidate`
  const reassessId = `${prefix}-reassess-trends`
  const criticalId = `${prefix}-critical-unsafe-candidate`
  const eventTemplates = spec.deliveryEvents ?? []

  const successConditions = spec.successConditions.map((condition) => ({
    id: `${prefix}-condition-${condition.suffix}`,
    metric: condition.metric,
    comparator: condition.comparator,
    value: condition.value,
    unit: condition.unit,
    sourceId: syntheticId,
    reviewStatus: PENDING,
  }))
  const conditionIds = new Map(
    spec.successConditions.map((condition) => [
      condition.suffix,
      `${prefix}-condition-${condition.suffix}`,
    ]),
  )
  const alternativeConditionIds = spec.alternativeConditionSuffixes.map((suffix) => {
    const id = conditionIds.get(suffix)
    if (!id) throw new Error(`${spec.id} references unknown alternative condition: ${suffix}`)
    return id
  })

  return {
    id: spec.id,
    sourceCaseId: spec.id,
    contentVersion: BAXTER_CRRT_CONTENT_VERSION,
    title: spec.title,
    stationId: spec.stationId,
    difficulty: spec.difficulty,
    roleLenses: [...ALL_ROLE_LENSES],
    compatibleDevices: [PRISMAX_DEVICE],
    patientDescription: spec.patientDescription,
    learningObjectives: [...spec.learningObjectives],
    initialPatient: {
      simulatedBodyWeightKg: spec.patient.bodyWeightKg,
      hematocritFraction: spec.patient.hematocritFraction,
      intravascularReserveMl: spec.patient.intravascularReserveMl,
      totalFluidOverloadMl: spec.patient.totalFluidOverloadMl,
      vascularRefillCapacityMlPerHour: spec.patient.vascularRefillCapacityMlPerHour,
      urineOutputMlPerHour: spec.patient.urineOutputMlPerHour,
      residualRenalClearanceMlPerMin: spec.patient.residualRenalClearanceMlPerMin,
      hemodynamics: {
        heartRatePerMin: spec.patient.heartRatePerMin,
        systolicPressureMmHg: spec.patient.systolicPressureMmHg,
        diastolicPressureMmHg: spec.patient.diastolicPressureMmHg,
        meanArterialPressureMmHg: spec.patient.meanArterialPressureMmHg,
        vasopressorState: spec.patient.vasopressorState,
      },
      temperatureCelsius: spec.patient.temperatureCelsius,
      solutes: {
        sodiumMmolPerL: spec.patient.sodiumMmolPerL,
        potassiumMmolPerL: spec.patient.potassiumMmolPerL,
        bicarbonateMmolPerL: spec.patient.bicarbonateMmolPerL,
        pH: spec.patient.pH,
        smallSoluteMarkerMmolPerL: spec.patient.smallSoluteMarkerMmolPerL,
        creatinineMgPerDl: spec.patient.creatinineMgPerDl,
        phosphateMgPerDl: spec.patient.phosphateMgPerDl,
        magnesiumMgPerDl: spec.patient.magnesiumMgPerDl,
        systemicIonizedCalciumMmolPerL: spec.patient.systemicIonizedCalciumMmolPerL,
        totalCalciumMgPerDl: null,
        glucoseMgPerDl: null,
        advanced: [],
      },
      sourceIds: [syntheticId],
    },
    initialAccess: {
      catheter: {
        descriptor: 'Synthetic dual-lumen central venous access',
        site: 'Synthetic central venous access site',
        type: 'Synthetic dual-lumen access',
        nominalFlowCapacityMlPerMin: spec.nominalFlowCapacityMlPerMin,
      },
      accessResistanceMmHgPerMlPerMin: spec.accessResistanceMmHgPerMlPerMin,
      returnResistanceMmHgPerMlPerMin: spec.returnResistanceMmHgPerMlPerMin,
      positionDependenceFraction: 0,
      recirculationFraction: 0,
      partialThrombusFraction: 0,
      accessLineState: 'open' as const,
      returnLineState: 'open' as const,
      connectionState: 'connected' as const,
      sourceIds: [syntheticId],
    },
    initialPrescription: {
      modality: spec.modality,
      ...spec.flows,
      anticoagulation: { method: 'none' as const, protocolProfileId: null },
      solutionProfileIds: [],
      sourceIds: [syntheticId, 'MATH-PM-001', 'DOSE-PM-001'],
    },
    initialDeviceOverrides: {
      workflowPhase: 'operations' as const,
      treatmentState: 'running' as const,
      connectedToPatient: true,
      pumpsPaused: false,
      activeAlarmIds: [],
    },
    hiddenMechanism: {
      id: `${prefix}-hidden-mechanism`,
      summary: spec.mechanism,
      causalChain: [
        `The reviewer first defines the candidate ${spec.focus}.`,
        spec.mechanism,
        spec.expectedResponse,
        `The reviewer reassesses ${spec.reassessmentFocus} before interpreting the candidate path.`,
      ],
      correctGoalOptionId: `${prefix}-goal-focus`,
      correctMechanismOptionId: `${prefix}-mechanism-causal`,
      correctControlOptionIds: [`${prefix}-control-safe`],
      correctResponseOptionId: `${prefix}-response-authored`,
      correctReassessmentOptionIds: [reassessId],
      sourceIds: contextualSourceIds,
      reviewStatus: PENDING,
    },
    visibleFindings: [
      'Every patient value and setting is synthetic teaching calibration pending review.',
      'No local solution, set, anticoagulation protocol, alarm threshold, or correction sequence is represented.',
      'The candidate is available only to reviewers and cannot record learner progress.',
    ],
    timedEvents: eventTemplates.map((event) => ({
      id: `${prefix}-event-${event.suffix}`,
      atSimulationSeconds: event.atSimulationSeconds,
      jitterSeconds: null,
      eventType: event.eventType,
      label: event.label,
      effects: [
        {
          target: 'device.deliveryState',
          operation: 'set' as const,
          valueType: 'enum' as const,
          value: event.deliveryState,
          sourceId: syntheticId,
        },
      ],
      sourceIds: [syntheticId],
      reviewStatus: PENDING,
    })),
    goalOptions: [
      option(
        `${prefix}-goal-focus`,
        `Define the candidate ${spec.focus}`,
        'Use the whole authored scenario and preserve explicit uncertainty; no isolated value becomes a clinical threshold.',
        contextualSourceIds,
      ),
      option(
        `${prefix}-goal-isolated-value`,
        'Treat one isolated value as the complete goal',
        'This omits the broader authored context and reassessment requirement.',
        contextualSourceIds,
      ),
    ],
    mechanismOptions: [
      option(
        `${prefix}-mechanism-causal`,
        'Use the candidate causal mechanism',
        spec.mechanism,
        contextualSourceIds,
      ),
      option(
        `${prefix}-mechanism-display-equals-outcome`,
        'Assume a displayed prescription guarantees the patient response',
        'This collapses prescribed therapy, delivered therapy, and patient response into one signal.',
        caseSourceIds,
      ),
    ],
    controlOptions: [
      option(
        `${prefix}-control-safe`,
        spec.safeAction.label,
        'Pending reviewer candidate with synthetic values and a required reassessment.',
        contextualSourceIds,
      ),
      option(
        `${prefix}-control-alternative`,
        spec.alternativeAction.label,
        'Separate pending reviewer alternative with synthetic values and the same reassessment requirement.',
        contextualSourceIds,
      ),
      option(
        `${prefix}-control-unsafe`,
        spec.unsafeAction.label,
        'Pending unsafe candidate retained only for reviewer scoring validation.',
        [syntheticId],
      ),
    ],
    responseOptions: [
      option(
        `${prefix}-response-authored`,
        'Expect the authored synthetic response and reassess it',
        spec.expectedResponse,
        contextualSourceIds,
      ),
      option(
        `${prefix}-response-guaranteed`,
        'Assume the response is immediate and guaranteed',
        'This bypasses the authored delivery and reassessment signals.',
        [syntheticId],
      ),
    ],
    reassessmentOptions: [
      option(
        reassessId,
        `Reassess ${spec.reassessmentFocus}`,
        'Review the authored machine, patient, delivery, and timeline signals before the debrief.',
        contextualSourceIds,
      ),
      option(
        `${prefix}-reassess-none`,
        'Do not reassess after the candidate action',
        'This omits the required reassessment gate.',
        [syntheticId],
      ),
    ],
    interventions: [
      {
        id: assessId,
        label: 'Assess the complete synthetic scenario',
        category: 'assessment' as const,
        description:
          'Review all authored patient, circuit, delivery, and hemodynamic signals without importing a bedside threshold.',
        response:
          'The reviewer assessment gate is recorded; it does not issue a clinical recommendation.',
        latencySeconds: 60,
        effects: [],
        prerequisites: [],
        repeatable: false,
        sourceIds: contextualSourceIds,
        reviewStatus: PENDING,
      },
      {
        id: safeId,
        ...spec.safeAction,
        effects: spec.safeAction.effects.map((effect) => numericEffect(effect, syntheticId)),
        prerequisites: [assessId],
        repeatable: false,
        sourceIds: [syntheticId, ...spec.clinicalSourceIds],
        reviewStatus: PENDING,
      },
      {
        id: alternativeId,
        ...spec.alternativeAction,
        effects: spec.alternativeAction.effects.map((effect) => numericEffect(effect, syntheticId)),
        prerequisites: [assessId],
        repeatable: false,
        sourceIds: [syntheticId, ...spec.clinicalSourceIds],
        reviewStatus: PENDING,
      },
      {
        id: communicateId,
        label: 'Communicate the candidate plan and uncertainty',
        category: 'communication' as const,
        description:
          'State the authored goal, pending evidence status, selected candidate path, and reassessment plan.',
        response:
          'Communication is recorded without implying approval, competency, or local protocol alignment.',
        latencySeconds: 60,
        effects: [],
        prerequisites: [assessId],
        repeatable: false,
        sourceIds: contextualSourceIds,
        reviewStatus: PENDING,
      },
      {
        id: unsafeId,
        ...spec.unsafeAction,
        effects: spec.unsafeAction.effects.map((effect) => numericEffect(effect, syntheticId)),
        prerequisites: [],
        repeatable: false,
        sourceIds: [syntheticId],
        reviewStatus: PENDING,
      },
    ],
    requiredActionIds: [assessId, safeId, communicateId],
    acceptedAlternativePaths: [
      {
        id: `${prefix}-path-alternative`,
        label: spec.alternativeAction.label,
        predictionControlOptionIds: [`${prefix}-control-alternative`],
        actionIds: [assessId, alternativeId, communicateId],
        reassessmentIds: [reassessId],
        successConditionIds: alternativeConditionIds,
        explanation:
          'A separate pending reviewer path that preserves assessment, communication, and reassessment while avoiding an unsupported universal setting.',
        sourceIds: contextualSourceIds,
        reviewStatus: PENDING,
      },
    ],
    requiredReassessmentIds: [reassessId],
    successConditions,
    unsafeActions: [
      {
        id: `${prefix}-unsafe-link`,
        actionId: unsafeId,
        explanation:
          'This exact unsafe candidate is synthetic, pending review, and must not be generalized to patient care.',
        criticalErrorId: criticalId,
        sourceIds: [syntheticId],
        reviewStatus: PENDING,
      },
    ],
    criticalErrors: [
      {
        id: criticalId,
        label: 'Pending synthetic critical-error candidate',
        explanation:
          'Reviewer-only scoring candidate; it is not an approved clinical critical-error rule.',
        actionIds: [unsafeId],
        conditionIds: [],
        sourceIds: [syntheticId],
        reviewStatus: PENDING,
      },
    ],
    hintLadder: [
      {
        id: `${prefix}-hint-1`,
        sequence: 1,
        text: `Start by stating the candidate ${spec.focus}.`,
        sourceIds: contextualSourceIds,
        reviewStatus: PENDING,
      },
      {
        id: `${prefix}-hint-2`,
        sequence: 2,
        text: 'Separate the authored prescription signal from delivery and patient response.',
        sourceIds: caseSourceIds,
        reviewStatus: PENDING,
      },
      {
        id: `${prefix}-hint-3`,
        sequence: 3,
        text: `Commit to reassessing ${spec.reassessmentFocus}.`,
        sourceIds: contextualSourceIds,
        reviewStatus: PENDING,
      },
    ],
    debrief: {
      summary: `Reviewer-only causal debrief for the pending ${spec.id} candidate.`,
      statedGoalReview: `Compare the stated goal with the authored ${spec.focus}; no numeric case value is a bedside target.`,
      predictionReview:
        'Compare the prediction with the authored synthetic mechanism and response.',
      actionTimelineReview:
        'Review whether assessment preceded action and whether communication and reassessment followed.',
      causalChain: [
        `Authored context framed the candidate ${spec.focus}.`,
        spec.mechanism,
        spec.expectedResponse,
        `Reassessment of ${spec.reassessmentFocus} determined whether the candidate endpoint was reached.`,
      ],
      trendReview:
        'Inspect the synthetic engine trend and delivery timeline; do not infer an unreviewed clinical threshold.',
      requiredActionsReview:
        'The required reviewer path contains assessment, the candidate action, communication, and reassessment.',
      criticalErrorsReview:
        'Any displayed critical error is a pending synthetic scoring candidate, not an approved clinical rule.',
      acceptedAlternativesReview:
        'The alternative preserves assessment, communication, and reassessment without asserting one universal prescription.',
      machineNavigationPoint:
        'The case begins on a simulated PrisMax Operations projection; it contains no exact alarm response or local configuration instruction.',
      transferQuestion: spec.transferQuestion,
      sourceIds: caseSourceIds,
      reviewStatus: PENDING,
    },
    sourceBasis: sourceBasis(caseSourceIds),
    reviewStatus: PENDING,
    engineModelConfiguration: {
      id: `${prefix}-synthetic-model`,
      version: BAXTER_CRRT_CONTENT_VERSION,
      internalStepSeconds: 60 as const,
      internalStepRationale:
        'One-minute deterministic integration is synthetic teaching calibration pending review.',
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
          id: `${prefix}-access-reference`,
          domain: 'pressure' as const,
          value: 5,
          unit: 'mmHg',
          sourceId: syntheticId,
          reviewStatus: PENDING,
        },
        {
          id: `${prefix}-filter-resistance`,
          domain: 'pressure' as const,
          value: 0.3,
          unit: 'mmHg per mL/min',
          sourceId: syntheticId,
          reviewStatus: PENDING,
        },
        {
          id: `${prefix}-hemodynamic-recovery`,
          domain: 'patient' as const,
          value: 0.12,
          unit: 'model fraction per hour',
          sourceId: syntheticId,
          reviewStatus: PENDING,
        },
      ],
      sourceIds: [syntheticId, 'DEV-PM-009'],
      reviewStatus: PENDING,
    },
    engineFixtureConfiguration: {
      patient: {
        vasopressorSupportIndex: spec.patient.vasopressorSupportIndex,
        hemodynamicStressIndex: spec.patient.hemodynamicStressIndex,
        totalCalciumMmolL: null,
        reviewStatus: PENDING,
        solutes: {
          sodium: soluteModel(syntheticId, 0.95),
          potassium: soluteModel(syntheticId, 1),
          bicarbonate: soluteModel(syntheticId, 1),
          'urea-marker': soluteModel(syntheticId, 1),
          'creatinine-marker': soluteModel(syntheticId, 0.9),
          phosphate: soluteModel(syntheticId, 0.9),
          magnesium: soluteModel(syntheticId, 0.85),
        },
      },
      access: {
        positionResistanceMultiplier: spec.positionResistanceMultiplier,
        reviewStatus: PENDING,
      },
      prescription: { reviewStatus: PENDING },
      bags: sourceBags(spec.flows, syntheticId),
      externalFluidRates: { ...spec.externalFluidRates },
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
          sourceIds: [syntheticId, 'DEV-PM-009'],
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
          sourceIds: [syntheticId],
        },
        hemodynamic: {
          stressGainPerExcessRemovalLiter: 0.4,
          stressRecoveryPerHour: 0.12,
          reviewStatus: PENDING,
          sourceIds: [syntheticId],
        },
        filterInletConcentrationFraction: 1,
        filtrationFraction: spec.modality === 'CVVHDF' ? 0.2 : 0.1,
        reviewStatus: PENDING,
        sourceIds: [syntheticId, 'DEV-PM-009'],
      },
      timedEventMappings: eventTemplates.map((event) => ({
        timedEventId: `${prefix}-event-${event.suffix}`,
        action: {
          type: 'SET_DELIVERY_STATE' as const,
          deliveryState: event.deliveryState,
        },
      })),
      sourceIds: [syntheticId, 'DEV-PM-009', 'DEV-PM-013'],
    },
  }
}

const noAdditionalExternalFluids = Object.freeze({
  maintenanceInputMlHour: 0,
  medicationCarrierInputMlHour: 0,
  nutritionInputMlHour: 0,
  bloodProductInputMlHour: 0,
  bolusInputMlHour: 0,
  otherInputMlHour: 0,
  urineOutputMlHour: 0,
  drainOutputMlHour: 0,
  otherOutputMlHour: 0,
})

const reviewCaseSpecs: readonly ReviewCaseSpec[] = [
  {
    id: 'CRRT-01',
    title: 'Define goals for septic shock, AKI, and fluid-overload context',
    stationId: 'define-goal',
    difficulty: 'intermediate',
    patientDescription:
      'A synthetic adult ICU scenario combines septic shock, AKI, accumulated fluid, and ongoing support. Review the complete context and define a candidate treatment goal.',
    learningObjectives: [
      'Frame kidney-support goals from the whole synthetic clinical context.',
      'Keep machine patient-fluid removal distinct from whole-patient balance.',
      'State a reassessment plan before interpreting the candidate response.',
    ],
    focus: 'fluid and solute treatment goal',
    mechanism:
      'The candidate separates machine removal, external fluid balance, solute delivery, and tolerance rather than treating one display as the outcome.',
    expectedResponse:
      'The authored removal-flow signal changes immediately, while patient and cumulative balance signals require reassessment over time.',
    reassessmentFocus: 'delivery, whole-patient balance, and synthetic tolerance',
    patient: {
      bodyWeightKg: 92,
      hematocritFraction: 0.29,
      intravascularReserveMl: 650,
      totalFluidOverloadMl: 5_600,
      vascularRefillCapacityMlPerHour: 90,
      urineOutputMlPerHour: 10,
      residualRenalClearanceMlPerMin: 0,
      heartRatePerMin: 112,
      systolicPressureMmHg: 92,
      diastolicPressureMmHg: 52,
      meanArterialPressureMmHg: 65,
      vasopressorState: 'stable',
      vasopressorSupportIndex: 0.65,
      temperatureCelsius: 37.8,
      sodiumMmolPerL: 137,
      potassiumMmolPerL: 5.4,
      bicarbonateMmolPerL: 17,
      pH: 7.22,
      smallSoluteMarkerMmolPerL: 32,
      creatinineMgPerDl: 3.4,
      phosphateMgPerDl: 5.6,
      magnesiumMgPerDl: 2.1,
      systemicIonizedCalciumMmolPerL: 1.08,
      hemodynamicStressIndex: 0.42,
    },
    modality: 'CVVHD',
    flows: {
      bloodFlowMlPerMin: 150,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 1_200,
      preReplacementFlowMlPerHour: 0,
      postReplacementFlowMlPerHour: 0,
      patientFluidRemovalMlPerHour: 20,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
    },
    positionResistanceMultiplier: 1,
    accessResistanceMmHgPerMlPerMin: 0.22,
    returnResistanceMmHgPerMlPerMin: 0.2,
    nominalFlowCapacityMlPerMin: 180,
    externalFluidRates: {
      ...noAdditionalExternalFluids,
      maintenanceInputMlHour: 80,
      medicationCarrierInputMlHour: 35,
      nutritionInputMlHour: 45,
      urineOutputMlHour: 10,
    },
    safeAction: {
      label: 'Apply the reviewer-only synthetic removal candidate',
      category: 'fluid',
      description:
        'Set only the authored synthetic machine-removal value after the assessment gate.',
      response: 'The machine-removal setting changes; no bedside target is implied.',
      latencySeconds: 60,
      effects: [
        {
          target: 'prescription.flows.patientFluidRemovalMlHour',
          operation: 'set',
          valueType: 'number',
          value: 70,
          unit: 'mL/h',
        },
      ],
    },
    alternativeAction: {
      label: 'Defer a numeric change and coordinate the goal',
      category: 'communication',
      description:
        'Preserve the current synthetic setting while escalating the unresolved goal for review.',
      response: 'The current setting is unchanged and uncertainty remains explicit.',
      latencySeconds: 60,
      effects: [],
    },
    unsafeAction: {
      label: 'Escalate removal without assessment or reassessment',
      category: 'fluid',
      description: 'Apply the authored unsafe candidate without a tolerance gate.',
      response: 'The action is recorded as a pending synthetic critical-error candidate.',
      latencySeconds: 0,
      effects: [
        {
          target: 'prescription.flows.patientFluidRemovalMlHour',
          operation: 'set',
          valueType: 'number',
          value: 300,
          unit: 'mL/h',
        },
      ],
    },
    successConditions: [
      {
        suffix: 'candidate-removal',
        metric: 'prescription.flows.patientFluidRemovalMlHour',
        comparator: 'between',
        value: [60, 80],
        unit: 'mL/h',
      },
      {
        suffix: 'tolerance-visible',
        metric: 'patient.hemodynamicStressIndex',
        comparator: 'lte',
        value: 0.5,
        unit: 'model fraction',
      },
    ],
    alternativeConditionSuffixes: ['tolerance-visible'],
    clinicalSourceIds: [
      'GUID-NICE-NG148-2024',
      'GUID-KDIGO-AKI-2012',
      'GUID-RRT-ICU-2026',
      'STARRT-AKI-2020',
    ],
    transferQuestion:
      'Which local review and patient-specific reassessment would be required before using any numeric fluid-removal plan?',
  },
  {
    id: 'CRRT-02',
    title: 'Prioritize refractory electrolyte and acid-base context during instability',
    stationId: 'define-goal',
    difficulty: 'advanced',
    patientDescription:
      'A synthetic unstable ICU scenario contains marked authored electrolyte and acid-base abnormalities despite prior management. Review urgency, delivery, and reassessment without converting case values into initiation thresholds.',
    learningObjectives: [
      'Use the whole authored context when prioritizing the candidate treatment goal.',
      'Separate an entered dialysate-flow candidate from delivered therapy and laboratory response.',
      'Escalate uncertainty rather than infer a universal setting.',
    ],
    focus: 'electrolyte and acid-base treatment priority',
    mechanism:
      'The candidate increases a synthetic diffusive-flow signal, but actual delivery and patient response remain time-dependent and require reassessment.',
    expectedResponse:
      'The prescription signal changes immediately; cumulative delivery and simulated solute direction do not become guaranteed outcomes.',
    reassessmentFocus:
      'delivered therapy, electrolyte direction, acid-base direction, and tolerance',
    patient: {
      bodyWeightKg: 74,
      hematocritFraction: 0.31,
      intravascularReserveMl: 400,
      totalFluidOverloadMl: 2_400,
      vascularRefillCapacityMlPerHour: 70,
      urineOutputMlPerHour: 5,
      residualRenalClearanceMlPerMin: 0,
      heartRatePerMin: 118,
      systolicPressureMmHg: 86,
      diastolicPressureMmHg: 48,
      meanArterialPressureMmHg: 61,
      vasopressorState: 'increasing',
      vasopressorSupportIndex: 0.8,
      temperatureCelsius: 36,
      sodiumMmolPerL: 136,
      potassiumMmolPerL: 6.9,
      bicarbonateMmolPerL: 10,
      pH: 7.08,
      smallSoluteMarkerMmolPerL: 38,
      creatinineMgPerDl: 4.1,
      phosphateMgPerDl: 6.2,
      magnesiumMgPerDl: 2.4,
      systemicIonizedCalciumMmolPerL: 1.02,
      hemodynamicStressIndex: 0.48,
    },
    modality: 'CVVHD',
    flows: {
      bloodFlowMlPerMin: 140,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 1_000,
      preReplacementFlowMlPerHour: 0,
      postReplacementFlowMlPerHour: 0,
      patientFluidRemovalMlPerHour: 0,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
    },
    positionResistanceMultiplier: 1.1,
    accessResistanceMmHgPerMlPerMin: 0.24,
    returnResistanceMmHgPerMlPerMin: 0.22,
    nominalFlowCapacityMlPerMin: 170,
    externalFluidRates: {
      ...noAdditionalExternalFluids,
      medicationCarrierInputMlHour: 30,
      urineOutputMlHour: 5,
    },
    safeAction: {
      label: 'Apply the synthetic diffusive-flow candidate',
      category: 'prescription',
      description: 'Apply the authored value only after the complete assessment gate.',
      response: 'The prescription signal changes and remains pending clinical review.',
      latencySeconds: 60,
      effects: [
        {
          target: 'prescription.flows.dialysateFlowMlHour',
          operation: 'set',
          valueType: 'number',
          value: 1_600,
          unit: 'mL/h',
        },
      ],
    },
    alternativeAction: {
      label: 'Preserve the setting and escalate urgent multidisciplinary review',
      category: 'communication',
      description:
        'Do not invent a device or clinical setting when the required review context is incomplete.',
      response: 'Urgency and uncertainty are communicated while the setting remains unchanged.',
      latencySeconds: 60,
      effects: [],
    },
    unsafeAction: {
      label: 'Delay action and ignore the authored instability',
      category: 'assessment',
      description: 'Record an unsafe candidate that dismisses the whole authored context.',
      response: 'The action is recorded as a pending synthetic critical-error candidate.',
      latencySeconds: 0,
      effects: [],
    },
    successConditions: [
      {
        suffix: 'candidate-dialysate',
        metric: 'prescription.flows.dialysateFlowMlHour',
        comparator: 'between',
        value: [1_500, 1_700],
        unit: 'mL/h',
      },
      {
        suffix: 'tolerance-visible',
        metric: 'patient.hemodynamicStressIndex',
        comparator: 'lte',
        value: 0.6,
        unit: 'model fraction',
      },
    ],
    alternativeConditionSuffixes: ['tolerance-visible'],
    clinicalSourceIds: [
      'GUID-NICE-NG148-2024',
      'GUID-KDIGO-AKI-2012',
      'GUID-RRT-ICU-2026',
      'STARRT-AKI-2020',
    ],
    transferQuestion:
      'How would your local team verify indication, prescription, delivery, and response without relying on one isolated laboratory value?',
  },
  {
    id: 'CRRT-06',
    title: 'Compare prescribed and delivered CVVHDF during an interruption',
    stationId: 'build-prescription',
    difficulty: 'intermediate',
    patientDescription:
      'A synthetic CVVHDF treatment has active dialysate, pre-replacement, and post-replacement flows. A bounded interruption separates the prescribed signal from integrated delivery.',
    learningObjectives: [
      'Identify every active CVVHDF source-flow term and its simulated source bag.',
      'Compare prescribed effluent intensity with integrated delivered therapy.',
      'Account for interruption time before interpreting response.',
    ],
    focus: 'prescribed-versus-delivered CVVHDF assessment',
    mechanism:
      'CVVHDF combines the authored dialysate and replacement-flow terms, while interruption reduces integrated delivery without rewriting the prescription.',
    expectedResponse:
      'The prescribed display remains available while cumulative delivered therapy diverges during the authored pause and resumes afterward.',
    reassessmentFocus: 'active flows, source bags, downtime, treatment time, and delivered dose',
    patient: {
      bodyWeightKg: 82,
      hematocritFraction: 0.3,
      intravascularReserveMl: 900,
      totalFluidOverloadMl: 3_200,
      vascularRefillCapacityMlPerHour: 110,
      urineOutputMlPerHour: 15,
      residualRenalClearanceMlPerMin: 0,
      heartRatePerMin: 98,
      systolicPressureMmHg: 106,
      diastolicPressureMmHg: 60,
      meanArterialPressureMmHg: 75,
      vasopressorState: 'stable',
      vasopressorSupportIndex: 0.4,
      temperatureCelsius: 36.4,
      sodiumMmolPerL: 139,
      potassiumMmolPerL: 5.2,
      bicarbonateMmolPerL: 18,
      pH: 7.27,
      smallSoluteMarkerMmolPerL: 29,
      creatinineMgPerDl: 3.1,
      phosphateMgPerDl: 4.9,
      magnesiumMgPerDl: 2,
      systemicIonizedCalciumMmolPerL: 1.1,
      hemodynamicStressIndex: 0.28,
    },
    modality: 'CVVHDF',
    flows: {
      bloodFlowMlPerMin: 150,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 900,
      preReplacementFlowMlPerHour: 500,
      postReplacementFlowMlPerHour: 300,
      patientFluidRemovalMlPerHour: 60,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
    },
    positionResistanceMultiplier: 1,
    accessResistanceMmHgPerMlPerMin: 0.2,
    returnResistanceMmHgPerMlPerMin: 0.2,
    nominalFlowCapacityMlPerMin: 180,
    externalFluidRates: {
      ...noAdditionalExternalFluids,
      maintenanceInputMlHour: 40,
      nutritionInputMlHour: 35,
      urineOutputMlHour: 15,
    },
    safeAction: {
      label: 'Observe the complete synthetic delivery window',
      category: 'assessment',
      description: 'Advance through the authored interruption and resumption before reassessment.',
      response: 'The delivery timeline now contains both treatment and downtime.',
      latencySeconds: 5_400,
      effects: [
        {
          target: 'simulation.advanceTimeSeconds',
          operation: 'add',
          valueType: 'number',
          value: 5_400,
          unit: 'seconds',
        },
      ],
    },
    alternativeAction: {
      label: 'Observe the interruption onset and preserve uncertainty',
      category: 'assessment',
      description:
        'Advance only far enough to observe that delivery has diverged, then communicate that the full window remains incomplete.',
      response: 'Downtime is visible, but the complete delivery window remains unresolved.',
      latencySeconds: 2_400,
      effects: [
        {
          target: 'simulation.advanceTimeSeconds',
          operation: 'add',
          valueType: 'number',
          value: 2_400,
          unit: 'seconds',
        },
      ],
    },
    unsafeAction: {
      label: 'Declare prescribed therapy fully delivered without reviewing downtime',
      category: 'assessment',
      description: 'Ignore the authored interruption and cumulative-delivery signal.',
      response: 'The action is recorded as a pending synthetic critical-error candidate.',
      latencySeconds: 0,
      effects: [],
    },
    successConditions: [
      {
        suffix: 'complete-downtime',
        metric: 'deliveredTherapy.cumulativeDowntimeSeconds',
        comparator: 'between',
        value: [1_750, 1_850],
        unit: 'seconds',
      },
      {
        suffix: 'treatment-observed',
        metric: 'deliveredTherapy.treatmentTimeSeconds',
        comparator: 'gte',
        value: 3_500,
        unit: 'seconds',
      },
      {
        suffix: 'interruption-visible',
        metric: 'deliveredTherapy.cumulativeDowntimeSeconds',
        comparator: 'gte',
        value: 500,
        unit: 'seconds',
      },
    ],
    alternativeConditionSuffixes: ['interruption-visible'],
    deliveryEvents: [
      {
        suffix: 'pause',
        atSimulationSeconds: 1_800,
        eventType: 'treatment-interruption',
        label: 'Synthetic delivery interruption',
        deliveryState: 'paused',
      },
      {
        suffix: 'resume',
        atSimulationSeconds: 3_600,
        eventType: 'treatment-resumption',
        label: 'Synthetic delivery resumption',
        deliveryState: 'running',
      },
    ],
    clinicalSourceIds: ['GUID-KDIGO-AKI-2012', 'GUID-RRT-ICU-2026'],
    transferQuestion:
      'Which prescribed, delivered, interruption, and bag signals would your local review require before judging treatment adequacy?',
  },
  {
    id: 'CRRT-11',
    title: 'Respond to synthetic hemodynamic intolerance during fluid removal',
    stationId: 'monitor-dose-fluid',
    difficulty: 'advanced',
    patientDescription:
      'A synthetic running treatment combines a fluid-removal setting with a high authored tolerance-stress signal. Review a bounded reduction or pause and reassess before any escalation.',
    learningObjectives: [
      'Recognize the authored mismatch between removal and tolerance signals.',
      'Test a bounded reduction or pause without asserting a universal rate.',
      'Reassess the synthetic patient and delivery response before further action.',
    ],
    focus: 'hemodynamic-tolerance response',
    mechanism:
      'When the authored machine-removal rate no longer fits the synthetic refill and reserve model, reducing or pausing it permits the bounded tolerance index to recover.',
    expectedResponse:
      'The flow changes immediately, while the synthetic tolerance index changes only after the authored observation interval.',
    reassessmentFocus: 'machine removal, whole-patient balance, delivery, and tolerance trend',
    patient: {
      bodyWeightKg: 68,
      hematocritFraction: 0.33,
      intravascularReserveMl: 100,
      totalFluidOverloadMl: 1_800,
      vascularRefillCapacityMlPerHour: 80,
      urineOutputMlPerHour: 5,
      residualRenalClearanceMlPerMin: 0,
      heartRatePerMin: 122,
      systolicPressureMmHg: 84,
      diastolicPressureMmHg: 46,
      meanArterialPressureMmHg: 59,
      vasopressorState: 'increasing',
      vasopressorSupportIndex: 0.85,
      temperatureCelsius: 35.8,
      sodiumMmolPerL: 138,
      potassiumMmolPerL: 4.8,
      bicarbonateMmolPerL: 19,
      pH: 7.29,
      smallSoluteMarkerMmolPerL: 26,
      creatinineMgPerDl: 2.9,
      phosphateMgPerDl: 4.7,
      magnesiumMgPerDl: 2,
      systemicIonizedCalciumMmolPerL: 1.05,
      hemodynamicStressIndex: 0.72,
    },
    modality: 'CVVHD',
    flows: {
      bloodFlowMlPerMin: 140,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 1_100,
      preReplacementFlowMlPerHour: 0,
      postReplacementFlowMlPerHour: 0,
      patientFluidRemovalMlPerHour: 180,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
    },
    positionResistanceMultiplier: 1,
    accessResistanceMmHgPerMlPerMin: 0.2,
    returnResistanceMmHgPerMlPerMin: 0.2,
    nominalFlowCapacityMlPerMin: 170,
    externalFluidRates: {
      ...noAdditionalExternalFluids,
      medicationCarrierInputMlHour: 25,
      urineOutputMlHour: 5,
    },
    safeAction: {
      label: 'Reduce the synthetic removal setting and observe',
      category: 'fluid',
      description: 'Apply the bounded candidate reduction, then advance the observation interval.',
      response: 'The removal signal changes and the synthetic tolerance trend is recomputed.',
      latencySeconds: 3_600,
      effects: [
        {
          target: 'prescription.flows.patientFluidRemovalMlHour',
          operation: 'set',
          valueType: 'number',
          value: 30,
          unit: 'mL/h',
        },
        {
          target: 'simulation.advanceTimeSeconds',
          operation: 'add',
          valueType: 'number',
          value: 3_600,
          unit: 'seconds',
        },
      ],
    },
    alternativeAction: {
      label: 'Pause synthetic removal and observe',
      category: 'fluid',
      description: 'Set the authored removal signal to zero for the same observation interval.',
      response: 'The synthetic tolerance trend is recomputed with machine removal paused.',
      latencySeconds: 3_600,
      effects: [
        {
          target: 'prescription.flows.patientFluidRemovalMlHour',
          operation: 'set',
          valueType: 'number',
          value: 0,
          unit: 'mL/h',
        },
        {
          target: 'simulation.advanceTimeSeconds',
          operation: 'add',
          valueType: 'number',
          value: 3_600,
          unit: 'seconds',
        },
      ],
    },
    unsafeAction: {
      label: 'Increase removal despite the authored intolerance signal',
      category: 'fluid',
      description: 'Apply the unsafe synthetic candidate without first resolving tolerance.',
      response: 'The action is recorded as a pending synthetic critical-error candidate.',
      latencySeconds: 0,
      effects: [
        {
          target: 'prescription.flows.patientFluidRemovalMlHour',
          operation: 'set',
          valueType: 'number',
          value: 320,
          unit: 'mL/h',
        },
      ],
    },
    successConditions: [
      {
        suffix: 'reduced-removal',
        metric: 'prescription.flows.patientFluidRemovalMlHour',
        comparator: 'between',
        value: [20, 40],
        unit: 'mL/h',
      },
      {
        suffix: 'tolerance-reassessed',
        metric: 'patient.hemodynamicStressIndex',
        comparator: 'lte',
        value: 0.61,
        unit: 'model fraction',
      },
    ],
    alternativeConditionSuffixes: ['tolerance-reassessed'],
    clinicalSourceIds: ['GUID-KDIGO-AKI-2012', 'GUID-RRT-ICU-2026'],
    transferQuestion:
      'What local monitoring, communication, and reassessment would be required before changing fluid removal for a real patient?',
  },
  {
    id: 'CRRT-05',
    title: 'Explore a synthetic pre- versus post-replacement split',
    stationId: 'build-prescription',
    difficulty: 'intermediate',
    patientDescription:
      'A synthetic CVVH prescription holds total replacement flow constant while the reviewer inspects how changing its location alters the authored dilution and filter-risk context. Quantitative clearance and preferred clinical split remain outside this candidate.',
    learningObjectives: [
      'Keep total replacement flow separate from its pre- and post-filter distribution.',
      'Inspect the directional dilution tradeoff without declaring one universal best split.',
      'Recognize that disputed device expressions and local practice prevent an actionable recommendation.',
    ],
    focus: 'pre- versus post-replacement tradeoff',
    mechanism:
      'Moving an authored portion of replacement flow upstream changes the synthetic dilution context while total replacement flow remains constant; this candidate does not calculate or prescribe a patient clearance target.',
    expectedResponse:
      'The pre/post flow display changes immediately, while the total replacement flow remains unchanged and every clinical interpretation stays pending review.',
    reassessmentFocus:
      'pre-flow, post-flow, unchanged total replacement flow, delivery, and explicit uncertainty',
    patient: {
      bodyWeightKg: 76,
      hematocritFraction: 0.34,
      intravascularReserveMl: 800,
      totalFluidOverloadMl: 2_200,
      vascularRefillCapacityMlPerHour: 100,
      urineOutputMlPerHour: 15,
      residualRenalClearanceMlPerMin: 0,
      heartRatePerMin: 96,
      systolicPressureMmHg: 108,
      diastolicPressureMmHg: 62,
      meanArterialPressureMmHg: 77,
      vasopressorState: 'stable',
      vasopressorSupportIndex: 0.35,
      temperatureCelsius: 36.6,
      sodiumMmolPerL: 138,
      potassiumMmolPerL: 5.1,
      bicarbonateMmolPerL: 19,
      pH: 7.3,
      smallSoluteMarkerMmolPerL: 28,
      creatinineMgPerDl: 3,
      phosphateMgPerDl: 5,
      magnesiumMgPerDl: 2,
      systemicIonizedCalciumMmolPerL: 1.09,
      hemodynamicStressIndex: 0.25,
    },
    modality: 'CVVH',
    flows: {
      bloodFlowMlPerMin: 150,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 0,
      preReplacementFlowMlPerHour: 0,
      postReplacementFlowMlPerHour: 1_200,
      patientFluidRemovalMlPerHour: 50,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
    },
    positionResistanceMultiplier: 1,
    accessResistanceMmHgPerMlPerMin: 0.2,
    returnResistanceMmHgPerMlPerMin: 0.2,
    nominalFlowCapacityMlPerMin: 180,
    externalFluidRates: {
      ...noAdditionalExternalFluids,
      maintenanceInputMlHour: 40,
      urineOutputMlHour: 15,
    },
    safeAction: {
      label: 'Apply the bounded synthetic split candidate',
      category: 'prescription',
      description:
        'Move only the authored portion upstream while preserving the same total replacement flow.',
      response:
        'The split changes in the synthetic prescription; no quantitative clinical advantage is asserted.',
      latencySeconds: 60,
      effects: [
        {
          target: 'prescription.flows.preReplacementFlowMlHour',
          operation: 'set',
          valueType: 'number',
          value: 900,
          unit: 'mL/h',
        },
        {
          target: 'prescription.flows.postReplacementFlowMlHour',
          operation: 'set',
          valueType: 'number',
          value: 300,
          unit: 'mL/h',
        },
      ],
    },
    alternativeAction: {
      label: 'Keep the original split and defer quantitative interpretation',
      category: 'communication',
      description:
        'Preserve the authored flow split while documenting the unresolved calculation and review gates.',
      response: 'The prescription remains unchanged and the uncertainty is explicit.',
      latencySeconds: 60,
      effects: [],
    },
    unsafeAction: {
      label: 'Declare one split universally superior',
      category: 'prescription',
      description:
        'Convert a bounded qualitative teaching comparison into an unsupported universal recommendation.',
      response: 'The claim is recorded as a pending synthetic critical-error candidate.',
      latencySeconds: 0,
      effects: [],
    },
    successConditions: [
      {
        suffix: 'pre-split',
        metric: 'prescription.flows.preReplacementFlowMlHour',
        comparator: 'between',
        value: [850, 950],
        unit: 'mL/h',
      },
      {
        suffix: 'post-split',
        metric: 'prescription.flows.postReplacementFlowMlHour',
        comparator: 'between',
        value: [250, 350],
        unit: 'mL/h',
      },
      {
        suffix: 'tolerance-visible',
        metric: 'patient.hemodynamicStressIndex',
        comparator: 'lte',
        value: 0.4,
        unit: 'model fraction',
      },
    ],
    alternativeConditionSuffixes: ['tolerance-visible'],
    clinicalSourceIds: ['REVIEW-CKRT-CORE-2025', 'MATH-PM-003', 'MATH-PM-005'],
    transferQuestion:
      'Which device calculation, set configuration, and clinical review would be required before translating this qualitative split into practice?',
  },
  {
    id: 'CRRT-07',
    title: 'Trace synthetic weight and hematocrit input propagation',
    stationId: 'setup-start',
    difficulty: 'intermediate',
    patientDescription:
      'A reviewer-only setup candidate begins with intentionally mismatched synthetic weight and hematocrit entries. Correcting those authored inputs changes weight-normalized display math and the downstream filter-risk model without validating a patient target.',
    learningObjectives: [
      'Identify weight and hematocrit as consequential authored inputs.',
      'Observe weight-normalized display recalculation separately from treatment delivery.',
      'Reassess the corrected inputs before interpreting any downstream model output.',
    ],
    focus: 'patient-input propagation and verification',
    mechanism:
      'The synthetic body-weight entry changes weight-normalized dose display arithmetic, while hematocrit participates in the authored filter-risk model; neither entry is an alarm threshold.',
    expectedResponse:
      'Corrected inputs update the source-backed arithmetic immediately, while patient and filter trajectories still require time and review.',
    reassessmentFocus:
      'entered weight, entered hematocrit, normalized dose display, and downstream synthetic trend',
    patient: {
      bodyWeightKg: 120,
      hematocritFraction: 0.46,
      intravascularReserveMl: 850,
      totalFluidOverloadMl: 2_800,
      vascularRefillCapacityMlPerHour: 110,
      urineOutputMlPerHour: 10,
      residualRenalClearanceMlPerMin: 0,
      heartRatePerMin: 102,
      systolicPressureMmHg: 104,
      diastolicPressureMmHg: 58,
      meanArterialPressureMmHg: 73,
      vasopressorState: 'stable',
      vasopressorSupportIndex: 0.4,
      temperatureCelsius: 36.5,
      sodiumMmolPerL: 139,
      potassiumMmolPerL: 5,
      bicarbonateMmolPerL: 20,
      pH: 7.31,
      smallSoluteMarkerMmolPerL: 27,
      creatinineMgPerDl: 3.2,
      phosphateMgPerDl: 4.8,
      magnesiumMgPerDl: 2,
      systemicIonizedCalciumMmolPerL: 1.1,
      hemodynamicStressIndex: 0.3,
    },
    modality: 'CVVHD',
    flows: {
      bloodFlowMlPerMin: 150,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 1_500,
      preReplacementFlowMlPerHour: 0,
      postReplacementFlowMlPerHour: 0,
      patientFluidRemovalMlPerHour: 40,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
    },
    positionResistanceMultiplier: 1,
    accessResistanceMmHgPerMlPerMin: 0.2,
    returnResistanceMmHgPerMlPerMin: 0.2,
    nominalFlowCapacityMlPerMin: 180,
    externalFluidRates: {
      ...noAdditionalExternalFluids,
      maintenanceInputMlHour: 35,
      urineOutputMlHour: 10,
    },
    safeAction: {
      label: 'Correct both authored patient inputs',
      category: 'device',
      description:
        'Replace the intentionally mismatched synthetic entries with the case-authored review values.',
      response:
        'The weight-normalized display and filter-risk inputs are recomputed without creating a clinical target.',
      latencySeconds: 60,
      effects: [
        {
          target: 'patient.bodyWeightKg',
          operation: 'set',
          valueType: 'number',
          value: 75,
          unit: 'kg',
        },
        {
          target: 'patient.hematocritFraction',
          operation: 'set',
          valueType: 'number',
          value: 0.3,
          unit: 'fraction',
        },
      ],
    },
    alternativeAction: {
      label: 'Stop progression and request independent input verification',
      category: 'communication',
      description:
        'Do not continue from entries whose source cannot be verified in the review environment.',
      response: 'No value is changed and the verification gate remains visible.',
      latencySeconds: 60,
      effects: [],
    },
    unsafeAction: {
      label: 'Proceed while treating the mismatched inputs as verified',
      category: 'device',
      description: 'Ignore the known authored mismatch and interpret dependent displays as final.',
      response: 'The action is recorded as a pending synthetic critical-error candidate.',
      latencySeconds: 0,
      effects: [],
    },
    successConditions: [
      {
        suffix: 'weight-corrected',
        metric: 'patient.bodyWeightKg',
        comparator: 'between',
        value: [74.9, 75.1],
        unit: 'kg',
      },
      {
        suffix: 'hematocrit-corrected',
        metric: 'patient.hematocritFraction',
        comparator: 'between',
        value: [0.299, 0.301],
        unit: 'fraction',
      },
      {
        suffix: 'tolerance-visible',
        metric: 'patient.hemodynamicStressIndex',
        comparator: 'lte',
        value: 0.4,
        unit: 'model fraction',
      },
    ],
    alternativeConditionSuffixes: ['tolerance-visible'],
    clinicalSourceIds: ['MATH-PM-005', 'DOSE-PM-001'],
    transferQuestion:
      'Which independent source and bedside verification workflow should govern patient inputs on the installed device?',
  },
  {
    id: 'CRRT-15',
    title: 'Localize a bounded synthetic filter-pressure trend',
    stationId: 'pressures-troubleshooting',
    difficulty: 'advanced',
    patientDescription:
      'A synthetic running treatment lets the reviewer introduce one bounded low-flow risk term and inspect directional pressure and filter trends without diagnosing a cause or prescribing a correction.',
    learningObjectives: [
      'Read filter pressure, return pressure, pressure drop, and TMP as separate trend signals.',
      'Test one synthetic contributor at a time rather than label every trend as anticoagulation failure.',
      'Preserve device and clinical uncertainty when alarm thresholds and corrective workflow are not reviewed.',
    ],
    focus: 'filter and effluent trend localization',
    mechanism:
      'The authored filter model integrates low effective flow and procoagulant burden over time; changing one synthetic contributor alters the future direction without proving a bedside diagnosis.',
    expectedResponse:
      'The selected risk term changes immediately, while filter burden and pressure signals evolve only through deterministic time advancement.',
    reassessmentFocus:
      'filter pressure, return pressure, pressure drop, TMP, delivery, and filter-risk terms',
    patient: {
      bodyWeightKg: 80,
      hematocritFraction: 0.36,
      intravascularReserveMl: 700,
      totalFluidOverloadMl: 2_500,
      vascularRefillCapacityMlPerHour: 100,
      urineOutputMlPerHour: 10,
      residualRenalClearanceMlPerMin: 0,
      heartRatePerMin: 100,
      systolicPressureMmHg: 102,
      diastolicPressureMmHg: 60,
      meanArterialPressureMmHg: 74,
      vasopressorState: 'stable',
      vasopressorSupportIndex: 0.4,
      temperatureCelsius: 36.3,
      sodiumMmolPerL: 138,
      potassiumMmolPerL: 4.9,
      bicarbonateMmolPerL: 20,
      pH: 7.31,
      smallSoluteMarkerMmolPerL: 26,
      creatinineMgPerDl: 3,
      phosphateMgPerDl: 4.8,
      magnesiumMgPerDl: 2,
      systemicIonizedCalciumMmolPerL: 1.08,
      hemodynamicStressIndex: 0.3,
    },
    modality: 'CVVHDF',
    flows: {
      bloodFlowMlPerMin: 130,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 800,
      preReplacementFlowMlPerHour: 400,
      postReplacementFlowMlPerHour: 400,
      patientFluidRemovalMlPerHour: 50,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
    },
    positionResistanceMultiplier: 1.4,
    accessResistanceMmHgPerMlPerMin: 0.25,
    returnResistanceMmHgPerMlPerMin: 0.2,
    nominalFlowCapacityMlPerMin: 160,
    externalFluidRates: {
      ...noAdditionalExternalFluids,
      maintenanceInputMlHour: 35,
      urineOutputMlHour: 10,
    },
    safeAction: {
      label: 'Introduce the authored low-flow contributor and observe',
      category: 'access-circuit',
      description:
        'Change only the bounded synthetic low-effective-flow term, then advance the review window.',
      response:
        'The future filter-risk trajectory is recomputed; no alarm threshold or bedside diagnosis is supplied.',
      latencySeconds: 3_600,
      effects: [
        {
          target: 'circuit.filter.lowEffectiveBloodFlowFraction',
          operation: 'set',
          valueType: 'number',
          value: 0.6,
          unit: 'fraction',
        },
        {
          target: 'simulation.advanceTimeSeconds',
          operation: 'add',
          valueType: 'number',
          value: 3_600,
          unit: 'seconds',
        },
      ],
    },
    alternativeAction: {
      label: 'Hold the current state and escalate trend review',
      category: 'communication',
      description:
        'Preserve the synthetic state while requesting device and clinical review of the complete trend.',
      response: 'No causal label or corrective sequence is asserted.',
      latencySeconds: 60,
      effects: [],
    },
    unsafeAction: {
      label: 'Label the trend as anticoagulation failure and escalate blindly',
      category: 'medication',
      description:
        'Ignore access, delivery, and effluent-path alternatives and invent an unsupported treatment response.',
      response: 'The claim is recorded as a pending synthetic critical-error candidate.',
      latencySeconds: 0,
      effects: [],
    },
    successConditions: [
      {
        suffix: 'low-flow-introduced',
        metric: 'circuit.filter.lowEffectiveBloodFlowFraction',
        comparator: 'gte',
        value: 0.5,
        unit: 'fraction',
      },
      {
        suffix: 'trend-observed',
        metric: 'simulationTimeSeconds',
        comparator: 'gte',
        value: 3_600,
        unit: 'seconds',
      },
      {
        suffix: 'pressure-visible',
        metric: 'circuit.pressures.filterPressureMmHg',
        comparator: 'gt',
        value: 0,
        unit: 'mmHg',
      },
    ],
    alternativeConditionSuffixes: ['pressure-visible'],
    clinicalSourceIds: ['DEV-PM-009', 'DEV-PM-010', 'REVIEW-CKRT-CORE-2025'],
    transferQuestion:
      'Which observed device behavior, local alarm mapping, and multidisciplinary review would be required before acting on a real filter-pressure trend?',
  },
]

const parsedReviewCases = runtimeCrrtCaseRegistrySchema.parse(
  reviewCaseSpecs.map(buildReviewCase).sort((left, right) => left.id.localeCompare(right.id)),
)

/** Authored source templates promoted into the unified learner registry. */
export const baxterCrrtAuthoredCaseTemplates: readonly RuntimeCrrtCase[] =
  deepFreeze(parsedReviewCases)
