import { getIcuScenario } from '../content'
import {
  ICU_SIMULATION_PROGRESS_STORAGE_KEY,
  ICU_SIMULATION_SESSION_STORAGE_KEY,
  applyIcuCommand,
  createDefaultIcuProgress,
  createIcuSimulation,
  createIcuSyntheticSession,
  createIcuWorkerRunner,
  parseIcuProgress,
  parseIcuSyntheticSession,
  recordIcuScenarioResult,
  resumeIcuSyntheticSession,
  serializeIcuProgress,
  type IcuCommand,
  type IcuSimulationState,
} from '../engine'

function runMastery(mode: 'practice' | 'assess'): IcuSimulationState {
  const scenario = getIcuScenario('septic-ards-aki')
  let state = createIcuSimulation(scenario, { mode, seed: 101 })
  const commands: readonly IcuCommand[] = [
    { type: 'diagnosis.commit', classification: 'distributive' },
    { type: 'assessment.order', assessmentId: 'bedside-exam' },
    { type: 'assessment.order', assessmentId: 'abg' },
    { type: 'assessment.order', assessmentId: 'lactate' },
    { type: 'care.perform', interventionId: 'antimicrobials' },
    { type: 'care.perform', interventionId: 'source-control' },
    { type: 'care.perform', interventionId: 'vasopressor-up' },
    {
      type: 'therapy.prepare',
      therapy: 'ventilator',
      configuration: 'volume-control',
    },
    { type: 'therapy.start', therapy: 'ventilator' },
    {
      type: 'therapy.adjust',
      therapy: 'ventilator',
      control: 'peep-cmh2o',
      value: 10,
    },
    { type: 'care.perform', interventionId: 'prone' },
    { type: 'therapy.prepare', therapy: 'crrt', configuration: 'cvvhd' },
    { type: 'therapy.start', therapy: 'crrt' },
    {
      type: 'therapy.adjust',
      therapy: 'crrt',
      control: 'patient-fluid-removal-ml-hour',
      value: 100,
    },
    { type: 'care.perform', interventionId: 'communicate-plan' },
    { type: 'time.advance', seconds: 60 },
    {
      type: 'patient.reassess',
      domains: ['hemodynamics', 'respiratory', 'renal'],
    },
    { type: 'time.advance', seconds: 10_740 },
    {
      type: 'patient.reassess',
      domains: ['hemodynamics', 'respiratory', 'renal'],
    },
    { type: 'session.complete' },
  ]
  for (const value of commands) state = applyIcuCommand(state, scenario, value)
  return state
}

describe('ICU scoring, replay, progress, and worker protocol', () => {
  it('requires longitudinal, ordered care before mastery', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    let clicked = createIcuSimulation(scenario, { mode: 'assess', seed: 100 })
    clicked = applyIcuCommand(clicked, scenario, {
      type: 'diagnosis.commit',
      classification: 'distributive',
    })
    clicked = applyIcuCommand(clicked, scenario, {
      type: 'patient.reassess',
      domains: ['hemodynamics', 'respiratory', 'renal'],
    })
    clicked = applyIcuCommand(clicked, scenario, { type: 'session.complete' })
    expect(clicked.outcome.mastery).toBe(false)
    expect(clicked.outcome.score.reassessment).toBe(0)

    const mastered = runMastery('assess')
    expect(mastered.outcome.score.total).toBe(100)
    expect(mastered.outcome.checkpointIdsCompleted).toHaveLength(2)
    expect(mastered.outcome.mastery).toBe(true)
  })

  it('scores the first Assess classification while preserving serial commitments', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    let state = createIcuSimulation(scenario, { mode: 'assess', seed: 102 })
    state = applyIcuCommand(state, scenario, {
      type: 'diagnosis.commit',
      classification: 'lv-cardiogenic',
    })
    state = applyIcuCommand(state, scenario, {
      type: 'diagnosis.commit',
      classification: 'distributive',
    })
    state = applyIcuCommand(state, scenario, { type: 'session.complete' })
    expect(state.diagnosis.commitments).toHaveLength(2)
    expect(state.performedActionIds).not.toContain('diagnosis:correct')
  })

  it('replays a synthetic session exactly and rejects extra persisted data', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    const state = runMastery('practice')
    const session = createIcuSyntheticSession(state)
    const restored = resumeIcuSyntheticSession(session, scenario)
    expect(restored).toEqual(state)

    const unsafe = JSON.stringify({ ...session, freeText: 'real patient note', waveforms: [1, 2] })
    expect(parseIcuSyntheticSession(unsafe)).toBeNull()

    const wrongTime: typeof session = {
      ...session,
      replay: {
        ...session.replay,
        commands: session.replay.commands.map((record, index) =>
          index === 1 ? { ...record, issuedAtSeconds: 999 } : record,
        ),
      },
    }
    expect(() => resumeIcuSyntheticSession(wrongTime, scenario)).toThrow()
  })

  it('keeps local progress allowlisted and reserves mastery for Assess', () => {
    const practice = runMastery('practice')
    let progress = recordIcuScenarioResult(createDefaultIcuProgress(), practice)
    expect(progress.completedScenarioIds).toContain('septic-ards-aki')
    expect(progress.masteredScenarioIds).not.toContain('septic-ards-aki')

    const assess = runMastery('assess')
    progress = recordIcuScenarioResult(progress, assess)
    expect(progress.masteredScenarioIds).toContain('septic-ards-aki')
    expect(parseIcuProgress(serializeIcuProgress(progress))).toEqual(progress)
    expect(
      parseIcuProgress(
        JSON.stringify({ ...progress, patientName: 'not allowed', waveform: [1, 2, 3] }),
      ),
    ).toBeNull()
    expect(ICU_SIMULATION_PROGRESS_STORAGE_KEY).toBe('icu-simulation-progress-v1')
    expect(ICU_SIMULATION_SESSION_STORAGE_KEY).toBe('icu-simulation-session-v1')
  })

  it('preserves completion after a debrief alarm acknowledgement', () => {
    const scenario = getIcuScenario('hemorrhagic')
    let state = createIcuSimulation(scenario, { mode: 'practice', seed: 103 })
    state = applyIcuCommand(state, scenario, { type: 'time.advance', seconds: 1 })
    const activeAlarm = state.alarms.find((alarm) => alarm.active)
    expect(activeAlarm).toBeDefined()
    state = applyIcuCommand(state, scenario, { type: 'session.complete' })
    expect(state.outcome.completed).toBe(true)
    state = applyIcuCommand(state, scenario, {
      type: 'alarm.acknowledge',
      alarmId: activeAlarm!.id,
    })
    expect(state.outcome.completed).toBe(true)
  })

  it('runs init, semantic commands, and advance through the worker-safe runner', () => {
    const runner = createIcuWorkerRunner(getIcuScenario)
    const beforeInit = runner.handle({ requestId: '0', type: 'advance', seconds: 1 })
    expect(beforeInit.type).toBe('error')
    const initialized = runner.handle({
      requestId: '1',
      type: 'init',
      scenarioId: 'septic-ards-aki',
      mode: 'practice',
      seed: 77,
    })
    expect(initialized.type).toBe('state')
    const advanced = runner.handle({ requestId: '2', type: 'advance', seconds: 60 })
    expect(advanced.type).toBe('state')
    if (advanced.type === 'state') expect(advanced.state.clock.elapsedSeconds).toBe(60)
  })

  it('restores strict synthetic sessions inside the worker runner', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    let state = createIcuSimulation(scenario, { mode: 'practice', seed: 78 })
    state = applyIcuCommand(state, scenario, { type: 'time.advance', seconds: 120 })
    const session = createIcuSyntheticSession(state)
    const runner = createIcuWorkerRunner(getIcuScenario)
    const restored = runner.handle({ requestId: 'restore-1', type: 'restore', session })
    expect(restored.type).toBe('state')
    if (restored.type === 'state') expect(restored.state).toEqual(state)

    const incompatible: typeof session = {
      ...session,
      replay: { ...session.replay, scenarioVersion: '9.9.9' },
    }
    expect(
      runner.handle({ requestId: 'restore-2', type: 'restore', session: incompatible }).type,
    ).toBe('error')
  })

  it('coalesces contiguous clock ticks and replays a long course exactly', () => {
    const scenario = getIcuScenario('septic-ards-aki')
    let state = createIcuSimulation(scenario, { mode: 'practice', seed: 79 })
    for (let second = 0; second < 3_000; second += 1)
      state = applyIcuCommand(state, scenario, { type: 'time.advance', seconds: 1 })
    expect(state.replay.commands).toHaveLength(1)
    expect(state.replay.commands[0]?.command).toEqual({ type: 'time.advance', seconds: 3_000 })
    expect(resumeIcuSyntheticSession(createIcuSyntheticSession(state), scenario)).toEqual(state)
  })

  it('stops at the authored course boundary without growing replay afterward', () => {
    const source = getIcuScenario('septic-ards-aki')
    const scenario = { ...source, durationHours: 1 }
    let state = createIcuSimulation(scenario, { mode: 'practice', seed: 80 })
    state = applyIcuCommand(state, scenario, { type: 'time.advance', seconds: 3_590 })
    state = applyIcuCommand(state, scenario, { type: 'time.advance', seconds: 900 })
    expect(state.clock.elapsedSeconds).toBe(3_600)
    expect(state.replay.commands).toHaveLength(1)
    expect(state.replay.commands[0]?.command).toEqual({ type: 'time.advance', seconds: 3_600 })
    const commandCount = state.replay.commands.length
    state = applyIcuCommand(state, scenario, { type: 'time.advance', seconds: 900 })
    expect(state.clock.elapsedSeconds).toBe(3_600)
    expect(state.replay.commands).toHaveLength(commandCount)
    expect(resumeIcuSyntheticSession(createIcuSyntheticSession(state), scenario)).toEqual(state)
  })
})
