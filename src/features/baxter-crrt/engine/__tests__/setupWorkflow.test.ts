import { getBaxterCrrtCase } from '../../content/completeCases'
import { crrtSuppliedEvidenceFieldIds } from '../../content/caseEvidenceScope'
import { selectCrrtBloodFlowState, selectCrrtCalculatedPressureValidity } from '../circuitDelivery'
import { selectCrrtConsoleControls } from '../consoleControls'
import {
  prismaxSetupSteps,
  selectPrismaxPilotCaseOperationsDisplay,
} from '../deviceAdapters/prismax'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionAction,
  type CrrtLearningSessionState,
} from '../learningSession'
import {
  crrtActionStartsDelivery,
  selectCrrtMachineStartReadiness,
  selectCrrtMachineStepAssertions,
  selectCrrtPrescriptionRecord,
} from '../setupWorkflow'
import { completeCrrtMachineSetup } from '../testSupport/machineWorkflow'

function start(caseId: string): CrrtLearningSessionState {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId as never),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

const perform = (interventionId: string): CrrtLearningSessionAction => ({
  type: 'PERFORM_INTERVENTION',
  interventionId,
})
const device = (action: unknown): CrrtLearningSessionAction =>
  ({ type: 'DEVICE_ACTION', action }) as CrrtLearningSessionAction

function run(session: CrrtLearningSessionState, actions: readonly CrrtLearningSessionAction[]) {
  return actions.reduce((next, action) => crrtLearningSessionReducer(next, action), session)
}

const learnerValues = {
  bloodFlowMlMin: 150,
  dialysateFlowMlHour: 1_900,
  patientFluidRemovalMlHour: 100,
} as const

const caseCards: readonly CrrtLearningSessionAction[] = [
  perform('crrt04-assess-goal'),
  perform('crrt04-enter-blood-flow'),
  perform('crrt04-enter-dialysate-primary'),
  perform('crrt04-enter-machine-pfr'),
]

function lastTimelineEntry(session: CrrtLearningSessionState) {
  return session.timeline[session.timeline.length - 1]
}

describe('CRRT-04 machine workflow is the authoritative one', () => {
  it('keeps the schema enum aligned with the facsimile setup steps', () => {
    expect(
      getBaxterCrrtCase('CRRT-04').interventions.find(
        ({ id }) => id === 'crrt04-complete-prime-review',
      )?.assertsCompletedMachineSteps,
    ).toEqual(['prime', 'review'])
    const stepIds = new Set<string>(prismaxSetupSteps.map((step) => step.id))
    for (const definitionCase of [getBaxterCrrtCase('CRRT-04')]) {
      for (const intervention of definitionCase.interventions) {
        for (const stepId of intervention.assertsCompletedMachineSteps ?? []) {
          expect(stepIds.has(stepId)).toBe(true)
        }
      }
    }
  })

  it('refuses a declaration of prime and review the machine has not recorded', () => {
    const session = run(start('CRRT-04'), [...caseCards, perform('crrt04-complete-prime-review')])
    const entry = lastTimelineEntry(session)
    expect(entry.referenceId).toBe('crrt04-complete-prime-review')
    expect(entry.outcome).toBe('refused')
    expect(entry.details?.[0].value).toMatch(/machine has not recorded Prime or Review/)
    expect(session.performedInterventionIds).not.toContain('crrt04-complete-prime-review')
  })

  it('refuses a case card that would start delivery around the machine start interlock', () => {
    const readiness = selectCrrtMachineStartReadiness(start('CRRT-04').interfaceState)
    expect(readiness.ready).toBe(false)
    expect(readiness.missing).toContain('the Prime step is not complete')
    expect(readiness.missing).toContain('no prescription has been committed')

    expect(
      crrtActionStartsDelivery(
        getBaxterCrrtCase('CRRT-04').interventions.find(
          ({ id }) => id === 'crrt04-start-reviewed-treatment',
        )!,
      ),
    ).toBe(true)

    // Reached directly, with the declaration prerequisite already satisfied on the
    // machine, so the refusal under test is the start interlock and not the
    // prerequisite chain.
    const prepared = run(
      completeCrrtMachineSetup(start('CRRT-04'), learnerValues, { startTreatment: false }),
      [...caseCards, perform('crrt04-complete-prime-review')],
    )
    expect(prepared.performedInterventionIds).toContain('crrt04-complete-prime-review')
    expect(prepared.interfaceState.treatmentState).toBe('idle')

    const started = run(prepared, [perform('crrt04-start-reviewed-treatment')])
    expect(started.simulation.device.deliveryState).toBe('running')
    expect(lastTimelineEntry(started).outcome).toBe('applied')
  })

  it('accepts the declaration once the machine has actually primed and reviewed', () => {
    const session = run(
      completeCrrtMachineSetup(start('CRRT-04'), learnerValues, { startTreatment: false }),
      [...caseCards, perform('crrt04-complete-prime-review')],
    )
    const assertions = selectCrrtMachineStepAssertions(
      getBaxterCrrtCase('CRRT-04').interventions.find(
        ({ id }) => id === 'crrt04-complete-prime-review',
      )!,
      session.interfaceState,
    )
    expect(assertions.map((assertion) => assertion.complete)).toEqual([true, true])
    expect(session.performedInterventionIds).toContain('crrt04-complete-prime-review')
  })

  it('records a genuinely completed machine step exactly once and refuses a repeat', () => {
    const session = run(start('CRRT-04'), [
      device({ type: 'SELECT_NEW_PATIENT' }),
      device({ type: 'COMPLETE_SETUP_STEP', stepId: 'patient' }),
      device({ type: 'COMPLETE_SETUP_STEP', stepId: 'patient' }),
    ])
    expect(session.interfaceState.completedStepIds).toEqual(['patient'])
    const outcomes = session.timeline
      .filter((entry) => entry.referenceId === 'COMPLETE_SETUP_STEP')
      .map((entry) => entry.outcome)
    expect(outcomes).toEqual(['applied', 'refused'])
  })

  it('does not treat viewing the case or declaring the goal as a machine step', () => {
    const viewed = start('CRRT-04')
    expect(viewed.interfaceState.completedStepIds).toEqual([])
    expect(viewed.interfaceState.primeState).toBe('not-started')

    const goalDeclared = run(viewed, [perform('crrt04-assess-goal')])
    expect(goalDeclared.performedInterventionIds).toEqual(['crrt04-assess-goal'])
    expect(goalDeclared.interfaceState.completedStepIds).toEqual([])
    expect(goalDeclared.interfaceState.primeState).toBe('not-started')
    expect(goalDeclared.interfaceState.committedPrescription).toBeNull()
    expect(goalDeclared.simulation.device.deliveryState).toBe('idle')
  })

  it('positions the goal before the guided prescription entry without gating the lesson', () => {
    const definition = getBaxterCrrtCase('CRRT-04')
    expect(
      definition.interventions.find(({ id }) => id === 'crrt04-enter-blood-flow')?.prerequisites,
    ).toEqual(['crrt04-assess-goal'])
    // Nothing about opening the case requires the declaration first.
    const opened = start('CRRT-04')
    expect(opened.timeline).toEqual([])
    expect(opened.performedInterventionIds).toEqual([])
  })

  it('preserves a nondefault learner prescription and names the divergence a card creates', () => {
    const started = completeCrrtMachineSetup(start('CRRT-04'), learnerValues)
    const matched = selectCrrtPrescriptionRecord(started)
    expect(matched.status).toBe('machine-reviewed-matches')
    expect(matched.divergences).toEqual([])
    expect(matched.inUse?.bloodFlowMlMin).toBe(150)

    const afterCard = run(started, [
      perform('crrt04-assess-goal'),
      perform('crrt04-enter-blood-flow'),
    ])
    // The learner's committed machine record is untouched.
    expect(afterCard.interfaceState.committedPrescription?.flows.bloodFlowMlMin).toBe(150)
    expect(afterCard.interfaceState.completedStepIds).toHaveLength(prismaxSetupSteps.length)
    expect(afterCard.interfaceState.primeState).toBe('complete')

    const record = selectCrrtPrescriptionRecord(afterCard)
    expect(record.status).toBe('changed-since-machine-review')
    expect(record.committedOnMachine?.bloodFlowMlMin).toBe(150)
    expect(record.inUse?.bloodFlowMlMin).toBe(120)
    expect(record.divergences).toEqual([
      { label: 'Blood flow', unit: 'mL/min', committedOnMachine: 150, inUse: 120 },
    ])
    expect(record.statement).toMatch(/no longer the one you committed on the machine/)
    // Only the prescription review is affected: prime and connection are not revoked.
    expect(record.statement).toMatch(/completed prime, connection and start are unchanged/)
  })

  it('labels a card that writes a flow as the case supplied example and shows what it replaces', () => {
    const started = completeCrrtMachineSetup(start('CRRT-04'), learnerValues)
    const controls = selectCrrtConsoleControls(run(started, [perform('crrt04-assess-goal')]))
    const bloodFlowCard = controls.settingActions.find(
      ({ id }) => id === 'crrt04-enter-blood-flow',
    )!
    expect(bloodFlowCard.writesPrescription).toBe(true)
    expect(bloodFlowCard.changes).toEqual([
      {
        target: 'prescription.flows.bloodFlowMlMin',
        label: 'Blood flow',
        instruction: 'Set to 120 mL/min',
        currentValueText: '150 mL/min',
      },
    ])
    const startCard = controls.settingActions.find(
      ({ id }) => id === 'crrt04-start-reviewed-treatment',
    )!
    expect(startCard.writesPrescription).toBe(false)
  })

  it('publishes the observation interval a card carries', () => {
    const controls = selectCrrtConsoleControls(start('CRRT-11'))
    const safeCard = controls.settingActions.find(
      ({ id }) => id === 'crrt11-action-safe-candidate',
    )!
    expect(safeCard.observationIntervalSeconds).toBe(3_600)
    const unsafeCard = controls.settingActions.find(
      ({ id }) => id === 'crrt11-action-unsafe-candidate',
    )!
    expect(unsafeCard.observationIntervalSeconds).toBe(0)
  })

  it('leaves a resume after a pause alone, because it bypasses no interlock', () => {
    const session = run(start('CRRT-13'), [
      perform('crrt13-assess-patient-device'),
      perform('crrt13-advance-to-pattern'),
      perform('crrt13-inspect-access-path'),
      perform('crrt13-pause-treatment'),
      perform('crrt13-reposition-access'),
      perform('crrt13-resume-treatment'),
    ])
    expect(session.performedInterventionIds).toContain('crrt13-resume-treatment')
    expect(session.simulation.device.deliveryState).toBe('running')
  })
})

describe('set blood flow, actual circuit flow and calculated-pressure validity', () => {
  it('reports the setting and zero actual flow while the circuit is not delivering', () => {
    const idle = start('CRRT-04')
    expect(selectCrrtBloodFlowState(idle.simulation)).toMatchObject({
      status: 'not-delivering',
      setMlMin: 0,
      actualMlMin: 0,
      bloodPumpRunning: false,
    })

    const started = completeCrrtMachineSetup(idle, learnerValues)
    expect(selectCrrtBloodFlowState(started.simulation)).toMatchObject({
      status: 'delivering',
      setMlMin: 150,
      actualMlMin: 150,
      bloodPumpRunning: true,
    })
  })

  it('keeps the set blood flow while the circuit carries none once delivery stops', () => {
    const paused = run(start('CRRT-13'), [
      perform('crrt13-assess-patient-device'),
      perform('crrt13-advance-to-pattern'),
      perform('crrt13-inspect-access-path'),
      perform('crrt13-pause-treatment'),
    ])
    const flow = selectCrrtBloodFlowState(paused.simulation)
    expect(flow.status).toBe('not-delivering')
    expect(flow.setMlMin).toBe(120)
    expect(flow.actualMlMin).toBe(0)
    expect(paused.simulation.device.deliveryState).toBe('paused')
  })

  it('marks only the calculated channels unsupported while no blood flows, and keeps their values', () => {
    const idle = start('CRRT-04')
    const advanced = crrtLearningSessionReducer(idle, { type: 'ADVANCE_TIME', seconds: 21_600 })
    const display = selectPrismaxPilotCaseOperationsDisplay(
      advanced.interfaceState,
      advanced.simulation,
    )
    const byId = new Map(display.pressureSignals.map((signal) => [signal.id, signal]))

    // The four measured sites stay supported: with no flow they legitimately read
    // the authored reference pressures.
    for (const id of ['access', 'filter', 'return', 'effluent'] as const) {
      expect(byId.get(id)).toMatchObject({ validity: 'supported', validityReason: null })
    }

    // The two device calculations reproduce the reported -25 mmHg drop and 7 mmHg
    // TMP with no blood moving. The values are unchanged and still shown; what is
    // added is the statement that they carry no information about the filter.
    expect(byId.get('filter-drop')?.valueMmHg).toBe(-25)
    expect(byId.get('tmp')?.valueMmHg).toBe(7)
    for (const id of ['tmp', 'filter-drop'] as const) {
      const signal = byId.get(id)!
      expect(signal.validity).toBe('no-flow-through-circuit')
      expect(signal.validityReason).toMatch(/No blood is moving through the circuit/)
      expect(signal.valueMmHg).not.toBeNull()
    }
    expect(display.treatmentContext.bloodFlow).toMatchObject({ setMlMin: 0, actualMlMin: 0 })
  })

  it('restores support for the calculated channels once blood is moving', () => {
    const running = completeCrrtMachineSetup(start('CRRT-04'), learnerValues)
    const display = selectPrismaxPilotCaseOperationsDisplay(
      running.interfaceState,
      running.simulation,
    )
    for (const signal of display.pressureSignals) {
      expect(signal.validity).toBe('supported')
      expect(signal.validityReason).toBeNull()
    }
  })

  it('never marks a measured site unsupported, whatever the flow state', () => {
    const stopped = selectCrrtBloodFlowState(start('CRRT-04').simulation)
    expect(selectCrrtCalculatedPressureValidity('directly-modelled-site', stopped)).toEqual({
      validity: 'supported',
      reason: null,
    })
    expect(selectCrrtCalculatedPressureValidity('calculated-relationship', stopped).validity).toBe(
      'no-flow-through-circuit',
    )
  })

  it('keeps every supplied-evidence field id readable', () => {
    expect(new Set(crrtSuppliedEvidenceFieldIds).size).toBe(crrtSuppliedEvidenceFieldIds.length)
  })
})
