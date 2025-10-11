import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'

const meta: Meta<typeof SectionHeader> = {
  title: 'Design System/Section Header',
  component: SectionHeader,
  tags: ['autodocs'],
  args: {
    eyebrow: 'Learning pathway',
    title: 'Rigid bronchoscopy mastery',
    description:
      'Combine hands-on simulation, debrief checklists, and asynchronous feedback from global mentors.',
    align: 'left',
  },
  argTypes: {
    align: {
      control: 'inline-radio',
      options: ['left', 'center'],
    },
  },
}

export default meta

type Story = StoryObj<typeof SectionHeader>

export const Playground: Story = {
  args: {
    actions: <Button size="sm">View outline</Button>,
  },
}

export const CenterAligned: Story = {
  args: {
    align: 'center',
    actions: (
      <div className="flex gap-3">
        <Button variant="outline" size="sm">
          Share
        </Button>
        <Button size="sm">Start module</Button>
      </div>
    ),
  },
}
