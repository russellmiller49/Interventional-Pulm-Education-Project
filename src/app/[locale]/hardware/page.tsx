import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { HardwareSetupShell } from '@/components/scope-tracker/HardwareSetupShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Scope Tracker Hardware Setup',
  description:
    'Connect, calibrate, and test the universal bronchoscope scope tracker that drives the EBUS and bronchoscopy navigation simulators.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

const setupHighlights = [
  'Clip the two tracker modules onto a disposable bronchoscope — no scope modification, training use only.',
  'Runtime input is a standard USB HID gamepad: flexion, insertion depth, and roll in one synchronized stream.',
  'Calibration profiles are saved in this browser and picked up live by both simulators.',
  'Optional Web Serial diagnostics expose SQUAL surface quality, raw optical counts, zeroing, and wiper reminders.',
]

interface HardwarePageProps {
  params: Promise<{ locale: string }>
}

export default async function HardwarePage({ params }: HardwarePageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-12 py-16">
          <section className="container space-y-6">
            <div className="space-y-3">
              <Badge
                variant="info"
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              >
                Simulation · Hardware
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Scope Tracker Setup</h1>
              <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
                Set up the universal scope tracker: a clip-on, two-module controller that turns a
                real single-use bronchoscope into a three-degree-of-freedom input device for the
                simulators — thumb-lever flexion, insertion depth, and roll.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/bronch-navigation-trainer">Bronch Navigation Trainer</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/socal-ebus-course">SoCal EBUS Course</Link>
              </Button>
            </div>

            <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
              <h2 className="text-lg font-semibold text-foreground">How it works</h2>
              <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                {setupHighlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="container">
            <HardwareSetupShell />
          </section>
        </div>
      }
    </HandoffContent>
  )
}
