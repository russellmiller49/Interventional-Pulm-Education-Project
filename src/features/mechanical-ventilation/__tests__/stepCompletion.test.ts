/** When a Learn step counts as performed: one rule per kind of step, read from the lab. */
import { ventilationLearningExperiments } from '../content/learningExperiments'
import { ventilationStageLesson, type VentilationStageStep } from '../content/stageLessons'
import { breathOnsetAfter, ventilationStepPerformed } from '../content/stepCompletion'
import { createLabSession, learningLabReducer, type LabAction } from '../engine/learningLab'
import type { VentilationAction } from '../engine/types'

const engine = (action: VentilationAction): LabAction => ({ type: 'ENGINE', action })
const at = { enteredAtSeconds: 0 }
const step = (unitId: string, find: (step: VentilationStageStep) => boolean) =>
  ventilationStageLesson(unitId).steps.find(find)!

describe('ventilationStepPerformed', () => {
  it('counts a reading step as performed once it is opened', () => {
    const session = createLabSession('controls-and-goals', 'hamilton-c6')
    for (const kind of ['read', 'sort', 'explain'] as const)
      expect(
        ventilationStepPerformed(
          step('controls-and-goals', (item) => item.interaction.kind === kind),
          session,
          at,
        ),
      ).toBe(true)
    expect(
      ventilationStepPerformed(
        step('waveform-anatomy', (item) => item.interaction.kind === 'walk'),
        createLabSession('waveform-anatomy', 'hamilton-c6'),
        at,
      ),
    ).toBe(true)
  })

  it('counts a question once its answer is committed, for its own part only', () => {
    const question = step(
      'waveform-anatomy',
      (item) => item.interaction.kind === 'prediction' && item.interaction.round === 0,
    )
    const fresh = createLabSession('waveform-anatomy', 'hamilton-c6')
    expect(ventilationStepPerformed(question, fresh, at)).toBe(false)
    const committed = learningLabReducer(fresh, { type: 'COMMIT', choice: 1 })
    expect(ventilationStepPerformed(question, committed, at)).toBe(true)
    const transfer = step(
      'waveform-anatomy',
      (item) => item.interaction.kind === 'prediction' && item.interaction.round === 1,
    )
    expect(ventilationStepPerformed(transfer, committed, at)).toBe(false)
  })

  it('counts a simulator task once its result is captured, not when the change is merely made', () => {
    const task = step(
      'waveform-anatomy',
      (item) => item.interaction.kind === 'simulator-task' && item.interaction.round === 0,
    )
    let session = learningLabReducer(createLabSession('waveform-anatomy', 'hamilton-c6'), {
      type: 'START_EXPERIMENT',
    })
    session = learningLabReducer(
      session,
      engine({ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 60 }),
    )
    expect(ventilationStepPerformed(task, session, at)).toBe(false)
    session = learningLabReducer(session, { type: 'RUN_AND_CAPTURE' })
    expect(ventilationStepPerformed(task, session, at)).toBe(true)
  })

  it('counts Watch one breath when a breath begins after the step opened', () => {
    const watch: VentilationStageStep = {
      ...step('controls-and-goals', (item) => item.interaction.kind === 'read'),
      interaction: { kind: 'advance-breath' },
    }
    let session = createLabSession('controls-and-goals', 'hamilton-c6')
    session = learningLabReducer(session, engine({ type: 'SET_PAUSED', paused: true }))
    const opened = { enteredAtSeconds: session.simulation.simulationTime }
    expect(ventilationStepPerformed(watch, session, opened)).toBe(false)
    session = learningLabReducer(session, engine({ type: 'STEP_BREATH' }))
    expect(ventilationStepPerformed(watch, session, opened)).toBe(true)
    expect(breathOnsetAfter(session.simulation.waveforms, session.simulation.simulationTime)).toBe(
      false,
    )
  })

  it('covers every interaction a lesson builds', () => {
    for (const experiment of ventilationLearningExperiments)
      for (const item of ventilationStageLesson(experiment.unitId).steps)
        expect(typeof ventilationStepPerformed(item, createLabSession(experiment.unitId), at)).toBe(
          'boolean',
        )
  })
})
