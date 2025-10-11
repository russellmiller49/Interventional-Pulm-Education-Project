import type { Meta, StoryObj } from '@storybook/react'

import { Badge } from '@/components/ui/badge'

const meta: Meta<typeof Badge> = {
  title: 'Design System/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    children: 'Clinical Beta',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'success', 'info'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta

type Story = StoryObj<typeof Badge>

export const Playground: Story = {}

export const Palette: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="info">Information</Badge>
      <Badge variant="success">Validated</Badge>
      <Badge variant="destructive">Deprecated</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  ),
}
