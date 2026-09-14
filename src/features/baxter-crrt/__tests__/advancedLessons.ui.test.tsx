import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import {
  readProgress,
  writeProgress,
  createDefaultProgress,
  recordLessonCompletion,
} from '../engine/progress'
import { CRRT_ADVANCED_VERSION } from '../content/advancedLessons'

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const answer = (name: RegExp) => {
  fireEvent.click(screen.getByRole('radio', { name }))
  click('Check reasoning')
  click('Review feedback and continue')
}
beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/en/baxter-crrt/learn?lesson=crrt-anticoagulation')
})
it('completes the actual citrate pathway after selections and reviewed applications, retaining a wrong first response', async () => {
  writeProgress(recordLessonCompletion(createDefaultProgress(), 'crrt-anticoagulation'))
  render(<BaxterCrrtLearn initialLessonId="crrt-anticoagulation" />)
  await waitFor(() => expect(screen.getByText(/Prior completion retained/)).toBeInTheDocument())
  expect(readProgress().learnTaskHistory ?? []).toHaveLength(0)
  click('Continue')
  expect(screen.getByRole('button', { name: 'Review observations and continue' })).toBeDisabled()
  for (const b of within(
    screen.getByRole('group', { name: 'Citrate path and sampling selection' }),
  ).getAllByRole('button'))
    fireEvent.click(b)
  click('Review observations and continue')
  expect(
    screen.queryByText(/Obtain correctly identified systemic information/),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /Patient calcium is adequate/ }))
  click('Check reasoning')
  await waitFor(() =>
    expect(
      readProgress().learnTaskHistory?.find((e) => e.taskId === 'sample-application')
        ?.feedbackDisplayed,
    ).toBe(true),
  )
  expect(
    readProgress().learnTaskHistory?.find((e) => e.taskId === 'sample-application')?.reviewed,
  ).toBe(false)
  click('Review feedback and continue')
  click('Continue')
  for (const b of within(
    screen.getByRole('group', { name: 'Citrate comparison categories' }),
  ).getAllByRole('button'))
    fireEvent.click(b)
  click('Review observations and continue')
  answer(/Conclude that circuit anticoagulation is insufficient/)
  answer(/Net alkali excess/)
  expect(screen.queryByText('Current lesson work recorded')).not.toBeInTheDocument()
  answer(/Assess patient and circuit/)
  expect(screen.getByText('Current lesson work recorded')).toBeInTheDocument()
  const history = readProgress().learnTaskHistory!
  expect(history).toHaveLength(6)
  expect(history.every((e) => e.contentVersion === CRRT_ADVANCED_VERSION && e.reviewed)).toBe(true)
  expect(history.find((e) => e.taskId === 'sample-application')).toMatchObject({
    response: 'systemic-safe',
    correct: false,
  })
  expect(history.find((e) => e.taskId === 'metabolic-application')).toMatchObject({
    response: 'circuit-dose',
    correct: false,
  })
  expect(readProgress().completedPracticeCaseIds).toEqual([])
  expect(readProgress().completedMasteryCapstoneIds).toEqual([])
  expect(readProgress().bestSafeScores).toEqual({})
  click('Repeat with a new attempt')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  expect(readProgress().learnTaskHistory).toEqual(history)
})

it.each(['correct', 'defer', 'unsafe-flow'] as const)(
  'runs the integrated %s path through actual controls with no initial diagnostic disclosure',
  async (plan) => {
    window.history.replaceState(
      {},
      '',
      '/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration',
    )
    const view = render(<BaxterCrrtLearn initialLessonId="crrt-pressure-profile-integration" />)
    expect(view.container.innerHTML).not.toMatch(
      /return-obstruction|High return pressure versus return disconnection|restriction is verified|reposition-access/,
    )
    click('Review patient and treatment')
    click('Record the first 30 minutes')
    expect(view.container.innerHTML).not.toMatch(
      /return-obstruction|restriction is verified|What produces it|Inspect the corresponding return/,
    )
    click('Review observations and continue')
    answer(
      plan === 'defer'
        ? /The return region needs inspection/
        : /Increased return-side resistance is plausible/,
    )
    answer(/Assess patient safety and inspect return tubing/)
    click('Record the selected circuit inspection')
    expect(
      screen.getByText(/Authored inspection: a return-region restriction is verified/),
    ).toBeInTheDocument()
    expect(screen.getByTestId('integration-state')).toHaveTextContent('Delivery: running')
    click('Pause modeled delivery')
    click('Record 10 minutes paused')
    click('Review observations and continue')
    answer(/Address the verified mechanical contributor/)
    answer(
      plan === 'defer'
        ? /Keep delivery paused and escalate/
        : plan === 'correct'
          ? /Apply the existing verified regional correction/
          : /Increase blood flow through the unresolved restriction/,
    )
    if (plan !== 'defer') {
      expect(
        screen.queryByRole('button', { name: 'Resume this corrected simulation' }),
      ).not.toBeInTheDocument()
      click('Apply the verified case correction')
      expect(screen.getByTestId('integration-state')).toHaveTextContent('Delivery: paused')
      click('Resume this corrected simulation')
    } else {
      expect(
        screen.queryByRole('button', { name: 'Apply the verified case correction' }),
      ).not.toBeInTheDocument()
    }
    click('Record to 1 hour')
    click('Review observations and continue')
    const field = screen.getByRole('textbox', { name: 'Signed whole-patient balance (mL)' })
    fireEvent.change(field, { target: { value: 'Infinity' } })
    fireEvent.submit(field.closest('form')!)
    expect(readProgress().learnTaskHistory?.some((e) => e.taskId === 'case-balance')).toBe(false)
    fireEvent.change(field, { target: { value: plan === 'defer' ? '150' : '133.3' } })
    click('Check recorded balance')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Recorded interruptions remain part of the patient ledger',
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('stopped hour')
    click('Review feedback and continue')
    if (plan !== 'defer') click('Record reassessment of this run')
    answer(/Report regional findings, actions/)
    expect(screen.queryByLabelText('Current run and recorded observations')).not.toBeInTheDocument()
    answer(/Retain the reported effluent total/)
    expect(screen.getByText('Current lesson work recorded')).toBeInTheDocument()
    const history = readProgress().learnTaskHistory!
    expect(history).toHaveLength(10)
    expect(history.find((e) => e.taskId === 'case-plan')).toMatchObject({
      response: plan,
      correct: plan !== 'unsafe-flow',
    })
    expect(history.find((e) => e.taskId === 'case-balance')).toMatchObject({
      correct: true,
      inputs: { downtimeSeconds: plan === 'defer' ? 1800 : 600, bloodFlowMlMin: 120 },
    })
    expect(readProgress().completedPracticeCaseIds).toEqual([])
    expect(readProgress().bestSafeScores).toEqual({})
  },
)

it('resets the whole capstone on history navigation and rejects stale callbacks while preserving first answers', async () => {
  window.history.replaceState(
    {},
    '',
    '/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration',
  )
  render(<BaxterCrrtLearn initialLessonId="crrt-pressure-profile-integration" />)
  click('Review patient and treatment')
  click('Record the first 30 minutes')
  click('Review observations and continue')
  answer(/An isolated access-side limitation/)
  const history = readProgress().learnTaskHistory!
  fireEvent.change(screen.getByRole('combobox', { name: 'CRRT lesson' }), {
    target: { value: 'crrt-anticoagulation' },
  })
  window.history.replaceState(
    {},
    '',
    '/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration',
  )
  fireEvent.popState(window)
  expect(screen.getByRole('button', { name: 'Review patient and treatment' })).toBeInTheDocument()
  expect(screen.getByText(/clock 0h 00m/)).toBeInTheDocument()
  expect(readProgress().learnTaskHistory).toEqual(history)
  click('Restart lesson')
  expect(readProgress().learnTaskHistory).toEqual(history)
})
