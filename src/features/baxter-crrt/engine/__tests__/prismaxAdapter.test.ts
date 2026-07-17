import { createInitialCrrtSimulationState } from '../initialState'
import type { ActiveAlarm, ConfiguredPrescriptionState } from '../types'
import {
  createInitialPrismaxPilotInterfaceState,
  prismaxDeviceAdapter,
  prismaxPilotInterfaceReducer,
  prismaxSetupSteps,
  prismaxStartOptions,
  selectPrismaxPilotInterface,
  selectPrismaxPilotOperationsDisplay,
  type PrismaxPilotInterfaceAction,
  type PrismaxPilotInterfaceState,
} from '../deviceAdapters/prismax'

function reduce(
  state: PrismaxPilotInterfaceState,
  ...actions: readonly PrismaxPilotInterfaceAction[]
): PrismaxPilotInterfaceState {
  return actions.reduce(prismaxPilotInterfaceReducer, state)
}

function reachPrescription(): PrismaxPilotInterfaceState {
  return reduce(
    createInitialPrismaxPilotInterfaceState(),
    { type: 'SELECT_NEW_PATIENT' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'patient' },
    { type: 'SELECT_CVVHD' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'therapy' },
  )
}

function commitPilotPrescription(
  state: PrismaxPilotInterfaceState,
  values = { bloodFlowMlMin: 150, dialysateFlowMlHour: 1_500, patientFluidRemovalMlHour: 50 },
): PrismaxPilotInterfaceState {
  return reduce(
    state,
    { type: 'SET_PRESCRIPTION_VALUE', field: 'bloodFlowMlMin', value: values.bloodFlowMlMin },
    {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'dialysateFlowMlHour',
      value: values.dialysateFlowMlHour,
    },
    {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'patientFluidRemovalMlHour',
      value: values.patientFluidRemovalMlHour,
    },
    { type: 'COMMIT_PRESCRIPTION' },
  )
}

function reachReadyToStart(): PrismaxPilotInterfaceState {
  return reduce(
    commitPilotPrescription(reachPrescription()),
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'sets' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' },
    { type: 'START_PRIME' },
    { type: 'COMPLETE_PRIME' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'review' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' },
  )
}

describe('PrisMax Phase 3 pilot adapter', () => {
  it('exposes the immutable source-mapped setup sequence in manual order', () => {
    expect(prismaxSetupSteps.map((step) => step.label)).toEqual([
      'Patient',
      'Therapy',
      'Prescription',
      'Sets',
      'Fluids',
      'Prime',
      'Review',
      'Connect Patient',
    ])
    expect(prismaxSetupSteps.every((step) => step.reviewStatus === 'pending')).toBe(true)
    expect(prismaxSetupSteps.every((step) => step.sourceIds.includes('DEV-PM-005'))).toBe(true)
    expect(Object.isFrozen(prismaxSetupSteps)).toBe(true)
    expect(prismaxSetupSteps.every(Object.isFrozen)).toBe(true)
    expect(prismaxSetupSteps.every((step) => Object.isFrozen(step.sourceIds))).toBe(true)

    expect(prismaxStartOptions).toEqual([
      expect.objectContaining({ id: 'new-patient', available: true }),
      expect.objectContaining({ id: 'same-patient', available: false }),
    ])
  })

  it('keeps the draft blank and requires BFR before dialysate or PFR', () => {
    let state = reachPrescription()
    expect(state.prescriptionDraft).toEqual({
      bloodFlowMlMin: null,
      dialysateFlowMlHour: null,
      patientFluidRemovalMlHour: null,
    })

    const beforeDownstream = state
    state = prismaxPilotInterfaceReducer(state, {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'dialysateFlowMlHour',
      value: 1_000,
    })
    expect(state).toBe(beforeDownstream)
    expect(selectPrismaxPilotInterface(state).canSetDialysateAndPatientFluidRemoval).toBe(false)

    state = prismaxPilotInterfaceReducer(state, {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'bloodFlowMlMin',
      value: 100,
    })
    expect(selectPrismaxPilotInterface(state).canSetDialysateAndPatientFluidRemoval).toBe(true)
    state = prismaxPilotInterfaceReducer(state, {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'dialysateFlowMlHour',
      value: 1_000,
    })
    expect(selectPrismaxPilotInterface(state).canCommitPrescription).toBe(true)
  })

  it('accepts finite nonnegative values without encoding a maximum, range, or increment', () => {
    const largeValue = 987_654_321.123
    const state = commitPilotPrescription(reachPrescription(), {
      bloodFlowMlMin: largeValue,
      dialysateFlowMlHour: largeValue,
      patientFluidRemovalMlHour: largeValue,
    })

    expect(state.committedPrescription?.flows).toMatchObject({
      bloodFlowMlMin: largeValue,
      dialysateFlowMlHour: largeValue,
      patientFluidRemovalMlHour: largeValue,
      pbpFlowMlHour: 0,
      preReplacementFlowMlHour: 0,
      postReplacementFlowMlHour: 0,
      syringeFlowMlHour: 0,
      makeupFlowMlHour: 0,
    })
    expect(state.committedPrescription).toMatchObject({
      modality: 'cvvhd',
      anticoagulation: 'none',
      citrateRequestedButDisabled: false,
    })
    expect(prismaxDeviceAdapter.validatePrescription(state.committedPrescription!)).toEqual({
      valid: true,
      errors: [],
    })

    const invalid = prismaxPilotInterfaceReducer(reachPrescription(), {
      type: 'SET_PRESCRIPTION_VALUE',
      field: 'bloodFlowMlMin',
      value: Number.POSITIVE_INFINITY,
    })
    expect(invalid.prescriptionDraft.bloodFlowMlMin).toBeNull()
  })

  it('enforces all eight setup gates sequentially and requires explicit priming', () => {
    let state = createInitialPrismaxPilotInterfaceState()
    const skipped = prismaxPilotInterfaceReducer(state, {
      type: 'COMPLETE_SETUP_STEP',
      stepId: 'therapy',
    })
    expect(skipped).toBe(state)
    expect(prismaxPilotInterfaceReducer(state, { type: 'START_TREATMENT' })).toBe(state)

    state = commitPilotPrescription(reachPrescription())
    state = reduce(
      state,
      { type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' },
      { type: 'COMPLETE_SETUP_STEP', stepId: 'sets' },
      { type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' },
    )
    expect(selectPrismaxPilotInterface(state).activeStep?.id).toBe('prime')
    expect(
      prismaxPilotInterfaceReducer(state, { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' }),
    ).toBe(state)

    state = reduce(
      state,
      { type: 'START_PRIME' },
      { type: 'COMPLETE_PRIME' },
      { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' },
      { type: 'COMPLETE_SETUP_STEP', stepId: 'review' },
      { type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' },
    )
    expect(state.completedStepIds).toEqual(prismaxSetupSteps.map((step) => step.id))
    expect(selectPrismaxPilotInterface(state).canStartTreatment).toBe(true)
    state = prismaxPilotInterfaceReducer(state, { type: 'START_TREATMENT' })
    expect(state).toMatchObject({ screen: 'operations', treatmentState: 'running' })
  })

  it('uses an explicit stop dialog, makes End irreversible, and resets every stale field', () => {
    let state = prismaxPilotInterfaceReducer(reachReadyToStart(), { type: 'START_TREATMENT' })
    expect(prismaxPilotInterfaceReducer(state, { type: 'END_TREATMENT' })).toBe(state)
    state = prismaxPilotInterfaceReducer(state, { type: 'OPEN_STOP_DIALOG' })
    expect(state.stopDialogOpen).toBe(true)
    state = prismaxPilotInterfaceReducer(state, { type: 'END_TREATMENT' })
    expect(state).toMatchObject({ treatmentState: 'ended', stopDialogOpen: false })
    expect(prismaxPilotInterfaceReducer(state, { type: 'START_TREATMENT' })).toBe(state)

    const reset = prismaxPilotInterfaceReducer(state, { type: 'RESET_INTERFACE' })
    expect(reset).toEqual(createInitialPrismaxPilotInterfaceState())
    expect(reset).not.toBe(state)
    expect(reset.completedStepIds).toEqual([])
    expect(reset.prescriptionDraft).toEqual({
      bloodFlowMlMin: null,
      dialysateFlowMlHour: null,
      patientFluidRemovalMlHour: null,
    })
    expect(reset.committedPrescription).toBeNull()
    expect(reset.primeState).toBe('not-started')
    expect(reset.stopDialogOpen).toBe(false)
  })

  it('keeps alarm mapping explicitly deferred and acknowledgement separate from cause resolution', () => {
    const alarm: ActiveAlarm = {
      id: 'ACCESS_OBSTRUCTION:0:1',
      code: 'ACCESS_OBSTRUCTION',
      cause: 'access-obstruction',
      urgency: null,
      startedAtSeconds: 0,
      active: true,
      deviceMappingStatus: 'pending-device-adapter',
      reviewStatus: 'pending',
    }
    const mapped = prismaxDeviceAdapter.mapEngineAlarm(alarm)
    expect(mapped).toEqual({
      engineAlarmId: alarm.id,
      code: 'ACCESS_OBSTRUCTION',
      label: 'Engine alarm: ACCESS_OBSTRUCTION',
      priorityLabel: 'Device mapping pending',
      mappingReviewStatus: 'pending',
    })

    const engine = createInitialCrrtSimulationState()
    const device = prismaxDeviceAdapter.createInitialDeviceState()
    expect(
      prismaxDeviceAdapter.reduceDeviceAction(
        device,
        { type: 'ACKNOWLEDGE_ALARM', alarmId: alarm.id },
        { simulationTimeSeconds: 0, engineState: engine },
      ),
    ).toBe(device)
    expect(alarm.active).toBe(true)
    expect(alarm.cause).toBe('access-obstruction')
  })

  it('selects an honest adapter display and case-free operations display', () => {
    const alarm: ActiveAlarm = {
      id: 'POWER_INTERRUPTION:12:1',
      code: 'POWER_INTERRUPTION',
      cause: 'power-interruption',
      urgency: null,
      startedAtSeconds: 12,
      active: true,
      deviceMappingStatus: 'pending-device-adapter',
      reviewStatus: 'pending',
    }
    const engine = createInitialCrrtSimulationState()
    const display = prismaxDeviceAdapter.selectDisplayModel({
      ...engine,
      device: prismaxDeviceAdapter.createInitialDeviceState(),
      alarms: [alarm],
    })
    expect(display).toMatchObject({
      deviceId: 'prismax-aw8035-2xx',
      deliveryState: 'idle',
      adapterStatus: 'available-phase-3',
      alarms: [{ priorityLabel: 'Device mapping pending', mappingReviewStatus: 'pending' }],
    })

    const interfaceState = commitPilotPrescription(reachPrescription())
    const operations = selectPrismaxPilotOperationsDisplay(interfaceState)
    expect(operations.effluentPumpTargetMlHour).toBe(1_550)
    expect(operations.effluentDoseMlKgHour).toBeNull()
    expect(Object.values(operations.pressures).every((value) => value === null)).toBe(true)
  })

  it('rejects non-pilot modalities and disabled flow terms at the adapter boundary', () => {
    const configured = commitPilotPrescription(reachPrescription()).committedPrescription!
    const unsupported: ConfiguredPrescriptionState = {
      ...configured,
      modality: 'cvvhdf',
      flows: { ...configured.flows, preReplacementFlowMlHour: 10 },
    }
    expect(prismaxDeviceAdapter.validatePrescription(unsupported)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'PILOT_MODALITY_ONLY' }),
        expect.objectContaining({ code: 'PILOT_FLOW_TERMS_DISABLED' }),
      ]),
    })
  })
})
