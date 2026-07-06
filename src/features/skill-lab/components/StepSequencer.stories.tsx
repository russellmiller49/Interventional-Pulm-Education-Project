import type { Meta, StoryObj } from '@storybook/react'

import { StepSequencer } from './StepSequencer'
import type { StepSequence } from '../engine/types'

/**
 * Neutral demonstration sequence. Real modules author clinically reviewed
 * sequences; this fixture only exercises the ordering + grading UI.
 */
const demoSequence: StepSequence = {
  id: 'demo-timeout',
  title: 'Pre-procedure safety sequence',
  prompt: 'Order the pre-procedure safety checklist steps.',
  steps: [
    {
      id: 'confirm-consent',
      label: 'Confirm consent and correct patient',
      detail: 'Identity, procedure, and consent are verified first.',
    },
    {
      id: 'confirm-site',
      label: 'Confirm site and imaging',
      detail: 'Site marking and relevant imaging are reviewed before setup.',
    },
    {
      id: 'team-timeout',
      label: 'Perform team time-out',
      detail: 'The whole team pauses to agree on the plan.',
    },
    {
      id: 'confirm-equipment',
      label: 'Confirm equipment and monitoring ready',
      detail: 'Equipment, suction, and monitoring are checked last before starting.',
    },
  ],
  rationale:
    'A structured time-out confirms identity, site, and readiness in a fixed order so nothing is skipped under time pressure.',
}

const meta: Meta<typeof StepSequencer> = {
  title: 'Skill Lab/StepSequencer',
  component: StepSequencer,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof StepSequencer>

export const Default: Story = {
  args: { sequence: demoSequence },
}
