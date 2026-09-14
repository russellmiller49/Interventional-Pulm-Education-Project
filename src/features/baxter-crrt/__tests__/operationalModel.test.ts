import {
  createCrrtOperationalRun,
  crrtReferenceSetupActions,
  crrtOperationalRunReducer,
  nextCrrtOperationalCommand,
  crrtOperationalTaskComplete,
  crrtRecordedDeliveryIntervals,
  crrtRecordedFluidChart,
  crrtBoundedObservationSeconds,
  crrtValidBalanceResponse,
  type CrrtOperationalRun,
  type CrrtLearnOperation,
  selectCrrtOperationalDisplay,
} from '../operationalModel'
import {
  createCrrtLearnAttempt,
  crrtCurrentTaskIdentity,
  crrtLearnAttemptReducer,
} from '../learnController'
import {
  crrtMakeupRunningState,
  crrtPriorMakeupThenZeroState,
} from '../engine/testSupport/cumulativeFluidStates'
import { selectPrismaxPilotCaseOperationsDisplay } from '../engine/deviceAdapters/prismax'
import { CRRT_FOUNDATION_VERSION, type CrrtLearnEvidence } from '../learnEvidence'
import { CRRT_OPERATIONAL_VERSION } from '../content/operationalLessons'

function performNext(run: CrrtOperationalRun, op: CrrtLearnOperation) {
  const command = nextCrrtOperationalCommand(run, op)
  if (!command) throw new Error(`Missing command for ${op}`)
  const next = crrtOperationalRunReducer(run, op, { type: 'command', id: command.id })
  if (next === run) throw new Error(`Rejected command ${command.id}`)
  return next
}
function finishOperation(run: CrrtOperationalRun, op: CrrtLearnOperation) {
  for (let n = 0; n < 20 && !crrtOperationalTaskComplete(run, op); n++) run = performNext(run, op)
  expect(crrtOperationalTaskComplete(run, op)).toBe(true)
  return run
}
function reviewed(state: ReturnType<typeof createCrrtLearnAttempt>): CrrtLearnEvidence {
  return {
    ...crrtCurrentTaskIdentity(state),
    mode: 'guided',
    response: 'reviewed',
    correct: null,
    feedbackDisplayed: true,
    reviewed: true,
  }
}

describe('Learn operations using the current session and device adapter', () => {
  it('keeps drafts, applied settings, priming and actual delivery distinct', () => {
    let run = createCrrtOperationalRun('workflow')
    const fixturePrescription = run.session.simulation.prescription
    expect(run.session.interfaceState.committedPrescription).toBeNull()
    expect(selectCrrtOperationalDisplay(run).flows).toBeNull()
    for (const action of crrtReferenceSetupActions) {
      run = crrtOperationalRunReducer(run, 'setup', { type: 'device', action })
      expect(run.session.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBe(0)
      if (action.type === 'SET_PRESCRIPTION_VALUE') {
        expect(run.session.simulation.prescription).toEqual(fixturePrescription)
        expect(selectCrrtOperationalDisplay(run).flows).toBeNull()
      }
      if (action.type === 'COMPLETE_PRIME') {
        expect(run.session.simulation.device.deliveryState).toBe('idle')
        expect(run.session.simulation.prescription.status).toBe('configured')
      }
    }
    expect(crrtOperationalTaskComplete(run, 'setup')).toBe(true)
    const applied = selectPrismaxPilotCaseOperationsDisplay(
      run.session.interfaceState,
      run.session.simulation,
    )
    expect(applied.flows).toMatchObject({
      bloodFlowMlMin: 120,
      dialysateFlowMlHour: 1800,
      patientFluidRemovalMlHour: 100,
    })
    run = finishOperation(run, 'normal')
    expect(run.session.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBeCloseTo(475)
    expect(run.session.simulation.deliveredTherapy.chartingWindowSeconds).toBe(900)
    expect(crrtRecordedFluidChart(run.session).removalMl).toBeCloseTo(25)
  })

  it('records acknowledgement without correcting the cause, then observes paused and resumed delivery', () => {
    let run = finishOperation(createCrrtOperationalRun('access'), 'alarm-arrival')
    const before = run.session.simulation
    expect(before.simulationTimeSeconds).toBe(1800)
    expect(before.alarms[0].acknowledgedAtSeconds).toBeUndefined()
    expect(before.device.bloodPumpRunning).toBe(true)
    run = performNext(run, 'alarm-repair')
    expect(run.session.simulation.alarms[0].acknowledgedAtSeconds).toBe(1800)
    expect(run.session.simulation.alarms[0].active).toBe(true)
    expect(run.session.simulation.circuit.pressures).toEqual(before.circuit.pressures)
    expect(run.session.simulation.device).toEqual(before.device)
    expect(run.session.simulation.deliveredTherapy).toEqual(before.deliveredTherapy)
    expect(run.session.timeline.at(-1)?.type).toBe('alarm-acknowledged')
    run = performNext(run, 'alarm-repair') // inspect
    run = performNext(run, 'alarm-repair') // deliberate pause
    const paused = run.session.simulation
    expect(paused.device.bloodPumpRunning).toBe(false)
    expect(paused.device.fluidPumpsRunning).toBe(false)
    run = performNext(run, 'alarm-repair') // observe paused
    expect(run.session.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBe(
      before.deliveredTherapy.cumulativeActualEffluentMl,
    )
    expect(run.session.simulation.deliveredTherapy.fluidLedger.maintenanceInputMl).toBeGreaterThan(
      paused.deliveredTherapy.fluidLedger.maintenanceInputMl,
    )
    expect(run.session.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(600)
    run = finishOperation(run, 'alarm-repair')
    expect(run.session.simulation.alarms).toHaveLength(0)
    expect(run.session.simulation.alarmHistory[0]).toMatchObject({
      acknowledgedAtSeconds: 1800,
      resolvedAtSeconds: 2400,
    })
    expect(run.session.simulation.device.deliveryState).toBe('paused')
    run = finishOperation(run, 'alarm-verify')
    expect(run.session.simulation.simulationTimeSeconds).toBe(3000)
    expect(run.session.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(600)
    const rows = crrtRecordedDeliveryIntervals(run)
    expect(rows.map((r) => r.downtimeSeconds)).toEqual([0, 600, 0])
    expect(rows[1].effluentMl).toBe(0)
    expect(rows[2].effluentMl).toBeGreaterThan(0)
  })

  it('stops observations at events and calculates interval volumes with downtime from the actual record', () => {
    let run = createCrrtOperationalRun('delivery')
    expect(crrtBoundedObservationSeconds(run.session, 86400)).toBe(7200)
    run = performNext(run, 'delivery-timeline')
    run = performNext(run, 'delivery-timeline')
    expect(run.session.simulation.device.deliveryState).toBe('paused')
    expect(run.session.simulation.simulationTimeSeconds).toBe(7200)
    run = performNext(run, 'delivery-timeline')
    expect(run.session.simulation.device.deliveryState).toBe('running')
    expect(run.session.simulation.simulationTimeSeconds).toBe(10800)
    run = finishOperation(run, 'delivery-timeline')
    const rows = crrtRecordedDeliveryIntervals(run)
    expect(rows).toHaveLength(4)
    expect(rows[2]).toMatchObject({ effluentMl: 0, removalMl: 0, downtimeSeconds: 3600 })
    expect(rows[2].externalInputMl).toBeCloseTo(170)
    expect(rows[2].externalOutputMl).toBeCloseTo(20)
    const chart = crrtRecordedFluidChart(run.session)
    expect(chart.externalInputMl).toBeCloseTo(680)
    expect(chart.urineMl).toBeCloseTo(80)
    expect(chart.removalMl).toBeCloseTo(300)
    expect(chart.balanceMl).toBeCloseTo(300)
    expect(chart.removalMl).not.toBe(100 * 4)
    expect(crrtRecordedFluidChart(run.session, true)).toMatchObject({
      urineMl: null,
      balanceMl: null,
    })
  })

  it('separates immediate settings from subsequent patient proxies without changing other flows or history', () => {
    let run = createCrrtOperationalRun('fluid')
    const before = run.session.simulation
    run = finishOperation(run, 'net-change')
    expect(run.session.simulation.circuit.flows).toEqual({
      ...before.circuit.flows,
      patientFluidRemovalMlHour: 350,
    })
    expect(run.session.simulation.patient).toEqual(before.patient)
    expect(run.session.simulation.deliveredTherapy.fluidLedger).toEqual(
      before.deliveredTherapy.fluidLedger,
    )
    run = finishOperation(run, 'net-observe')
    expect(run.session.simulation.simulationTimeSeconds).toBe(1800)
    expect(crrtRecordedFluidChart(run.session).removalMl).toBeCloseTo(175)
    expect(crrtRecordedFluidChart(run.session).balanceMl).toBeCloseTo(100)
    expect(run.session.simulation.patient).not.toEqual(before.patient)
    expect(run.snapshots[0].simulation).toEqual(before)
  })

  it('rejects wrong-stage commands and premature completion; keeps foundation versions and stale run identities isolated', () => {
    const run = createCrrtOperationalRun('access')
    expect(
      crrtOperationalRunReducer(run, 'alarm-arrival', {
        type: 'command',
        id: 'crrt13-resume-treatment',
      }),
    ).toBe(run)
    expect(
      crrtOperationalRunReducer(run, 'alarm-arrival', {
        type: 'device',
        action: { type: 'END_TREATMENT' },
      }),
    ).toBe(run)
    const a = createCrrtLearnAttempt('crrt-prescription-dosing', 'old-a')
    expect(crrtCurrentTaskIdentity(a).contentVersion).toBe(CRRT_FOUNDATION_VERSION)
    let b = createCrrtLearnAttempt('crrt-alarms-troubleshooting', 'new-b')
    expect(crrtCurrentTaskIdentity(b).contentVersion).toBe(CRRT_OPERATIONAL_VERSION)
    b = crrtLearnAttemptReducer(b, {
      type: 'complete',
      identity: crrtCurrentTaskIdentity(b),
      evidence: reviewed(b),
    })
    expect(b.run?.id).toBe('workflow')
    expect(
      crrtLearnAttemptReducer(b, {
        type: 'complete',
        identity: crrtCurrentTaskIdentity(b),
        evidence: reviewed(b),
      }),
    ).toBe(b)
    expect(
      crrtLearnAttemptReducer(b, {
        type: 'operation',
        identity: { ...crrtCurrentTaskIdentity(b), attemptId: 'stale' },
        action: { type: 'device', action: { type: 'SELECT_NEW_PATIENT' } },
      }),
    ).toBe(b)
  })

  it('withholds exact balance under the existing makeup gate, including after historical delivery', () => {
    const run = createCrrtOperationalRun('fluid')
    for (const simulation of [crrtMakeupRunningState(), crrtPriorMakeupThenZeroState()]) {
      const session = { ...run.session, simulation }
      expect(crrtRecordedFluidChart(session)).toMatchObject({ removalMl: null, balanceMl: null })
      expect(crrtRecordedFluidChart(session).withheldReason).toBeTruthy()
    }
  })

  it('rejects blank, nonfinite and malformed numeric answers, including forged reviewed completion', () => {
    for (const raw of ['', ' ', 'Infinity', 'NaN', '1e309', '4 hours', '--20'])
      expect(crrtValidBalanceResponse(raw)).toBeNull()
    expect(crrtValidBalanceResponse('-50.5')).toBe(-50.5)
    let b = createCrrtLearnAttempt('crrt-fluid-liberation', 'balance-b')
    b = { ...b, taskIndex: 2, run: finishOperation(b.run!, 'delivery-timeline') }
    const identity = crrtCurrentTaskIdentity(b)
    const bad = {
      ...reviewed(b),
      response: 'balance:NaN',
      inputs: { answerMl: NaN, expectedBalanceMl: 300 },
      correct: false,
    }
    expect(crrtLearnAttemptReducer(b, { type: 'evidence', evidence: bad })).toBe(b)
    expect(crrtLearnAttemptReducer(b, { type: 'complete', identity, evidence: bad })).toBe(b)
    const expected = crrtRecordedFluidChart(b.run!.session).balanceMl!
    const wrong = {
      ...reviewed(b),
      mode: 'independent' as const,
      response: 'balance:400',
      inputs: { answerMl: 400, expectedBalanceMl: expected },
      correct: false,
    }
    b = crrtLearnAttemptReducer(b, { type: 'complete', identity, evidence: wrong })
    expect(b.taskIndex).toBe(3)
    expect(b.evidence[0]).toMatchObject({ response: 'balance:400', correct: false, reviewed: true })
  })
})
