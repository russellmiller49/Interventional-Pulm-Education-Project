import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft } from 'lucide-react'

import { AirwayAnatomyLessonDynamic } from '@/components/airway-anatomy-lesson/AirwayAnatomyLessonDynamic'
import { Badge } from '@/components/ui/badge'
import { IntroBronchoscopyProgressToggle } from '@/features/intro-bronchoscopy/components/IntroBronchoscopyProgressToggle'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Airway Anatomy — Intro to Bronchoscopy',
  description:
    'Learn the tracheobronchial tree for bronchoscopy: trachea, carina, lobar and segmental bronchi (RB1–RB10, LB1–LB10) with an animated endoscopic survey, a labeled 3D model, and a self-check.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const learningObjectives = [
  'Name the trachea, main bronchi, bronchus intermedius, lobar bronchi, and all bronchopulmonary segments (RB1–RB10, LB1–LB10).',
  'Recognize the standard endoscopic landmarks and the clock-face orientation used at each branch point.',
  'Contrast right and left airway anatomy — lobes, segments, and the asymmetries that drive clinical patterns.',
  'Correlate a labeled 3D airway model with the flat branching diagram and the bronchoscopic view.',
]

export default function AirwayAnatomyIntroPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <section className="container space-y-6">
            <Link
              href={'/intro-bronchoscopy' as Route}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Intro to bronchoscopy modules
            </Link>

            <div className="space-y-3">
              <Badge
                variant="info"
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              >
                Intro bronchoscopy · Anatomy
              </Badge>
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
                Airway anatomy for bronchoscopy
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
                A foundational tour of the tracheobronchial tree for the flexible bronchoscopist:
                walk a normal airway survey, explore a labeled 3D model synced to a branching map,
                and test your recall of the segmental anatomy.
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">Learning objectives</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                {learningObjectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-muted-foreground">
              <span className="font-semibold text-foreground">Educational use only.</span> The
              diagrams and endoscopic views here are schematic teaching aids and normal-variant
              simplifications — they are not a substitute for procedural training, supervision, or a
              patient&apos;s own imaging. Segmental branching patterns vary between individuals.
            </p>
          </section>

          <section className="container">
            <AirwayAnatomyLessonDynamic />
          </section>

          <section className="container max-w-4xl">
            <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-card/70 p-4">
              <IntroBronchoscopyProgressToggle
                moduleId="airway-anatomy"
                section="learn"
                label="Mark anatomy learning"
              />
              <IntroBronchoscopyProgressToggle
                moduleId="airway-anatomy"
                section="practice"
                label="Mark anatomy practice"
              />
              <IntroBronchoscopyProgressToggle
                moduleId="airway-anatomy"
                section="assessment"
                label="Mark anatomy assessment"
              />
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
