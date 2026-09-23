import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { useReducer } from 'react'

import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { CrrtFoundationLesson } from '../components/CrrtFoundationLesson'
import { CrrtRapidDrillReview } from '../components/CrrtRapidDrillReview'
import { getBaxterCrrtCase } from '../content/completeCases'
import { baxterCrrtAdditionalCaseIds, baxterCrrtCoreCaseIds } from '../content/curriculum'
import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import { crrtLearnTasks } from '../content/learnTasks'
import { baxterCrrtRapidDrills } from '../content/rapidDrills'
import type { RuntimeCrrtCase } from '../content/schema'
import { getCrrtWorkedCaseExample } from '../content/workedCaseExamples'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY } from '../engine/progress'
import { selectCrrtWorkedRetiredIds } from '../workedCaseModel'

/**
 * CRRT-FELLOW-04 — F-06 and F-07. Optional application checks, drills and case action cards say
 * honestly what they are. Explanations stay available before an answer, retry and skip stay
 * open, and nothing is scored, counted, shuffled or gated. Where a surface asks for a decision,
 * its pre-choice wording no longer prints the answer.
 */

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

function progressRecord() {
  const raw = window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

function openFirstApplicationCheck() {
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
  expect(
    screen.getByRole('heading', { name: 'Apply: identify goals and constraints' }),
  ).toBeVisible()
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/en/baxter-crrt/learn')
})

describe('the 25 optional application checks (F-06)', () => {
  const items = BAXTER_CRRT_LEARN_LESSON_IDS.flatMap((lessonId) =>
    (crrtLearnTasks[lessonId] ?? [])
      .filter((task) => task.kind === 'question')
      .map((task) => ({ lessonId, task })),
  )

  it('keeps all 25 items, their options and their accepted answers exactly as authored', () => {
    expect(items).toHaveLength(25)
    const keys = items.map(({ lessonId, task }) => [
      `${lessonId}/${task.id}`,
      task.choices!.map((choice) => `${choice.id}${choice.correct ? '*' : ''}`).join(','),
    ])
    expect(Object.fromEntries(keys)).toMatchObject({
      'crrt-indications-modality/goals-case': 'fluid-only,two-goals*,most-mechanisms',
      'crrt-alarms-troubleshooting/alarm-transfer': 'restored,not-restored*',
      'crrt-fluid-liberation/missing-chart-data': 'zero-output,reconcile*',
      'crrt-pressure-profile-integration/case-localize':
        'filter-certain,return-resistance*,access-only,outflow-uncertain*',
      'crrt-pressure-profile-integration/case-plan': 'unsafe-flow,defer*,correct*',
    })
  })

  it('no instruction states an accepted answer above its question (Lesson 8 task 6)', () => {
    for (const { lessonId, task } of items) {
      for (const accepted of task.choices!.filter((choice) => choice.correct)) {
        expect({
          item: `${lessonId}/${task.id}`,
          leak: task.instruction.toLowerCase().includes(accepted.label.toLowerCase().slice(0, 24)),
        }).toEqual({ item: `${lessonId}/${task.id}`, leak: false })
      }
    }
    const plan = crrtLearnTasks['crrt-pressure-profile-integration']!.find(
      (task) => task.id === 'case-plan',
    )!
    // "The paused state" is the run's current state from the previous task; what leaked was the
    // accepted plan itself ("A continued pause for escalation is also supported…").
    expect(plan.instruction).not.toMatch(/continued pause|escalat/i)
    expect(plan.instruction).toMatch(/More than one plan can be supported/)
  })

  it('frames the check as an optional try and shows the worked explanation before any answer', () => {
    openFirstApplicationCheck()
    const check = screen.getByRole('region', { name: 'Application check' })
    expect(check).toHaveTextContent('Optional try')
    expect(check).toHaveTextContent('it shows the accepted answer')
    click('Show worked explanation')
    const worked = check.querySelector('[data-crrt-worked-explanation]')!
    expect(worked).toHaveTextContent('Worked explanation · no answer recorded.')
    expect(within(worked as HTMLElement).getAllByText('Accepted answer:')).toHaveLength(1)
    expect(within(worked as HTMLElement).getAllByText('Not accepted:')).toHaveLength(2)
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('states the outcome of a wrong answer, names the accepted answer, and allows retry', () => {
    openFirstApplicationCheck()
    expect(screen.getByRole('button', { name: 'Check reasoning' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /Fluid removal alone/ }))
    click('Check reasoning')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Your choice is not the accepted answer')
    expect(status).toHaveTextContent('You chose: Fluid removal alone')
    expect(within(status).getByText('Accepted answer')).toBeInTheDocument()
    expect(status).toHaveTextContent('Solute/acid-base support and fluid management')
    expect(within(status).getByText('How every option compares')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show worked explanation' })).toBeNull()

    click('Try again')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    expect(screen.getByRole('button', { name: 'Check reasoning' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /Solute\/acid-base support/ }))
    click('Check reasoning')
    expect(screen.getByRole('status')).toHaveTextContent('Your choice matches the accepted answer')
    expect(within(screen.getByRole('status')).queryByText('Accepted answer')).toBeNull()
  })

  it('lets the learner skip without answering, and records no answer, score or attempt', () => {
    openFirstApplicationCheck()
    click('Continue without this exercise')
    expect(
      screen.getByRole('heading', { name: 'Apply again: a different fluid goal' }),
    ).toBeVisible()
    const record = progressRecord()
    expect(record.attempts).toEqual({})
    expect(record.bestSafeScores).toEqual({})
    expect(record.learnTaskHistory).toBeUndefined()
    expect(record.completedLessonIds).toEqual([])
  })

  it('names both accepted answers when an item accepts more than one', () => {
    window.history.replaceState(
      {},
      '',
      '/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration',
    )
    render(<BaxterCrrtLearn initialLessonId="crrt-pressure-profile-integration" />)
    click('Review patient and treatment')
    click('Record the first 30 minutes')
    click('Review observations and continue')
    fireEvent.click(screen.getByRole('radio', { name: /The return region needs inspection/ }))
    click('Check reasoning')
    const status = document.querySelector('[data-crrt-question-feedback]') as HTMLElement
    expect(status).toHaveAttribute('role', 'status')
    expect(status).toHaveTextContent('Your choice is one of the accepted answers')
    const accepted = status.querySelector('[data-crrt-accepted-answers]') as HTMLElement
    expect(within(accepted).getAllByRole('listitem')).toHaveLength(2)
    expect(accepted).toHaveTextContent('Increased return-side resistance is plausible')
  })
})

describe('rapid drills say what they are (F-07)', () => {
  it('asks for a first response, matching its prompt, and prints no verdict before a choice', () => {
    render(<CrrtRapidDrillReview />)
    const drill = baxterCrrtRapidDrills[0]
    const legend = screen.getByText(
      'Optional try: choose a first response before the worked example',
    )
    expect(legend.tagName).toBe('LEGEND')
    expect(legend.textContent).not.toMatch(/cause/i)
    expect(drill.predictionPrompt).toMatch(/response/)
    for (const option of drill.predictionOptions) {
      expect(screen.queryByText(option.description)).not.toBeInTheDocument()
    }
    expect(screen.queryByText(/Safe path|Accepted alternative|Unsafe because/)).toBeNull()
  })

  it('keeps the authored option order and does not shuffle between renders', () => {
    const labels = () =>
      screen
        .getAllByRole('radio')
        .map((radio) => (radio.closest('label') as HTMLElement).textContent)
    const first = render(<CrrtRapidDrillReview />)
    const order = labels()
    expect(order).toEqual(baxterCrrtRapidDrills[0].predictionOptions.map((option) => option.label))
    first.unmount()
    render(<CrrtRapidDrillReview />)
    expect(labels()).toEqual(order)
  })

  it('is a worked safety example on a reveal-first path, with every verdict explained', () => {
    render(<CrrtRapidDrillReview />)
    const drill = baxterCrrtRapidDrills[0]
    click('Show worked safety example')
    expect(screen.getByRole('heading', { name: 'Worked safety example' })).toBeVisible()
    expect(screen.getByText('No response chosen')).toBeVisible()
    for (const option of drill.predictionOptions) {
      expect(screen.getByText(option.description)).toBeVisible()
    }
    expect(screen.getByText('Accepted first response')).toBeInTheDocument()
    expect(screen.getByText('Also accepted')).toBeInTheDocument()
  })

  it('gives an optional try its verdict in words, including an unsafe choice', () => {
    render(<CrrtRapidDrillReview />)
    const drill = baxterCrrtRapidDrills[0]
    const unsafe = drill.predictionOptions.find((option) => option.disposition === 'unsafe')!
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(unsafe.label, 'i') }))
    click('Check this response')
    const chosen = document.querySelector('[data-chosen-disposition]')!
    expect(chosen).toHaveAttribute('data-chosen-disposition', 'unsafe')
    expect(chosen).toHaveTextContent(`${unsafe.label} — Unsafe`)
    expect(screen.getByTestId('crrt-rapid-drill-review')).toHaveAttribute('data-scoring', 'none')
    expect(window.localStorage).toHaveLength(0)
  })

  it('says what Reset this drill clears, and clears only that', () => {
    render(<CrrtRapidDrillReview />)
    const reset = screen.getByRole('button', { name: 'Reset this drill' })
    expect(reset).toHaveAccessibleDescription(/for this drill only/)
    fireEvent.click(screen.getAllByRole('radio')[0])
    click('Check this response')
    expect(screen.getByRole('heading', { name: 'Worked safety example' })).toBeVisible()
    fireEvent.click(reset)
    expect(screen.queryByRole('heading', { name: 'Worked safety example' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Check this response' })).toBeDisabled()
  })
})

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
    <CrrtCasePlayer
      session={session}
      dispatch={dispatch}
      onRoleChange={() => {}}
      onReset={() => dispatch({ type: 'RESET' })}
    />
  )
}

describe('case action cards describe the action, not its verdict (F-07)', () => {
  const verdictWords =
    /\bunsafe\b|\baccepted\b|intentionally|for debriefing|\bdisabled\b|use this alternative|bypass(es)? a required/i
  const cases = [...baxterCrrtCoreCaseIds, ...baxterCrrtAdditionalCaseIds, 'CRRT-16'] as const

  it.each(cases)('%s: no visible card description prints a verdict before a choice', (caseId) => {
    const definition = getBaxterCrrtCase(caseId as never)
    const retired = selectCrrtWorkedRetiredIds(definition, getCrrtWorkedCaseExample(definition.id))
    for (const intervention of definition.interventions) {
      if (retired.interventionIds.has(intervention.id)) continue
      expect({ id: intervention.id, description: intervention.description }).not.toEqual(
        expect.objectContaining({ description: expect.stringMatching(verdictWords) }),
      )
    }
  })

  it('keeps each unsafe card’s own label, which names what is unsafe about it', () => {
    const labels = getBaxterCrrtCase('CRRT-08').interventions.map((i) => i.label)
    expect(labels).toContain('Connect first and plan to correct the mismatch later')
    expect(getBaxterCrrtCase('CRRT-13').interventions.map((i) => i.label)).toContain(
      'Increase BFR through unresolved access resistance',
    )
  })

  it('keeps the safety explanations free of build vocabulary in every case', () => {
    for (const caseId of cases) {
      const definition = getBaxterCrrtCase(caseId as never)
      const text = [
        ...definition.unsafeActions.map((u) => u.explanation),
        ...definition.criticalErrors.flatMap((e) => [e.label, e.explanation]),
      ].join(' ')
      expect({ caseId, text }).not.toEqual(
        expect.objectContaining({
          text: expect.stringMatching(
            /pending option|scoring|retained only as|critical-error option/i,
          ),
        }),
      )
    }
  })

  it('names the unsafe actions in Explain this case and says the list includes them', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-08')} />)
    const note = document.querySelector('[data-crrt-action-list-note]')
    expect(note).toHaveTextContent('This list includes actions this case treats as unsafe')
    click('Explain this case')
    const worked = screen.getByRole('region', { name: 'Worked example' })
    expect(within(worked).getByText('Actions this case treats as unsafe')).toBeInTheDocument()
    expect(worked).toHaveTextContent('Connect first and plan to correct the mismatch later')
    expect(worked).toHaveTextContent('It stays in the list so its consequences can be explored')
  })

  it('lists the unsafe actions a run did not perform in its debrief', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-01')} />)
    click('End run and review debrief')
    const safety = screen
      .getByRole('heading', { name: 'Safety review of this run' })
      .closest('section') as HTMLElement
    expect(safety).toHaveTextContent(
      'This run recorded none of the actions this case flags as unsafe',
    )
    expect(
      within(safety).getByText('Actions this case treats as unsafe that this run did not perform'),
    ).toBeInTheDocument()
    expect(safety).toHaveTextContent('Escalate removal without assessment or reassessment')
  })

  it('shows no list note where a worked example retires the unsafe card', () => {
    render(<Player definition={getBaxterCrrtCase('CRRT-05')} />)
    expect(document.querySelector('[data-crrt-action-list-note]')).toBeNull()
  })
})
