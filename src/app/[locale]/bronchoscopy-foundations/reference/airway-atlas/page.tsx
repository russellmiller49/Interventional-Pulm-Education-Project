import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BronchoscopyFoundationsModuleFrame } from '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame'
import { AirwayStillAtlas } from '@/features/bronchoscopy-foundations/components/reference/AirwayStillAtlas'
import { BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF } from '@/features/bronchoscopy-foundations/content/routes'
import { Link } from '@/i18n/navigation'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Airway atlas · Bronchoscopy Foundations',
  description:
    'Endoscopic stills of the teaching airway, one per structure, captioned with the name the course uses.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BronchoscopyFoundationsAtlasPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BronchoscopyFoundationsModuleFrame
      locale={locale}
      activeHref={BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF}
    >
      <div
        className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8"
        data-atlas-landing
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Reference · airway atlas
        </p>
        <h1 className="text-3xl font-bold tracking-tight">The teaching airway, still by still</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          One endoscopic still per structure, from one annotated normal survey, in the order the
          course introduces them. Authored teaching media, pending review.{' '}
          <Link
            className="font-semibold text-primary"
            href={BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF}
          >
            Back to the reference
          </Link>
          .
        </p>
        <AirwayStillAtlas />
      </div>
    </BronchoscopyFoundationsModuleFrame>
  )
}
