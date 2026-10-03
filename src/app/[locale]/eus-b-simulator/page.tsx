import Link from 'next/link'
import type { Route } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HandoffContent } from '@/i18n/handoff'
import { buildEmbeddedAppSrc, socalEusBSimulatorAppPath } from '@/lib/embedded-app-locale'

export default async function EusBSimulatorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // The simulator is a standalone entry of the embedded EBUS course build, opened the same way as
  // its other public training embeds.
  const embedSrc = buildEmbeddedAppSrc(socalEusBSimulatorAppPath, locale, {
    publicTraining: '1',
    publicScope: 'ebus',
  })

  return (
    <HandoffContent>
      {
        <div className="space-y-8 py-12">
          <section className="container space-y-5">
            <div className="max-w-4xl space-y-3">
              <Badge
                variant="info"
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              >
                Development preview
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">EUS-B Simulator</h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Drive the EBUS endoscope down the esophagus and into the proximal stomach. A
                simulated ultrasound image, the 3D anatomy and the CT follow the scope, with
                calibrated views of the lymph node stations and landmarks reached from the
                esophagus.
              </p>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                The images are simulated from one CT and its segmentation for anatomy teaching. They
                are not clinical images, and the teaching notes are a draft awaiting physician
                review.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={embedSrc} target="_blank" rel="noreferrer">
                  Open Dedicated View
                </a>
              </Button>
              <Button asChild variant="secondary">
                <Link href={'/ebus-training' as Route}>Back to EBUS Training</Link>
              </Button>
            </div>
          </section>

          <section className="container">
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
              <iframe
                title="EUS-B Simulator"
                src={embedSrc}
                suppressHydrationWarning
                className="h-[calc(100vh-6rem)] min-h-[900px] w-full bg-slate-950"
              />
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
