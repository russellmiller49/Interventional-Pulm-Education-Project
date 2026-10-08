import Link from 'next/link'
import type { Route } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { SIMULATOR_ABOUT_ID, simulatorPage } from '@/components/layout/simulator-page'
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
        <div className={simulatorPage.root}>
          {/* The simulator is a three-pane workspace, so its frame spans the window. */}
          <section className={simulatorPage.stage}>
            <div className={simulatorPage.header}>
              <div className={simulatorPage.identity}>
                <Badge
                  variant="info"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Development preview
                </Badge>
                <h1 className={simulatorPage.title}>EUS-B Simulator</h1>
              </div>
              <div className={simulatorPage.actions}>
                <a href={`#${SIMULATOR_ABOUT_ID}`} className={simulatorPage.aboutLink}>
                  What&apos;s inside
                </a>
                <Button asChild size="sm">
                  <a href={embedSrc} target="_blank" rel="noreferrer">
                    Open Dedicated View
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href={'/ebus-training' as Route}>Back to EBUS Training</Link>
                </Button>
              </div>
            </div>
            <div className={simulatorPage.frame}>
              <iframe
                title="EUS-B Simulator"
                src={embedSrc}
                suppressHydrationWarning
                className={`${simulatorPage.iframe} bg-slate-950`}
              />
            </div>
          </section>

          <section id={SIMULATOR_ABOUT_ID} className={simulatorPage.about}>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Drive the EBUS endoscope down the esophagus and into the proximal stomach. A simulated
              ultrasound image, the 3D anatomy and an endoscopic or CT view follow the scope, with
              calibrated views of the lymph node stations and landmarks reached from the esophagus
              and stomach.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              The images are simulated from one CT and its segmentation for anatomy teaching. They
              are not clinical images, and the teaching notes are a draft awaiting physician review.
            </p>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
