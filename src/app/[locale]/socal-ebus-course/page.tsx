import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CourseEmbedShell } from '@/components/socal-ebus/CourseEmbedShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { buildEmbeddedAppSrc, socalEbusCourseAppPath } from '@/lib/embedded-app-locale'

const handoffMetadata: Metadata = {
  title: 'Southern California EBUS Course Participant Portal',
  description:
    'Participant portal for the Southern California EBUS Course with lectures, surveys, tests, progress tracking, and course-specific materials.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const courseHighlights = [
  'Pre-course and post-course surveys and tests for registered course participants.',
  'Lecture review and course-specific progress tracking for the Southern California EBUS cohort.',
  'Participant access to the same EBUS training assets plus course-only sequencing.',
  'Course logistics, faculty materials, and completion workflow in one embedded portal.',
]

interface SoCalEbusCoursePageProps {
  params: Promise<{ locale: string }>
}

export default async function SoCalEbusCoursePage({ params }: SoCalEbusCoursePageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  const embeddedCourseSrc = buildEmbeddedAppSrc(socalEbusCourseAppPath, locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-12 py-16">
          <section className="container space-y-6">
            <div className="space-y-3">
              <Badge
                variant="success"
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              >
                Participant portal · Southern California EBUS Course
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Southern California EBUS Course
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
                This portal is for Southern California EBUS Course participants who need the lecture
                sequence, surveys, tests, progress tracking, and course-specific materials. General
                learners can use the EBUS Training and TNM-9 modules separately.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={embeddedCourseSrc} target="_blank" rel="noreferrer">
                  Open Dedicated View
                </a>
              </Button>
              <Button asChild variant="secondary">
                <Link href={'/ebus-training' as Route}>EBUS Training</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={'/tnm-9-staging' as Route}>TNM-9 Staging</Link>
              </Button>
            </div>

            <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">Participant portal contents</h2>
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
            <CourseEmbedShell locale={locale} />
          </section>
        </div>
      }
    </HandoffContent>
  )
}
