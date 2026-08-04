import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { createInitialSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState, SimulationAction } from '../engine/types'

/**
 * The one state an air-embolism resumption must never render.
 *
 * Both near-patient limbs open with the centrifugal pump stopped means the patient is continuous
 * with a circuit that is not moving blood — and a centrifugal head is non-occlusive, so nothing is
 * holding a column in place. The module used to walk learners straight through it: open drainage,
 * open return, and only then reset the console latch to restart the pump.
 *
 * The owner decision was to stop teaching any particular clamp/pump/reset choreography and to make
 * resumption one bounded action instead. These tests hold that line for both tracks, on the guided
 * lessons and on the clinical cases, and on the reducer directly.
 */

const BUBBLE_LESSONS = ['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const
const BUBBLE_CASES = [
  'clinical-vv-circuit-air-embolism',
  'va-clinical-circuit-air-embolism',
] as const

interface Frame {
  readonly label: string
  readonly state: EcmoSimulationState
}

function bothLimbsOpenWithPumpStopped(state: EcmoSimulationState): boolean {
  return (
    !state.circuit.drainageClampClosed &&
    !state.circuit.returnClampClosed &&
    !state.device.pumpRunning
  )
}

/**
 * Every frame the lesson's own authored actions produce, in order.
 *
 * The lesson is walked exactly as a learner walks it — one step's actions at a time, through the
 * real reducer — so this measures what the module teaches rather than what a hand-built sequence
 * could reach.
 */
function walkLesson(scenarioId: string): readonly Frame[] {
  const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
  if (!lesson) throw new Error(`No guided lesson for ${scenarioId}`)
  let state = createInitialSimulationState(scenarioId, 'guided')
  const frames: Frame[] = [{ label: 'initial', state }]
  for (const step of lesson.steps) {
    // The transfer step deliberately loads a different case; the resumption is over by then.
    if (step.transferScenarioId) break
    for (const action of step.actions) {
      state = ecmoSimulationReducer(state, action)
      frames.push({ label: `${step.id} · ${action.type}`, state })
    }
    // A step the learner completes is followed by the clock moving on, so the settled frame each
    // step leaves behind is checked too.
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    frames.push({ label: `${step.id} · settled`, state })
  }
  return frames
}

/** Frames from the moment the air source is recorded as corrected. */
function framesAfterCorrection(frames: readonly Frame[]): readonly Frame[] {
  const index = frames.findIndex((frame) =>
    frame.state.scenario.correctedFaults.includes('arterial-bubble'),
  )
  return index < 0 ? [] : frames.slice(index)
}

/** The bubble event is injected at four modelled seconds, and guided cases open with a paused clock. */
const advanceToEvent: readonly SimulationAction[] = [
  { type: 'STEP' },
  { type: 'STEP' },
  { type: 'STEP' },
  { type: 'STEP' },
]

function applyAll(
  scenarioId: string,
  actions: readonly SimulationAction[],
  mode: EcmoSimulationState['simulationMode'] = 'guided',
): readonly Frame[] {
  let state = createInitialSimulationState(scenarioId, mode)
  const frames: Frame[] = [{ label: 'initial', state }]
  for (const action of actions) {
    state = ecmoSimulationReducer(state, action)
    frames.push({ label: action.type, state })
  }
  return frames
}

describe('the air-resumption safety invariant', () => {
  it.each(BUBBLE_LESSONS)(
    '%s never walks back through both limbs open with the pump stopped once the air is corrected',
    (scenarioId) => {
      /*
       * Scoped to the resumption on purpose.
       *
       * Immediately after the event the patient IS continuous with both limbs of a stopped circuit
       * — that is the hazard this drill exists to teach, and the reason the first taught act is to
       * clamp. What must never happen is the module walking the learner back through that state on
       * the way out, which is exactly what the old open-drainage / open-return / reset order did.
       */
      const frames = walkLesson(scenarioId)
      const correctedAt = frames.findIndex((frame) =>
        frame.state.scenario.correctedFaults.includes('arterial-bubble'),
      )
      expect(correctedAt).toBeGreaterThan(0)
      const offending = frames
        .slice(correctedAt)
        .filter((frame) => bothLimbsOpenWithPumpStopped(frame.state))
      expect(offending.map((frame) => frame.label)).toEqual([])
    },
  )

  it.each(BUBBLE_LESSONS)('%s corrects the air source before it resumes support', (scenarioId) => {
    const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
    if (!lesson) throw new Error(`No guided lesson for ${scenarioId}`)
    const actions = lesson.steps.flatMap((step) => step.actions)
    const correctIndex = actions.findIndex(
      (action) => action.type === 'CORRECT_FAULT' && action.fault === 'arterial-bubble',
    )
    const resumeIndex = actions.findIndex((action) => action.type === 'RESUME_SUPPORT_AFTER_BUBBLE')
    expect(correctIndex).toBeGreaterThanOrEqual(0)
    expect(resumeIndex).toBeGreaterThan(correctIndex)
  })

  it.each(BUBBLE_LESSONS)(
    '%s teaches no clamp choreography after the air source is corrected',
    (scenarioId) => {
      // The owner decision: past isolation, de-airing and source correction, this module does not
      // teach one universal clamp/pump/reset order, because no such order is supported by both the
      // current instructions for use and every approved local protocol.
      const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
      if (!lesson) throw new Error(`No guided lesson for ${scenarioId}`)
      const actions = lesson.steps.flatMap((step) => step.actions)
      const correctIndex = actions.findIndex(
        (action) => action.type === 'CORRECT_FAULT' && action.fault === 'arterial-bubble',
      )
      const afterCorrection = actions.slice(correctIndex + 1)
      expect(afterCorrection.filter((action) => action.type === 'TOGGLE_CIRCUIT_CLAMP')).toEqual([])
    },
  )

  it('resumes atomically from the isolated, corrected state', () => {
    const frames = applyAll('arterial-bubble-stop', [
      ...advanceToEvent,
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'CORRECT_FAULT', fault: 'arterial-bubble' },
      { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
      { type: 'STEP' },
    ])
    const resumed = frames[frames.length - 2].state
    expect(resumed.circuit.drainageClampClosed).toBe(false)
    expect(resumed.circuit.returnClampClosed).toBe(false)
    expect(resumed.device.pumpRunning).toBe(true)
    expect(resumed.circuit.bubbleResetRequired).toBe(false)
    expect(resumed.circuit.arterialBubbleDetected).toBe(false)
    expect(resumed.scenario.criticalErrors).toEqual([])
    expect(
      framesAfterCorrection(frames).every((frame) => !bothLimbsOpenWithPumpStopped(frame.state)),
    ).toBe(true)
    expect(frames[frames.length - 1].state.circuit.bloodFlow).toBeGreaterThan(0)
  })

  it('refuses to resume before the air source has been corrected', () => {
    const frames = applyAll('arterial-bubble-stop', [
      ...advanceToEvent,
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
    ])
    const refused = frames[frames.length - 1].state
    expect(refused.scenario.criticalErrors).toContain('premature-bubble-reset')
    expect(refused.device.pumpRunning).toBe(false)
    expect(refused.circuit.returnClampClosed).toBe(true)
    expect(refused.circuit.drainageClampClosed).toBe(true)
  })

  it('refuses to open the last limb by hand while the bubble latch still holds the pump', () => {
    const frames = applyAll('arterial-bubble-stop', [
      ...advanceToEvent,
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'CORRECT_FAULT', fault: 'arterial-bubble' },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: false },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: false },
    ])
    const final = frames[frames.length - 1].state
    // The second open is refused rather than charged: nothing unsafe happened, and the state that
    // would have resulted is the one this invariant exists to prevent.
    expect(bothLimbsOpenWithPumpStopped(final)).toBe(false)
    expect(
      framesAfterCorrection(frames).every((frame) => !bothLimbsOpenWithPumpStopped(frame.state)),
    ).toBe(true)
  })

  it('still charges a premature unclamp before the air source is corrected', () => {
    const frames = applyAll('arterial-bubble-stop', [
      ...advanceToEvent,
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: false },
    ])
    expect(frames[frames.length - 1].state.scenario.criticalErrors).toContain(
      'unsafe-unclamp-before-deair',
    )
  })

  it.each(BUBBLE_CASES)('%s resumes without an open, stopped intermediate state', (caseId) => {
    // The clinical cases open with the event already over — pump stopped, both limbs open, air in
    // the circuit. The learner isolates, de-airs, and then resumes; the prompted interventions are
    // credited by operating the real controls, exactly as a learner does.
    const scenario = clinicalPracticeScenarioById.get(caseId)
    if (!scenario) throw new Error(`No clinical case ${caseId}`)
    const prefix = caseId.startsWith('va-') ? 'va-' : ''

    const frames = applyAll(
      caseId,
      [
        { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
        { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
        { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: `${prefix}air-deair` },
        { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
        { type: 'STEP' },
      ],
      'guided',
    )

    const clearedAt = frames.findIndex((frame) => !frame.state.circuit.bubbleResetRequired)
    expect(clearedAt).toBeGreaterThan(0)
    expect(
      frames.slice(clearedAt).filter((frame) => bothLimbsOpenWithPumpStopped(frame.state)),
    ).toEqual([])

    const final = frames[frames.length - 1].state
    expect(final.device.pumpRunning).toBe(true)
    expect(final.circuit.bloodFlow).toBeGreaterThan(0)
    expect(final.scenario.criticalErrors).toEqual([])

    // Every required intervention was credited, so the case is completable through the new action.
    const applied = new Set(
      (final.scenario.clinical?.appliedInterventions ?? []).map((record) => record.interventionId),
    )
    for (const required of scenario.clinicalCase?.requiredInterventionIds ?? []) {
      expect(applied).toContain(required)
    }
  })
})
