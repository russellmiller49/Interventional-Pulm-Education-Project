import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpHub } from '@/features/cardiohelp-ecmo/components/CardiohelpHub'
import { cardiohelpEcmoPublicationStatus } from '@/features/cardiohelp-ecmo/content/deviceProfile'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'CARDIOHELP-i Adult VV & VA ECMO Learn & Practice Lab',
  description:
    cardiohelpEcmoPublicationStatus === 'published'
      ? 'Reviewed step-by-step learning and independent adult VV and peripheral VA ECMO console, circuit, sweep, pressure-reasoning, and troubleshooting practice.'
      : 'Unlisted testing version of the step-by-step adult VV and peripheral VA ECMO console, circuit, sweep, pressure-reasoning, and troubleshooting lab.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function CardiohelpEcmoPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CardiohelpHub locale={locale} />
}
