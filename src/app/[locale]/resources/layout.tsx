import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'

import { ResourceTabsNav } from './resource-tabs-nav'

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background">
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="container py-10 md:py-12">
          <div className="max-w-3xl space-y-4">
            <Badge variant="info" className="rounded-full px-3 py-1">
              Resources
            </Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Resource library
              </h1>
              <p className="text-base leading-7 text-muted-foreground md:text-lg">
                Practical teaching assets for interventional pulmonology educators, learners, and
                clinician-builders.
              </p>
            </div>
          </div>
          <ResourceTabsNav />
        </div>
      </section>
      {children}
    </div>
  )
}
