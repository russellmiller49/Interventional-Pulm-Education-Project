import {
  createCrrtOperationalRun,
  crrtOperationalRunReducer,
  crrtOperationalTaskComplete,
  nextCrrtOperationalCommand,
  crrtRecordedDeliveryIntervals,
  crrtRecordedFluidChart,
  type CrrtOperationalRun,
  type CrrtLearnOperation,
} from '../operationalModel'
import {
  crrtLearnAttemptReducer,
  createCrrtLearnAttempt,
  crrtCurrentTaskIdentity,
} from '../learnController'
import { crrtLearnTasks, crrtLearnTaskVersion } from '../content/learnTasks'
import { CRRT_ADVANCED_VERSION } from '../content/advancedLessons'
import { CRRT_FOUNDATION_VERSION } from '../learnEvidence'
import { CRRT_OPERATIONAL_VERSION } from '../content/operationalLessons'
import { baxterCrrtLearnerCases } from '../content/learnerRegistry'

function finishOperation(run: CrrtOperationalRun, operation: CrrtLearnOperation) {
  for (let guard = 0; guard < 10; guard++) {
    const command = nextCrrtOperationalCommand(run, operation)
    if (!command) return run
    run = crrtOperationalRunReducer(run, operation, { type: 'command', id: command.id })
  }
  throw new Error('Unbounded command sequence')
}
describe('bounded integration of the unchanged CRRT-14 engine case', () => {
  it.each(['correct', 'defer'] as const)(
    'records the %s branch, causal observation and common fluid interval',
    (integrationPlan) => {
      let run = createCrrtOperationalRun('integration')
      expect(run.session.caseDefinition).toBe(
        baxterCrrtLearnerCases.find((c) => c.id === 'CRRT-14'),
      )
      const initial = run.session.simulation
      expect(crrtOperationalTaskComplete(run, 'integration-entry')).toBe(false)
      // An out-of-sequence correction cannot enter the session.
      expect(
        crrtOperationalRunReducer(run, 'integration-entry', {
          type: 'command',
          id: 'reposition-access',
        }),
      ).toBe(run)
      run = finishOperation(run, 'integration-entry')
      expect(run.session.simulation.simulationTimeSeconds).toBe(1800)
      expect(run.session.simulation.circuit.pressures.returnPressureMmHg!).toBeGreaterThan(
        initial.circuit.pressures.returnPressureMmHg!,
      )
      expect(run.session.simulation.circuit.flows).toEqual(initial.circuit.flows)
      const beforeInspection = run.session.simulation
      run = crrtOperationalRunReducer(run, 'integration-inspect', {
        type: 'command',
        id: 'inspect-access-path',
      })
      expect(run.session.simulation).toBe(beforeInspection)
      run = finishOperation(run, 'integration-inspect')
      expect(run.session.simulation.simulationTimeSeconds).toBe(2400)
      expect(run.session.simulation.deliveredTherapy.cumulativeActualEffluentMl).toBeCloseTo(775)
      expect(run.session.simulation.device.bloodPumpRunning).toBe(false)
      expect(nextCrrtOperationalCommand(run, 'integration-action')).toBeNull()
      run = { ...run, integrationPlan }
      run = finishOperation(run, 'integration-action')
      expect(run.session.simulation.simulationTimeSeconds).toBe(3600)
      const intervals = crrtRecordedDeliveryIntervals(run)
      const pause = intervals.find((i) => i.startSeconds === 1800)!
      expect(pause.effluentMl).toBe(0)
      expect(pause.removalMl).toBe(0)
      expect(pause.externalInputMl).toBeGreaterThan(0)
      const chart = crrtRecordedFluidChart(run.session)
      expect(chart.externalInputMl).toBeCloseTo(190)
      expect(chart.urineMl).toBeCloseTo(15)
      expect(chart.balanceMl).toBeCloseTo(integrationPlan === 'correct' ? 133.333333 : 150)
      expect(run.session.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(
        integrationPlan === 'correct' ? 600 : 1800,
      )
      expect(run.session.simulation.device.deliveryState).toBe(
        integrationPlan === 'correct' ? 'running' : 'paused',
      )
      expect(crrtOperationalTaskComplete(run, 'integration-balance')).toBe(true)
      const wrongTask = crrtOperationalRunReducer(run, 'integration-balance', {
        type: 'device',
        action: { type: 'START_TREATMENT' },
      })
      expect(wrongTask).toBe(run)
    },
  )
  it('does not change A/B content versions or create state from old completions', () => {
    expect(crrtLearnTaskVersion('crrt-prescription-dosing')).toBe(CRRT_FOUNDATION_VERSION)
    expect(crrtLearnTaskVersion('crrt-fluid-liberation')).toBe(CRRT_OPERATIONAL_VERSION)
    expect(crrtLearnTaskVersion('crrt-pressure-profile-integration')).toBe(CRRT_ADVANCED_VERSION)
    const state = createCrrtLearnAttempt('crrt-pressure-profile-integration', 'new')
    expect(state.evidence).toEqual([])
    expect(state.run?.session.simulation.simulationTimeSeconds).toBe(0)
    expect(
      crrtLearnAttemptReducer(state, {
        type: 'operation',
        identity: { ...crrtCurrentTaskIdentity(state), attemptId: 'stale' },
        action: { type: 'command', id: 'assess-patient-device' },
      }),
    ).toBe(state)
  })
  it('derives the run branch from the retained first valid plan, rejecting changed or forged callbacks', () => {
    let run = finishOperation(createCrrtOperationalRun('integration'), 'integration-entry')
    run = finishOperation(run, 'integration-inspect')
    const base = createCrrtLearnAttempt('crrt-pressure-profile-integration', 'first')
    const taskIndex = crrtLearnTasks[base.lessonId]!.findIndex((t) => t.id === 'case-plan')
    let state = { ...base, run, taskIndex }
    const evidence = {
      ...crrtCurrentTaskIdentity(state),
      mode: 'independent' as const,
      response: 'defer',
      correct: true,
      feedbackDisplayed: false,
      reviewed: false,
    }
    state = crrtLearnAttemptReducer(state, { type: 'evidence', evidence }) as typeof state
    expect(
      crrtLearnAttemptReducer(state, {
        type: 'complete',
        identity: evidence,
        evidence: { ...evidence, response: 'correct', reviewed: true, feedbackDisplayed: true },
      }),
    ).toBe(state)
    expect(
      crrtLearnAttemptReducer(state, {
        type: 'evidence',
        evidence: { ...evidence, response: 'unsafe-flow', correct: true },
      }),
    ).toBe(state)
    const next = crrtLearnAttemptReducer(state, {
      type: 'complete',
      identity: evidence,
      evidence: { ...evidence, reviewed: true, feedbackDisplayed: true },
    })
    expect(next.run?.integrationPlan).toBe('defer')
    expect(next.evidence[0].response).toBe('defer')
  })
})
