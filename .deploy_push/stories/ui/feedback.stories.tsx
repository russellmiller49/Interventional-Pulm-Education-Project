'use client'

import type { Meta, StoryObj } from '@storybook/react'
import { Fragment } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const meta: Meta = {
  title: 'Design System/Feedback',
}

export default meta

type Story = StoryObj

export const TooltipAndToast: Story = {
  render: () => (
    <TooltipProvider>
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost">Hover for guidance</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Use this action to share anonymized bronchoscopy outcomes with the community.</p>
          </TooltipContent>
        </Tooltip>
        <Button
          onClick={() =>
            toast({
              title: 'Analytics exported',
              description: 'A JSON snapshot has been saved to your downloads folder.',
            })
          }
        >
          Trigger toast
        </Button>
      </div>
    </TooltipProvider>
  ),
}

export const CalloutVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <Callout title="Open education license">
        All simulation assets are shared under CC-BY so you can remix and translate for your own
        training programs.
      </Callout>
      <Callout variant="success" title="Contributors matched">
        12 clinicians have volunteered for the upcoming navigation lab. Coordinate scheduling in the
        contributors area.
      </Callout>
      <Callout variant="warning" title="Checklist update pending">
        Review the new sedation protocol before your next case. The workflow has been updated to
        include bedside ultrasound verification.
      </Callout>
    </div>
  ),
}

export const SkeletonStates: Story = {
  render: () => (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-36 w-full rounded-3xl" />
    </div>
  ),
}

export const KeyboardHint: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <span>Open global search</span>
      <span className="flex items-center gap-1 text-foreground">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
      <Badge variant="outline">Available soon</Badge>
    </div>
  ),
}
