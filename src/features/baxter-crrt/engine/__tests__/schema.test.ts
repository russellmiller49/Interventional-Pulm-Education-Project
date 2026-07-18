import {
  authoredCrrtCaseSchema,
  collectCrrtCaseSemanticIssues,
  configuredPatientSchema,
  CRRT_ALL_CASE_IDS,
  prescriptionSchema,
  runtimeCrrtCaseSchema,
  validateCrrtCaseRegistry,
} from '../../content/schema'
import { parseRuntimeCrrtCaseToEngineFixture } from '../../content/runtimeCaseNormalization'
import { createInitialCrrtSimulationState } from '../initialState'

const SOURCE_ID = 'TEST-001'

function option(id: string) {
  return {
    id,
    label: `Synthetic ${id}`,
    description: `Synthetic description for ${id}.`,
    sourceIds: [SOURCE_ID],
    reviewStatus: 'pending' as const,
  }
}

function buildAuthoredCase(id = 'CRRT-04') {
  return {
    id,
    title: 'Synthetic schema case',
    stationId: 'build-prescription' as const,
    difficulty: 'introductory' as const,
    roleLenses: ['integrated' as const],
    compatibleDevices: ['prismax-aw8035-2xx' as const],
    patientDescription: 'A fictional adult used only to test schema boundaries.',
    learningObjectives: ['Validate an authored CRRT case.'],
    initialPatient: {
      simulatedBodyWeightKg: 1,
      hematocritFraction: 0.5,
      intravascularReserveMl: 1,
      totalFluidOverloadMl: 1,
      vascularRefillCapacityMlPerHour: 1,
      urineOutputMlPerHour: 1,
      residualRenalClearanceMlPerMin: 1,
      hemodynamics: {
        heartRatePerMin: 1,
        systolicPressureMmHg: 1,
        diastolicPressureMmHg: 1,
        meanArterialPressureMmHg: 1,
        vasopressorState: 'off' as const,
      },
      temperatureCelsius: 1,
      solutes: {
        sodiumMmolPerL: 1,
        potassiumMmolPerL: 1,
        bicarbonateMmolPerL: 1,
        pH: 1,
        smallSoluteMarkerMmolPerL: 1,
        creatinineMgPerDl: 1,
        phosphateMgPerDl: 1,
        magnesiumMgPerDl: 1,
        systemicIonizedCalciumMmolPerL: 1,
        totalCalciumMgPerDl: null,
        glucoseMgPerDl: null,
        advanced: [],
      },
      sourceIds: [SOURCE_ID],
    },
    initialAccess: {
      catheter: {
        descriptor: 'Synthetic catheter',
        site: 'Synthetic site',
        type: 'Synthetic type',
        nominalFlowCapacityMlPerMin: 1,
      },
      accessResistanceMmHgPerMlPerMin: 1,
      returnResistanceMmHgPerMlPerMin: 1,
      positionDependenceFraction: 0,
      recirculationFraction: 0,
      partialThrombusFraction: 0,
      accessLineState: 'open' as const,
      returnLineState: 'open' as const,
      connectionState: 'connected' as const,
      sourceIds: [SOURCE_ID],
    },
    initialPrescription: {
      modality: 'CVVHD' as const,
      bloodFlowMlPerMin: 1,
      preBloodPumpFlowMlPerHour: 0,
      dialysateFlowMlPerHour: 1,
      preReplacementFlowMlPerHour: 0,
      postReplacementFlowMlPerHour: 0,
      patientFluidRemovalMlPerHour: 0,
      syringeFlowMlPerHour: 0,
      makeupFlowMlPerHour: 0,
      anticoagulation: { method: 'none' as const, protocolProfileId: null },
      solutionProfileIds: [],
      sourceIds: [SOURCE_ID],
    },
    hiddenMechanism: {
      id: 'hidden-mechanism',
      summary: 'Synthetic mechanism.',
      causalChain: ['Synthetic cause.', 'Synthetic response.'],
      correctGoalOptionId: 'goal-a',
      correctMechanismOptionId: 'mechanism-a',
      correctControlOptionIds: ['control-a'],
      correctResponseOptionId: 'response-a',
      correctReassessmentOptionIds: ['reassess-a'],
      sourceIds: [SOURCE_ID],
      reviewStatus: 'pending' as const,
    },
    visibleFindings: ['Synthetic finding.'],
    timedEvents: [
      {
        id: 'event-one',
        atSimulationSeconds: 1,
        jitterSeconds: null,
        eventType: 'laboratory-result' as const,
        label: 'Synthetic result',
        effects: [
          {
            target: 'patient.solutes.potassiumMmolPerL',
            operation: 'set' as const,
            valueType: 'number' as const,
            value: 1,
            unit: 'synthetic-unit',
            sourceId: SOURCE_ID,
          },
        ],
        sourceIds: [SOURCE_ID],
        reviewStatus: 'pending' as const,
      },
    ],
    goalOptions: [option('goal-a'), option('goal-b')],
    mechanismOptions: [option('mechanism-a'), option('mechanism-b')],
    controlOptions: [option('control-a'), option('control-b')],
    responseOptions: [option('response-a'), option('response-b')],
    reassessmentOptions: [option('reassess-a'), option('reassess-b')],
    interventions: [
      {
        id: 'action-a',
        label: 'Synthetic action',
        category: 'assessment' as const,
        description: 'Synthetic action description.',
        response: 'Synthetic action response.',
        latencySeconds: 0,
        effects: [],
        prerequisites: [],
        repeatable: false,
        sourceIds: [SOURCE_ID],
        reviewStatus: 'pending' as const,
      },
      {
        id: 'action-unsafe',
        label: 'Synthetic unsafe action',
        category: 'device' as const,
        description: 'Synthetic unsafe action description.',
        response: 'Synthetic unsafe action response.',
        latencySeconds: 0,
        effects: [],
        prerequisites: [],
        repeatable: false,
        sourceIds: [SOURCE_ID],
        reviewStatus: 'pending' as const,
      },
    ],
    requiredActionIds: ['action-a'],
    acceptedAlternativePaths: [
      {
        id: 'path-a',
        label: 'Synthetic path',
        predictionControlOptionIds: ['control-a'],
        actionIds: ['action-a'],
        reassessmentIds: ['reassess-a'],
        successConditionIds: ['condition-a'],
        explanation: 'Synthetic accepted path.',
        sourceIds: [SOURCE_ID],
        reviewStatus: 'pending' as const,
      },
    ],
    requiredReassessmentIds: ['reassess-a'],
    successConditions: [
      {
        id: 'condition-a',
        metric: 'deliveredTherapy.syntheticValue',
        comparator: 'gte' as const,
        value: 1,
        unit: 'synthetic-unit',
        sourceId: SOURCE_ID,
        reviewStatus: 'pending' as const,
      },
    ],
    unsafeActions: [
      {
        id: 'unsafe-a',
        actionId: 'action-unsafe',
        explanation: 'Synthetic unsafe relationship.',
        criticalErrorId: 'critical-a',
        sourceIds: [SOURCE_ID],
        reviewStatus: 'pending' as const,
      },
    ],
    criticalErrors: [
      {
        id: 'critical-a',
        label: 'Synthetic critical error',
        explanation: 'Synthetic critical-error explanation.',
        actionIds: ['action-unsafe'],
        conditionIds: [],
        sourceIds: [SOURCE_ID],
        reviewStatus: 'pending' as const,
      },
    ],
    hintLadder: [
      {
        id: 'hint-a',
        sequence: 1,
        text: 'Synthetic hint.',
        sourceIds: [SOURCE_ID],
        reviewStatus: 'pending' as const,
      },
    ],
    debrief: {
      summary: 'Synthetic debrief.',
      statedGoalReview: 'Synthetic stated-goal review.',
      predictionReview: 'Synthetic prediction review.',
      actionTimelineReview: 'Synthetic action-timeline review.',
      causalChain: ['Synthetic action.', 'Synthetic result.'],
      trendReview: 'Synthetic trend review.',
      requiredActionsReview: 'Synthetic required-actions review.',
      criticalErrorsReview: 'Synthetic critical-errors review.',
      acceptedAlternativesReview: 'Synthetic accepted-alternatives review.',
      machineNavigationPoint: 'Synthetic machine-navigation teaching point.',
      transferQuestion: 'What would you reassess?',
      sourceIds: [SOURCE_ID],
      reviewStatus: 'pending' as const,
    },
    sourceBasis: [
      {
        id: SOURCE_ID,
        claim: 'Synthetic values exist only to exercise validation.',
        sourceTitle: 'Synthetic test source',
        sourceType: 'peer-reviewed' as const,
        pageOrSection: 'Synthetic section',
        implementationLocation: 'schema.test.ts',
        reviewer: null,
        reviewStatus: 'pending' as const,
      },
    ],
    reviewStatus: 'pending' as const,
  }
}

function buildRuntimeCase(id = 'CRRT-04') {
  const soluteModel = () => ({
    distributionVolumeLiters: 1,
    productionAmountPerHour: 0,
    inputAmountPerHour: 0,
    residualClearanceMlPerMin: 0,
    filterPermeabilityFraction: 1,
    reviewStatus: 'pending' as const,
    sourceIds: [SOURCE_ID],
  })

  return {
    ...buildAuthoredCase(id),
    sourceCaseId: id,
    contentVersion: 'synthetic-test-v1',
    engineModelConfiguration: {
      id: 'synthetic-engine',
      version: 'synthetic-test-v1',
      internalStepSeconds: 60,
      internalStepRationale: 'Synthetic deterministic test step.',
      maximumTrendSamples: 288,
      enabledModelIds: [],
      parameters: [],
      sourceIds: [SOURCE_ID],
      reviewStatus: 'pending' as const,
    },
    engineFixtureConfiguration: {
      patient: {
        vasopressorSupportIndex: 0,
        hemodynamicStressIndex: 0,
        totalCalciumMmolL: null,
        reviewStatus: 'pending' as const,
        solutes: {
          sodium: soluteModel(),
          potassium: soluteModel(),
          bicarbonate: soluteModel(),
          'urea-marker': soluteModel(),
          'creatinine-marker': soluteModel(),
          phosphate: soluteModel(),
          magnesium: soluteModel(),
        },
      },
      access: {
        positionResistanceMultiplier: 1,
        reviewStatus: 'pending' as const,
      },
      prescription: { reviewStatus: 'pending' as const },
      bags: [],
      externalFluidRates: {
        maintenanceInputMlHour: 0,
        medicationCarrierInputMlHour: 0,
        nutritionInputMlHour: 0,
        bloodProductInputMlHour: 0,
        bolusInputMlHour: 0,
        otherInputMlHour: 0,
        urineOutputMlHour: 0,
        drainOutputMlHour: 0,
        otherOutputMlHour: 0,
      },
      unintendedDeviceNetGainRateMlHour: 0,
      modelConfiguration: {
        pressure: {
          accessReferencePressureMmHg: 0,
          disconnectedAccessPressureMmHg: 0,
          returnReferencePressureMmHg: 0,
          disconnectedReturnPressureMmHg: 0,
          observedEffluentPressureMmHg: 0,
          filterResistanceMmHgPerMlMin: 0,
          partialThrombusResistanceGainAtFullBurden: 0,
          foulingResistanceGainMmHgPerMlMinAtFullBurden: 0,
          clotResistanceGainMmHgPerMlMinAtFullBurden: 0,
          accessKinkResistanceMultiplier: 1,
          returnKinkResistanceMultiplier: 1,
          reviewStatus: 'pending' as const,
          sourceIds: [SOURCE_ID],
        },
        filter: {
          foulingFractionPerHourAtRiskOne: 0,
          clotFractionPerHourAtRiskOne: 0,
          filtrationFractionWeight: 0,
          interruptionWeight: 0,
          lowFlowWeight: 0,
          accessDysfunctionWeight: 0,
          hematocritWeight: 0,
          procoagulantWeight: 0,
          anticoagulationProtectionFraction: { none: 0, 'systemic-concept': 0 },
          referenceHematocritFraction: 0,
          reviewStatus: 'pending' as const,
          sourceIds: [SOURCE_ID],
        },
        hemodynamic: {
          stressGainPerExcessRemovalLiter: 0,
          stressRecoveryPerHour: 0,
          reviewStatus: 'pending' as const,
          sourceIds: [SOURCE_ID],
        },
        filterInletConcentrationFraction: 1,
        filtrationFraction: 0,
        reviewStatus: 'pending' as const,
        sourceIds: [SOURCE_ID],
      },
      timedEventMappings: [
        {
          timedEventId: 'event-one',
          action: {
            type: 'SET_EXTERNAL_FLUID_RATE' as const,
            field: 'otherInputMlHour' as const,
            rateMlHour: 1,
          },
        },
      ],
      sourceIds: [SOURCE_ID],
    },
  }
}

describe('Baxter CRRT authored-content schema boundary', () => {
  it('parses the complete strict authored and runtime case shapes', () => {
    expect(authoredCrrtCaseSchema.parse(buildAuthoredCase()).id).toBe('CRRT-04')
    expect(runtimeCrrtCaseSchema.parse(buildRuntimeCase()).contentVersion).toBe('synthetic-test-v1')
  })

  it('normalizes a parsed runtime case into a fixture that initializes the engine', () => {
    const runtimeCase = runtimeCrrtCaseSchema.parse(buildRuntimeCase())
    const fixture = parseRuntimeCrrtCaseToEngineFixture(runtimeCase)
    const state = createInitialCrrtSimulationState({ fixture })

    expect(fixture.id).toBe('CRRT-04')
    expect(fixture.patient.solutes['creatinine-marker']?.concentrationPerLiter).toBe(10)
    expect(fixture.events).toEqual([expect.objectContaining({ id: 'event-one', atSeconds: 1 })])
    expect(state.patient).toMatchObject({ status: 'configured', bodyWeightKg: 1 })
    expect(state.scenario).toMatchObject({ status: 'loaded', fixtureId: 'CRRT-04' })
  })

  it('fails closed when normalization data or required engine parameters are absent', () => {
    const missingBoundary = buildRuntimeCase() as Record<string, unknown>
    delete missingBoundary.engineFixtureConfiguration
    expect(runtimeCrrtCaseSchema.safeParse(missingBoundary).success).toBe(false)

    const missingPressureParameter = buildRuntimeCase()
    const pressure = {
      ...missingPressureParameter.engineFixtureConfiguration.modelConfiguration.pressure,
    } as Record<string, unknown>
    delete pressure.filterResistanceMmHgPerMlMin
    const invalid = {
      ...missingPressureParameter,
      engineFixtureConfiguration: {
        ...missingPressureParameter.engineFixtureConfiguration,
        modelConfiguration: {
          ...missingPressureParameter.engineFixtureConfiguration.modelConfiguration,
          pressure,
        },
      },
    }
    expect(runtimeCrrtCaseSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects incomplete or extraneous timed-event mappings', () => {
    const runtimeCase = buildRuntimeCase()
    expect(
      runtimeCrrtCaseSchema.safeParse({
        ...runtimeCase,
        engineFixtureConfiguration: {
          ...runtimeCase.engineFixtureConfiguration,
          timedEventMappings: [],
        },
      }).success,
    ).toBe(false)

    expect(
      runtimeCrrtCaseSchema.safeParse({
        ...runtimeCase,
        engineFixtureConfiguration: {
          ...runtimeCase.engineFixtureConfiguration,
          timedEventMappings: [
            ...runtimeCase.engineFixtureConfiguration.timedEventMappings,
            {
              timedEventId: 'unknown-event',
              action: { type: 'SET_DELIVERY_STATE' as const, deliveryState: 'paused' as const },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('accepts both operational device identities at the v1 runtime boundary', () => {
    const runtimeCase = buildRuntimeCase()
    expect(
      runtimeCrrtCaseSchema.safeParse({
        ...runtimeCase,
        compatibleDevices: ['prismax-aw8035-2xx' as const, 'prismaflex-g5036003-6xx' as const],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown nested fields and impossible mathematical values', () => {
    const patient = buildAuthoredCase().initialPatient
    expect(
      configuredPatientSchema.safeParse({
        ...patient,
        solutes: { ...patient.solutes, unreviewedValue: 1 },
      }).success,
    ).toBe(false)
    expect(configuredPatientSchema.safeParse({ ...patient, hematocritFraction: 1.1 }).success).toBe(
      false,
    )
  })

  it('reports duplicate and unresolved authored identifiers', () => {
    const authored = buildAuthoredCase()
    const invalid = {
      ...authored,
      goalOptions: [authored.goalOptions[0], authored.goalOptions[0]],
      requiredActionIds: ['missing-action'],
      requiredReassessmentIds: ['missing-reassessment', 'missing-reassessment'],
      sourceBasis: [authored.sourceBasis[0], authored.sourceBasis[0]],
    }
    const issues = collectCrrtCaseSemanticIssues(invalid)
    expect(issues).toContain('Duplicate option ID: goal-a')
    expect(issues).toContain('Unresolved required intervention ID: missing-action')
    expect(issues).toContain('Unresolved required reassessment ID: missing-reassessment')
    expect(issues).toContain('Duplicate required reassessment ID: missing-reassessment')
    expect(issues).toContain(`Duplicate source ID: ${SOURCE_ID}`)
    expect(authoredCrrtCaseSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects duplicate claim mappings and unused source-basis records', () => {
    const authored = buildAuthoredCase()
    const unusedSourceId = 'TEST-UNUSED-001'
    const invalid = {
      ...authored,
      hiddenMechanism: {
        ...authored.hiddenMechanism,
        sourceIds: [SOURCE_ID, SOURCE_ID],
      },
      sourceBasis: [
        ...authored.sourceBasis,
        {
          ...authored.sourceBasis[0],
          id: unusedSourceId,
          implementationLocation: 'unused test evidence record',
        },
      ],
    }

    const issues = collectCrrtCaseSemanticIssues(invalid)
    expect(issues).toContain(`Duplicate source ID ${SOURCE_ID} at hiddenMechanism`)
    expect(issues).toContain(`Unreferenced source basis ID: ${unusedSourceId}`)
    expect(authoredCrrtCaseSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects duplicate or unresolved accepted-path prediction controls', () => {
    const authored = buildAuthoredCase()
    const invalid = {
      ...authored,
      acceptedAlternativePaths: [
        {
          ...authored.acceptedAlternativePaths[0],
          predictionControlOptionIds: ['missing-control', 'missing-control'],
        },
      ],
    }

    const issues = collectCrrtCaseSemanticIssues(invalid)
    expect(issues).toContain(
      'Accepted path path-a has duplicate prediction control option ID: missing-control',
    )
    expect(issues).toContain(
      'Accepted path path-a has unresolved prediction control option ID: missing-control',
    )
    expect(authoredCrrtCaseSchema.safeParse(invalid).success).toBe(false)
  })

  it('validates an exact 18-case registry boundary', () => {
    expect(
      validateCrrtCaseRegistry([], {
        expectedCaseIds: CRRT_ALL_CASE_IDS,
        registryLabel: 'v1',
      }),
    ).toEqual([`Missing v1 case IDs: ${CRRT_ALL_CASE_IDS.join(', ')}`])
  })

  it('keeps citrate education direction-only with no dose, target, rate, or adjustment fields', () => {
    const citrate = createInitialCrrtSimulationState().circuit.citrate
    expect(citrate).toMatchObject({
      status: 'conceptual-direction-only',
      reassessmentRequired: true,
      escalationBoundary: 'responsible-clinical-team-and-local-protocol',
    })
    const keys: string[] = []
    const visit = (value: unknown) => {
      if (value === null || typeof value !== 'object') return
      for (const [key, nested] of Object.entries(value)) {
        keys.push(key)
        visit(nested)
      }
    }
    visit(citrate)
    expect(keys.join(' ')).not.toMatch(/dose|target|adjust|rate|amount|concentration/i)

    const basePrescription = buildAuthoredCase().initialPrescription
    expect(
      prescriptionSchema.safeParse({
        ...basePrescription,
        anticoagulation: {
          method: 'regional-citrate-calcium',
          protocolProfileId: 'PROTO-001',
        },
      }).success,
    ).toBe(false)
  })
})
