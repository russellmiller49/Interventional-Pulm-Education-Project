import type { Meta, StoryObj } from '@storybook/react'
import { ArrowRightIcon } from '@radix-ui/react-icons'

import { Button } from '@/components/ui/button'

const meta: Meta<typeof Button> = {
  title: 'Design System/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'icon'],
    },
    elevated: {
      control: 'boolean',
    },
  },
  args: {
    children: 'Explore Tools',
  },
  parameters: {
    controls: {
      exclude: ['asChild'],
    },
    a11y: {
      element: '#storybook-root',
    },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: {
    variant: 'default',
  },
}

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
}

export const WithIcon: Story = {
  render: (args) => (
    <Button {...args}>
      <span>Continue</span>
      <ArrowRightIcon />
    </Button>
  ),
  args: {
    variant: 'secondary',
    elevated: true,
  },
}

export const IconButton: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="icon" aria-label="Create">
        <ArrowRightIcon />
      </Button>
      <span className="text-sm text-muted-foreground">Accessible icon-only button</span>
    </div>
  ),
  args: {
    size: 'icon',
  },
}
