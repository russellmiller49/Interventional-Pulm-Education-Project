import { fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'
import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { CrrtFoundationLesson } from '../components/CrrtFoundationLesson'
import { CrrtPressureLocalizationLab } from '../components/CrrtPressureLocalizationLab'
import { CrrtRapidDrillReview } from '../components/CrrtRapidDrillReview'
import { baxterCrrtCases } from '../content/completeCases'
import { crrtLearnTasks } from '../content/learnTasks'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY, createDefaultProgress } from '../engine/progress'
import { readCrrtSelfPacedProgress, recordCrrtVisit } from '../selfPacedProgress'
import {
  createCrrtLearnAttempt,
  crrtCurrentTaskIdentity,
  crrtLearnAttemptReducer,
} from '../learnController'
import type { RuntimeCrrtCase } from '../content/schema'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
function Player({ definition }: { definition: RuntimeCrrtCase }) {
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition: definition,
      experience: 'practice' as const,
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )
  return (
    <>
      <CrrtCasePlayer
        session={session}
        dispatch={dispatch}
        onRoleChange={() => {}}
        onReset={() => dispatch({ type: 'RESET' })}
      />
      <output data-testid="session-facts">
        {JSON.stringify({
          prediction: session.prediction,
          actions: session.performedInterventionIds,
          reassessment: session.reassessment,
          time: session.simulation.simulationTimeSeconds,
          delivery: session.simulation.device.deliveryState,
        })}
      </output>
    </>
  )
}
const facts = () => JSON.parse(screen.getByTestId('session-facts').textContent!)
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
beforeEach(() => window.localStorage.clear())

it.each(baxterCrrtCases.map((definition) => [definition.id, definition] as const))(
  '%s exposes teaching with no five-part form, grade or invented run',
  (_id, definition) => {
    const view = render(<Player definition={definition} />)
    expect(screen.queryByRole('combobox', { name: /Goal|Mechanism|Expected response/ })).toBeNull()
    const initial = facts()
    click('Explain this case')
    expect(screen.getByRole('region', { name: 'Worked example' })).toHaveTextContent(
      definition.hiddenMechanism.summary,
    )
    expect(screen.getByRole('region', { name: 'Worked example' })).not.toHaveTextContent(
      /The reviewer|option path/i,
    )
    expect(facts()).toEqual(initial)
    expect(facts()).toMatchObject({
      prediction: null,
      actions: [],
      reassessment: { committed: false },
      time: 0,
    })
    click('Reveal hint 1')
    expect(facts()).toEqual(initial)
    click('End run and review debrief')
    expect(screen.getByText('Supplied teaching path · worked example')).toBeInTheDocument()
    expect(screen.queryByText(/, completed/)).toBeNull()
    expect(screen.getByText('Debrief opened · no run performed')).toBeInTheDocument()
    expect(facts()).toEqual(initial)
    expect(view.container.textContent).not.toMatch(
      /\b(?:mastered|mastery|grade)\b|best score|minimum score|pass\/fail|percentage correct/i,
    )
    expect(window.localStorage).toHaveLength(0)
    click('Reset case')
    expect(facts()).toEqual(initial)
  },
)

it('keeps actual action prerequisites and delayed responses independent of questions', () => {
  render(<Player definition={baxterCrrtCases.find((item) => item.id === 'CRRT-01')!} />)
  const actions = screen
    .getByRole('heading', { name: 'Choose and sequence clinical actions' })
    .closest('section')!
  const articles = within(actions).getAllByRole('article')
  const adjustment = articles.find((article) =>
    article.textContent?.includes('Adjust machine fluid removal after assessment'),
  )!
  expect(within(adjustment).getByRole('button')).toBeDisabled()
  const assessment = articles.find((article) =>
    article.textContent?.includes('Complete the initial clinical assessment'),
  )!
  fireEvent.click(within(assessment).getByRole('button'))
  expect(within(adjustment).getByRole('button')).toBeEnabled()
  fireEvent.click(within(adjustment).getByRole('button'))
  expect(facts().prediction).toBeNull()
  expect(facts().actions).toHaveLength(2)
  expect(facts().time).toBe(0)
  click('+5 min')
  expect(facts().time).toBe(300)
  click('End run and review debrief')
  expect(
    screen.getByText(/^Debrief opened · \d+ recorded events? in this run$/),
  ).toBeInTheDocument()
  expect(screen.queryByText('Debrief opened · no run performed')).toBeNull()
})

it('does not treat opening and closing a device dialog as a performed run', () => {
  render(<Player definition={baxterCrrtCases.find((item) => item.id === 'CRRT-01')!} />)
  const initial = facts()
  click('Stop')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  click('Resume interface')
  expect(facts()).toEqual(initial)
  expect(
    screen.getByRole('group', { name: 'Select every reassessment you actually completed' }),
  ).toBeDisabled()
  click('End run and review debrief')
  expect(screen.getByText('Debrief opened · no run performed')).toBeInTheDocument()
})

it.each(Object.keys(crrtLearnTasks))(
  '%s permits continuation through every topic without manufacturing task evidence',
  (id) => {
    let state = createCrrtLearnAttempt(id as keyof typeof crrtLearnTasks, 'self-paced')
    const count = crrtLearnTasks[state.lessonId]!.length
    for (let i = 0; i < count; i++) {
      expect(state.taskIndex).toBe(i)
      state = crrtLearnAttemptReducer(state, {
        type: 'continue',
        identity: crrtCurrentTaskIdentity(state),
      })
      expect(state.evidence).toEqual([])
      expect(state.completedTaskIds).toEqual([])
      expect(state.run?.integrationPlan).toBeUndefined()
      expect(state.run?.session.prediction ?? null).toBeNull()
      expect(state.run?.session.performedInterventionIds ?? []).toEqual([])
    }
    expect(state.finished).toBe(true)
  },
)

it('offers explanation, wrong-answer feedback, retry, and navigation without writing answer history', () => {
  render(
    <CrrtFoundationLesson
      lessonId="crrt-indications-modality"
      onNavigate={() => {}}
      onRestart={() => {}}
    />,
  )
  click('Continue')
  click('Continue')
  click('Continue without this exercise')
  click('Show worked explanation')
  expect(screen.getByText('Worked explanation · no answer recorded.')).toBeVisible()
  expect(screen.queryByRole('radio', { checked: true })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: /Fluid removal alone/ }))
  click('Check reasoning')
  expect(screen.getByRole('status')).toHaveTextContent('Your choice is not the accepted answer')
  click('Try again')
  expect(screen.queryByRole('radio', { checked: true })).toBeNull()
  click('Continue without this exercise')
  expect(screen.getByRole('heading', { name: 'Apply again: a different fluid goal' })).toBeVisible()
  const raw = JSON.parse(localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!)
  expect(raw.attempts).toEqual({})
  expect(raw.bestSafeScores).toEqual({})
  expect(raw.learnTaskHistory).toBeUndefined()
  expect(raw.selfPaced.visitedLessonIds).toEqual(['crrt-indications-modality'])
})

it('reveals a pressure example without submitting directions or reporting an observation', () => {
  const committed = jest.fn(),
    completed = jest.fn()
  render(
    <CrrtPressureLocalizationLab
      onPredictionCommitted={committed}
      onCompletionEvidence={completed}
    />,
  )
  click('Show explanation')
  expect(screen.getAllByText('No prediction recorded')).toHaveLength(6)
  expect(committed).not.toHaveBeenCalled()
  expect(completed).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Review pressure comparison and continue' }),
  ).toBeDisabled()
})

it('reveals a rapid-drill example without an answer or cause-correction claim', () => {
  render(<CrrtRapidDrillReview />)
  click('Show worked safety example')
  expect(screen.getByText('No response chosen')).toBeVisible()
  click('Review: Verify that the cause is corrected')
  expect(screen.getByTestId('crrt-rapid-drill-review')).toHaveAttribute(
    'data-correction-verification',
    'not-reviewed',
  )
  expect(window.localStorage).toHaveLength(0)
})

it('extends only self-paced location/visits and preserves all legacy records, including unknown fields', () => {
  const legacy = {
    ...createDefaultProgress(),
    attempts: { historical: 2 },
    bestSafeScores: { historical: 99 },
    learnTaskHistory: [{ response: 'historical', correct: true }],
    futureRecord: { untouched: true },
  }
  localStorage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, JSON.stringify(legacy))
  expect(readCrrtSelfPacedProgress()).toEqual({ visitedLessonIds: [], visitedCaseIds: [] })
  expect(recordCrrtVisit({ section: 'practice', id: 'CRRT-18' })).toBe(true)
  const { selfPaced, ...after } = JSON.parse(
    localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!,
  )
  expect(after).toEqual(legacy)
  expect(selfPaced).toMatchObject({
    visitedLessonIds: [],
    visitedCaseIds: ['CRRT-18'],
    lastLocation: { section: 'practice', id: 'CRRT-18' },
  })
})
it.each(['not-json', '{"version":4,"attempts":{"future":3}}'])(
  'leaves unreadable or unsupported legacy storage untouched: %s',
  (raw) => {
    localStorage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, raw)
    expect(recordCrrtVisit({ section: 'practice', id: 'CRRT-01' })).toBe(false)
    expect(localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBe(raw)
  },
)
