import { cleanup, fireEvent, screen } from '@testing-library/react'
import { bronchStageLesson } from '../content/stageLessons'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { nextIncompleteBronchSection } from '../content/pathwayResolver'
import { BRONCH_LEARN_VERSIONS } from '../content/lessonVersions'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
  isSectionCompleted,
  parseBronchRecord,
  withSectionCompleted,
} from '../engine/learnProgress'
import { createScopeState, reduceScope } from '../engine/scope/scopeReducer'
import { scopeGoalsMet } from '../engine/scope/scopeGoalEvaluation'
import { bronchStageReducer, emptyBronchStageSession } from '../engine/stageSession'
import {
  attributesText,
  clickPrimary,
  commitById,
  control,
  controlsFieldset,
  currentStepId,
  goalStates,
  installDom,
  keyedChoiceId,
  mountSection,
  nowPrimary,
  nowStatus,
  otherChoiceId,
  scannableText,
  settle,
} from '../test-support/stageHarness'
import {
  performFiveControlsLearn,
  performPilotStep,
  pilotButton,
} from '../test-support/fiveControlsLearnHarness'

jest.mock(
  '../components/scope/ScopePane',
  () => jest.requireActual('../test-support/ScopeTestDouble').scopePaneDouble,
)
jest.mock('../components/stage/scopeCaseLoader', () => ({
  loadStageScopeCase: () =>
    Promise.resolve(jest.requireActual('../test-support/teachingCase').teachingCase()),
}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})
const record = () => parseBronchRecord(localStorage.getItem(BRONCH_STORAGE_KEY))!

test('orientation and depth teaching precede answers; demonstrations do not earn learner completion', async () => {
  const { lesson } = await mountSection('five-controls')
  expect(screen.getByRole('heading', { name: 'What each hand does' })).toBeVisible()
  expect(screen.getByRole('img', { name: /Flexible bronchoscope:/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Steering and suction' }))
  expect(screen.getByRole('img', { name: /Angulation lever, suction control/ })).toBeVisible()
  expect(document.querySelector('[data-prediction-choices]')).toBeNull()
  clickPrimary()
  await settle()
  expect(screen.getByRole('heading', { name: 'Depth changes the distance' })).toBeVisible()
  clickPrimary() // demonstration advance
  expect(document.querySelector('[data-readout="depthMm"] dd')).toHaveTextContent('12 mm')
  expect(controlsFieldset()).toBeDisabled()
  clickPrimary() // demonstration withdraw
  expect(document.querySelector('[data-readout="depthMm"] dd')).toHaveTextContent('0 mm')
  expect(record().completedSectionIds).toEqual([])
  expect(record().firstAttempts).toEqual({})
  fireEvent.click(pilotButton('Replay the example'))
  fireEvent.click(pilotButton('Try with guidance'))
  expect(controlsFieldset()).not.toBeDisabled()
  expect(goalStates()).toEqual(['false'])
  expect(document.querySelector('[data-readout="depthMm"] dd')).toHaveTextContent('0 mm')
  fireEvent.click(control('advance'))
  fireEvent.click(control('advance'))
  expect(goalStates()).toEqual(['false'])
  expect(nowPrimary()).toBeNull()
  fireEvent.click(control('withdraw'))
  fireEvent.click(control('withdraw'))
  expect(goalStates()).toEqual(['true'])
  expect(currentStepId()).toBe(lesson.steps[1].id) // feedback never auto-advances
  clickPrimary()
  await settle()
  expect(document.querySelector('[data-pilot-cue]')).toBeNull()
  expect(goalStates()).toEqual(['false'])
})

test('the complete real pilot keeps a wrong first answer, allows retry and records guided completion v2', async () => {
  const { lesson } = await mountSection('five-controls')
  await performFiveControlsLearn(lesson, lesson.predictionStepIndex)
  const check = lesson.steps[lesson.predictionStepIndex]
  expect(document.querySelector('[data-pilot-teaching]')).toHaveAttribute(
    'data-pilot-teaching',
    'check',
  )
  const raw = `${scannableText()} ${attributesText()}`
  for (const denied of lesson.section.precommitDenyPatterns) expect(raw).not.toMatch(denied)
  const wrong = otherChoiceId(check)
  commitById(wrong)
  expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  expect(currentStepId()).toBe(check.id)
  const first = record().firstAttempts['five-controls-learn-v2:N03']
  expect(first.choiceId).toBe(wrong)
  fireEvent.click(pilotButton('Try this check again'))
  expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  commitById(keyedChoiceId(check))
  expect(record().firstAttempts['five-controls-learn-v2:N03']).toEqual(first)
  clickPrimary()
  await settle()
  for (const step of lesson.steps.slice(lesson.predictionStepIndex + 1, -1))
    await performPilotStep(step)
  expect(document.querySelector('[data-pilot-cue]')).toBeNull()
  expect(document.querySelector('[data-demonstration-caption]')).toBeNull()
  expect(record().completedSectionIds).toEqual([])
  fireEvent.click(control('advance')) // early depth is observed, not misdiagnosed grip/force
  expect(nowStatus()).toContain('advanced before centering')
  expect(nowPrimary()).toBeNull()
  fireEvent.click(pilotButton('Reset this attempt'))
  await performPilotStep(lesson.steps.at(-1)!) // no rotation needed for the changed target
  expect(isSectionCompleted(record(), 'five-controls')).toBe(true)
  expect(record().sectionVersions).toEqual(BRONCH_LEARN_VERSIONS)
  expect(record().sectionPerformance['five-controls-learn-v2']).toMatchObject({
    unaided: false,
    assistsUsed: ['guided-practice'],
  })
  expect(document.querySelector('[data-next-section]')).toHaveAttribute(
    'data-next-section',
    'branch-entry',
  )
  expect(controlsFieldset()).toBeDisabled()
  cleanup()
  await mountSection('five-controls')
  expect(currentStepId()).toBe(lesson.steps[0].id)
  expect(record().firstAttempts['five-controls-learn-v2:N03']).toEqual(first)
})

test('an unfinished reload and review preserve history without pretending to restore the task', async () => {
  const { lesson } = await mountSection('five-controls')
  await performFiveControlsLearn(lesson, 2)
  fireEvent.click(pilotButton('Back to Act'))
  expect(controlsFieldset()).toBeDisabled()
  expect(nowStatus()).toContain('looking back')
  clickPrimary()
  expect(currentStepId()).toBe(lesson.steps[2].id)
  cleanup()
  await mountSection('five-controls')
  expect(currentStepId()).toBe(lesson.steps[0].id)
  expect(record().completedSectionIds).toEqual([])
})

test('legacy completion remains historical and Start/Continue selects the revised pilot', () => {
  const legacy = { ...createEmptyBronchRecord(), completedSectionIds: [...BRONCH_SECTION_IDS] }
  legacy.sectionPerformance['five-controls'] = {
    inputModes: ['keyboard'],
    assistsUsed: [],
    unaided: true,
  }
  const loaded = parseBronchRecord(JSON.stringify(legacy))!
  expect(loaded.completedSectionIds).toContain('five-controls')
  expect(isSectionCompleted(loaded, 'five-controls')).toBe(false)
  expect(nextIncompleteBronchSection(loaded)?.section.id).toBe('five-controls')
  const current = withSectionCompleted(loaded, 'five-controls', {
    inputModes: ['pointer'],
    assistsUsed: ['guided-practice'],
    unaided: false,
  })
  expect(current.sectionPerformance['five-controls']).toEqual(
    legacy.sectionPerformance['five-controls'],
  )
  expect(nextIncompleteBronchSection(current)).toBeNull()
})

test('every worked demonstration ends with the actual modeled goal achieved, without creating a learner record', () => {
  for (const step of bronchStageLesson('five-controls').steps) {
    if (!step.learn?.demonstration || step.interaction.kind !== 'scope-task') continue
    const { view, goals } = step.interaction
    let state = createScopeState(view, null)
    for (const move of step.learn.demonstration)
      state = reduceScope(state, move.command, 'scripted', { view, scopeCase: null })
    expect(scopeGoalsMet(goals, state)).toBe(true)
    expect(state.inputModes).toEqual(['scripted'])
  }
  expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()
})

test('a requested transfer hint is disclosed as support and never upgrades the first check or completion', async () => {
  const { lesson } = await mountSection('five-controls')
  await performFiveControlsLearn(lesson, lesson.steps.length - 1)
  const first = record().firstAttempts
  fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }))
  expect(document.querySelector('[data-pilot-cue]')).toHaveTextContent('Compare the target')
  expect(record().completedSectionIds).toEqual([])
  await performPilotStep(lesson.steps.at(-1)!)
  expect(record().sectionPerformance['five-controls-learn-v2']).toMatchObject({
    unaided: false,
    assistsUsed: ['guided-practice', 'requested-hint'],
  })
  expect(record().firstAttempts).toEqual(first)
})

test('actual movement direction, zero travel, transfer geometry and scripted isolation are checked by the reducer', () => {
  const lesson = bronchStageLesson('five-controls')
  const step = lesson.steps[1]
  if (step.interaction.kind !== 'scope-task') throw new Error('depth task missing')
  const { view, goals } = step.interaction
  const context = { view, scopeCase: null }
  let state = createScopeState(view, null)
  state = reduceScope(state, { type: 'advance', mm: 0 }, 'keyboard', context)
  expect(state.events).not.toContain('advanced')
  state = reduceScope(state, { type: 'advance', mm: 8 }, 'keyboard', context)
  state = reduceScope(state, { type: 'advance', mm: 8 }, 'keyboard', context)
  expect(scopeGoalsMet(goals, state)).toBe(false)
  state = reduceScope(state, { type: 'advance', mm: -16 }, 'keyboard', context)
  expect(scopeGoalsMet(goals, state)).toBe(true)
  const reducer = bronchStageReducer(lesson)
  let session = reducer(emptyBronchStageSession(), {
    type: 'SCOPE_INIT',
    stepId: step.id,
    view,
    scopeCase: null,
  })
  const before = session
  session = reducer(session, {
    type: 'SCOPE_COMMAND',
    stepId: step.id,
    view,
    scopeCase: null,
    inputMode: 'scripted',
    command: { type: 'advance', mm: 12 },
  })
  expect(session).toBe(before)
  expect(reducer(session, { type: 'FINISH' }).commitments.finished).toBe(false)
})
