'use client'

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const meta: Meta = {
  title: 'Design System/Navigation Primitives',
}

export default meta

type Story = StoryObj

export const TabsExample: Story = {
  render: () => {
    const [value, setValue] = useState('overview')
    return (
      <Tabs value={value} onValueChange={setValue} className="w-full max-w-2xl">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p className="text-sm text-muted-foreground">
            Quick snapshot of the module: estimated time commitment, recommended prerequisites, and
            expected outcomes for learners before entering the bronchoscopy suite.
          </p>
        </TabsContent>
        <TabsContent value="curriculum">
          <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
            <li>Pre-procedural assessment</li>
            <li>Therapeutic interventions with decision trees</li>
            <li>Post-procedure care pathways</li>
          </ul>
        </TabsContent>
        <TabsContent value="resources">
          <p className="text-sm text-muted-foreground">
            Reference articles, printable checklists, and videos curated by contributors across the
            Interventional Pulmonology community.
          </p>
        </TabsContent>
      </Tabs>
    )
  },
}

export const AccordionExample: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-full max-w-2xl space-y-3">
      <AccordionItem value="item-1">
        <AccordionTrigger>What equipment is required for this module?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            You&apos;ll need the printable airway phantom, a standard bronchoscopy tower, and the open-source
            analytics app. Suggested 3D printer settings are linked within the module guide.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Does the training support offline mode?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Yes. All core content can be cached locally, with progress syncing whenever an internet
            connection becomes available.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>How are learner outcomes measured?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Metrics focus on practical skill acquisition, adherence to safety checklists, and reflective
            assessments authored by clinical leads.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}
