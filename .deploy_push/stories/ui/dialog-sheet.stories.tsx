'use client'

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const meta: Meta = {
  title: 'Design System/Overlay',
}

export default meta

type Story = StoryObj

export const DialogExample: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Schedule Lab Session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a wet lab slot</DialogTitle>
          <DialogDescription>
            Choose preferred dates and include required equipment so the operations team can
            prepare.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Preferred date
            <Input type="date" className="mt-1" />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Notes
            <Textarea
              className="mt-1"
              placeholder="List attending clinicians, learning goals, specimen preferences..."
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="submit">Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const SheetExample: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open progress summary</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[360px]">
        <SheetHeader>
          <SheetTitle>Bronchoscopy mastery</SheetTitle>
          <SheetDescription>
            Track current competency targets and outstanding practice sessions.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="font-semibold text-foreground">Next milestone</p>
            <p className="text-muted-foreground">
              Complete 3 supervised therapeutic interventions.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Recommended resources</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Airway stenting rehearsal checklist</li>
              <li>EBUS target identification mini quiz</li>
            </ul>
          </div>
        </div>
        <SheetFooter>
          <Button size="sm">Mark as reviewed</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}
