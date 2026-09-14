import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import { CrrtOperationalTool } from '../components/CrrtOperationalTools'
import { crrtOperationalTasks } from '../content/operationalLessons'
import {
  createCrrtOperationalRun,
  crrtOperationalRunReducer,
  nextCrrtOperationalCommand,
} from '../operationalModel'
import {
  readProgress,
  createDefaultProgress,
  recordLessonCompletion,
  writeProgress,
} from '../engine/progress'

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
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const click = (name: string | RegExp) => fireEvent.click(button(name))
const observations = () => click('Review observations and continue')
function answer(name: RegExp) {
  fireEvent.click(screen.getByRole('radio', { name }))
  click('Check reasoning')
  click('Review feedback and continue')
}
beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/en/baxter-crrt/learn?lesson=crrt-fluid-liberation')
})

describe('rendered Batch B lessons', () => {
  it('requires recorded observations and a real numeric answer, retains a wrong first answer, and completes only after reviewed transfer', async () => {
    writeProgress(recordLessonCompletion(createDefaultProgress(), 'crrt-prescription-dosing'))
    const view = render(<BaxterCrrtLearn initialLessonId="crrt-fluid-liberation" />)
    await waitFor(() =>
      expect(screen.queryByText(/Prior completion retained/)).not.toBeInTheDocument(),
    )
    click('Continue')
    expect(button('Review observations and continue')).toBeDisabled()
    for (let h = 1; h <= 4; h++) click(`Record to ${h} hours`)
    expect(await axe(view.container)).toHaveNoViolations()
    observations()
    const input = screen.getByRole('textbox', { name: 'Signed whole-patient balance (mL)' })
    expect(button('Check recorded balance')).toBeDisabled()
    for (const value of ['NaN', 'Infinity', '']) {
      fireEvent.change(input, { target: { value } })
      fireEvent.submit(input.closest('form')!)
      expect(
        readProgress().learnTaskHistory?.some((e) => e.taskId === 'recorded-balance'),
      ).toBeFalsy()
      expect(button('Check recorded balance')).toBeDisabled()
    }
    expect(screen.queryByText(/Recorded balance:/)).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: '400' } })
    click('Check recorded balance')
    await waitFor(() =>
      expect(
        readProgress().learnTaskHistory?.find((e) => e.taskId === 'recorded-balance'),
      ).toMatchObject({
        response: 'balance:400',
        correct: false,
        feedbackDisplayed: true,
        reviewed: false,
        inputs: { simulationSeconds: 14400 },
      }),
    )
    expect(await axe(view.container)).toHaveNoViolations()
    expect(readProgress().completedLessonIds).not.toContain('crrt-fluid-liberation')
    click('Review feedback and continue')
    expect(screen.getByText('Not recorded in this chart')).toBeVisible()
    expect(screen.queryByText(/Recorded balance:/)).not.toBeInTheDocument()
    answer(/Report that exact balance is unavailable/)
    expect(screen.getByText(/Net-removal case · CRRT-10 · event 0 · clock 0h 00m/)).toBeVisible()
    click('Review patient tolerance')
    click('Review external intake and output')
    click('Apply the case net-removal adjustment')
    observations()
    click('Record 30 minutes')
    observations()
    answer(/Reassess net removal and all patient inputs/)
    click('Continue')
    fireEvent.click(
      screen.getByRole('radio', { name: /Reassess the original indication, native function/ }),
    )
    click('Check reasoning')
    expect(readProgress().completedLessonIds).not.toContain('crrt-fluid-liberation')
    click('Review feedback and continue')
    expect(readProgress().completedLessonIds).toEqual(
      expect.arrayContaining(['crrt-prescription-dosing', 'crrt-fluid-liberation']),
    )
    expect(
      readProgress().learnTaskHistory?.find((e) => e.taskId === 'recorded-balance'),
    ).toMatchObject({ response: 'balance:400', correct: false, reviewed: true })
    expect(readProgress().bestSafeScores).toEqual({})
    expect(readProgress().completedLessonIds).not.toContain('crrt-anticoagulation')
  })

  it('keeps the native hardware, alert/circuit and blank setup projections accessible', async () => {
    const lesson = crrtOperationalTasks['crrt-alarms-troubleshooting']!
    const view = render(
      <CrrtOperationalTool task={lesson[0]} onAction={() => {}} onReady={() => {}} />,
    )
    expect(await axe(view.container)).toHaveNoViolations()
    let run = createCrrtOperationalRun('access')
    for (let n = 0; n < 2; n++) {
      const command = nextCrrtOperationalCommand(run, 'alarm-arrival')!
      run = crrtOperationalRunReducer(run, 'alarm-arrival', { type: 'command', id: command.id })
    }
    view.rerender(
      <CrrtOperationalTool task={lesson[4]} run={run} onAction={() => {}} onReady={() => {}} />,
    )
    expect(await axe(view.container)).toHaveNoViolations()
    expect(screen.getByRole('region', { name: 'Canonical CRRT circuit' })).toHaveTextContent(
      'Circuit state: running',
    )
    expect(
      within(screen.getByRole('region', { name: 'Alert and cause record' })).getByText(
        /active cause/,
      ),
    ).toBeVisible()
    view.rerender(
      <CrrtOperationalTool
        task={lesson[1]}
        run={createCrrtOperationalRun('workflow')}
        onAction={() => {}}
        onReady={() => {}}
      />,
    )
    expect(await axe(view.container)).toHaveNoViolations()
    expect(screen.getByText('Applied blood flow').parentElement).toHaveTextContent('Unavailable')
    expect(screen.queryByText(/No patient model is connected/)).not.toBeInTheDocument()
  })
})
