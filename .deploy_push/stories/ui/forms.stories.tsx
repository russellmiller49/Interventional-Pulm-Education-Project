'use client'

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionHeader } from '@/components/ui/section-header'
import { Textarea } from '@/components/ui/textarea'

const meta: Meta = {
  title: 'Design System/Form Controls',
}

export default meta

type Story = StoryObj

export const Example: Story = {
  render: () => {
    const [setting, setSetting] = useState('research')
    const [notifications, setNotifications] = useState(true)

    return (
      <form className="mx-auto grid w-full max-w-xl gap-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <SectionHeader
          eyebrow="Team setup"
          title="Create a workspace"
          description="Invite collaborators and configure which track this workspace should focus on."
        />
        <Input placeholder="Workspace name" autoComplete="off" />
        <Textarea placeholder="Goals for this workspace" />
        <div className="space-y-2 text-sm">
          <label className="block font-medium text-foreground">Focus area</label>
          <Select value={setting} onValueChange={setSetting}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a track" />
            </SelectTrigger>
            <SelectContent>
              <SelectLabel>Clinical</SelectLabel>
              <SelectItem value="bronchoscopy">Bronchoscopy bootcamp</SelectItem>
              <SelectItem value="airway">Airway stenting practice</SelectItem>
              <SelectSeparator />
              <SelectLabel>Research & innovation</SelectLabel>
              <SelectItem value="research">AI assisted navigation</SelectItem>
              <SelectItem value="hardware">DIY hardware labs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">Access level</p>
          <RadioGroup
            value={notifications ? 'team' : 'private'}
            onValueChange={(value) => setNotifications(value === 'team')}
            className="flex flex-col gap-2"
          >
            <label className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
              <RadioGroupItem value="team" />
              <div>
                <p className="font-medium text-foreground">Team visibility</p>
                <p className="text-xs text-muted-foreground">
                  Share analytics and notes with invited collaborators automatically.
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
              <RadioGroupItem value="private" />
              <div>
                <p className="font-medium text-foreground">Private draft</p>
                <p className="text-xs text-muted-foreground">
                  Keep everything private while you iterate on early concepts.
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>
        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          <Checkbox
            checked={notifications}
            onCheckedChange={(value) => setNotifications(value === true)}
          />
          Send weekly summary to maintainers
        </label>
        <Button type="submit" className="w-full">
          Create workspace
        </Button>
      </form>
    )
  },
}
