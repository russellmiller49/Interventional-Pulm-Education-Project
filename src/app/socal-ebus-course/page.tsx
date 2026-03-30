import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'SoCal EBUS Course',
  description:
    'Launch the SoCal EBUS fellow-prep course with pretest, lectures, station mapping, knobology labs, and 3D anatomy inside the Interventional Pulmonology Collaborative.',
}

const courseHighlights = [
  'Pre-course baseline testing, lecture review, and a structured prep pathway for fellows.',
  'Station mapping, flashcards, and image-rich CT, bronchoscopy, and ultrasound correlation.',
  'Interactive knobology drills that teach gain, depth, Doppler, and image optimization.',
  'A linked 3D anatomy case viewer for airway, vessel, and nodal orientation practice.',
]

const embeddedCourseAppPath = '/socal-ebus-course/app/index.html'

export default function SoCalEbusCoursePage() {
  return (
    <div className="space-y-12 py-16">
      <section className="container space-y-6">
        <div className="space-y-3">
          <Badge
            variant="success"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Regional Training · EBUS
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">SoCal EBUS Course</h1>
          <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
            A dedicated fellows course now lives inside the main site, with the full prep experience
            available in one place: pretest, lecture review, knobology, station mapping, and a 3D
            anatomy lab.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={embeddedCourseAppPath} target="_blank" rel="noreferrer">
              Open Dedicated View
            </a>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/board-prep/lung-cancer-staging-and-linear-ebus">
              Pair With Board Review
            </Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
          <h2 className="text-lg font-semibold text-foreground">What&apos;s inside</h2>
          <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            {courseHighlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
          <iframe
            title="SoCal EBUS Course"
            src={embeddedCourseAppPath}
            className="h-[calc(100vh-12rem)] min-h-[780px] w-full bg-white"
          />
        </div>
      </section>
    </div>
  )
}
