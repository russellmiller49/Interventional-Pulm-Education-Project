import {
  baxterCrrtPilotCases,
  baxterCrrtPilotFixtures,
  baxterCrrtPilotSourceReferences,
  BAXTER_CRRT_PILOT_CONTENT_VERSION,
  getBaxterCrrtPilotCase,
  getBaxterCrrtPilotFixture,
} from '../content'
import { CRRT_PILOT_CASE_IDS, validatePilotCrrtCaseRegistry } from '../content/schema'
import { createInitialCrrtSimulationState } from '../engine/initialState'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../engine/learningSession'
import { selectCrrtLearningOutcome } from '../engine/outcomes'
import { crrtSimulationReducer } from '../engine/reducer'

const canonicalEffectTargets = new Set([
  'prescription.flows.bloodFlowMlMin',
  'prescription.flows.dialysateFlowMlHour',
  'prescription.flows.pbpFlowMlHour',
  'prescription.flows.preReplacementFlowMlHour',
  'prescription.flows.postReplacementFlowMlHour',
  'prescription.flows.patientFluidRemovalMlHour',
  'prescription.flows.syringeFlowMlHour',
  'prescription.flows.makeupFlowMlHour',
  'scenario.externalFluidRates.maintenanceInputMlHour',
  'scenario.externalFluidRates.medicationCarrierInputMlHour',
  'scenario.externalFluidRates.nutritionInputMlHour',
  'scenario.externalFluidRates.bloodProductInputMlHour',
  'scenario.externalFluidRates.bolusInputMlHour',
  'scenario.externalFluidRates.otherInputMlHour',
  'scenario.externalFluidRates.urineOutputMlHour',
  'scenario.externalFluidRates.drainOutputMlHour',
  'scenario.externalFluidRates.otherOutputMlHour',
  'access.accessResistanceMmHgPerMlMin',
  'scenario.activeFaults.access-obstruction',
  'device.deliveryState',
  'simulation.advanceTimeSeconds',
])

const requiredDebriefKeys = [
  'summary',
  'statedGoalReview',
  'predictionReview',
  'actionTimelineReview',
  'causalChain',
  'trendReview',
  'requiredActionsReview',
  'criticalErrorsReview',
  'acceptedAlternativesReview',
  'machineNavigationPoint',
  'transferQuestion',
] as const

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

describe('Baxter CRRT Phase 5 pilot case registry', () => {
  it('exports exactly the ordered CRRT-04, CRRT-10, and CRRT-13 pilot registry', () => {
    expect(baxterCrrtPilotCases.map(({ id }) => id)).toEqual([...CRRT_PILOT_CASE_IDS])
    expect(baxterCrrtPilotFixtures.map(({ id }) => id)).toEqual([...CRRT_PILOT_CASE_IDS])
    expect(
      validatePilotCrrtCaseRegistry(baxterCrrtPilotCases, { requireExactPilotCases: true }),
    ).toEqual([])
    expect(Object.isFrozen(baxterCrrtPilotCases)).toBe(true)
    expect(Object.isFrozen(baxterCrrtPilotFixtures)).toBe(true)

    for (const caseId of CRRT_PILOT_CASE_IDS) {
      expect(getBaxterCrrtPilotCase(caseId)).toMatchObject({
        id: caseId,
        contentVersion: BAXTER_CRRT_PILOT_CONTENT_VERSION,
      })
      expect(getBaxterCrrtPilotFixture(caseId).id).toBe(caseId)
      expect(
        createCrrtLearningSession({
          caseDefinition: getBaxterCrrtPilotCase(caseId),
          experience: 'learn',
          roleLens: 'integrated',
          attempt: 1,
        }).simulation.contentVersion,
      ).toBe(BAXTER_CRRT_PILOT_CONTENT_VERSION)
    }
  })

  it('keeps all pilot content pending, synthetic, and PrisMax-only', () => {
    for (const definition of baxterCrrtPilotCases) {
      expect(definition.reviewStatus).toBe('pending')
      expect(definition.compatibleDevices).toEqual(['prismax-aw8035-2xx'])
      expect(definition.sourceBasis.every(({ reviewStatus }) => reviewStatus === 'pending')).toBe(
        true,
      )
      expect(definition.sourceBasis.some(({ id }) => id === `SYNTH-${definition.id}`)).toBe(true)
      expect(
        definition.sourceBasis.find(({ id }) => id === `SYNTH-${definition.id}`)?.value,
      ).toMatch(/not sourced clinical targets/i)
    }
  })

  it('provides explicit pending manual, clinical-context, and synthetic source records', () => {
    const references = new Map(
      baxterCrrtPilotSourceReferences.map((reference) => [reference.id, reference] as const),
    )

    for (const sourceId of [
      'DEV-PM-005',
      'MATH-PM-001',
      'DOSE-PM-001',
      'FLUID-PM-001',
      'DEV-PM-009',
      'DEV-PM-013',
      'RENAL-2009',
      'WHITE-2024',
      'GONEUTRAL-2024',
      'SYNTH-CRRT-04',
      'SYNTH-CRRT-10',
      'SYNTH-CRRT-13',
    ]) {
      expect(references.get(sourceId)).toMatchObject({ id: sourceId, reviewStatus: 'pending' })
    }

    expect(references.get('RENAL-2009')?.pageOrSection).toContain('10.1056/NEJMoa0902413')
    expect(references.get('WHITE-2024')?.pageOrSection).toContain('10.1159/000538421')
    expect(references.get('GONEUTRAL-2024')?.pageOrSection).toContain('10.1007/s00134-024-07676-1')
  })

  it('normalizes every authored case into an independent engine fixture', () => {
    for (const [index, caseId] of CRRT_PILOT_CASE_IDS.entries()) {
      const first = getBaxterCrrtPilotFixture(caseId)
      const second = getBaxterCrrtPilotFixture(caseId)
      expect(first).toEqual(baxterCrrtPilotFixtures[index])
      expect(first).not.toBe(second)
      expect(first.patient.synthetic).toBe(true)
      expect(first.reviewStatus).toBe('pending')
    }

    expect(getBaxterCrrtPilotCase('CRRT-04').initialDeviceOverrides).toMatchObject({
      workflowPhase: 'new-patient',
      treatmentState: 'not-started',
      connectedToPatient: false,
      pumpsPaused: true,
    })
    for (const caseId of ['CRRT-10', 'CRRT-13'] as const) {
      expect(getBaxterCrrtPilotCase(caseId).initialDeviceOverrides).toMatchObject({
        workflowPhase: 'operations',
        treatmentState: 'running',
        connectedToPatient: true,
        pumpsPaused: false,
      })
    }
  })

  it('uses only the canonical learning-session state effect targets', () => {
    for (const definition of baxterCrrtPilotCases) {
      const effects = [
        ...definition.timedEvents.flatMap(({ effects: timedEffects }) => timedEffects),
        ...definition.interventions.flatMap(
          ({ effects: interventionEffects }) => interventionEffects,
        ),
      ]
      for (const effect of effects) expect(canonicalEffectTargets).toContain(effect.target)
    }
  })

  it('ships complete alternatives, safety teaching, ordered hints, and causal debriefs', () => {
    for (const definition of baxterCrrtPilotCases) {
      expect(definition.acceptedAlternativePaths.length).toBeGreaterThanOrEqual(2)
      expect(definition.unsafeActions.length).toBeGreaterThanOrEqual(2)
      expect(definition.criticalErrors.length).toBeGreaterThanOrEqual(2)
      expect(definition.hintLadder.map(({ sequence }) => sequence)).toEqual(
        definition.hintLadder.map((_, index) => index + 1),
      )
      for (const key of requiredDebriefKeys) {
        const value = definition.debrief[key]
        expect(Array.isArray(value) ? value.length : value.length).toBeGreaterThan(0)
      }
    }
  })

  it('runs every accepted path end to end through the learning-session reducer', () => {
    for (const [index, definition] of baxterCrrtPilotCases.entries()) {
      const fixture = getBaxterCrrtPilotFixture(CRRT_PILOT_CASE_IDS[index])
      const hidden = definition.hiddenMechanism
      for (const [pathIndex, path] of definition.acceptedAlternativePaths.entries()) {
        let session = createCrrtLearningSession({
          caseDefinition: definition,
          fixture,
          experience: 'learn',
          roleLens: 'integrated',
          attempt: pathIndex + 1,
        })
        session = advanceToPrediction(session)

        session = crrtLearningSessionReducer(session, {
          type: 'COMMIT_PREDICTION',
          prediction: {
            goalOptionId: hidden.correctGoalOptionId,
            mechanismOptionId: hidden.correctMechanismOptionId,
            controlOptionIds: hidden.correctControlOptionIds,
            responseOptionId: hidden.correctResponseOptionId,
            reassessmentOptionIds: hidden.correctReassessmentOptionIds,
          },
        })
        for (const interventionId of path.actionIds) {
          session = crrtLearningSessionReducer(session, {
            type: 'PERFORM_INTERVENTION',
            interventionId,
          })
          expect(session.performedInterventionIds).toContain(interventionId)
        }
        session = crrtLearningSessionReducer(session, {
          type: 'ADVANCE_TIME',
          seconds: 60,
        })
        session = crrtLearningSessionReducer(session, {
          type: 'COMMIT_REASSESSMENT',
          optionIds: path.reassessmentIds,
        })
        session = crrtLearningSessionReducer(session, { type: 'REVEAL_DEBRIEF' })

        const outcome = selectCrrtLearningOutcome(session)
        expect(outcome.matchedAcceptedPathIds).toContain(path.id)
        expect(outcome.criticalErrorIds).toEqual([])
        expect(outcome.reassessmentComplete).toBe(true)
        expect(session.debriefRevealed).toBe(true)
      }
    }
  })

  it('derives the CRRT-13 pressure change and obstruction alarm from scheduled events', () => {
    let state = createInitialCrrtSimulationState({ fixture: getBaxterCrrtPilotFixture('CRRT-13') })
    state = crrtSimulationReducer(state, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'running',
    })
    const baselineAccessPressure = state.circuit.pressures.accessPressureMmHg

    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 1_800 })

    expect(state.simulationTimeSeconds).toBe(1_800)
    expect(state.scenario.appliedEventIds).toEqual(
      expect.arrayContaining(['crrt13-obstruction-flag', 'crrt13-resistance-rise']),
    )
    expect(state.scenario.activeFaults).toContain('access-obstruction')
    expect(state.access.status).toBe('configured')
    if (state.access.status === 'configured') {
      expect(state.access.accessResistanceMmHgPerMlMin).toBe(1.2)
    }
    expect(state.circuit.pressures.accessPressureMmHg).toBeLessThan(
      baselineAccessPressure ?? Number.POSITIVE_INFINITY,
    )
    expect(state.alarms.map(({ code }) => code)).toContain('ACCESS_OBSTRUCTION')
  })

  it('keeps machine removal distinct from whole-patient balance in CRRT-10', () => {
    let state = createInitialCrrtSimulationState({ fixture: getBaxterCrrtPilotFixture('CRRT-10') })
    state = crrtSimulationReducer(state, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'running',
    })
    state = crrtSimulationReducer(state, { type: 'ADVANCE_TIME', seconds: 3_600 })

    expect(state.scenario.appliedEventIds).toContain('crrt10-bolus-complete')
    expect(state.scenario.externalFluidRates.bolusInputMlHour).toBe(0)
    expect(state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl).toBeGreaterThan(0)
    expect(state.deliveredTherapy.cumulativeWholePatientBalanceMl).not.toBe(
      -state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl,
    )
  })
})
