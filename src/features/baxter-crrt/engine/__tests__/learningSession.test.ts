import type { RuntimeCrrtCase } from '../../content/schema'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  UnsupportedCrrtLearningEffectError,
  type CrrtLearningExperience,
  type CrrtLearningSessionState,
  type CrrtPredictionCommitment,
} from '../learningSession'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'

const correctPrediction: CrrtPredictionCommitment = {
  goalOptionId: 'goal-correct',
  mechanismOptionId: 'mechanism-correct',
  controlOptionIds: ['control-correct'],
  responseOptionId: 'response-correct',
  reassessmentOptionIds: ['reassess-correct'],
}

function option(id: string) {
  return { id, label: id, description: id, sourceIds: ['TEST-P4-001'], reviewStatus: 'pending' }
}

function buildCase(
  id = 'CRRT-04',
  initialDeviceOverrides?: RuntimeCrrtCase['initialDeviceOverrides'],
): RuntimeCrrtCase {
  return {
    id,
    contentVersion: 'test-mastery.1',
    initialDeviceOverrides,
    goalOptions: [option('goal-correct'), option('goal-other')],
    mechanismOptions: [option('mechanism-correct'), option('mechanism-other')],
    controlOptions: [option('control-correct'), option('control-other')],
    responseOptions: [option('response-correct'), option('response-other')],
    reassessmentOptions: [option('reassess-correct'), option('reassess-other')],
    hiddenMechanism: {
      id: 'hidden',
      summary: 'Synthetic mechanism',
      causalChain: ['cause', 'effect'],
      correctGoalOptionId: 'goal-correct',
      correctMechanismOptionId: 'mechanism-correct',
      correctControlOptionIds: ['control-correct'],
      correctResponseOptionId: 'response-correct',
      correctReassessmentOptionIds: ['reassess-correct'],
      sourceIds: ['TEST-P4-001'],
      reviewStatus: 'pending',
    },
    interventions: [
      {
        id: 'adjust-prescription',
        label: 'Adjust prescription',
        category: 'prescription',
        description: 'Synthetic action',
        response: 'Synthetic response',
        latencySeconds: 0,
        prerequisites: [],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'prescription.flows.bloodFlowMlMin',
            operation: 'set',
            valueType: 'number',
            value: 175,
            unit: 'mL/min',
            sourceId: 'TEST-P4-001',
          },
          {
            target: 'scenario.externalFluidRates.maintenanceInputMlHour',
            operation: 'set',
            valueType: 'number',
            value: 75,
            unit: 'mL/h',
            sourceId: 'TEST-P4-001',
          },
          {
            target: 'access.accessResistanceMmHgPerMlMin',
            operation: 'set',
            valueType: 'number',
            value: 0.3,
            unit: 'mmHg/(mL/min)',
            sourceId: 'TEST-P4-001',
          },
          {
            target: 'access.returnResistanceMmHgPerMlMin',
            operation: 'set',
            valueType: 'number',
            value: 0.4,
            unit: 'mmHg/(mL/min)',
            sourceId: 'TEST-P4-001',
          },
          {
            target: 'circuit.filter.procoagulantBurdenFraction',
            operation: 'set',
            valueType: 'number',
            value: 0.3,
            unit: 'fraction',
            sourceId: 'TEST-P4-001',
          },
          {
            target: 'circuit.filter.lowEffectiveBloodFlowFraction',
            operation: 'set',
            valueType: 'number',
            value: 0.2,
            unit: 'fraction',
            sourceId: 'TEST-P4-001',
          },
        ],
      },
      {
        id: 'advance-response',
        label: 'Advance response',
        category: 'assessment',
        description: 'Synthetic delayed response',
        response: 'Time advanced',
        latencySeconds: 60,
        prerequisites: [],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'simulation.advanceTimeSeconds',
            operation: 'add',
            valueType: 'number',
            value: 60,
            unit: 's',
            sourceId: 'TEST-P4-001',
          },
        ],
      },
      {
        id: 'unsupported-action',
        label: 'Unsupported',
        category: 'assessment',
        description: 'Must fail closed',
        response: 'Never applied',
        latencySeconds: 0,
        prerequisites: [],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'patient.unreviewedValue',
            operation: 'set',
            valueType: 'number',
            value: 1,
            unit: 'model-unit',
            sourceId: 'TEST-P4-001',
          },
        ],
      },
      {
        id: 'pause-delivery',
        label: 'Pause delivery',
        category: 'device',
        description: 'Synthetic pause',
        response: 'Pumps pause',
        latencySeconds: 0,
        prerequisites: [],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'device.deliveryState',
            operation: 'set',
            valueType: 'enum',
            value: 'paused',
            sourceId: 'TEST-P4-001',
          },
        ],
      },
      {
        id: 'resume-delivery',
        label: 'Resume delivery',
        category: 'device',
        description: 'Synthetic resume',
        response: 'Pumps resume',
        latencySeconds: 0,
        prerequisites: ['pause-delivery'],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'device.deliveryState',
            operation: 'set',
            valueType: 'enum',
            value: 'running',
            sourceId: 'TEST-P4-001',
          },
        ],
      },
      {
        id: 'end-delivery',
        label: 'End delivery',
        category: 'device',
        description: 'Synthetic end',
        response: 'Run ends',
        latencySeconds: 0,
        prerequisites: ['resume-delivery'],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'device.deliveryState',
            operation: 'set',
            valueType: 'enum',
            value: 'ended',
            sourceId: 'TEST-P4-001',
          },
        ],
      },
      {
        id: 'set-return-obstruction',
        label: 'Set generic return obstruction',
        category: 'access-circuit',
        description: 'Synthetic engine-fault fixture only',
        response: 'Generic fault is active',
        latencySeconds: 0,
        prerequisites: [],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'scenario.activeFaults.return-obstruction',
            operation: 'set',
            valueType: 'boolean',
            value: true,
            sourceId: 'TEST-P4-001',
          },
        ],
      },
      {
        id: 'clear-return-obstruction',
        label: 'Clear generic return obstruction',
        category: 'access-circuit',
        description: 'Synthetic engine-fault fixture only',
        response: 'Generic fault is cleared',
        latencySeconds: 0,
        prerequisites: ['set-return-obstruction'],
        repeatable: false,
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
        effects: [
          {
            target: 'scenario.activeFaults.return-obstruction',
            operation: 'set',
            valueType: 'boolean',
            value: false,
            sourceId: 'TEST-P4-001',
          },
        ],
      },
    ],
    requiredActionIds: ['adjust-prescription'],
    requiredReassessmentIds: ['reassess-correct'],
    acceptedAlternativePaths: [],
    successConditions: [
      {
        id: 'time-observed',
        metric: 'simulationTimeSeconds',
        comparator: 'gte',
        value: 60,
        unit: 's',
        sourceId: 'TEST-P4-001',
        reviewStatus: 'pending',
      },
    ],
    unsafeActions: [],
    criticalErrors: [],
    hintLadder: [
      {
        id: 'hint-1',
        sequence: 1,
        text: 'First',
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
      },
      {
        id: 'hint-2',
        sequence: 2,
        text: 'Second',
        sourceIds: ['TEST-P4-001'],
        reviewStatus: 'pending',
      },
    ],
    debrief: {
      summary: 'Summary',
      causalChain: ['cause', 'effect'],
      statedGoalReview: 'Goal review',
      predictionReview: 'Prediction review',
      actionTimelineReview: 'Timeline review',
      trendReview: 'Trend review',
      requiredActionsReview: 'Action review',
      criticalErrorsReview: 'Error review',
      acceptedAlternativesReview: 'Alternative review',
      machineNavigationPoint: 'Navigation point',
      transferQuestion: 'Transfer?',
      sourceIds: ['TEST-P4-001'],
      reviewStatus: 'pending',
    },
  } as unknown as RuntimeCrrtCase
}

function create(experience: CrrtLearningExperience = 'practice', attempt = 1) {
  const caseDefinition = buildCase()
  return createFromDefinition(caseDefinition, experience, attempt)
}

function createFromDefinition(
  caseDefinition: RuntimeCrrtCase,
  experience: CrrtLearningExperience = 'practice',
  attempt = 1,
) {
  return createCrrtLearningSession({
    caseDefinition,
    fixture: { ...createSyntheticFixture(), id: caseDefinition.id },
    experience,
    roleLens: 'integrated',
    attempt,
    audience: 'reviewer',
  })
}

function advanceToPrediction(state: CrrtLearningSessionState) {
  if (state.reasoningPhase === 'read') {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'define',
    })
  }
  if (state.reasoningPhase === 'define') {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'select',
    })
  }
  if (state.reasoningPhase === 'select') {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'predict',
    })
  }
  return state
}

function commit(state: CrrtLearningSessionState) {
  state = advanceToPrediction(state)
  return crrtLearningSessionReducer(state, {
    type: 'COMMIT_PREDICTION',
    prediction: correctPrediction,
  })
}

function deviceAction(
  state: CrrtLearningSessionState,
  action: Extract<
    Parameters<typeof crrtLearningSessionReducer>[1],
    { type: 'DEVICE_ACTION' }
  >['action'],
) {
  return crrtLearningSessionReducer(state, { type: 'DEVICE_ACTION', action })
}

describe('CRRT Phase 4 learning-session reducer', () => {
  it('owns the ordered pre-commit reasoning progression and resets it on reset or load', () => {
    let state = create()
    expect(state.reasoningPhase).toBe('read')

    expect(
      crrtLearningSessionReducer(state, {
        type: 'ENTER_PRECOMMIT_REASONING_PHASE',
        phase: 'predict',
      }),
    ).toBe(state)

    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'define',
    })
    expect(state.reasoningPhase).toBe('define')
    expect(
      crrtLearningSessionReducer(state, {
        type: 'ENTER_PRECOMMIT_REASONING_PHASE',
        phase: 'predict',
      }),
    ).toBe(state)

    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'select',
    })
    expect(state.reasoningPhase).toBe('select')
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'predict',
    })
    expect(state.reasoningPhase).toBe('predict')

    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'define',
    })
    expect(state.reasoningPhase).toBe('define')
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'select',
    })
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'predict',
    })
    expect(state.reasoningPhase).toBe('predict')

    state = commit(state)
    expect(state.reasoningPhase).toBe('run')
    expect(
      crrtLearningSessionReducer(state, {
        type: 'ENTER_PRECOMMIT_REASONING_PHASE',
        phase: 'define',
      }),
    ).toBe(state)

    const reset = crrtLearningSessionReducer(state, { type: 'RESET' })
    expect(reset.reasoningPhase).toBe('read')

    const loadedCase = buildCase('CRRT-13')
    const loaded = crrtLearningSessionReducer(state, {
      type: 'LOAD_CASE',
      caseDefinition: loadedCase,
      fixture: { ...createSyntheticFixture(), id: loadedCase.id },
      experience: 'learn',
      roleLens: 'integrated',
      attempt: 2,
      audience: 'reviewer',
    })
    expect(loaded.reasoningPhase).toBe('read')
  })

  it('rejects direct prediction and reassessment bypasses until canonical phases are reached', () => {
    const initial = create()
    expect(
      crrtLearningSessionReducer(initial, {
        type: 'COMMIT_PREDICTION',
        prediction: correctPrediction,
      }),
    ).toBe(initial)

    let state = crrtLearningSessionReducer(initial, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'define',
    })
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'select',
    })
    expect(
      crrtLearningSessionReducer(state, {
        type: 'COMMIT_PREDICTION',
        prediction: correctPrediction,
      }),
    ).toBe(state)
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'predict',
    })
    state = crrtLearningSessionReducer(state, {
      type: 'COMMIT_PREDICTION',
      prediction: correctPrediction,
    })
    expect(state.reasoningPhase).toBe('run')

    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    expect(state.reasoningPhase).toBe('run')

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'adjust-prescription',
    })
    expect(
      crrtLearningSessionReducer(state, {
        type: 'COMMIT_REASSESSMENT',
        optionIds: ['reassess-correct'],
      }),
    ).toBe(state)
    expect(crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 0 })).toBe(state)

    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    expect(state.reasoningPhase).toBe('reassess')
    expect(
      crrtLearningSessionReducer(state, {
        type: 'COMMIT_REASSESSMENT',
        optionIds: ['reassess-correct'],
      }).reassessment.committed,
    ).toBe(true)
  })

  it('keeps Mastery locked while the immutable activation registry has no runtime case', () => {
    const caseDefinition = buildCase()
    const fixture = { ...createSyntheticFixture(), id: caseDefinition.id }
    const createMastery = () =>
      createCrrtLearningSession({
        caseDefinition,
        fixture,
        experience: 'mastery',
        roleLens: 'integrated',
        attempt: 1,
        audience: 'reviewer',
      })

    expect(() => createMastery()).toThrow(/Mastery is locked/i)
  })

  it('uses an identical clinical seed across pathways and reducer-enforces the prediction lock', () => {
    const learn = create('learn', 3)
    const practice = create('practice', 3)

    expect(learn.simulation.seed).toBe(practice.simulation.seed)
    expect(learn.simulation.patient).toEqual(practice.simulation.patient)
    expect(learn.simulation.scenario).toEqual(practice.simulation.scenario)

    expect(
      crrtLearningSessionReducer(learn, {
        type: 'PERFORM_INTERVENTION',
        interventionId: 'adjust-prescription',
      }),
    ).toBe(learn)
    expect(
      crrtLearningSessionReducer(learn, {
        type: 'DEVICE_ACTION',
        action: { type: 'SELECT_NEW_PATIENT' },
      }),
    ).toBe(learn)
    expect(crrtLearningSessionReducer(learn, { type: 'ADVANCE_TIME', seconds: 60 })).toBe(learn)
  })

  it('allows only canonical generic engine-fault IDs and clears the cause separately', () => {
    let state = commit(create())
    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'set-return-obstruction',
    })
    expect(state.simulation.scenario.activeFaults).toContain('return-obstruction')
    expect(state.simulation.alarms.map((alarm) => alarm.code)).toContain('RETURN_OBSTRUCTION')

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'clear-return-obstruction',
    })
    expect(state.simulation.scenario.activeFaults).not.toContain('return-obstruction')
    expect(state.simulation.alarms.map((alarm) => alarm.code)).not.toContain('RETURN_OBSTRUCTION')
    expect(state.simulation.alarmHistory.map((alarm) => alarm.code)).toContain('RETURN_OBSTRUCTION')
  })

  it('commits an immutable five-field prediction and resets every state domain cleanly', () => {
    let state = commit(create())
    expect(Object.isFrozen(state.prediction)).toBe(true)
    expect(Object.isFrozen(state.prediction?.controlOptionIds)).toBe(true)
    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'adjust-prescription',
    })
    state = crrtLearningSessionReducer(state, { type: 'USE_HINT' })
    state = crrtLearningSessionReducer(state, { type: 'USE_HINT' })
    state = crrtLearningSessionReducer(state, { type: 'USE_HINT' })
    expect(state.usedHintIds).toEqual(['hint-1', 'hint-2'])
    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    state = crrtLearningSessionReducer(state, {
      type: 'COMMIT_REASSESSMENT',
      optionIds: ['reassess-correct'],
    })
    state = crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })

    const reset = crrtLearningSessionReducer(state, { type: 'RESET', experience: 'learn' })
    expect(reset.experience).toBe('learn')
    expect(reset.simulation.simulationTimeSeconds).toBe(0)
    expect(reset.interfaceState.screen).toBe('start')
    expect(reset.prediction).toBeNull()
    expect(reset.performedInterventionIds).toEqual([])
    expect(reset.usedHintIds).toEqual([])
    expect(reset.reassessment).toEqual({ committed: false, optionIds: [] })
    expect(reset.timeline).toEqual([])
    expect(reset.criticalErrorIds).toEqual([])
    expect(reset.debriefRevealed).toBe(false)
    expect(reset.reasoningPhase).toBe('read')
  })

  it('rejects RESET and LOAD_CASE attempts that try to enter locked Mastery', () => {
    let practice = commit(create('practice', 2))
    practice = crrtLearningSessionReducer(practice, { type: 'USE_HINT' })
    practice = crrtLearningSessionReducer(practice, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'adjust-prescription',
    })
    expect(practice.usedHintIds).toEqual(['hint-1'])
    expect(practice.performedInterventionIds).toEqual(['adjust-prescription'])

    expect(() =>
      crrtLearningSessionReducer(practice, {
        type: 'RESET',
        experience: 'mastery',
        attempt: 3,
      }),
    ).toThrow(/Mastery is locked/i)

    const caseDefinition = buildCase('CRRT-13')
    expect(() =>
      crrtLearningSessionReducer(practice, {
        type: 'LOAD_CASE',
        caseDefinition,
        fixture: { ...createSyntheticFixture(), id: caseDefinition.id },
        experience: 'mastery',
        roleLens: 'operator',
        attempt: 1,
        audience: 'reviewer',
      }),
    ).toThrow(/Mastery is locked/i)
  })

  it.each(['CRRT-10', 'CRRT-13'])(
    'loads and resets %s on Operations with the case prescription and running engine aligned',
    (caseId) => {
      const definition = buildCase(caseId, {
        workflowPhase: 'operations',
        treatmentState: 'running',
        connectedToPatient: true,
        pumpsPaused: false,
        activeAlarmIds: [],
      })
      let state = createFromDefinition(definition)

      expect(state.interfaceState).toMatchObject({
        screen: 'operations',
        startSelection: 'new-patient',
        selectedModality: 'cvvhd',
        completedStepIds: [
          'patient',
          'therapy',
          'prescription',
          'sets',
          'fluids',
          'prime',
          'review',
          'connect-patient',
        ],
        primeState: 'complete',
        treatmentState: 'running',
      })
      expect(state.interfaceState.committedPrescription).toEqual(state.simulation.prescription)
      expect(state.interfaceState.prescriptionDraft).toEqual({
        bloodFlowMlMin: state.simulation.prescription.flows.bloodFlowMlMin,
        dialysateFlowMlHour: state.simulation.prescription.flows.dialysateFlowMlHour,
        patientFluidRemovalMlHour: state.simulation.prescription.flows.patientFluidRemovalMlHour,
      })
      expect(state.simulation.device).toMatchObject({
        deliveryState: 'running',
        patientConnected: true,
        bloodPumpRunning: true,
        fluidPumpsRunning: true,
        returnClampClosed: false,
      })

      state = commit(state)
      state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
      state = crrtLearningSessionReducer(state, { type: 'USE_HINT' })
      const reset = crrtLearningSessionReducer(state, { type: 'RESET' })

      expect(reset.simulation.simulationTimeSeconds).toBe(0)
      expect(reset.simulation.device.deliveryState).toBe('running')
      expect(reset.interfaceState.screen).toBe('operations')
      expect(reset.interfaceState.treatmentState).toBe('running')
      expect(reset.interfaceState.committedPrescription).toEqual(reset.simulation.prescription)
      expect(reset.prediction).toBeNull()
      expect(reset.usedHintIds).toEqual([])
    },
  )

  it('projects an authored non-CVVHD prescription into a reviewer-only Operations state', () => {
    const definition = buildCase('CRRT-06', {
      workflowPhase: 'operations',
      treatmentState: 'running',
      connectedToPatient: true,
      pumpsPaused: false,
      activeAlarmIds: [],
    })
    const baseFixture = createSyntheticFixture()
    const baseBags = baseFixture.bags ?? []
    const sourceBag = baseBags.find((bag) => bag.direction === 'source')
    if (!sourceBag) throw new Error('Synthetic fixture must include a source bag.')
    const fixture = {
      ...baseFixture,
      id: definition.id,
      prescription: {
        ...baseFixture.prescription,
        modality: 'cvvhdf' as const,
        flows: {
          ...baseFixture.prescription.flows,
          dialysateFlowMlHour: 1_000,
          preReplacementFlowMlHour: 500,
          postReplacementFlowMlHour: 500,
        },
      },
      bags: [
        ...baseBags,
        {
          ...sourceBag,
          id: 'synthetic-pre-replacement-bag',
          label: 'Synthetic pre-replacement source',
          flowTerm: 'pre-replacement' as const,
        },
        {
          ...sourceBag,
          id: 'synthetic-post-replacement-bag',
          label: 'Synthetic post-replacement source',
          flowTerm: 'post-replacement' as const,
        },
      ],
    }

    const state = createCrrtLearningSession({
      caseDefinition: definition,
      fixture,
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
      audience: 'reviewer',
    })

    expect(state.interfaceState).toMatchObject({
      screen: 'operations',
      selectedModality: 'cvvhdf',
      treatmentState: 'running',
    })
    expect(state.interfaceState.committedPrescription).toEqual(state.simulation.prescription)
    expect(state.audience).toBe('reviewer')
    expect(() =>
      createCrrtLearningSession({
        caseDefinition: definition,
        fixture,
        experience: 'practice',
        roleLens: 'integrated',
        attempt: 1,
      }),
    ).toThrow(/reviewer-only/i)
  })

  it('keeps CRRT-04 new-patient/setup starts fresh and reconstructs that screen on reset', () => {
    const newPatientDefinition = buildCase('CRRT-04', {
      workflowPhase: 'new-patient',
      treatmentState: 'not-started',
      connectedToPatient: false,
      pumpsPaused: true,
      activeAlarmIds: [],
    })
    let state = createFromDefinition(newPatientDefinition)

    expect(state.interfaceState).toMatchObject({
      screen: 'start',
      startSelection: null,
      selectedModality: null,
      completedStepIds: [],
      committedPrescription: null,
      primeState: 'not-started',
      treatmentState: 'idle',
    })
    expect(state.simulation.device.deliveryState).toBe('idle')

    state = commit(state)
    state = deviceAction(state, { type: 'SELECT_NEW_PATIENT' })
    expect(state.interfaceState.screen).toBe('setup')
    const reset = crrtLearningSessionReducer(state, { type: 'RESET' })
    expect(reset.interfaceState.screen).toBe('start')
    expect(reset.interfaceState.committedPrescription).toBeNull()

    const setup = createFromDefinition(
      buildCase('CRRT-04', {
        ...newPatientDefinition.initialDeviceOverrides,
        workflowPhase: 'setup',
      }),
    )
    expect(setup.interfaceState).toMatchObject({
      screen: 'setup',
      startSelection: 'new-patient',
      completedStepIds: [],
      committedPrescription: null,
      primeState: 'not-started',
      treatmentState: 'idle',
    })
  })

  it('requires an intervention before reassessment and reassessment before debrief', () => {
    let state = commit(create())
    const prematureReassessment = crrtLearningSessionReducer(state, {
      type: 'COMMIT_REASSESSMENT',
      optionIds: ['reassess-correct'],
    })
    expect(prematureReassessment).toBe(state)
    expect(crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })).toBe(state)

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'adjust-prescription',
    })
    const bypass = crrtLearningSessionReducer(state, {
      type: 'COMMIT_REASSESSMENT',
      optionIds: ['reassess-correct'],
    })
    expect(bypass).toBe(state)
    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    state = crrtLearningSessionReducer(state, {
      type: 'COMMIT_REASSESSMENT',
      optionIds: ['reassess-correct'],
    })
    expect(crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' }).debriefRevealed).toBe(true)
  })

  it('executes only explicitly allowlisted intervention targets and fails closed otherwise', () => {
    let state = commit(create())
    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'adjust-prescription',
    })
    expect(state.simulation.prescription.flows.bloodFlowMlMin).toBe(175)
    expect(state.simulation.scenario.externalFluidRates.maintenanceInputMlHour).toBe(75)
    expect(state.simulation.access.status).toBe('configured')
    if (state.simulation.access.status === 'configured') {
      expect(state.simulation.access.accessResistanceMmHgPerMlMin).toBe(0.3)
      expect(state.simulation.access.returnResistanceMmHgPerMlMin).toBe(0.4)
    }
    expect(state.simulation.circuit.filter).toMatchObject({
      procoagulantBurdenFraction: 0.3,
      lowEffectiveBloodFlowFraction: 0.2,
    })
    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'advance-response',
    })
    expect(state.simulation.simulationTimeSeconds).toBe(60)

    expect(() =>
      crrtLearningSessionReducer(state, {
        type: 'PERFORM_INTERVENTION',
        interventionId: 'unsupported-action',
      }),
    ).toThrow(UnsupportedCrrtLearningEffectError)
  })

  it('synchronizes committed interface prescription and treatment start into the engine', () => {
    let state = commit(create())
    state = deviceAction(state, { type: 'SELECT_NEW_PATIENT' })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'patient' })
    state = deviceAction(state, { type: 'SELECT_CVVHD' })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'therapy' })
    state = deviceAction(state, {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'bloodFlowMlMin',
      value: 180,
    })
    state = deviceAction(state, {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'dialysateFlowMlHour',
      value: 1_200,
    })
    state = deviceAction(state, {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'patientFluidRemovalMlHour',
      value: 80,
    })
    state = deviceAction(state, { type: 'COMMIT_PRESCRIPTION' })
    expect(state.simulation.prescription.flows).toMatchObject({
      bloodFlowMlMin: 180,
      dialysateFlowMlHour: 1_200,
      patientFluidRemovalMlHour: 80,
    })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'sets' })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' })
    state = deviceAction(state, { type: 'START_PRIME' })
    state = deviceAction(state, { type: 'COMPLETE_PRIME' })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'review' })
    state = deviceAction(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' })
    state = deviceAction(state, { type: 'START_TREATMENT' })

    expect(state.interfaceState.treatmentState).toBe('running')
    expect(state.simulation.device.deliveryState).toBe('running')
    expect(state.simulation.device.patientConnected).toBe(true)
  })

  it('projects intervention pause, resume, and end states onto Operations without false RUNNING', () => {
    const definition = buildCase('CRRT-13', {
      workflowPhase: 'operations',
      treatmentState: 'running',
      connectedToPatient: true,
      pumpsPaused: false,
      activeAlarmIds: [],
    })
    let state = commit(createFromDefinition(definition))

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'pause-delivery',
    })
    expect(state.simulation.device).toMatchObject({
      deliveryState: 'paused',
      bloodPumpRunning: false,
      fluidPumpsRunning: false,
    })
    expect(state.interfaceState).toMatchObject({
      screen: 'operations',
      treatmentState: 'idle',
      stopDialogOpen: false,
    })

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'resume-delivery',
    })
    expect(state.simulation.device.deliveryState).toBe('running')
    expect(state.interfaceState).toMatchObject({
      screen: 'operations',
      treatmentState: 'running',
    })

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'end-delivery',
    })
    expect(state.simulation.device.deliveryState).toBe('ended')
    expect(state.interfaceState).toMatchObject({
      screen: 'operations',
      treatmentState: 'ended',
      stopDialogOpen: false,
    })
  })
})
