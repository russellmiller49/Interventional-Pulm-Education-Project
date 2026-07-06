import type { Meta, StoryObj } from '@storybook/react'

import { DecisionScenario } from './DecisionScenario'
import type { DecisionScenario as DecisionScenarioType } from '../engine/types'

/**
 * Neutral demonstration scenario exercising branching, the timed default path,
 * the simulated vitals trend, and the debrief report card. Clinical modules
 * supply reviewed content; this is illustrative only.
 */
const demoScenario: DecisionScenarioType = {
  id: 'demo-desaturation',
  title: 'Intraprocedural desaturation (demo)',
  briefing:
    'A simulated case: during a procedure the monitored oxygen saturation begins to fall. Recognize and respond.',
  initialVitals: { spo2: 96, hr: 88, sbp: 124 },
  startNodeId: 'recognize',
  nodes: [
    {
      id: 'recognize',
      situation: 'SpO₂ is trending down. What is your first response?',
      decisionSeconds: 20,
      choices: [
        {
          id: 'increase-oxygen',
          label: 'Optimize oxygenation and confirm ventilation',
          feedback:
            'Addressing oxygenation and confirming ventilation first is the appropriate response.',
          isSafe: true,
          nextNodeId: 'stabilized',
        },
        {
          id: 'continue',
          label: 'Continue and reassess in a few minutes',
          feedback: 'Delaying response to a falling saturation allows avoidable deterioration.',
          isSafe: false,
          vitalsDelta: { spo2: -7, hr: 16 },
          nextNodeId: 'deteriorating',
        },
      ],
    },
    {
      id: 'deteriorating',
      situation: 'Saturation has fallen further. What now?',
      decisionSeconds: 15,
      choices: [
        {
          id: 'escalate',
          label: 'Pause, optimize oxygenation, and call for help',
          feedback: 'Pausing and escalating recovers the situation, though later than ideal.',
          isSafe: true,
          vitalsDelta: { spo2: 6 },
          nextNodeId: 'mixed-end',
        },
      ],
    },
    {
      id: 'stabilized',
      situation: 'Saturation recovers.',
      choices: [],
      terminal: {
        outcome: 'rescued',
        debrief: 'Prompt recognition and an oxygenation-first response prevented deterioration.',
        referenceIds: [],
      },
    },
    {
      id: 'mixed-end',
      situation: 'Saturation recovers after a delay.',
      choices: [],
      terminal: {
        outcome: 'mixed',
        debrief:
          'The situation was recovered, but a delayed first response allowed an avoidable dip.',
        referenceIds: [],
      },
    },
  ],
}

const meta: Meta<typeof DecisionScenario> = {
  title: 'Skill Lab/DecisionScenario',
  component: DecisionScenario,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof DecisionScenario>

export const Default: Story = {
  args: { scenario: demoScenario },
}
