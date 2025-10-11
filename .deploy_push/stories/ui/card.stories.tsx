import type { Meta, StoryObj } from '@storybook/react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof Card> = {
  title: 'Design System/Card',
  component: Card,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Card>

export const Overview: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <Badge variant="info" className="w-fit">
          Featured
        </Badge>
        <CardTitle>Navigational Bronchoscopy</CardTitle>
        <CardDescription>
          Simulation and learning module covering equipment setup, navigation planning, and hands-on
          practice scenarios.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
          <li>4K walkthrough videos with annotations</li>
          <li>Interactive checklist with saveable progress</li>
          <li>Reusable 3D airway model with printable inserts</li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button size="sm">Launch Module</Button>
        <Button variant="ghost" size="sm">
          View curriculum
        </Button>
      </CardFooter>
    </Card>
  ),
}
