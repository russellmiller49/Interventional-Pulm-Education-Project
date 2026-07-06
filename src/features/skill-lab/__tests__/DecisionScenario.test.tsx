import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DecisionScenario } from '../components/DecisionScenario'
import type { DecisionScenario as DecisionScenarioType } from '../engine/types'

// recharts' ResponsiveContainer needs ResizeObserver, absent in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub

const scenario: DecisionScenarioType = {
  id: 'demo',
  title: 'Demo scenario',
  briefing: 'A simulated decision.',
  initialVitals: { spo2: 96, hr: 90, sbp: 120 },
  startNodeId: 'start',
  nodes: [
    {
      id: 'start',
      situation: 'Decide now.',
      choices: [
        {
          id: 'good',
          label: 'Take the safe action',
          feedback: 'Correct recognition and response.',
          isSafe: true,
          nextNodeId: 'win',
        },
        {
          id: 'bad',
          label: 'Delay and observe',
          feedback: 'Delay allows deterioration.',
          isSafe: false,
          vitalsDelta: { spo2: -10 },
          nextNodeId: 'lose',
        },
      ],
    },
    {
      id: 'win',
      situation: 'Stabilized.',
      choices: [],
      terminal: { outcome: 'rescued', debrief: 'You rescued the patient.', referenceIds: [] },
    },
    {
      id: 'lose',
      situation: 'Deteriorated.',
      choices: [],
      terminal: { outcome: 'harm', debrief: 'Preventable harm occurred.', referenceIds: [] },
    },
  ],
}

describe('DecisionScenario', () => {
  it('renders the briefing and the current situation with choices', () => {
    render(<DecisionScenario scenario={scenario} />)
    expect(screen.getByText('A simulated decision.')).toBeInTheDocument()
    expect(screen.getByText('Decide now.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take the safe action' })).toBeInTheDocument()
  })

  it('advances a safe choice to a rescued debrief and logs the decision', async () => {
    const user = userEvent.setup()
    render(<DecisionScenario scenario={scenario} />)

    await user.click(screen.getByRole('button', { name: 'Take the safe action' }))

    expect(screen.getByText(/Debrief: Rescued/)).toBeInTheDocument()
    expect(screen.getByText('You rescued the patient.')).toBeInTheDocument()
    // The decision-log report card replays the chosen action's feedback.
    expect(screen.getByText('Correct recognition and response.')).toBeInTheDocument()
  })

  it('advances an unsafe choice to a harm debrief', async () => {
    const user = userEvent.setup()
    render(<DecisionScenario scenario={scenario} />)

    await user.click(screen.getByRole('button', { name: 'Delay and observe' }))

    expect(screen.getByText(/Debrief: Preventable harm/)).toBeInTheDocument()
    expect(screen.getByText('Preventable harm occurred.')).toBeInTheDocument()
  })
})
