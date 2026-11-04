import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { RepairLab } from '../components/RepairLab'
import { TodayScreen } from '../components/TodayScreen'
import { objectiveById } from '../content/objectives'
import { NAVIGATOR_STORAGE_KEY, parseRecord } from '../engine/record'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function stored() {
  return parseRecord(window.localStorage.getItem(NAVIGATOR_STORAGE_KEY))
}

/**
 * The lab, end to end on one objective: the diagnostic task leaks nothing before the commit,
 * writes one observation per committed task, routes a wrong answer to its wrong model in the
 * explanation, and closes the loop with a scheduled review once the idea has been demonstrated.
 */
describe('the repair lab', () => {
  const objective = objectiveById('ms-01')

  it('keeps rationales and the answer off the screen until the learner commits', () => {
    render(<RepairLab objectiveId="ms-01" mode="repair" />)
    const diagnose = objective.lab.diagnose
    if (diagnose.kind !== 'choice') throw new Error('expected a choice')
    expect(screen.getByText(diagnose.stem)).toBeInTheDocument()
    for (const option of diagnose.options) {
      expect(screen.queryByText(option.rationale)).not.toBeInTheDocument()
    }
    expect(screen.queryByText(diagnose.hint)).not.toBeInTheDocument()
    expect(screen.getByTestId('task-commit')).toBeDisabled()
  })

  it('records a hinted miss with its wrong model, explains that model, then demonstrates on a new task', () => {
    render(<RepairLab objectiveId="ms-01" mode="repair" />)
    const lab = screen.getByTestId('repair-lab')

    // Diagnose: take the hint, pick the midline-divide option, commit.
    fireEvent.click(screen.getByRole('button', { name: /show a hint/i }))
    expect(screen.getByTestId('task-hint')).toHaveTextContent(objective.lab.diagnose.hint)
    fireEvent.click(within(lab).getByRole('radio', { name: 'Station 4L' }))
    fireEvent.click(screen.getByLabelText('Fairly sure'))
    fireEvent.click(screen.getByTestId('task-commit'))
    expect(screen.getByRole('status')).toHaveTextContent('Not correct.')

    let record = stored()
    expect(record?.evidence).toHaveLength(1)
    expect(record?.evidence[0]).toMatchObject({
      objectiveId: 'ms-01',
      phase: 'diagnose',
      taskKind: 'choice',
      outcome: 'missed',
      confidence: 'fairly-sure',
      misconceptionId: 'ms-01.midline-divide',
    })

    // Explain: the matched wrong model is named.
    fireEvent.click(screen.getByTestId('task-continue'))
    expect(screen.getByTestId('explain-panel')).toHaveTextContent(objective.misconceptions[0].label)
    expect(screen.getByTestId('explain-panel')).toHaveTextContent(objective.lab.repair.principle)
    fireEvent.click(screen.getByTestId('explain-continue'))

    // Manipulate: predict correctly without a hint.
    const manipulate = objective.lab.repair.manipulate
    if (!manipulate) throw new Error('expected a manipulation')
    fireEvent.click(within(lab).getByRole('radio', { name: 'Station 4L' }))
    fireEvent.click(screen.getByTestId('task-commit'))
    expect(screen.getByRole('status')).toHaveTextContent('Correct.')
    fireEvent.click(screen.getByTestId('task-continue'))

    // Verify: the hotspot. Region letters, not station names, before the commit.
    expect(lab).toHaveAttribute('data-stage', 'verify')
    const regionOptions = screen.getAllByRole('radio')
    expect(regionOptions.some((node) => node.textContent?.includes('10R'))).toBe(false)
    fireEvent.click(screen.getByText('E', { selector: 'span' }).closest('button')!)
    fireEvent.click(screen.getByTestId('task-commit'))
    expect(screen.getByRole('status')).toHaveTextContent('Correct.')
    expect(screen.getByText('10R', { selector: 'span' })).toBeInTheDocument()

    record = stored()
    expect(record?.evidence.map((entry) => [entry.phase, entry.outcome])).toEqual([
      ['diagnose', 'missed'],
      ['manipulate', 'independent'],
      ['verify', 'independent'],
    ])
    // Demonstrated on two kinds (predict + hotspot), one a transfer → a review is scheduled.
    expect(record?.reviews['ms-01']?.stage).toBe(0)

    // Close the loop.
    fireEvent.click(screen.getByTestId('task-continue'))
    const close = screen.getByTestId('close-panel')
    expect(close).toHaveTextContent('repaired the idea')
    expect(close).toHaveTextContent(objective.lab.repair.distinction)
    expect(close).toHaveTextContent(/in 3 days/)
    expect(within(close).getByText('Demonstrated')).toBeInTheDocument()
  })

  it('does not schedule a review when the transfer task is missed', () => {
    render(<RepairLab objectiveId="pl-06" mode="repair" />)
    const diagnose = objectiveById('pl-06').lab.diagnose
    if (diagnose.kind !== 'choice') throw new Error('expected a choice')
    fireEvent.click(screen.getByRole('radio', { name: diagnose.options.find((option) => option.id === diagnose.answerId)!.label }))
    fireEvent.click(screen.getByTestId('task-commit'))
    fireEvent.click(screen.getByTestId('task-continue'))
    fireEvent.click(screen.getByTestId('explain-continue'))
    // Manipulate: pick the right answer.
    const manipulate = objectiveById('pl-06').lab.repair.manipulate!
    fireEvent.click(screen.getByRole('radio', { name: manipulate.options.find((option) => option.id === manipulate.answerId)!.label }))
    fireEvent.click(screen.getByTestId('task-commit'))
    fireEvent.click(screen.getByTestId('task-continue'))
    // Verify: miss on purpose.
    const verify = objectiveById('pl-06').lab.verify
    if (verify.kind !== 'predict') throw new Error('expected a prediction')
    fireEvent.click(screen.getByRole('radio', { name: verify.options.find((option) => option.id !== verify.answerId)!.label }))
    fireEvent.click(screen.getByTestId('task-commit'))
    expect(screen.getByRole('status')).toHaveTextContent('Not correct.')
    fireEvent.click(screen.getByTestId('task-continue'))
    expect(stored()?.reviews['pl-06']).toBeUndefined()
    expect(screen.getByTestId('close-panel')).toHaveTextContent('did not carry into the new case')
  })
})

describe('the Today screen', () => {
  it('asks for a goal first, then shows a recommendation with a readable reason', () => {
    render(<TodayScreen />)
    expect(screen.getByTestId('navigator-onboarding')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Fellowship learning/))
    fireEvent.click(screen.getByLabelText('5 minutes'))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(stored()?.profile).toEqual({ goal: 'fellowship', examDate: null, sessionMinutes: 5 })
    const card = screen.getByTestId('next-best-move')
    expect(card).toHaveTextContent('Next best move')
    expect(screen.getByTestId('next-move-rationale').textContent?.length).toBeGreaterThan(20)
    expect(within(card).getByRole('link', { name: /start the lab/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/board-navigator/lab?objective='),
    )
    // No pass-probability claim anywhere.
    expect(screen.queryByText(/chance of passing/i)).not.toBeInTheDocument()
  })
})
