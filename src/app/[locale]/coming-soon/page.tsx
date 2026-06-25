import type { Metadata } from 'next'
import { Activity, Stethoscope, Telescope } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const roadmapSections = [
  {
    id: 'intro-pleural-disease',
    label: 'Pleural',
    title: 'Intro to Pleural Disease',
    description:
      'Foundational pleural disease course for effusion physiology, symptom framing, initial imaging, and procedure-ready decision points.',
    icon: Stethoscope,
  },
  {
    id: 'rigid-bronchoscopy-foundations',
    label: 'Airway',
    title: 'Rigid Bronchoscopy Foundations',
    description:
      'Core rigid bronchoscopy curriculum for indications, airway control, instrumentation, stents, debulking, and simulation lab preparation.',
    icon: Activity,
  },
  {
    id: 'intro-bronchoscopy',
    label: 'Bronchoscopy',
    title: 'Intro to Bronchoscopy',
    description:
      'Entry-level bronchoscopy module covering airway orientation, scope handling, safety basics, and early navigation habits.',
    icon: Telescope,
  },
] as const

const handoffMetadata: Metadata = {
  title: 'Coming Soon | Interventional Pulmonology Collaborative',
  description:
    'Preview upcoming modules for intro pleural disease, rigid bronchoscopy foundations, and intro bronchoscopy.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function ComingSoonPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-16 py-16">
          <section className="container space-y-6 text-center">
            <Badge
              variant="info"
              className="rounded-full px-4 py-1 text-xs uppercase tracking-[0.3em]"
            >
              Coming soon
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Upcoming modules</h1>
              <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
                The next launches focus on foundational pleural disease, rigid bronchoscopy, and
                early bronchoscopy training.
              </p>
            </div>
          </section>

          <section className="container grid gap-6 md:grid-cols-3">
            {roadmapSections.map((section) => {
              const Icon = section.icon

              return (
                <Card
                  key={section.id}
                  id={section.id}
                  className="border-border/60 bg-card/80 shadow-sm transition hover:shadow-lg"
                >
                  <CardHeader className="space-y-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-sky-600">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <Badge
                      variant="outline"
                      className="w-fit rounded-full uppercase tracking-[0.3em]"
                    >
                      {section.label}
                    </Badge>
                    <CardTitle className="text-xl font-semibold tracking-tight">
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground">
                    <p>{section.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </section>
        </div>
      }
    </HandoffContent>
  )
}
