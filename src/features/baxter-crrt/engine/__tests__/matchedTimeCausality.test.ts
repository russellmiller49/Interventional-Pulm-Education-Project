import { getBaxterCrrtCase } from '../../content/completeCases'
import { selectCrrtActualRunReview } from '../../actualRunReview'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionAction,
  type CrrtLearningSessionState,
} from '../learningSession'

/**
 * Matched-time behavior for the tolerance and access cases.
 *
 * CRRT-11's safe action carries its own one-hour observation interval, so a run
 * that performs it reaches a later clock than a run that does not. Comparing the
 * arms at "the same number of clicks" therefore compares different elapsed times,
 * which was the reported defect. These assertions run the real reducer and pin
 * both facts: the paths do separate, and they only separate interpretably once
 * the clock is matched.
 */

const HOUR = 3_600

function start(caseId: string): CrrtLearningSessionState {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId as never),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

function run(caseId: string, actions: readonly CrrtLearningSessionAction[]) {
  return actions.reduce(
    (session, action) => crrtLearningSessionReducer(session, action),
    start(caseId),
  )
}

const perform = (interventionId: string): CrrtLearningSessionAction => ({
  type: 'PERFORM_INTERVENTION',
  interventionId,
})
const advance = (seconds: number): CrrtLearningSessionAction => ({
  type: 'ADVANCE_TIME',
  seconds,
})

function tolerance(session: CrrtLearningSessionState) {
  const patient = session.simulation.patient
  if (patient.status !== 'configured') throw new Error('Expected a configured patient')
  return {
    elapsedSeconds: session.simulation.simulationTimeSeconds,
    stressIndex: Number(patient.hemodynamicStressIndex.toFixed(3)),
    reserveMl: Math.round(patient.intravascularReserveMl),
    meanArterialPressureMmHg: patient.meanArterialPressureMmHg,
    balanceMl: Math.round(session.simulation.deliveredTherapy.cumulativeWholePatientBalanceMl),
    criticalErrorIds: session.criticalErrorIds,
  }
}

describe('CRRT-11 matched-time comparison', () => {
  it('reproduces the unmatched clock: the safe action carries its own hour', () => {
    const noAction = run('CRRT-11', [advance(2 * HOUR)])
    const harmful = run('CRRT-11', [perform('crrt11-action-unsafe-candidate'), advance(2 * HOUR)])
    const safeSameClicks = run('CRRT-11', [
      perform('crrt11-action-assess'),
      perform('crrt11-action-safe-candidate'),
      advance(2 * HOUR),
    ])

    expect(noAction.simulation.simulationTimeSeconds).toBe(2 * HOUR)
    expect(harmful.simulation.simulationTimeSeconds).toBe(2 * HOUR)
    // Not a bug in the safe arm: the action's own authored effect advances an hour.
    expect(safeSameClicks.simulation.simulationTimeSeconds).toBe(3 * HOUR)
  })

  it('attributes that hour to the action rather than to the learner', () => {
    const safe = run('CRRT-11', [
      perform('crrt11-action-assess'),
      perform('crrt11-action-safe-candidate'),
      advance(HOUR),
    ])
    const accounting = selectCrrtActualRunReview(safe).timeAccounting
    expect(accounting.totalElapsedSeconds).toBe(2 * HOUR)
    expect(accounting.advancedByLearnerSeconds).toBe(HOUR)
    expect(accounting.advancedByCaseActionsSeconds).toBe(HOUR)
    expect(accounting.reconciled).toBe(true)
    expect(accounting.intervalActions).toEqual([
      {
        actionId: 'crrt11-action-safe-candidate',
        label: expect.any(String),
        atSeconds: 0,
        advanceSeconds: HOUR,
      },
    ])
  })

  it('separates no action, the corrective path and the harmful path at a matched two hours', () => {
    const noAction = tolerance(run('CRRT-11', [advance(2 * HOUR)]))
    const diagnosticOnly = tolerance(
      run('CRRT-11', [perform('crrt11-action-assess'), advance(2 * HOUR)]),
    )
    const safe = tolerance(
      run('CRRT-11', [
        perform('crrt11-action-assess'),
        perform('crrt11-action-safe-candidate'),
        advance(HOUR),
      ]),
    )
    const pause = tolerance(
      run('CRRT-11', [
        perform('crrt11-action-assess'),
        perform('crrt11-action-alternative-candidate'),
        advance(HOUR),
      ]),
    )
    const harmful = tolerance(
      run('CRRT-11', [perform('crrt11-action-unsafe-candidate'), advance(2 * HOUR)]),
    )

    for (const arm of [noAction, diagnosticOnly, safe, pause, harmful]) {
      expect(arm.elapsedSeconds).toBe(2 * HOUR)
      // The engine holds the supplied blood pressure on every path.
      expect(arm.meanArterialPressureMmHg).toBe(59)
    }

    // An assessment changes nothing, and says so by matching the untouched run.
    expect(diagnosticOnly).toEqual(noAction)

    expect(noAction.stressIndex).toBeCloseTo(0.76, 3)
    expect(safe.stressIndex).toBeCloseTo(0.48, 3)
    expect(pause.stressIndex).toBeCloseTo(0.48, 3)
    expect(harmful.stressIndex).toBeCloseTo(0.872, 3)
    expect(safe.stressIndex).toBeLessThan(noAction.stressIndex)
    expect(harmful.stressIndex).toBeGreaterThan(noAction.stressIndex)

    // The reserve is drawn down and never refilled, so a path that still holds it
    // spent none of it rather than having recovered any.
    expect(noAction.reserveMl).toBe(0)
    expect(harmful.reserveMl).toBe(0)
    expect(safe.reserveMl).toBe(100)
    expect(pause.reserveMl).toBe(100)

    expect(noAction.balanceMl).toBe(-320)
    expect(safe.balanceMl).toBe(-20)
    expect(pause.balanceMl).toBe(40)
    expect(harmful.balanceMl).toBe(-600)

    expect(harmful.criticalErrorIds).toEqual(['crrt11-critical-unsafe-candidate'])
    expect(safe.criticalErrorIds).toEqual([])
  })

  it('separates them at a matched three hours as well', () => {
    const noAction = tolerance(run('CRRT-11', [advance(3 * HOUR)]))
    const safe = tolerance(
      run('CRRT-11', [
        perform('crrt11-action-assess'),
        perform('crrt11-action-safe-candidate'),
        advance(2 * HOUR),
      ]),
    )
    const harmful = tolerance(
      run('CRRT-11', [perform('crrt11-action-unsafe-candidate'), advance(3 * HOUR)]),
    )
    for (const arm of [noAction, safe, harmful]) expect(arm.elapsedSeconds).toBe(3 * HOUR)
    expect(noAction.stressIndex).toBeCloseTo(0.8, 3)
    expect(safe.stressIndex).toBeCloseTo(0.36, 3)
    expect(harmful.stressIndex).toBeCloseTo(0.968, 3)
  })

  it('reaches the same state whether the clock moves in one step or three', () => {
    const oneStep = tolerance(run('CRRT-11', [advance(3 * HOUR)]))
    const threeSteps = tolerance(run('CRRT-11', [advance(HOUR), advance(HOUR), advance(HOUR)]))
    expect(threeSteps).toEqual(oneStep)
  })

  it('records two same-timestamp actions in order without inventing elapsed time', () => {
    const session = run('CRRT-11', [
      perform('crrt11-action-assess'),
      perform('crrt11-action-communicate'),
    ])
    expect(session.simulation.simulationTimeSeconds).toBe(0)
    const review = selectCrrtActualRunReview(session)
    expect(review.actions.map((action) => [action.atSeconds, action.reference])).toEqual([
      [0, 'crrt11-action-assess'],
      [0, 'crrt11-action-communicate'],
    ])
    expect(review.timeAccounting.totalElapsedSeconds).toBe(0)
    expect(review.timeAccounting.advancedByCaseActionsSeconds).toBe(0)
  })
})

describe('CRRT-13 correction, acknowledgement and downtime', () => {
  const toPattern: readonly CrrtLearningSessionAction[] = [
    perform('crrt13-assess-patient-device'),
    perform('crrt13-advance-to-pattern'),
  ]

  function circuit(session: CrrtLearningSessionState) {
    return {
      elapsedSeconds: session.simulation.simulationTimeSeconds,
      accessPressureMmHg: Math.round(
        session.simulation.circuit.pressures.accessPressureMmHg ?? NaN,
      ),
      activeFaults: session.simulation.scenario.activeFaults,
      activeAlarmCodes: session.simulation.alarms.filter((a) => a.active).map((a) => a.code),
      deliveredDose: Number(
        (session.simulation.deliveredTherapy.deliveredDoseMlKgHour ?? 0).toFixed(2),
      ),
      downtimeSeconds: session.simulation.deliveredTherapy.cumulativeDowntimeSeconds,
      criticalErrorIds: session.criticalErrorIds,
    }
  }

  it('distinguishes correction, diagnosis alone, acknowledgement alone and a harmful flow change at one clock', () => {
    const noAction = circuit(run('CRRT-13', [advance(1_800)]))
    const diagnosticOnly = circuit(
      run('CRRT-13', [...toPattern, perform('crrt13-inspect-access-path')]),
    )
    const corrective = circuit(
      run('CRRT-13', [
        ...toPattern,
        perform('crrt13-inspect-access-path'),
        perform('crrt13-pause-treatment'),
        perform('crrt13-reposition-access'),
        perform('crrt13-resume-treatment'),
        perform('crrt13-confirm-restored-delivery'),
      ]),
    )
    const acknowledgeOnly = circuit(
      run('CRRT-13', [
        ...toPattern,
        perform('crrt13-acknowledge-alert'),
        perform('crrt13-declare-resolved-after-ack'),
      ]),
    )
    const harmful = circuit(
      run('CRRT-13', [
        ...toPattern,
        perform('crrt13-increase-bfr-through-obstruction'),
        perform('crrt13-acknowledge-alert'),
        perform('crrt13-declare-resolved-after-ack'),
      ]),
    )

    for (const arm of [noAction, diagnosticOnly, corrective, acknowledgeOnly, harmful]) {
      expect(arm.elapsedSeconds).toBe(1_800)
    }

    // Inspecting the access path changes nothing, which is what a diagnostic action should do.
    expect(diagnosticOnly.accessPressureMmHg).toBe(noAction.accessPressureMmHg)
    expect(diagnosticOnly.activeFaults).toEqual(['access-obstruction'])

    // Correction clears the cause; acknowledgement does not.
    expect(corrective.accessPressureMmHg).toBe(-25)
    expect(corrective.activeFaults).toEqual([])
    expect(corrective.activeAlarmCodes).toEqual([])
    expect(acknowledgeOnly.accessPressureMmHg).toBe(-139)
    expect(acknowledgeOnly.activeFaults).toEqual(['access-obstruction'])
    expect(acknowledgeOnly.activeAlarmCodes).toEqual(['ACCESS_OBSTRUCTION'])
    expect(acknowledgeOnly.criticalErrorIds).toContain('crrt13-critical-acknowledgement-only')

    // Raising blood flow through the obstruction makes access pressure much more negative.
    expect(harmful.accessPressureMmHg).toBe(-211)
    expect(harmful.activeFaults).toEqual(['access-obstruction'])
    expect(harmful.criticalErrorIds).toContain('crrt13-critical-increase-bfr')

    // Delivered dose and downtime are identical on every arm, because no arm
    // spent simulated time paused. That is the accounting, not a missing penalty.
    for (const arm of [noAction, diagnosticOnly, corrective, acknowledgeOnly, harmful]) {
      expect(arm.deliveredDose).toBeCloseTo(22.14, 2)
      expect(arm.downtimeSeconds).toBe(0)
    }
  })

  it('records the same-timestamp pause and resume as zero downtime and says why', () => {
    const session = run('CRRT-13', [
      ...toPattern,
      perform('crrt13-inspect-access-path'),
      perform('crrt13-pause-treatment'),
      perform('crrt13-reposition-access'),
      perform('crrt13-resume-treatment'),
    ])
    const review = selectCrrtActualRunReview(session)
    expect(review.interruptions).toMatchObject({
      pauseCount: 1,
      resumeCount: 1,
      downtimeSeconds: 0,
      pausedWithoutElapsedTime: true,
    })
  })

  it('charges real downtime when the learner advances the clock while delivery is paused', () => {
    const session = run('CRRT-13', [
      ...toPattern,
      perform('crrt13-inspect-access-path'),
      perform('crrt13-pause-treatment'),
      advance(600),
      perform('crrt13-reposition-access'),
      perform('crrt13-resume-treatment'),
    ])
    const review = selectCrrtActualRunReview(session)
    expect(review.interruptions).toMatchObject({
      pauseCount: 1,
      resumeCount: 1,
      downtimeSeconds: 600,
      pausedWithoutElapsedTime: false,
    })
    expect(session.simulation.simulationTimeSeconds).toBe(2_400)
    expect(session.simulation.deliveredTherapy.deliveredDoseMlKgHour).toBeCloseTo(16.61, 2)
  })

  it('keeps earlier harmful history after a later recovery', () => {
    const session = run('CRRT-13', [
      ...toPattern,
      perform('crrt13-increase-bfr-through-obstruction'),
      perform('crrt13-inspect-access-path'),
      perform('crrt13-pause-treatment'),
      perform('crrt13-reposition-access'),
      perform('crrt13-resume-treatment'),
    ])
    expect(session.simulation.scenario.activeFaults).toEqual([])
    expect(session.criticalErrorIds).toContain('crrt13-critical-increase-bfr')
    const review = selectCrrtActualRunReview(session)
    expect(review.unsafeActionsPerformed.map((entry) => entry.actionId)).toContain(
      'crrt13-increase-bfr-through-obstruction',
    )
  })
})

describe('CRRT-05 pre/post replacement split', () => {
  it('changes only the two flow terms, with no rounded difference hidden anywhere', () => {
    const baseline = run('CRRT-05', [advance(HOUR)])
    const split = run('CRRT-05', [
      perform('crrt05-action-assess'),
      perform('crrt05-action-safe-candidate'),
      advance(HOUR),
    ])

    const flowsBefore = baseline.simulation.prescription
    const flowsAfter = split.simulation.prescription
    if (flowsBefore.status !== 'configured' || flowsAfter.status !== 'configured') {
      throw new Error('Expected configured prescriptions')
    }
    expect(flowsBefore.flows.preReplacementFlowMlHour).toBe(0)
    expect(flowsBefore.flows.postReplacementFlowMlHour).toBe(1_200)
    expect(flowsAfter.flows.preReplacementFlowMlHour).toBe(900)
    expect(flowsAfter.flows.postReplacementFlowMlHour).toBe(300)
    // Total replacement flow is unchanged, so the split is the only change asked for.
    expect(
      flowsAfter.flows.preReplacementFlowMlHour + flowsAfter.flows.postReplacementFlowMlHour,
    ).toBe(flowsBefore.flows.preReplacementFlowMlHour + flowsBefore.flows.postReplacementFlowMlHour)

    // The delivery continues after the split: CRRT-02 hung the pre-filter source
    // bag the split needs, and that repair is still in place.
    expect(split.simulation.device.deliveryState).toBe('running')
    expect(split.simulation.deliveredTherapy.deliveredDoseMlKgHour).toBeGreaterThan(0)
    expect(split.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(0)

    // Every other computed quantity is bit-identical, not merely close. The
    // outputs match because nothing in the model couples them to the split — not
    // because a difference is being lost to rounding.
    const after = split.simulation
    const before = baseline.simulation
    expect(after.deliveredTherapy.deliveredDoseMlKgHour).toBe(
      before.deliveredTherapy.deliveredDoseMlKgHour,
    )
    expect(after.deliveredTherapy.prescribedEffluentDoseMlKgHour).toBe(
      before.deliveredTherapy.prescribedEffluentDoseMlKgHour,
    )
    expect(after.deliveredTherapy.cumulativeActualEffluentMl).toBe(
      before.deliveredTherapy.cumulativeActualEffluentMl,
    )
    expect(after.deliveredTherapy.cumulativeWholePatientBalanceMl).toBe(
      before.deliveredTherapy.cumulativeWholePatientBalanceMl,
    )
    expect(after.deliveredTherapy.filtrationFraction).toBe(
      before.deliveredTherapy.filtrationFraction,
    )
    expect(after.circuit.pressures).toEqual(before.circuit.pressures)
    expect(after.circuit.filter).toEqual(before.circuit.filter)
  })

  it('reaches the same state whether the split precedes or follows the hour', () => {
    const splitFirst = run('CRRT-05', [
      perform('crrt05-action-assess'),
      perform('crrt05-action-safe-candidate'),
      advance(HOUR),
    ])
    const hourFirst = run('CRRT-05', [
      advance(HOUR),
      perform('crrt05-action-assess'),
      perform('crrt05-action-safe-candidate'),
    ])
    expect(hourFirst.simulation.circuit.pressures).toEqual(splitFirst.simulation.circuit.pressures)
    expect(hourFirst.simulation.deliveredTherapy.deliveredDoseMlKgHour).toBe(
      splitFirst.simulation.deliveredTherapy.deliveredDoseMlKgHour,
    )
  })
})

describe('CRRT-15 and CRRT-16 history, plan and current run', () => {
  it('runs CRRT-16 exactly as CRRT-15 does, because its failed circuits are history only', () => {
    const fifteen = run('CRRT-15', [advance(6 * HOUR)]).simulation
    const sixteen = run('CRRT-16', [advance(6 * HOUR)]).simulation
    expect(sixteen.circuit.pressures).toEqual(fifteen.circuit.pressures)
    expect(sixteen.circuit.filter).toEqual(fifteen.circuit.filter)
    expect(sixteen.deliveredTherapy.deliveredDoseMlKgHour).toBe(
      fifteen.deliveredTherapy.deliveredDoseMlKgHour,
    )
    expect(sixteen.deliveredTherapy.cumulativeDowntimeSeconds).toBe(0)
  })

  it('leaves CRRT-16 unchanged by its own plan: no action carries an effect', () => {
    for (const intervention of getBaxterCrrtCase('CRRT-16').interventions) {
      expect(intervention.effects).toEqual([])
    }
    const planned = run('CRRT-16', [
      perform('crrt16-action-assess'),
      perform('crrt16-action-safe-candidate'),
      perform('crrt16-action-communicate'),
    ])
    const untouched = start('CRRT-16')
    expect(planned.simulation.simulationTimeSeconds).toBe(0)
    expect(planned.simulation.circuit.pressures).toEqual(untouched.simulation.circuit.pressures)
    expect(planned.simulation.circuit.filter).toEqual(untouched.simulation.circuit.filter)
    expect(planned.simulation.scenario.activeFaults).toEqual(
      untouched.simulation.scenario.activeFaults,
    )
    // A plan-only case carries no observation interval, so its clock never moves.
    expect(selectCrrtActualRunReview(planned).timeAccounting.advancedByCaseActionsSeconds).toBe(0)
  })

  it('keeps the CRRT-15 six-hour filter trend at the small value the model produces', () => {
    const session = run('CRRT-15', [advance(6 * HOUR)])
    const start15 = start('CRRT-15')
    const before = start15.simulation.circuit.pressures.filterPressureMmHg ?? NaN
    const after = session.simulation.circuit.pressures.filterPressureMmHg ?? NaN
    expect(before).toBeCloseTo(70, 3)
    expect(after - before).toBeCloseTo(0.3744, 4)
  })
})
